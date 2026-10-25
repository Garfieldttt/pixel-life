// Top-down terrain in 16px tiles: grass, dense bushes, cobblestone paths,
// dirt, sand, water, wooden decks and cliffs, with seasonal palettes and
// hand-drawn looking edges between them.
import {mix} from './gfx.js';
import {INK, ramp} from './art.js';

export const TILE = 16;
export const T = {GRASS: 0, BUSH: 1, PATH: 2, DIRT: 3, SAND: 4, WATER: 5, DECK: 6, HIGH: 7, CLIFF: 8, STAIRS: 9, PLAZA: 10, TILLED: 11};
export const WALKABLE = new Set([T.GRASS, T.PATH, T.DIRT, T.SAND, T.DECK, T.STAIRS, T.PLAZA, T.TILLED]);

const hash = (x, y, s = 0) => ((((x + s * 131) * 73856093) ^ ((y - s * 71) * 19349663)) >>> 0) % 1000;

const GRASS = {
    spring: [0x1e4a2a, 0x2c6a30, 0x3e8c34, 0x5aac3e, 0x86cc52],
    summer: [0x163e26, 0x24602c, 0x347e30, 0x4c9c38, 0x76bc48],
    autumn: [0x3a3a1e, 0x5a5a26, 0x7a7a2e, 0x9e9436, 0xc4b04c],
    winter: [0x8a9ac0, 0xb0c0dc, 0xd4e0f0, 0xeaf2fc, 0xffffff],
};
const BUSH = {
    spring: [0x123a20, 0x1e5a28, 0x2e7c30, 0x4a9e3a, 0x7ac450],
    summer: [0x0e3020, 0x1a4e26, 0x28702c, 0x3e9034, 0x66b444],
    autumn: [0x3a1e14, 0x6a3418, 0x9a5420, 0xc87a2a, 0xe8a83c],
    winter: [0x4a5a6a, 0x6a7a8a, 0x9aaabb, 0xd8e4f2, 0xffffff],
};
const BLOSSOM = {spring: [0xf8b0d0, 0xffd8e8], summer: [0xf0a0c8, 0xf8e080], autumn: [0xe86a30, 0xf8c040], winter: [0xffffff, 0xe8f0ff]};
const STONE = ramp(0xa8a090);
const DIRT = ramp(0xa8784a);
const SAND = ramp(0xe0c080);
const WOOD = ramp(0xa8703a);
const ROCK = [0x3a2018, 0x6a3a22, 0x9a5a30, 0xc07a3a, 0xe0a050];

export function grassRamp(season) {
    return GRASS[season];
}

export class Terrain {
    constructor(cols, rows, fill = T.GRASS) {
        this.cols = cols;
        this.rows = rows;
        this.t = new Uint8Array(cols * rows).fill(fill);
        this.seed = Math.floor(Math.random() * 1e6);
    }

    get(x, y) {
        if (x < 0 || y < 0 || x >= this.cols || y >= this.rows)
            return -1;
        return this.t[y * this.cols + x];
    }

    set(x, y, v) {
        if (x >= 0 && y >= 0 && x < this.cols && y < this.rows)
            this.t[y * this.cols + x] = v;
    }

    rect(x, y, w, h, v) {
        for (let yy = y; yy < y + h; yy++)
            for (let xx = x; xx < x + w; xx++)
                this.set(xx, yy, v);
    }

    walkable(x, y) {
        return WALKABLE.has(this.get(x, y));
    }

    render(g, env) {
        const season = env.weather.snowCover > 0.3 ? 'winter' : env.season;
        for (let ty = 0; ty < this.rows; ty++)
            for (let tx = 0; tx < this.cols; tx++)
                this._tile(g, tx, ty, season, env);
        // edges after all fills, so they can overlap neighbours
        for (let ty = 0; ty < this.rows; ty++)
            for (let tx = 0; tx < this.cols; tx++)
                this._edges(g, tx, ty, season);
    }

    _tile(g, tx, ty, season, env) {
        const x = tx * TILE, y = ty * TILE, s = this.seed;
        switch (this.get(tx, ty)) {
        case T.GRASS:
        case T.HIGH:
            grassTile(g, x, y, season, s);
            break;
        case T.BUSH:
            grassTile(g, x, y, season, s);
            break;
        case T.PATH:
        case T.PLAZA:
            cobbleTile(g, x, y, s, this.get(tx, ty) === T.PLAZA, season);
            break;
        case T.DIRT:
            dirtTile(g, x, y, s, season);
            break;
        case T.TILLED:
            tilledTile(g, x, y, s, season);
            break;
        case T.SAND:
            sandTile(g, x, y, s);
            break;
        case T.WATER:
            waterTile(g, x, y, s, this._shoreDist(tx, ty), env, season);
            break;
        case T.DECK:
            waterTile(g, x, y, s, 3, env, season);
            deckTile(g, x, y, s, this.get(tx - 1, ty) !== T.DECK, this.get(tx + 1, ty) !== T.DECK);
            break;
        case T.CLIFF:
            cliffTile(g, x, y, s, this.get(tx, ty - 1) !== T.CLIFF, this.get(tx, ty + 1) !== T.CLIFF);
            break;
        case T.STAIRS:
            stairsTile(g, x, y);
            break;
        }
    }

    _shoreDist(tx, ty) {
        for (let d = 1; d < 4; d++)
            for (let yy = -d; yy <= d; yy++)
                for (let xx = -d; xx <= d; xx++) {
                    const v = this.get(tx + xx, ty + yy);
                    if (v !== T.WATER && v !== T.DECK && v !== -1)
                        return d;
                }
        return 4;
    }

    _edges(g, tx, ty, season) {
        const v = this.get(tx, ty), x = tx * TILE, y = ty * TILE, s = this.seed;
        const G = GRASS[season];
        if (v === T.PATH || v === T.PLAZA || v === T.DIRT || v === T.TILLED) {
            // grass tufts creeping over the border
            const grassy = n => n === T.GRASS || n === T.BUSH || n === T.HIGH;
            const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            for (const [dx, dy] of sides) {
                if (!grassy(this.get(tx + dx, ty + dy)))
                    continue;
                for (let i = 0; i < TILE; i++) {
                    const depth = 1 + (hash(x + i * (dy ? 1 : 0), y + i * (dx ? 1 : 0), s + 5) % 3);
                    for (let k = 0; k < depth; k++) {
                        const px = dx === 0 ? x + i : dx < 0 ? x + k : x + TILE - 1 - k;
                        const py = dy === 0 ? y + i : dy < 0 ? y + k : y + TILE - 1 - k;
                        g.px(px, py, k === depth - 1 ? G[1] : G[2 + (hash(px, py, s) % 2)]);
                    }
                }
            }
        }
        if (v === T.WATER || v === T.DECK) {
            const land = n => n !== T.WATER && n !== T.DECK && n !== -1;
            const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            for (const [dx, dy] of sides) {
                const n = this.get(tx + dx, ty + dy);
                if (!land(n))
                    continue;
                const cliff = n === T.CLIFF;
                for (let i = 0; i < TILE; i++) {
                    const w = 3 + (hash(x + i, y + dx * 7 + dy * 3, s + 9) % 3);
                    for (let k = 0; k < w; k++) {
                        const px = dx === 0 ? x + i : dx < 0 ? x + k : x + TILE - 1 - k;
                        const py = dy === 0 ? y + i : dy < 0 ? y + k : y + TILE - 1 - k;
                        let c = k === w - 1 ? INK : cliff ? ROCK[1 + (k % 2)] : SAND[k < 2 ? 3 : 2];
                        if (season === 'winter' && k < w - 2 && !cliff)
                            c = 0xeef4ff;
                        g.px(px, py, c);
                    }
                }
            }
        }
        if (v === T.HIGH && this.get(tx, ty + 1) === T.CLIFF) {
            // grass lip hanging over the cliff
            for (let i = 0; i < TILE; i++) {
                const d = 2 + (hash(x + i, y, s + 3) % 3);
                g.rect(x + i, y + TILE - 1, 1, d, G[2]);
                g.px(x + i, y + TILE - 1 + d, INK);
            }
        }
    }
}

// ---------------- tile painters ----------------

export function grassTile(g, x, y, season, s) {
    const G = GRASS[season];
    g.rect(x, y, TILE, TILE, G[2]);
    for (let yy = 0; yy < TILE; yy++)
        for (let xx = 0; xx < TILE; xx++) {
            const h = hash(x + xx, y + yy, s);
            if (h < 70)
                g.px(x + xx, y + yy, G[1]);
            else if (h > 940)
                g.px(x + xx, y + yy, G[3]);
        }
    // blade tufts: light tip over a dark base
    for (let i = 0; i < 4; i++) {
        const h = hash(x + i * 5, y + i * 3, s + 1);
        const bx = x + (h % 14), by = y + 2 + (Math.floor(h / 14) % 12);
        g.px(bx, by, G[4]);
        g.px(bx + 1, by + 1, G[3]);
        g.px(bx - 1, by + 1, G[3]);
        g.rect(bx - 1, by + 2, 3, 1, G[1]);
    }
    if (season !== 'winter' && hash(x, y, s + 2) < 90) {
        const fx = x + 3 + hash(x, y, s + 4) % 10, fy = y + 3 + hash(x, y, s + 6) % 10;
        const c = [0xf8f0f0, 0xf8d848, 0xf090c0, 0xc8a0f8][hash(x, y, s + 8) % 4];
        g.px(fx, fy, c);
        g.px(fx + 1, fy, c);
        g.px(fx, fy + 1, c);
        g.px(fx + 1, fy + 1, 0xf8e070);
    }
}

// Dense leafy bush tile (drawn as an object in the world, see world.js).
export function bushClump(g, x, y, w, h, season, s, flowers = true) {
    const R = BUSH[season];
    const blobs = [];
    const n = Math.max(3, Math.floor(w * h / 60));
    for (let i = 0; i < n; i++) {
        const bx = x + 3 + (hash(i, x, s) % Math.max(1, w - 6)), by = y + 3 + (hash(i, y, s + 1) % Math.max(1, h - 6));
        blobs.push([bx, by, 4 + (hash(i, x + y, s + 2) % 3)]);
    }
    blobs.sort((a, b) => a[1] - b[1]);
    for (const [bx, by, r] of blobs)
        g.disc(bx, by, r + 1, INK);
    for (const [bx, by, r] of blobs) {
        g.disc(bx, by, r, R[1]);
        for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r * r)
                    continue;
                const v = (-dx * 0.6 - dy * 0.8) / r, hh = hash(bx + dx, by + dy, s);
                let k = v > 0.45 ? 3 : v > -0.1 ? 2 : 1;
                if (hh < 120)
                    k = Math.max(1, k - 1);
                else if (hh > 900)
                    k = Math.min(4, k + 1);
                g.px(bx + dx, by + dy, R[k]);
            }
    }
    if (flowers && season !== 'winter') {
        const B = BLOSSOM[season];
        for (let i = 0; i < w * h / 40; i++) {
            const fx = x + 2 + hash(i, 11, s + x) % Math.max(1, w - 4), fy = y + 2 + hash(i, 13, s + y) % Math.max(1, h - 4);
            g.px(fx, fy, B[0]);
            g.px(fx + 1, fy, B[1]);
        }
    }
}

function cobbleTile(g, x, y, s, plaza, season) {
    const R = plaza ? ramp(0xb8a890) : STONE;
    g.rect(x, y, TILE, TILE, R[0]);
    // irregular stones in a loose grid
    for (let cy = 0; cy < 3; cy++)
        for (let cx = 0; cx < 3; cx++) {
            const h = hash(x + cx * 7, y + cy * 11, s);
            const sx = x + cx * 5 + (h % 2), sy = y + cy * 5 + ((h >> 3) % 2);
            const w = 4 + (h % 2), hh = 4 + ((h >> 5) % 2);
            g.rect(sx + 1, sy, w - 2, hh, R[2]);
            g.rect(sx, sy + 1, w, hh - 2, R[2]);
            g.rect(sx + 1, sy, w - 2, 1, R[4]);
            g.px(sx, sy + 1, R[3]);
            g.rect(sx + 1, sy + hh - 1, w - 2, 1, R[1]);
            if (h % 7 === 0)
                g.px(sx + 2, sy + 2, R[3]);
        }
    if (season === 'winter')
        for (let i = 0; i < 6; i++)
            g.rect(x + hash(i, x, s) % 14, y + hash(i, y, s) % 14, 3, 2, 0xeef4ff);
    else if (hash(x, y, s + 3) < 200)
        g.px(x + hash(x, 1, s) % 16, y + hash(y, 2, s) % 16, GRASS[season][2]);
}

function dirtTile(g, x, y, s, season) {
    const R = season === 'winter' ? ramp(0xd8e0f0) : DIRT;
    g.rect(x, y, TILE, TILE, R[2]);
    for (let yy = 0; yy < TILE; yy++)
        for (let xx = 0; xx < TILE; xx++) {
            const h = hash(x + xx, y + yy, s + 4);
            if (h < 50)
                g.px(x + xx, y + yy, R[1]);
            else if (h > 960)
                g.px(x + xx, y + yy, R[3]);
        }
    if (hash(x, y, s) < 300) {
        const px = x + hash(x, 3, s) % 13, py = y + hash(y, 4, s) % 13;
        g.rect(px, py, 3, 2, R[1]);
        g.px(px, py, R[4]);
    }
}

function tilledTile(g, x, y, s, season) {
    const R = season === 'winter' ? ramp(0xd8e0f0) : ramp(0x7a4a2a);
    g.rect(x, y, TILE, TILE, R[1]);
    g.rect(x + 1, y + 1, TILE - 2, TILE - 2, R[2]);
    g.rect(x + 1, y + 1, TILE - 2, 1, R[3]);
    g.rect(x + 1, y + TILE - 2, TILE - 2, 1, R[0]);
    for (let i = 0; i < 5; i++)
        g.px(x + 2 + hash(i, x, s) % 12, y + 3 + hash(i, y, s) % 10, R[1]);
}

function sandTile(g, x, y, s) {
    g.rect(x, y, TILE, TILE, SAND[2]);
    for (let yy = 0; yy < TILE; yy++)
        for (let xx = 0; xx < TILE; xx++) {
            const h = hash(x + xx, y + yy, s + 7);
            if (h < 60)
                g.px(x + xx, y + yy, SAND[1]);
            else if (h > 960)
                g.px(x + xx, y + yy, SAND[4]);
        }
}

export const WATER = [0x0e1e5a, 0x16307a, 0x1e4aa0, 0x2a68c0, 0x58a0e0];

function waterTile(g, x, y, s, dist, env, season) {
    const k = dist >= 3 ? 0 : dist === 2 ? 1 : 2;
    const deep = WATER[k + 1], shallow = WATER[k + 2];
    for (let yy = 0; yy < TILE; yy++)
        for (let xx = 0; xx < TILE; xx++) {
            const h = hash(x + xx, y + yy, s + 11);
            g.px(x + xx, y + yy, h < 140 ? deep : h > 930 ? shallow : mix(deep, shallow, 0.35));
        }
    if (season === 'winter' && env.weather.snowCover > 0.6 && dist <= 1)
        g.rect(x, y, TILE, TILE, 0xc8dcf0);
}

function deckTile(g, x, y, s, leftEnd, rightEnd) {
    g.rect(x, y + 1, TILE, TILE - 2, WOOD[2]);
    for (let py = y + 1; py < y + TILE - 1; py += 5) {
        g.rect(x, py, TILE, 1, WOOD[3]);
        g.rect(x, py + 4, TILE, 1, WOOD[0]);
        g.px(x + 2 + hash(x, py, s) % 12, py + 2, WOOD[1]);
    }
    g.rect(x, y, TILE, 1, INK);
    g.rect(x, y + TILE - 1, TILE, 1, INK);
    // posts into the water
    if (leftEnd || hash(x, y, s) % 3 === 0) {
        g.rect(x, y + TILE - 2, 3, 4, INK);
        g.rect(x + 1, y + TILE - 1, 1, 2, WOOD[1]);
    }
    if (rightEnd) {
        g.rect(x + TILE - 3, y + TILE - 2, 3, 4, INK);
        g.rect(x + TILE - 2, y + TILE - 1, 1, 2, WOOD[1]);
    }
}

function cliffTile(g, x, y, s, top, bottom) {
    g.rect(x, y, TILE, TILE, ROCK[2]);
    for (let yy = 0; yy < TILE; yy++)
        for (let xx = 0; xx < TILE; xx++) {
            const h = hash(x + xx, y + yy, s + 13);
            const band = (yy + (hash(x + xx, 0, s) % 4)) % 6;
            let c = band === 0 ? ROCK[1] : band === 1 ? ROCK[3] : ROCK[2];
            if (h < 60)
                c = ROCK[1];
            else if (h > 970)
                c = ROCK[4];
            g.px(x + xx, y + yy, c);
        }
    // vertical cracks
    for (let i = 0; i < 2; i++) {
        const cx = x + 3 + hash(x, y + i, s) % 10;
        g.rect(cx, y + 2 + i * 6, 1, 4, ROCK[0]);
    }
    if (top)
        g.rect(x, y, TILE, 2, ROCK[1]);
    if (bottom) {
        g.rect(x, y + TILE - 2, TILE, 2, ROCK[0]);
        g.rect(x, y + TILE - 1, TILE, 1, INK);
    }
}

function stairsTile(g, x, y) {
    const R = ramp(0xb0a490);
    g.rect(x, y, TILE, TILE, R[1]);
    for (let i = 0; i < 4; i++) {
        g.rect(x + 1, y + i * 4, TILE - 2, 3, R[2]);
        g.rect(x + 1, y + i * 4, TILE - 2, 1, R[4]);
    }
    g.rect(x, y, 1, TILE, INK);
    g.rect(x + TILE - 1, y, 1, TILE, INK);
}
