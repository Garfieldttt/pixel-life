// Base for top-down scenes: a tile terrain plus objects baked into one
// static layer. Walkers are drawn over it in depth order, and objects in
// front of a walker are copied back from the lit layer, so people
// disappear behind trees and houses. Trees (sway) are kept as sprites as
// well, so they can lean in the wind.
import {Terrain, TILE, T} from './terrain.js';
import {leanOffsets} from './art.js';
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
    add(y, draw, hint, foot = null, occlude = true, sway = false) {
        const o = {y, draw, hint, occlude, sway, mask: null, box: null, sprite: null};
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
            this.layerBG = g.layer();
            this.scratch = g.layer();
        }
        const A = this.layerA, BG = this.layerBG, S = this.scratch, W = this.w;
        A.fill(0);
        g.into(A, () => this.terrain.render(g, env));
        g.into(A, () => this.renderGround(g, env));
        BG.set(A);
        this.objects.sort((a, b) => a.y - b.y);
        // each object goes through the scratch layer once to get its mask;
        // BG gets everything but the trees
        S.fill(0);
        for (const o of this.objects) {
            const sp = g.masked(o.sway ? null : A, S, o.hint, () => o.draw(g, env));
            o.box = sp && sp.box;
            o.mask = sp && sp.mask;
            o.sprite = o.sway ? sp : null;
            if (!sp)
                continue;
            if (o.sway) {
                g.into(A, () => g.drawSprite(sp));
                continue;
            }
            const [bx, by, bw, bh] = sp.box;
            for (let y = 0; y < bh; y++)
                for (let x = 0; x < bw; x++)
                    if (sp.mask[y * bw + x])
                        BG[(by + y) * W + bx + x] = A[(by + y) * W + bx + x];
        }
    }

    // Trees leaning in the wind: around each moving tree the screen is
    // rebuilt from the layer without trees, then every object there is
    // put back over it, back to front.
    sway(g, env) {
        const moving = [];
        for (const o of this.objects) {
            if (!o.sprite)
                continue;
            const [bx, , bw] = o.sprite.box;
            o.sprite.offs = leanOffsets(o.sprite, env.weather.lean(bx + bw / 2));
            if (o.sprite.offs)
                moving.push(o);
        }
        if (!moving.length)
            return;
        // overlapping crowns (the forest) merge into one area, so each
        // tree is drawn once
        const rects = [];
        for (const m of moving) {
            const [bx, by, bw, bh] = m.box;
            let r = [Math.max(0, bx - 8), Math.max(0, by), Math.min(this.w, bx + bw + 8), Math.min(this.h, by + bh)];
            for (let i = rects.length - 1; i >= 0; i--) {
                const q = rects[i];
                if (q[0] < r[2] && r[0] < q[2] && q[1] < r[3] && r[1] < q[3]) {
                    r = [Math.min(q[0], r[0]), Math.min(q[1], r[1]), Math.max(q[2], r[2]), Math.max(q[3], r[3])];
                    rects.splice(i, 1);
                    i = rects.length;
                }
            }
            rects.push(r);
        }
        const bg = g.litBuffer(this.layerBG), W = this.w, t = g.t;
        for (const [x1, y1, x2, y2] of rects) {
            for (let y = y1; y < y2; y++)
                t.set(bg.subarray(y * W + x1, y * W + x2), y * W + x1);
            this._redraw(g, bg, -Infinity, x1, y1, x2 - x1, y2 - y1);
        }
    }

    // objects standing in front of feetY over the box, back to front
    _redraw(g, bg, feetY, x, top, w, h) {
        for (const o of this.objects) {
            if (!o.box || o.y <= feetY)
                continue;
            const [bx, by, bw, bh] = o.box;
            if (bx > x + w || bx + bw < x || by > top + h || by + bh < top)
                continue;
            if (o.sprite)
                g.drawSprite(o.sprite, o.sprite.offs, [x, top, w, h]);
            else
                g.occlude(bg, o, x, top, w, h);
        }
    }

    // flat decorations drawn after the terrain, before objects
    renderGround() {}

    // Copy objects in front of (x..x+w, y-h..y, feet at y) back over a walker.
    occlude(g, x, top, w, h, feetY) {
        const bg = g.litBuffer(this.layerBG);
        for (const o of this.objects) {
            if (!o.occlude || !o.box || o.y <= feetY)
                continue;
            if (o.sprite)
                g.drawSprite(o.sprite, o.sprite.offs, [x, top, w, h]);
            else
                g.occlude(bg, o, x, top, w, h);
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
