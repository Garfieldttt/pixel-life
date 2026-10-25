// Base for top-down scenes: a tile terrain plus objects baked into one
// static layer. Walkers are drawn over it in depth order, and objects in
// front of a walker are copied back from the lit layer, so people
// disappear behind trees and houses.
import {Terrain, TILE, T} from './terrain.js';
import {Timers} from './timers.js';

const COST = {[T.PATH]: 1, [T.PLAZA]: 1, [T.DECK]: 1, [T.STAIRS]: 1, [T.GRASS]: 4, [T.DIRT]: 2, [T.SAND]: 3, [T.TILLED]: 6};

export class World {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.topDown = true;
        this.cols = Math.ceil(w / TILE);
        this.rows = Math.ceil(h / TILE);
        this.terrain = new Terrain(this.cols, this.rows);
        this.objects = [];
        this.blocked = new Uint8Array(this.cols * this.rows);
        this.timers = new Timers();
        this.layerA = null;
        this.horizon = 0;
        this.realT = 0;
    }

    // draw(g, env) paints the object with its base at y; hint = rough box
    // [x, y, w, h] it paints into; foot = tiles it blocks
    add(y, draw, hint, foot = null, occlude = true) {
        const o = {y, draw, hint, occlude, mask: null, box: null};
        this.objects.push(o);
        if (foot)
            for (let ty = foot[1]; ty < foot[1] + foot[3]; ty++)
                for (let tx = foot[0]; tx < foot[0] + foot[2]; tx++)
                    if (tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows)
                        this.blocked[ty * this.cols + tx] = 1;
        return o;
    }

    free(tx, ty) {
        return tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows && !this.blocked[ty * this.cols + tx];
    }

    walkable(tx, ty) {
        return this.free(tx, ty) && this.terrain.walkable(tx, ty);
    }

    renderStatic(g, env) {
        if (!this.layerA) {
            this.layerA = g.layer();
            this.scratch = g.layer();
        }
        const A = this.layerA, S = this.scratch, W = this.w, H = this.h;
        A.fill(0);
        g.into(A, () => this.terrain.render(g, env));
        g.into(A, () => this.renderGround(g, env));
        this.objects.sort((a, b) => a.y - b.y);
        // each object goes through the scratch layer once to get its mask
        S.fill(0);
        for (const o of this.objects) {
            g.into(S, () => o.draw(g, env));
            const [hx, hy, hw, hh] = o.hint;
            const sx1 = Math.max(0, Math.floor(hx) - 8), sx2 = Math.min(W, Math.ceil(hx + hw) + 8);
            const sy1 = Math.max(0, Math.floor(hy) - 8), sy2 = Math.min(H, Math.ceil(hy + hh) + 8);
            let x1 = W, y1 = H, x2 = -1, y2 = -1;
            for (let y = sy1; y < sy2; y++) {
                const row = y * W;
                let any = false;
                for (let x = sx1; x < sx2; x++) {
                    if (S[row + x]) {
                        any = true;
                        if (x < x1)
                            x1 = x;
                        if (x > x2)
                            x2 = x;
                    }
                }
                if (any) {
                    if (y < y1)
                        y1 = y;
                    y2 = y;
                }
            }
            if (x2 < 0) {
                o.box = null;
                continue;
            }

            const bw = x2 - x1 + 1, bh = y2 - y1 + 1;
            const mask = new Uint8Array(bw * bh);
            for (let y = y1; y <= y2; y++) {
                for (let x = x1; x <= x2; x++) {
                    const i = y * W + x, p = S[i];
                    if (p) {
                        A[i] = p;
                        mask[(y - y1) * bw + (x - x1)] = 1;
                        S[i] = 0;
                    }
                }
            }
            o.box = [x1, y1, bw, bh];
            o.mask = mask;
            for (let y = sy1; y < sy2; y++)
                S.fill(0, y * W + sx1, y * W + sx2);
        }
    }

    // flat decorations drawn after the terrain, before objects
    renderGround() {}

    // Copy objects in front of (x..x+w, y-h..y, feet at y) back over a walker.
    occlude(g, x, top, w, h, feetY) {
        const lit = g.litBuffer(this.layerA);
        if (!lit)
            return;
        const W = this.w, t = g.t;
        for (const o of this.objects) {
            if (!o.occlude || !o.box || o.y <= feetY)
                continue;
            const [bx, by, bw, bh] = o.box;
            if (bx > x + w || bx + bw < x || by > top + h || by + bh < top)
                continue;
            const x1 = Math.max(bx, Math.floor(x)), x2 = Math.min(bx + bw, Math.ceil(x + w));
            const y1 = Math.max(by, Math.floor(top)), y2 = Math.min(by + bh, Math.ceil(top + h));
            for (let yy = y1; yy < y2; yy++)
                for (let xx = x1; xx < x2; xx++)
                    if (o.mask[(yy - by) * bw + (xx - bx)])
                        t[yy * W + xx] = lit[yy * W + xx];
        }
    }

    // Cheapest tile path (paths preferred over grass), 4-neighbour Dijkstra.
    findPath(sx, sy, tx, ty) {
        const C = this.cols, N = C * this.rows;
        if (!this.walkable(tx, ty) && !(tx === sx && ty === sy))
            return null;
        const dist = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
        const start = sy * C + sx, goal = ty * C + tx;
        dist[start] = 0;
        const open = [start];
        while (open.length) {
            let bi = 0;
            for (let i = 1; i < open.length; i++)
                if (dist[open[i]] < dist[open[bi]])
                    bi = i;
            const cur = open[bi];
            open[bi] = open[open.length - 1];
            open.pop();
            if (cur === goal)
                break;
            const cx = cur % C, cy = (cur / C) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = cx + dx, ny = cy + dy;
                if (!this.walkable(nx, ny) && !(nx === tx && ny === ty))
                    continue;
                const ni = ny * C + nx;
                const nd = dist[cur] + (COST[this.terrain.get(nx, ny)] || 5);
                if (nd < dist[ni]) {
                    if (dist[ni] === Infinity)
                        open.push(ni);
                    dist[ni] = nd;
                    prev[ni] = cur;
                }
            }
        }
        if (prev[goal] < 0 && goal !== start)
            return null;
        const path = [];
        for (let c = goal; c !== start && c >= 0; c = prev[c])
            path.push([c % C, (c / C) | 0]);
        return path.reverse();
    }
}

export {TILE, T};
