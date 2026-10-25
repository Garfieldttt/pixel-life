// Countryside motif in the cozy pixel look: mountains, a village, the railway,
// and a farm with crops, animals, a pond and a country road.
import {rand, randi, chance, pick, weighted, clamp, steppedLevel} from './util.js';
import {mix, shadow, highlight} from './gfx.js';
import * as A from './art.js';
import {Household, Win} from './windows.js';
import {makePerson, drawPerson, makeDog, dogFigure, makeCat, catFigure} from './people.js';
import {makeVehicle, drawVehicle, vehicleLength} from './vehicles.js';
import {Cells, drawFigure} from './figure.js';
import {Timers} from './timers.js';

const INK = A.INK;
const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000;
const sh = (c, t = 0.3) => mix(c, 0x2a1040, t);
const hi = (c, t = 0.25) => mix(c, 0xfff4d0, t);
const FIELD = {
    spring: [0x88c858, 0x9ad060, 0x7ab848, 0xb8a060],
    summer: [0xe8c858, 0xd8b048, 0x78b048, 0xc8d060],
    autumn: [0xa87848, 0xc89a50, 0x8a6a40, 0xb0a050],
    winter: [0xe8eef8, 0xdce4f0, 0xe0e8f4, 0xd8e0ec],
};

// ---------------- animals ----------------

function buildAnimal(kind, a, b, pose) {
    let c;
    const aS = sh(a, 0.25), aH = hi(a, 0.3);
    if (kind === 'cow') {
        c = new Cells(32, 22);
        const lie = pose === 'lie', by = lie ? 9 : 4;
        c.rect(3, by, 21, 10, a);
        c.rect(3, by, 21, 1, aH);
        c.rect(4, by + 8, 19, 2, aS);
        c.rect(7, by + 2, 6, 4, b);
        c.rect(16, by + 1, 5, 3, b);
        c.rect(5, by + 6, 3, 2, b);
        c.rect(1, by + 1, 2, 7, a); // tail
        c.rect(0, by + 7, 2, 2, b);
        const hy = pose === 'graze' ? by + 6 : by - 3;
        c.rect(23, hy, 8, 8, a);
        c.rect(23, hy, 8, 1, aH);
        c.rect(27, hy + 5, 5, 3, 0xf0b8a8);
        c.set(30, hy + 6, sh(0xf0b8a8, 0.4));
        c.rect(27, hy + 2, 2, 2, INK);
        c.set(27, hy + 2, 0xffffff);
        c.rect(22, hy - 1, 2, 2, aS); // ear
        c.rect(25, hy - 2, 1, 2, 0xf0e8d8); // horn
        c.rect(29, hy - 2, 1, 2, 0xf0e8d8);
        if (!lie) {
            c.rect(14, by + 10, 4, 2, 0xf0b0b8); // udder
            const st = pose === 'walk1';
            for (const [lx, o] of [[4, st ? -1 : 0], [8, st ? 1 : 0], [16, st ? 1 : 0], [20, st ? -1 : 0]]) {
                c.rect(lx + o, by + 10, 3, 6, lx % 8 === 0 ? aS : a);
                c.rect(lx + o, by + 15, 3, 2, 0x3a2a24);
            }
        }
    } else if (kind === 'sheep') {
        c = new Cells(26, 18);
        const lie = pose === 'lie', by = lie ? 7 : 3;
        for (let i = 0; i < 6; i++)
            for (let j = 0; j < 3; j++) {
                const cx = 3 + i * 3, cy = by + j * 3;
                c.rect(cx, cy, 4, 4, j === 0 ? aH : j === 2 ? aS : a);
            }
        c.rect(3, by + 1, 18, 7, a);
        for (let i = 0; i < 6; i++)
            c.rect(4 + i * 3, by, 2, 1, aH);
        const hy = pose === 'graze' ? by + 5 : by;
        c.rect(19, hy, 6, 6, b);
        c.rect(20, hy - 1, 4, 2, aH);
        c.rect(22, hy + 2, 1, 2, INK);
        c.rect(18, hy + 1, 2, 2, sh(b, 0.2));
        if (!lie) {
            const st = pose === 'walk1';
            for (const [lx, o] of [[5, st ? -1 : 0], [9, 0], [14, st ? 1 : 0], [18, 0]])
                c.rect(lx + o, by + 8, 2, 6, b);
        }
    } else if (kind === 'chicken') {
        c = new Cells(13, 13);
        const peck = pose === 'graze';
        c.rect(1, 5, 8, 6, a);
        c.rect(1, 5, 8, 1, aH);
        c.rect(0, 3, 3, 4, a); // tail
        c.rect(3, 7, 4, 2, aS); // wing
        const hx = 7, hy = peck ? 6 : 1;
        c.rect(hx, hy, 4, 5, a);
        c.rect(hx + 1, hy - 1, 2, 1, 0xe03030);
        c.rect(hx + 4, hy + 2, 2, 1, 0xf0a020);
        c.set(hx + 3, hy + 1, INK);
        c.set(hx + 3, hy + 4, 0xe03030);
        c.rect(3, 11, 1, 2, 0xf0a020);
        c.rect(6, 11, 1, 2, 0xf0a020);
    } else if (kind === 'rabbit') {
        c = new Cells(14, 12);
        const up = pose === 'walk1';
        const by = up ? 4 : 5;
        c.rect(1, by, 8, 5, a);
        c.rect(1, by, 8, 1, aH);
        c.rect(0, by + 1, 2, 2, 0xf8f8f8);
        c.rect(7, by - 2, 5, 5, a);
        c.rect(8, by - 6, 2, 5, a);
        c.rect(10, by - 6, 2, 5, aS);
        c.set(8, by - 5, 0xf0b8b8);
        c.set(10, by - 1, INK);
        c.rect(2, by + 5, 3, 2, a);
        c.rect(7, by + 5, 2, 2, a);
    } else if (kind === 'deer') {
        c = new Cells(30, 30);
        c.rect(3, 10, 18, 8, a);
        c.rect(3, 10, 18, 1, aH);
        for (let i = 4; i < 18; i += 4)
            c.set(i, 12, 0xf0e0c8);
        c.rect(2, 9, 3, 3, 0xf8f4ec);
        c.rect(18, 3, 4, 9, a);
        c.rect(19, 0, 8, 6, a);
        c.rect(25, 3, 3, 2, sh(a, 0.3));
        c.set(23, 2, INK);
        c.rect(17, 0, 2, 3, aS);
        c.set(20, -1, 0x6a4a30);
        const st = pose === 'walk1';
        for (const [lx, o] of [[4, st ? -2 : 0], [7, st ? 2 : 0], [16, st ? 2 : 0], [19, st ? -2 : 0]])
            c.rect(lx + o, 18, 2, 10, lx % 2 ? aS : a);
    } else if (kind === 'fox') {
        c = new Cells(26, 14);
        c.rect(6, 4, 13, 6, a);
        c.rect(6, 4, 13, 1, aH);
        c.rect(8, 8, 10, 2, 0xf8f0e4);
        c.rect(18, 1, 7, 6, a);
        c.rect(22, 4, 3, 2, 0xf8f0e4);
        c.set(25, 4, INK);
        c.set(21, 2, INK);
        c.rect(18, -1, 2, 2, a);
        c.rect(22, -1, 2, 2, a);
        c.rect(0, 2, 7, 4, a); // bushy tail
        c.rect(0, 3, 2, 2, 0xf8f0e4);
        const st = pose === 'walk1';
        for (const [lx, o] of [[7, st ? -1 : 0], [10, st ? 1 : 0], [15, st ? 1 : 0], [18, st ? -1 : 0]])
            c.rect(lx + o, 10, 2, 4, 0x3a2a24);
    }
    return c.finish(INK);
}

const CACHE = new Map();
function animalFigure(kind, a, b, pose) {
    const key = `${kind}:${a}:${b}:${pose}`;
    let f = CACHE.get(key);
    if (!f) {
        f = buildAnimal(kind, a, b, pose);
        CACHE.set(key, f);
    }
    return f;
}

// ---------------- scene ----------------

export class Farm {
    constructor(w, h, env) {
        this.name = 'country';
        this.w = w;
        this.h = h;
        this.timers = new Timers();
        this.layout(env);
    }

    layout(env) {
        const W = this.w, H = this.h;
        this.horizon = Math.round(H * 0.42);
        this.railY = this.horizon + 26;
        this.meadowTop = this.railY + 4;
        this.G = Math.round(H * 0.7);
        this.roadTop = H - 16;
        this.roadY = H - 4;
        this.t = 0;
        this.eventTimer = rand(30, 90);
        this.flip = chance(0.5);
        const mx = (x, w) => (this.flip ? W - x - w : x);
        // mountains
        this.ridges = [0, 1].map(l => {
            const pts = [];
            let y = rand(0.3, 0.7);
            for (let x = 0; x <= W + 8; x += 6) {
                y = clamp(y + rand(-0.14, 0.14), 0.05, 1);
                pts.push(y);
            }
            for (let k = 0; k < 3; k++)
                for (let i = 1; i < pts.length - 1; i++)
                    pts[i] = (pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4;
            return {pts, h: l === 0 ? rand(80, 110) : rand(40, 60)};
        });
        // village on the hill
        const vx = randi(20, W - 180);
        this.village = [];
        for (let i = 0; i < randi(5, 8); i++)
            this.village.push({x: vx + i * randi(16, 22), w: randi(12, 16), h: randi(10, 14), roof: pick([0xa04838, 0x7a4a3a, 0x4a5a7a, 0x8a3a6a]), wall: pick([0xf0e0c0, 0xe8d0a8, 0xf4f0e4, 0xc8d8e8])});
        this.church = {x: vx + randi(40, 90), h: 40};
        this.fields = [];
        for (let fx = -randi(0, 40); fx < W; ) {
            const fw = randi(60, 130);
            this.fields.push({x: fx, w: fw, k: randi(0, 3), rows: chance(0.6)});
            fx += fw;
        }
        this.forest = [];
        for (let x = rand(0, 8); x < W; x += rand(7, 12))
            if (chance(0.6))
                this.forest.push({x, s: randi(8, 12), pine: chance(0.6), seed: randi(0, 1e6)});
        // farm
        const G = this.G;
        // buildings sized for people about 31px tall
        this.house = {x: mx(16, 130), w: 130, wallH: 62, roofH: 48};
        this.barn = {x: mx(158, 112), w: 112, h: 76};
        this.silo = {x: mx(282, 30), w: 30, h: 112};
        const hh = new Household();
        hh.kind = 'farmer';
        hh.wake = rand(5, 5.8);
        hh.sleep = rand(21, 22.5);
        hh.leave = 7;
        hh.back = 7;
        this.hh = hh;
        const fr = A.ramp(0x9a5a30);
        const wy = G - this.house.wallH + 14;
        this.wins = [
            new Win(this.house.x + 14, wy, 20, 26, hh, 'kitchen'),
            new Win(this.house.x + this.house.w - 34, wy, 20, 26, hh, 'living'),
            new Win(this.house.x + this.house.w / 2 - 9, G - this.house.wallH - 32, 18, 16, hh, 'bed'),
        ];
        for (const w of this.wins)
            w.frameR = fr;
        this.houseDoor = {x: this.house.x + this.house.w / 2 - 9, open: 0};
        // crops in front of the farm buildings
        const fieldW = Math.min(200, Math.floor(W * 0.32));
        // chickens, dog and farmer stay above this line
        this.yardFront = G + 13;
        this.field = {x: mx(96, fieldW), w: fieldW, y1: G + 14, y2: this.roadTop - 8, crops: pick(['pumpkin', 'cauliflower', 'corn', 'tomato', 'melon']), seed: randi(0, 1e6)};
        // pasture
        const pw = Math.min(220, Math.floor(W * 0.36));
        const px1 = Math.min(W - pw - 10, 330);
        this.pasture = {x1: mx(px1, pw), x2: mx(px1, pw) + pw, y1: G - 40, y2: G + 4};
        const pondW = Math.min(160, Math.floor(W * 0.14));
        this.pond = {x: this.flip ? 30 : W - pondW - 30, y: G + 18, w: pondW, h: 40};
        // the mill stands in the middle distance, big enough to read
        this.mill = {x: this.flip ? randi(70, Math.floor(W * 0.3)) : randi(Math.floor(W * 0.6), W - 80), y: Math.round(this.meadowTop + (G - 40 - this.meadowTop) * 0.75), k: 1.8, a: rand(6.28)};
        const blocked = (x, pad, y, up = 0) => [this.house, this.barn, this.silo].some(o => x > o.x - pad && x < o.x + o.w + pad && y > G - 170) ||
            (x > this.pasture.x1 - pad && x < this.pasture.x2 + pad && y > this.pasture.y1 - 30 && y < this.pasture.y2 + 36 + up) ||
            (x > this.field.x - pad && x < this.field.x + this.field.w + pad && y > this.field.y1 - 10) ||
            (x > this.pond.x - pad && x < this.pond.x + this.pond.w + pad && y > this.pond.y - 10 && y < this.pond.y + this.pond.h + 20) ||
            Math.abs(x - this.mill.x) < 40 + pad && y > this.mill.y - 110 && y < this.mill.y + 14 + up;
        // scattered trees with open meadow between them
        this.trees = [];
        // sized against the felled stumps: the trunk is about as thick as a
        // stump, so a tree stands three to four people tall
        for (let i = 0; i < W / 16; i++) {
            const x = randi(0, W), y = randi(this.meadowTop + 8, this.roadTop - 6);
            const far = (y - this.meadowTop) / (this.roadTop - this.meadowTop);
            const s = Math.round(36 + far * 20);
            // up: the crown must not hide the pasture or the mill behind it
            if (!blocked(x, s, y, s * 2.4) && !this.trees.some(t => Math.abs(t.x - x) < (t.s + s) * 1.3 && Math.abs(t.y - y) < 40))
                this.trees.push({x, y, s, seed: randi(0, 1e6), pine: chance(0.25)});
        }
        this.trees.sort((a, b) => a.y - b.y);
        this.bits = [];
        // mostly plants; rocks, stumps, hives and hay only now and then, so
        // the meadow does not look littered
        for (let i = 0; i < W / 24; i++) {
            const x = randi(4, W - 12), y = randi(this.meadowTop + 6, this.roadTop - 4);
            if (!blocked(x, 6, y))
                this.bits.push({x, y, kind: weighted([['flowers', 6], ['bush', 3], ['rock', 0.5], ['stump', 0.5], ['mushrooms', 0.8], ['beehive', 0.12], ['weeds', 3], ['hay', 0.12]]), seed: randi(0, 1e6)});
        }
        this.bits.sort((a, b) => a.y - b.y);
        // grass tufts that sway in the wind, on the open meadow only
        const spots = [];
        for (let i = 0; i < W * (this.roadTop - this.meadowTop) / 200; i++) {
            const x = randi(4, W - 4), y = randi(this.meadowTop + 10, this.roadTop - 3);
            if (!blocked(x, 4, y) && !this.trees.some(t => Math.abs(t.x - x) < t.s * 0.3 + 3 && Math.abs(t.y - y) < 4))
                spots.push([x, y]);
        }
        this.tufts = A.makeTufts(spots, randi(0, 1e6));
        // animals
        this.cows = [];
        this.sheep = [];
        for (let i = 0; i < randi(2, 3); i++)
            this.cows.push(this._animal('cow', pick([[0xf4f0e8, 0x2a2428], [0x8a5a3a, 0xf4f0e8], [0xd8a060, 0xf4f0e8]])));
        for (let i = 0; i < randi(2, 4); i++)
            this.sheep.push(this._animal('sheep', chance(0.85) ? [0xf4f0e8, 0x3a3030] : [0x5a4a4a, 0x2a2020]));
        this.chickens = [];
        for (let i = 0; i < randi(3, 6); i++)
            this.chickens.push({a: pick([0xf4f0e8, 0xc88a40, 0x8a5a3a]), x: this.house.x + rand(0, this.house.w + 60), y: G + rand(4, 12), dir: chance(0.5) ? 1 : -1, t: rand(5), state: 'walk', timer: rand(1, 4)});
        this.ducks = [];
        for (let i = 0; i < randi(2, 4); i++)
            this.ducks.push({x: this.pond.x + rand(14, this.pond.w - 20), y: this.pond.y + rand(8, this.pond.h - 6), dir: chance(0.5) ? 1 : -1, t: rand(5), baby: i > 1});
        this.dog = makeDog();
        this.dog.big = true;
        this.dogX = this.houseDoor.x + 30;
        this.dogDir = 1;
        this.cat = makeCat();
        this.wild = [];
        this.people = [];
        this.cars = [];
        this.train = null;
        this.trainTimer = rand(20, 120);
        this.smoke = [];
        this.flies = [];
        this.butterflies = [];
        this.fish = [];
        this.kite = null;
        this.farmer = null;
        this.owl = this.trees.length ? {tree: this.trees[Math.floor(this.trees.length / 2)], t: 0} : null;
        this.layerA = this.layerM = this.layerB = this.layerC = null;
    }

    _animal(kind, [a, b]) {
        const p = this.pasture;
        return {kind, a, b, x: rand(p.x1 + 8, p.x2 - 38), y: rand(p.y1 + 18, p.y2 - 2), dir: chance(0.5) ? 1 : -1, state: 'graze', timer: rand(2, 10), t: rand(5), lift: 0};
    }

    staticKey(env) {
        // each rebuild stalls a frame, so light and wetness only count once
        // they really changed
        this.darkLevel = steppedLevel(env.dark, this.darkLevel, 4);
        this.wetLevel = steppedLevel(env.weather.wet, this.wetLevel, 1);
        return [this.darkLevel, env.lampsOn ? 1 : 0, Math.round(env.weather.snowCover * 4), env.season, this.wetLevel].join(':');
    }

    renderStatic(g, env) {
        // A ground and far land, M meadow with the windmill, B farmyard, C
        // field and things in front of the yard; moving things and the
        // trees are drawn between them by depth
        if (!this.layerA)
            for (const k of ['layerA', 'layerM', 'layerB', 'layerC'])
                this[k] = g.layer();
        for (const k of ['layerA', 'layerM', 'layerB', 'layerC'])
            this[k].fill(0);
        g.into(this.layerA, () => this._drawFar(g, env));
        g.into(this.layerM, () => this._drawMeadow(g, env));
        g.into(this.layerB, () => this._drawFarm(g, env));
        g.into(this.layerC, () => this._drawFront(g, env));
        // trees are sprites drawn each frame right after their layer, so
        // they can lean in the wind
        this.scratch = this.scratch || g.layer();
        this.scratch.fill(0);
        for (const t of this.trees)
            t.sprite = g.masked(null, this.scratch, [t.x - t.s * 2, t.y - t.s * 3.3, t.s * 4, t.s * 3.3 + 6], () => this._tree(g, t, env));
    }

    // the trees with from <= y < to, back to front
    _drawTrees(g, env, from, to) {
        for (const t of this.trees)
            if (t.y >= from && t.y < to && t.sprite)
                g.drawSprite(t.sprite, A.leanOffsets(t.sprite, env.weather.lean(t.x)));
    }

    _snowy(env) {
        return env.weather.snowCover > 0.25;
    }

    _season(env) {
        return this._snowy(env) ? 'winter' : env.season;
    }

    _drawFar(g, env) {
        const W = this.w, hz = this.horizon, snow = this._snowy(env);
        this.ridges.forEach((r, l) => {
            const base = l === 0 ? mix(0x7a88b8, env.skyBottom, 0.45) : mix(0x6a9a7a, env.skyBottom, 0.3);
            const cap = mix(0xf8faff, env.skyBottom, 0.2);
            const lit = highlight(base, 0.12), dark = shadow(base, 0.12), haze = mix(base, env.skyBottom, 0.3);
            const topAt = x => {
                const i = Math.max(0, x) / 6, i0 = Math.floor(i), f = i - i0;
                const v = r.pts[i0] * (1 - f) + (r.pts[i0 + 1] ?? r.pts[i0]) * f;
                return [Math.floor(hz - v * r.h), v];
            };
            const capH = l === 0 ? (snow || env.season !== 'summer' ? 16 : 6) : (snow ? 8 : 0);
            for (let x = 0; x < W; x++) {
                const [top, v] = topAt(x);
                // slope over a few pixels, so faces are broad and not 6px stripes
                const slope = topAt(x + 12)[0] - topAt(x - 12)[0];
                const face = slope > 5 ? lit : slope < -5 ? dark : base;
                const depth = hz - top + 2;
                for (let y = 0; y < depth; y++) {
                    // haze grows towards the valley, dithered at the steps
                    const t = y / depth + ((x + y) % 2) * 0.06;
                    g.px(x, top + y, t > 0.8 ? haze : t > 0.62 ? mix(face, haze, 0.5) : face);
                }
                g.px(x, top, highlight(base, 0.3));
                if (capH && v > 0.45) {
                    // ragged snow line, lit and shaded like the rock below
                    const ch = Math.floor(capH * (v - 0.3)) + (hash(x >> 1, l + 9) % 3) - 1;
                    for (let y = 0; y < ch; y++)
                        g.px(x, top + y, slope < -5 ? mix(cap, base, 0.3) : y > ch - 2 ? mix(cap, base, 0.15) : cap);
                }
                // the near hills are wooded: little tree tops along the crest
                if (l === 1 && !snow && hash(x, 77) % 5 === 0) {
                    const tc = shadow(mix(0x3a7a4a, env.skyBottom, 0.3), 0.05);
                    g.rect(x - 1, top - 2, 3, 3, tc);
                    g.px(x, top - 3, tc);
                }
            }
        });
        const pal = FIELD[this._season(env)];
        for (const f of this.fields) {
            const c = pal[f.k];
            g.rect(f.x, hz, f.w, this.railY - hz, c);
            if (f.rows)
                for (let y = hz + 1; y < this.railY; y += 3)
                    g.rect(f.x, y, f.w, 1, shadow(c, 0.1));
            g.rect(f.x, hz, 1, this.railY - hz, shadow(c, 0.3));
        }
        for (const v of this.village) {
            const y = hz + 3, wall = mix(v.wall, env.skyBottom, 0.15), roof = snow ? 0xf0f4fc : mix(v.roof, env.skyBottom, 0.15);
            g.rect(v.x - 1, y - v.h - 1, v.w + 2, v.h + 1, mix(INK, env.skyBottom, 0.3));
            g.rect(v.x, y - v.h, v.w, v.h, wall);
            for (let i = 0; i < 6; i++)
                g.rect(v.x - 2 + i, y - v.h - 1 - i, v.w + 4 - i * 2, 1, roof);
            const lit = env.dark > 0.4 && hash(v.x, Math.floor(env.hour)) < 650;
            (lit ? g.rectE.bind(g) : g.rect.bind(g))(v.x + 3, y - v.h + 3, 3, 3, lit ? 0xffd890 : 0x4a5a7a);
        }
        const ch = this.church, cy = hz + 3, cw = mix(0xf4f0e4, env.skyBottom, 0.15), cr = mix(0x5a8a6a, env.skyBottom, 0.15);
        g.rect(ch.x, cy - ch.h, 10, ch.h, cw);
        g.rect(ch.x - 1, cy - ch.h - 6, 12, 6, cr);
        g.rect(ch.x + 3, cy - ch.h - 14, 4, 8, cr);
        g.rect(ch.x + 4, cy - ch.h - 18, 2, 4, 0xe8c050);
        g.disc(ch.x + 5, cy - ch.h + 6, 2, 0xf8f4ec);
        g.px(ch.x + 5, cy - ch.h + 5, 0x3a3a3a);
        for (const t of this.forest) {
            if (t.pine)
                this._pine(g, t.x, this.railY - 4, t.s, env);
            else
                A.bigTree(g, t.x, this.railY - 4, Math.round(t.s * 0.55), this._season(env), t.seed, env.weather.snowCover);
        }
        // railway embankment
        g.rect(0, this.railY - 2, W, 6, 0x8a7a6a);
        for (let x = 0; x < W; x += 5)
            g.rect(x, this.railY, 3, 3, 0x5a4030);
        g.rect(0, this.railY - 1, W, 1, 0xa8a8b4);
        g.rect(0, this.railY + 1, W, 1, 0x8a8a96);
        // meadow
        A.grass(g, 0, this.meadowTop, W, this.h - this.meadowTop, this._season(env), 3);
        const season = this._season(env);
        // the other layers start transparent, so contact shadows of
        // everything standing in the meadow go onto the grass here
        for (const t of this.trees)
            g.footShadow(t.x, t.y, t.pine ? t.s * 1.1 : t.s * 1.8, 0.3);
        const BIT_SHADOW = {bush: [8, 18], rock: [9, 20], stump: [7, 20], beehive: [7, 18], hay: [14, 26], mushrooms: [4, 12]};
        for (const b of this.bits) {
            const sh = BIT_SHADOW[b.kind];
            const shown = !(b.kind === 'mushrooms' || b.kind === 'hay') || (season === 'summer' || season === 'autumn');
            if (sh && shown)
                g.footShadow(b.x + sh[0], b.y, sh[1], 0.28);
        }
        const f = this.field;
        g.footShadow(f.x + Math.floor(f.w * 0.6), f.y1 + 18, 10, 0.3);
    }

    // bits on the meadow and the windmill; its sails turn in front of the
    // trees behind it
    _drawMeadow(g, env) {
        for (const b of this.bits)
            if (b.y < this.G - 40)
                this._bit(g, b, env);
        this._windmill(g, env);
    }

    // tiered fir: each tier lit on the left, in shade on the right and
    // throwing a dark band onto the tier below; snow sits on the tiers
    _pine(g, x, ground, s, env) {
        const R = A.ramp(mix(0x2f7a4a, env.skyBottom, 0.15));
        const snow = this._snowy(env);
        const trunkH = Math.max(3, Math.round(s * 0.3));
        g.rect(x - 2, ground - trunkH, 4, trunkH, INK);
        g.rect(x - 1, ground - trunkH, 2, trunkH, 0x6a4430);
        const tiers = s >= 12 ? 4 : 3, h = s * 2;
        const th = Math.ceil(h / tiers) + 3;
        for (let k = tiers - 1; k >= 0; k--) {
            const top = ground - trunkH - h + Math.floor(k * (h - th) / (tiers - 1 || 1)) + 1;
            const maxHalf = Math.round(s * (0.3 + 0.32 * (k + 1) / tiers));
            // curved flanks, the bottom edge hangs down in branch tips
            const halfAt = i => Math.max(1, Math.round(Math.pow((i + 1) / th, 0.75) * maxHalf));
            for (let i = 0; i < th; i++) {
                const half = halfAt(i), y = top + i;
                g.rect(x - half - 1, y, half * 2 + 3, 1, INK);
                g.rect(x - half, y, half, 1, R[3]);
                g.rect(x, y, half + 1, 1, R[1]);
                g.rect(x - Math.floor(half / 3), y, Math.floor(half / 3) + 1, 1, R[2]);
                if (snow && (k === 0 ? i < th * 0.45 : i === th - 1))
                    g.rect(x - half, y, half * 2 + 1, 1, i % 2 ? 0xdce4f4 : 0xf4f8ff);
            }
            const half = halfAt(th - 1);
            for (let j = -half; j <= half; j++) {
                const tip = ((j + half + k) % 4) < 2;
                if (tip) {
                    g.px(x + j, top + th, snow ? 0xf4f8ff : j < 0 ? R[3] : R[1]);
                    g.px(x + j, top + th + 1, INK);
                } else {
                    g.px(x + j, top + th, INK);
                }
            }
            // light needles along the lit flank
            for (let i = 2; i < th - 1; i += 3)
                g.px(x - halfAt(i) + 1, top + i, R[4]);
            // this tier shades the one below, just under its branch tips
            if (k < tiers - 1)
                g.blend(x - half + 1, top + th + 2, half * 2 - 1, 1, 0x1a1028, 0.3);
        }
        g.px(x, ground - trunkH - h, INK);
    }

    _tree(g, t, env) {
        if (t.pine)
            this._pine(g, t.x, t.y, Math.round(t.s * 0.9), env);
        else
            A.bigTree(g, t.x, t.y, t.s, this._season(env), t.seed, env.weather.snowCover);
    }

    _windmill(g, env) {
        const m = this.mill, R = A.ramp(0xe8dcc8), snow = this._snowy(env);
        const S = v => Math.round(v * m.k), H = S(44), hw = S(9);
        g.rect(m.x - hw, m.y - H, hw * 2 + 1, H, INK);
        for (let i = 0; i < H; i++) {
            const inset = Math.floor((1 - i / H) * S(3));
            g.rect(m.x - hw + 1 + inset, m.y - H + i, hw * 2 - 1 - inset * 2, 1, i % S(6) === 0 ? R[1] : R[2]);
        }
        g.rect(m.x - hw + 1, m.y - H, S(3), H, R[3]);
        // door, window and a small gallery under the cap
        g.rect(m.x - S(3), m.y - S(12), S(3) * 2 + 1, S(12), INK);
        g.rect(m.x - S(3) + 1, m.y - S(12) + 1, S(3) * 2 - 1, S(12) - 1, 0x7a4a30);
        g.rect(m.x - S(2), m.y - S(32), S(2) * 2 + 1, S(6), INK);
        g.rect(m.x - S(2) + 1, m.y - S(32) + 1, S(2) * 2 - 1, S(6) - 2, A.GLASS[2]);
        g.rect(m.x - hw - 2, m.y - H + S(4), hw * 2 + 5, 2, INK);
        g.rect(m.x - hw - 1, m.y - H + S(4), hw * 2 + 3, 1, 0x8a5a38);
        // pointed cap: narrow at the top, as wide as the tower at the eaves
        const roof = snow ? A.ramp(0xe8eef8) : A.ramp(0xa84838), rh = S(9);
        for (let i = 0; i < rh; i++) {
            const half = Math.round((i + 1) / rh * (hw + 1)), y = m.y - H - rh + i;
            g.rect(m.x - half, y, half * 2 + 1, 1, INK);
            if (half > 1 && i < rh - 1)
                g.rect(m.x - half + 1, y, half * 2 - 1, 1, i < rh / 3 ? roof[3] : roof[2]);
        }
        m.hub = [m.x, m.y - H + S(2)];
    }

    _bit(g, b, env) {
        const {x, y} = b;
        const season = this._season(env);
        switch (b.kind) {
        case 'flowers':
            if (season === 'winter')
                break;
            for (let i = 0; i < 6; i++) {
                const fx = x + (hash(i, b.seed) % 12), fy = y - (hash(i + 7, b.seed) % 5);
                g.rect(fx, fy, 1, 2, 0x3a8a30);
                const c = season === 'autumn' ? [0xe0a040, 0xc06030][i % 2] : [0xf8f0f0, 0xf0d050, 0xe85060, 0xc070e0, 0xf090c0][(b.seed + i) % 5];
                g.rect(fx - 1, fy - 1, 3, 1, c);
                g.px(fx, fy - 2, c);
                g.px(fx, fy - 1, 0xf8e070);
            }
            break;
        case 'weeds': {
            const R = A.GRASS[season];
            for (let i = 0; i < 4; i++) {
                g.rect(x + i * 2, y - 4 + (i % 2), 1, 4 - (i % 2), R[1]);
                g.px(x + i * 2, y - 5 + (i % 2), R[3]);
            }
            break;
        }
        case 'bush': {
            // three leaf clumps, shaded from the top left, berries in small
            // bunches so they read as fruit and not as dots
            const R = A.leafRamp(season === 'autumn' ? 'summer' : season);
            A.bush(g, x, y, 17, R, b.seed);
            if (season === 'summer' || season === 'autumn') {
                const c = season === 'summer' ? A.ramp(0x4a4ab8) : A.ramp(0xd8343a);
                for (const [bx, by] of [[x + 3, y - 6], [x + 11, y - 4], [x + 8, y - 11]]) {
                    for (const [dx, dy] of [[0, 0], [2, 1], [1, 2]]) {
                        g.rect(bx + dx, by + dy, 2, 2, c[1]);
                        g.px(bx + dx, by + dy, c[3]);
                    }
                }
            }
            break;
        }
        case 'rock':
            A.boulder(g, x, y, b.seed, season);
            break;
        case 'stump':
            A.stump(g, x, y, season);
            break;
        case 'mushrooms':
            if (season === 'autumn' || season === 'summer') {
                // fly agarics, one big and two small
                for (const [mx, s] of [[x + 4, 3], [x, 2], [x + 9, 2]]) {
                    const stem = s + 2;
                    g.rect(mx - 1, y - stem, 3, stem, INK);
                    g.rect(mx, y - stem, 1, stem, 0xf4ece0);
                    g.rect(mx - s - 1, y - stem - s - 1, s * 2 + 3, s + 1, INK);
                    g.rect(mx - s, y - stem - s - 2, s * 2 + 1, 1, INK);
                    g.rect(mx - s, y - stem - s, s * 2 + 1, s, 0xd83838);
                    g.rect(mx - s + 1, y - stem - s - 1, s * 2 - 1, 1, 0xd83838);
                    g.rect(mx - s, y - stem - 1, s * 2 + 1, 1, 0x982828);
                    g.px(mx - s + 1, y - stem - s, 0xffffff);
                    g.px(mx + 1, y - stem - s + 1, 0xffffff);
                    if (s > 2)
                        g.px(mx - 1, y - stem - 2, 0xffffff);
                }
            }
            break;
        case 'beehive': {
            // straw skep on a little stand: stacked rings, dark entrance
            const R = A.ramp(0xd8a848), cx = x + 7;
            const P = A.ramp(0x8a5a38);
            g.rect(cx - 8, y - 4, 17, 2, INK);
            g.rect(cx - 7, y - 4, 15, 1, P[2]);
            g.rect(cx - 6, y - 2, 2, 2, INK);
            g.rect(cx + 5, y - 2, 2, 2, INK);
            const rows = [5, 9, 11, 13, 13, 13];
            for (let i = 0; i < rows.length; i++) {
                const wd = rows[i], top = y - 4 - (rows.length - i) * 3;
                g.rect(cx - Math.floor(wd / 2) - 1, top, wd + 2, 3, INK);
                g.rect(cx - Math.floor(wd / 2), top + (i ? 0 : 1), wd, 2, R[2]);
                g.rect(cx - Math.floor(wd / 2), top + 2, wd, 1, R[1]);
                g.rect(cx - Math.floor(wd / 2), top, 2, 2, R[3]);
            }
            g.rect(cx - 1, y - 8, 3, 2, INK);
            b.bees = true;
            break;
        }
        case 'hay':
            if (season === 'summer' || season === 'autumn') {
                // round bale lying on its side: spiral face and a body
                const R = A.ramp(0xe0b858), cx = x + 8, cy = y - 8;
                g.rect(cx, cy - 8, 14, 17, INK);
                g.rect(cx, cy - 7, 13, 15, R[2]);
                g.rect(cx, cy - 7, 13, 2, R[3]);
                g.rect(cx, cy + 5, 13, 3, R[1]);
                for (let i = 2; i < 13; i += 3)
                    g.rect(cx + i, cy - 4, 1, 8, R[1]);
                g.rect(cx + 6, cy - 7, 2, 15, 0xa83a30);
                g.disc(cx, cy, 8, INK);
                g.disc(cx, cy, 7, R[3]);
                g.disc(cx, cy, 5, R[2]);
                g.disc(cx, cy, 3, R[3]);
                g.disc(cx, cy, 1, R[1]);
                g.px(cx - 4, cy - 4, R[4]);
                g.px(cx + 3, cy + 2, R[1]);
            }
            break;
        }
    }

    _drawFarm(g, env) {
        const G = this.G, season = this._season(env), snow = season === 'winter';
        for (const b of this.bits)
            if (b.y >= this.G - 40 && b.y < this.pasture.y1)
                this._bit(g, b, env);
        // pasture back fence
        const p = this.pasture, fenceR = A.ramp(0xb07a48);
        A.fence(g, p.x1, p.y1, p.x2 - p.x1, fenceR);
        A.sideFence(g, p.x1, p.y1, p.y2 + 8, fenceR);
        A.sideFence(g, p.x2 - 4, p.y1, p.y2 + 8, fenceR);
        this._barn(g, env);
        this._silo(g, env);
        // farmhouse
        const H = this.house, top = G - H.wallH;
        const wallR = A.ramp(0xd8aa68), roofH = snow ? A.ramp(0xe8eef8) : A.ramp(0x3a7a8a);
        A.chimney(g, H.x + H.w - 26, top - H.roofH - 4, 12, 26, A.ramp(0x9a5040));
        this.chimney = {x: H.x + H.w - 20, y: top - H.roofH - 6};
        A.slopeRoof(g, H.x, top - H.roofH, H.w, H.roofH, roofH, 12, 6);
        g.rect(H.x - 1, top, H.w + 2, H.wallH, INK);
        A.wallSiding(g, H.x, top, H.w, H.wallH, wallR, 3);
        // the eaves shade the top of the wall, corner boards, stone footing
        g.blend(H.x, top, H.w, 4, 0x1a1028, 0.3);
        g.blend(H.x, top + 4, H.w, 2, 0x1a1028, 0.12);
        for (const cx of [H.x, H.x + H.w - 4]) {
            g.rect(cx, top, 4, H.wallH, 0xf0e4cc);
            g.rect(cx + 3, top, 1, H.wallH, 0xc8b490);
            g.rect(cx, top, 4, 4, 0xb8a888);
        }
        g.rect(H.x - 2, G - 7, H.w + 4, 7, INK);
        A.wallStone(g, H.x - 1, G - 6, H.w + 2, 6, A.ramp(0xa09888), 4);
        // dormer with the bedroom window
        const dw = this.wins[2];
        g.rect(dw.x - 6, dw.y - 10, dw.w + 12, dw.h + 13, INK);
        A.wallSiding(g, dw.x - 5, dw.y - 3, dw.w + 10, dw.h + 5, wallR, 9);
        A.gableRoof(g, dw.x - 5, dw.y - 12, dw.w + 10, 10, roofH, 13, 2);
        for (const w of this.wins) {
            A.windowFrame(g, w.x, w.y, w.w, w.h, w.frameR);
            if (w.role !== 'bed') {
                const sr = A.ramp(0x3a7a8a);
                for (const sx of [w.x - 8, w.x + w.w + 3]) {
                    g.rect(sx - 1, w.y - 2, 7, w.h + 4, INK);
                    g.rect(sx, w.y - 1, 5, w.h + 2, sr[2]);
                    for (let i = 1; i < w.h; i += 3)
                        g.rect(sx + 1, w.y + i, 3, 1, sr[1]);
                }
                A.flowerBox(g, w.x - 1, w.y + w.h + 4, w.w + 2, env.season, w.x);
            }
        }
        const d = this.houseDoor;
        A.door(g, d.x, G - 38, 18, 38, A.ramp(0x8a4a30), 1);
        // porch roof and posts
        g.rect(d.x - 12, G - 46, 42, 4, INK);
        g.rect(d.x - 11, G - 45, 40, 2, roofH[2]);
        g.rect(d.x - 10, G - 42, 2, 42, INK);
        g.rect(d.x + 26, G - 42, 2, 42, INK);
        g.rect(d.x - 7, G - 40, 3, 4, INK);
        // mailbox, shipping bin and well
        const mbx = H.x + H.w + 4;
        g.rect(mbx, G - 12, 2, 12, 0x6a4a30);
        g.rect(mbx - 4, G - 18, 10, 7, INK);
        g.rect(mbx - 3, G - 17, 8, 5, 0x4c7cd0);
        g.rect(mbx + 4, G - 20, 1, 4, 0xd84848);
        this._shippingBin(g, H.x - 4, G + 9);
        // dog house
        const dh = this.houseDoor.x + 40;
        const dr = A.ramp(0xc85a3a);
        g.rect(dh - 1, G - 16, 22, 16, INK);
        g.rect(dh, G - 15, 20, 15, A.ramp(0x9a6a40)[2]);
        for (let i = 0; i < 6; i++)
            g.rect(dh - 2 + i, G - 22 + i, 24 - i * 2, 1, i === 0 ? INK : dr[2]);
        g.rect(dh + 6, G - 9, 8, 9, INK);
        // path to the road
        A.dirtPath(g, d.x - 2, G + 1, 20, this.roadTop - G - 1, season, 21);
        // the pond lies flat, nothing from the yard walks over it
        this._pond(g, env);
        // country road
        A.dirtPath(g, 0, this.roadTop, this.w, this.h - this.roadTop, season, 31);
        g.rect(0, this.roadTop, this.w, 1, A.GRASS[season][1]);
        if (this.wetLevel)
            for (let i = 0; i < this.w / 60; i++)
                g.blend(hash(i, 11) * this.w / 1000, this.roadTop + 4 + hash(i, 13) % 8, 14, 3, env.skyBottom, 0.35);
        for (const bb of this.bits)
            if (bb.y >= this.pasture.y1 && bb.y < this.yardFront)
                this._bit(g, bb, env);
    }

    // everything standing in front of the farmyard walkers and the ducks
    _drawFront(g, env) {
        this._field(g, env);
        for (const bb of this.bits)
            if (bb.y >= this.yardFront)
                this._bit(g, bb, env);
    }

    // red barn seen from the gable end: gambrel roof with white trim, a
    // hayloft door with hay, X-braced doors and a stone footing
    _barn(g, env) {
        const G = this.G, b = this.barn, red = A.ramp(0xb84a3a), snow = this._snowy(env);
        const roofR = snow ? A.ramp(0xe8eef8) : A.ramp(0x5a4a5a), trim = 0xf4ece0;
        const eave = G - b.h, cx = b.x + b.w / 2, hw = b.w / 2;
        const knee = 22, peak = 40;
        // gable profile: half width per row above the eave
        const halfAt = up => up <= knee ? hw - Math.round(up / knee * 13) : Math.round((hw - 13) * (1 - (up - knee) / (peak - knee)) ** 0.8);
        const plank = (x, y) => {
            const k = ((x - b.x) % 6 + 6) % 6;
            g.px(x, y, k === 0 ? red[0] : k === 1 ? red[3] : k === 5 ? red[1] : red[2]);
        };
        g.rect(b.x - 1, eave, b.w + 2, b.h, INK);
        A.wallPlanks(g, b.x, eave, b.w, b.h, red, 5);
        for (let up = 1; up <= peak; up++) {
            const h = halfAt(up), y = eave - up;
            for (let x = Math.round(cx - h); x < Math.round(cx + h); x++)
                plank(x, y);
        }
        // roof edge: a thick band along the profile, white trim inside it
        for (let up = 0; up <= peak + 3; up++) {
            const h = halfAt(Math.min(up, peak)) + (up > peak ? -(up - peak) * 3 : 0), y = eave - up;
            if (h < 0)
                continue;
            for (const side of [-1, 1]) {
                const edge = Math.round(cx + side * h);
                const out = side < 0 ? edge - 7 : edge;
                g.rect(out - 1, y, 9, 1, INK);
                g.rect(out, y, 7, 1, (up % 4 === 0) ? roofR[1] : side < 0 ? roofR[3] : roofR[2]);
                g.rect(side < 0 ? edge : edge - 2, y, 2, 1, trim);
            }
        }
        g.rect(Math.round(cx - 4), eave - peak - 4, 9, 2, INK);
        // white corner boards and eave shadow
        for (const x of [b.x, b.x + b.w - 3]) {
            g.rect(x, eave, 3, b.h, trim);
            g.rect(x + 2, eave, 1, b.h, 0xc8bca8);
        }
        // hayloft door with hay and the hoist beam
        const lw = 22, lh = 18, lx = Math.round(cx - lw / 2), ly = eave - 30;
        g.rect(lx - 2, ly - 2, lw + 4, lh + 4, INK);
        g.rect(lx - 1, ly - 1, lw + 2, lh + 2, trim);
        g.rect(lx, ly, lw, lh, 0x3a2420);
        g.rect(lx, ly + lh - 8, lw, 8, 0xe0b850);
        for (let i = 0; i < lw; i += 2)
            g.rect(lx + i, ly + lh - 10 + (i * 7) % 3, 1, 3, 0xf0d070);
        g.rect(lx, ly + lh - 8, lw, 1, 0xa88030);
        g.rect(lx + lw / 2 - 1, ly, 2, lh, trim);
        g.rect(lx, ly + lh - 9, lw / 2 - 1, 1, 0xf0d070);
        g.rect(Math.round(cx - 1), ly - 9, 3, 7, INK);
        g.rect(Math.round(cx), ly - 8, 1, 5, 0x8a5a38);
        // big sliding doors, tall enough for a tractor
        const dx = Math.round(cx - 22), bdH = 50;
        g.rect(dx - 2, G - bdH, 48, bdH, INK);
        g.rect(dx - 1, G - bdH + 1, 46, bdH - 1, trim);
        g.rect(dx + 1, G - bdH + 3, 42, bdH - 3, red[1]);
        for (let x = dx + 1; x < dx + 43; x += 5)
            g.rect(x, G - bdH + 3, 1, bdH - 3, red[0]);
        for (const [x0, y0, x1, y1] of [[dx + 1, G - bdH + 3, dx + 21, G - 1], [dx + 21, G - bdH + 3, dx + 1, G - 1], [dx + 23, G - bdH + 3, dx + 42, G - 1], [dx + 42, G - bdH + 3, dx + 23, G - 1]]) {
            g.line(x0, y0, x1, y1, trim);
            g.line(x0 + 1, y0, x1 + 1, y1, trim);
        }
        g.rect(dx + 21, G - bdH + 3, 2, bdH - 3, trim);
        g.rect(dx - 4, G - bdH - 3, 52, 2, INK);
        g.rect(dx - 3, G - bdH - 3, 50, 1, 0x8a8a96);
        // lantern next to the door
        const lnx = dx + 52;
        g.rect(lnx, G - 40, 6, 8, INK);
        g.rect(lnx + 1, G - 39, 4, 6, 0x8a7a5a);
        g.rect(lnx + 2, G - 42, 2, 2, INK);
        this.barnLamp = {x: lnx + 1, y: G - 39};
        // stone footing
        g.rect(b.x - 2, G - 7, b.w + 4, 7, INK);
        A.wallStone(g, b.x - 1, G - 6, b.w + 2, 6, A.ramp(0xa09888), 6);
        g.rect(dx - 1, G - 6, 46, 6, 0x8a7a6a);
        if (snow)
            g.rect(Math.round(cx - 5), eave - peak - 3, 11, 2, 0xf4f8ff);
    }

    // metal silo on a stone base: rounded shading, riveted rings, a
    // ribbed dome and a ladder on the side
    _silo(g, env) {
        const G = this.G, s = this.silo, snow = this._snowy(env);
        const M = A.ramp(0xa8b4c0), top = G - s.h;
        g.rect(s.x - 1, top, s.w + 2, s.h, INK);
        for (let i = 0; i < s.w; i++) {
            const t = i / (s.w - 1);
            const c = t < 0.12 ? M[2] : t < 0.4 ? M[3] : t < 0.5 ? M[4] : t < 0.75 ? M[2] : t < 0.92 ? M[1] : M[0];
            g.rect(s.x + i, top, 1, s.h, c);
        }
        for (let y = top + 10; y < G - 14; y += 12) {
            g.rect(s.x, y, s.w, 1, M[0]);
            g.rect(s.x, y + 1, s.w, 1, M[4]);
            for (let x = s.x + 2; x < s.x + s.w - 1; x += 4)
                g.px(x, y - 2, M[0]);
        }
        // stone base
        g.rect(s.x - 3, G - 15, s.w + 6, 15, INK);
        A.wallStone(g, s.x - 2, G - 14, s.w + 4, 14, A.ramp(0xa09888), 9);
        // dome
        const dh = 14, dr = s.w / 2 + 2, dcx = s.x + s.w / 2 - 0.5;
        const roof = snow ? A.ramp(0xe8eef8) : A.ramp(0xa04838);
        for (let dy = 0; dy < dh; dy++) {
            const half = Math.round(Math.sqrt(1 - ((dh - dy) / dh) ** 2) * dr);
            const y = top - dh + dy;
            g.rect(Math.round(dcx - half) - 1, y, half * 2 + 3, 1, INK);
            for (let x = Math.round(dcx - half); x <= Math.round(dcx + half); x++) {
                const u = (x - dcx) / dr;
                const rib = Math.abs((Math.round(u * 4 * 10) % 10)) === 0;
                g.px(x, y, rib ? roof[1] : u < -0.3 ? roof[3] : u < 0.35 ? roof[2] : roof[1]);
            }
        }
        g.rect(s.x - 3, top - 1, s.w + 6, 2, INK);
        g.rect(s.x - 2, top - 1, s.w + 4, 1, roof[1]);
        g.rect(Math.round(dcx) - 3, top - dh - 4, 7, 4, INK);
        g.rect(Math.round(dcx) - 2, top - dh - 3, 5, 2, M[3]);
        // ladder on the shaded side
        const lx = s.x + s.w - 7;
        g.rect(lx, top + 2, 1, s.h - 16, INK);
        g.rect(lx + 4, top + 2, 1, s.h - 16, INK);
        for (let y = top + 4; y < G - 15; y += 4)
            g.rect(lx, y, 5, 1, INK);
    }

    _shippingBin(g, x, bottom) {
        const R = A.ramp(0x9a6a40), y = bottom - 14;
        g.rect(x - 1, y, 24, 15, INK);
        g.rect(x, y + 4, 22, 10, R[2]);
        for (let py = y + 7; py < bottom; py += 3)
            g.rect(x, py, 22, 1, R[1]);
        // lid, slightly wider, with a lit edge
        g.rect(x - 2, y - 1, 26, 5, INK);
        g.rect(x - 1, y, 24, 3, R[3]);
        g.rect(x - 1, y, 24, 1, R[4]);
        // iron corners
        for (const cx of [x, x + 19])
            g.rect(cx, y + 4, 3, 10, 0x6a6a78);
        g.rect(x + 9, y + 3, 4, 3, 0x6a6a78);
        g.px(x + 10, y + 4, 0xc8c8d8);
    }

    _pond(g, env) {
        const p = this.pond, snow = this._snowy(env);
        const water = A.ramp(snow ? 0xc8dcf0 : mix(0x3a7ac8, env.skyBottom, 0.25));
        for (let y = 0; y < p.h; y++) {
            const half = Math.floor(Math.sqrt(1 - ((y - p.h / 2 + 0.5) / (p.h / 2)) ** 2) * p.w / 2);
            const cx = p.x + p.w / 2;
            g.rect(cx - half - 2, p.y + y, half * 2 + 4, 1, INK);
            g.rect(cx - half - 1, p.y + y, half * 2 + 2, 1, 0x9a8a6a);
            g.rect(cx - half + 1, p.y + y, half * 2 - 2, 1, y < 3 ? water[1] : y > p.h - 5 ? water[3] : water[2]);
        }
        if (!snow) {
            for (const [fx, fy] of [[0.2, 0.55], [0.55, 0.35], [0.65, 0.68], [0.78, 0.45]]) {
                const lx = Math.round(p.x + p.w * fx), ly = Math.round(p.y + p.h * fy);
                g.disc(lx, ly, 3, 0x3a8a3a);
                g.rect(lx, ly - 3, 1, 3, water[2]);
                if (env.season === 'summer')
                    g.rect(lx - 1, ly - 1, 2, 2, 0xf8b0d0);
            }
            // reeds at both ends
            for (let i = 0; i < 10; i++) {
                const rx = i < 5 ? p.x + 6 + i * 3 : p.x + p.w - 22 + (i - 5) * 3;
                g.rect(rx, p.y - 6, 1, 10, 0x4a8a3a);
                g.rect(rx, p.y - 6, 1, 3, 0x7a5030);
            }
        }
    }

    _field(g, env) {
        const f = this.field, season = this._season(env);
        const soil = A.ramp(0x8a5a3a);
        g.rect(f.x - 1, f.y1 - 1, f.w + 2, f.y2 - f.y1 + 2, INK);
        g.rect(f.x, f.y1, f.w, f.y2 - f.y1, soil[1]);
        // 16px tilled tiles
        const CROPS = {spring: ['parsnip', 'strawberry', 'cauliflower', 'parsnip'], summer: ['tomato', 'melon', 'sunflower', 'corn', 'wheat'],
            autumn: ['pumpkin', 'corn', 'sunflower', 'pumpkin', 'wheat'], winter: []};
        const list = CROPS[env.season];
        if (season === 'winter' && this._snowy(env)) {
            this._snowField(g, f);
            return this._scarecrow(g, f, env);
        }
        let rowI = 0;
        for (let ty = f.y1; ty < f.y2 - 4; ty += 12, rowI++) {
            const crop = list.length ? list[(rowI + f.seed) % list.length] : '';
            for (let tx = f.x; tx < f.x + f.w - 4; tx += 14) {
                g.rect(tx + 1, ty + 1, 12, 10, soil[2]);
                g.rect(tx + 1, ty + 1, 12, 1, soil[3]);
                g.rect(tx + 1, ty + 10, 12, 1, soil[0]);
                if (season === 'winter') {
                    this._winterTile(g, tx, ty, hash(tx, ty + f.seed));
                    continue;
                }
                this._crop(g, tx + 7, ty + 9, crop, env.season, hash(tx, ty + f.seed));
            }
        }
        this._scarecrow(g, f, env);
        // sprinkler
        const spx = f.x + Math.floor(f.w * 0.25), spy = f.y1 + 30;
        g.rect(spx - 2, spy - 4, 5, 4, INK);
        g.rect(spx - 1, spy - 3, 3, 2, 0xa8a8b8);
        this.sprinkler = {x: spx, y: spy - 4};
    }

    _scarecrow(g, f, env) {
        const sx = f.x + Math.floor(f.w * 0.6), sy = f.y1 + 18;
        g.rect(sx - 1, sy - 30, 3, 30, INK);
        g.rect(sx, sy - 30, 1, 30, 0x8a5a38);
        g.rect(sx - 12, sy - 24, 25, 3, INK);
        g.rect(sx - 11, sy - 23, 23, 1, 0x8a5a38);
        g.rect(sx - 6, sy - 25, 13, 12, INK);
        g.rect(sx - 5, sy - 24, 11, 10, 0x4c7cd0);
        g.rect(sx - 2, sy - 24, 4, 10, 0xd84848);
        g.rect(sx - 5, sy - 34, 11, 10, INK);
        g.rect(sx - 4, sy - 33, 9, 8, 0xe8c070);
        g.px(sx - 2, sy - 30, INK);
        g.px(sx + 2, sy - 30, INK);
        g.rect(sx - 1, sy - 28, 3, 1, 0x8a4a2a);
        g.rect(sx - 8, sy - 37, 17, 3, INK);
        g.rect(sx - 7, sy - 36, 15, 1, 0x9a7a40);
        g.rect(sx - 4, sy - 41, 9, 4, INK);
        g.rect(sx - 3, sy - 40, 7, 3, 0x9a7a40);
        if (this._snowy(env))
            g.rect(sx - 7, sy - 38, 15, 1, 0xf4f8ff);
    }

    // bare soil in winter: frost and a few stubble stalks
    _winterTile(g, tx, ty, h) {
        for (let i = 0; i < 4; i++)
            g.px(tx + 2 + (h * (i + 3)) % 10, ty + 3 + (h >> i) % 6, 0xd8e0ec);
        if (h % 3 === 0)
            for (let i = 0; i < 3; i++)
                g.rect(tx + 4 + i * 3, ty + 5 - (i % 2), 1, 4, 0xa88a50);
    }

    // snowed-in field: the rows stay visible as long soft ridges, lit on
    // top and blue in the furrows, with soil and stubble peeking out
    _snowField(g, f) {
        g.rect(f.x, f.y1, f.w, f.y2 - f.y1, 0xe8eef8);
        for (let ty = f.y1; ty < f.y2 - 4; ty += 12) {
            for (let x = f.x; x < f.x + f.w; x++) {
                const h = hash(x, ty + f.seed), clump = hash(x >> 2, ty + f.seed + 7);
                g.px(x, ty + 1, 0xf4f8ff);
                g.px(x, ty + 2, 0xffffff);
                g.px(x, ty + 3, h < 600 ? 0xffffff : 0xf4f8ff);
                g.px(x, ty + 7, 0xdce4f0);
                g.px(x, ty + 8, 0xd0dcec);
                g.px(x, ty + 9, 0xbccae0);
                g.px(x, ty + 10, clump < 90 ? 0x6a4a3a : 0xa8b8d4);
                g.px(x, ty + 11, clump < 90 ? 0x8a6a50 : 0xc8d4e8);
                if (h > 990) {
                    g.rect(x, ty, 1, 4, 0x9a7a48);
                    g.px(x + 1, ty + 1, 0x9a7a48);
                }
            }
        }
    }

    _scarecrow(g, f, env) {
        const sx = f.x + Math.floor(f.w * 0.6), sy = f.y1 + 18;
        g.rect(sx - 1, sy - 30, 3, 30, INK);
        g.rect(sx, sy - 30, 1, 30, 0x8a5a38);
        g.rect(sx - 12, sy - 24, 25, 3, INK);
        g.rect(sx - 11, sy - 23, 23, 1, 0x8a5a38);
        g.rect(sx - 6, sy - 25, 13, 12, INK);
        g.rect(sx - 5, sy - 24, 11, 10, 0x4c7cd0);
        g.rect(sx - 2, sy - 24, 4, 10, 0xd84848);
        g.rect(sx - 5, sy - 34, 11, 10, INK);
        g.rect(sx - 4, sy - 33, 9, 8, 0xe8c070);
        g.px(sx - 2, sy - 30, INK);
        g.px(sx + 2, sy - 30, INK);
        g.rect(sx - 1, sy - 28, 3, 1, 0x8a4a2a);
        g.rect(sx - 8, sy - 37, 17, 3, INK);
        g.rect(sx - 7, sy - 36, 15, 1, 0x9a7a40);
        g.rect(sx - 4, sy - 41, 9, 4, INK);
        g.rect(sx - 3, sy - 40, 7, 3, 0x9a7a40);
        if (this._snowy(env))
            g.rect(sx - 7, sy - 38, 15, 1, 0xf4f8ff);
    }

    // bare soil in winter: frost and a few stubble stalks
    _winterTile(g, tx, ty, h) {
        for (let i = 0; i < 4; i++)
            g.px(tx + 2 + (h * (i + 3)) % 10, ty + 3 + (h >> i) % 6, 0xd8e0ec);
        if (h % 3 === 0)
            for (let i = 0; i < 3; i++)
                g.rect(tx + 4 + i * 3, ty + 5 - (i % 2), 1, 4, 0xa88a50);
    }

    // snowed-in field: the rows stay visible as long soft ridges, lit on
    // top and blue in the furrows, with soil and stubble peeking out
    _snowField(g, f) {
        g.rect(f.x, f.y1, f.w, f.y2 - f.y1, 0xe8eef8);
        for (let ty = f.y1; ty < f.y2 - 4; ty += 12) {
            for (let x = f.x; x < f.x + f.w; x++) {
                const h = hash(x, ty + f.seed);
                g.px(x, ty + 2, h < 850 ? 0xffffff : 0xe8eef8);
                g.px(x, ty + 3, h < 300 ? 0xffffff : 0xf0f4fc);
                g.px(x, ty + 9, 0xc8d4e8);
                g.px(x, ty + 10, h < 120 ? 0x6a4a3a : 0xb0c0dc);
                g.px(x, ty + 11, 0xc8d4e8);
                if (h > 985) {
                    g.rect(x, ty + 1, 1, 4, 0x9a7a48);
                    g.px(x + 1, ty + 2, 0x9a7a48);
                }
            }
        }
    }

    _crop(g, x, y, kind, season, h) {
        const L = A.ramp(0x5aa04a);
        const leaves = (cx, cy, n = 3, r = 3) => {
            for (let i = 0; i < n; i++) {
                const lx = cx + (i - (n - 1) / 2) * 4, ly = cy - (i % 2) * 2;
                g.disc(lx, ly, r, INK);
                g.disc(lx, ly, r - 1, L[2]);
                g.px(lx - 1, ly - 1, L[3]);
            }
        };
        const ball = (cx, cy, r, base) => {
            const R = A.ramp(base);
            g.disc(cx, cy, r + 1, INK);
            g.disc(cx, cy, r, R[2]);
            g.disc(cx - 1, cy - 1, r - 1 > 0 ? r - 1 : 1, R[3]);
            g.px(cx - r + 1, cy - r + 1, R[4]);
            g.rect(cx - r + 1, cy + r - 1, r * 2 - 1, 1, R[1]);
        };
        if (h % 9 === 0) {
            // still a seedling
            g.rect(x, y - 4, 1, 4, L[2]);
            g.rect(x - 2, y - 4, 2, 1, L[3]);
            g.rect(x + 1, y - 3, 2, 1, L[3]);
            return;
        }
        switch (kind) {
        case 'parsnip':
            leaves(x, y - 6, 3, 3);
            g.rect(x - 1, y - 3, 3, 3, INK);
            g.rect(x, y - 3, 1, 2, 0xf0d8a0);
            break;
        case 'strawberry':
            leaves(x, y - 3, 3, 3);
            for (const [dx, dy] of [[-3, -2], [2, -1], [0, -4]]) {
                g.rect(x + dx, y + dy, 2, 2, 0xe02a3a);
                g.px(x + dx, y + dy, 0xff8080);
            }
            break;
        case 'cauliflower':
            leaves(x, y - 3, 3, 4);
            ball(x, y - 5, 3, 0xf4f0e0);
            g.px(x + 1, y - 6, 0xd8d0c0);
            g.px(x - 1, y - 4, 0xd8d0c0);
            break;
        case 'pumpkin': {
            g.line(x - 6, y - 2, x + 5, y - 1, L[1]);
            leaves(x + 4, y - 6, 1, 3);
            if (season === 'autumn' || h % 3) {
                const R = A.ramp(season === 'autumn' ? 0xf08a20 : 0x8ac050);
                g.rect(x - 5, y - 8, 10, 8, INK);
                g.rect(x - 6, y - 7, 12, 6, INK);
                g.rect(x - 5, y - 7, 10, 6, R[2]);
                g.rect(x - 4, y - 8, 8, 1, R[2]);
                g.rect(x - 2, y - 7, 1, 6, R[1]);
                g.rect(x + 1, y - 7, 1, 6, R[1]);
                g.rect(x - 4, y - 7, 2, 1, R[4]);
                g.rect(x - 1, y - 10, 2, 3, 0x5a7a2a);
            }
            break;
        }
        case 'melon':
            leaves(x - 3, y - 3, 2, 3);
            ball(x + 1, y - 4, 4, 0x4a9a3a);
            for (let i = -3; i <= 3; i += 3)
                g.rect(x + 1 + i, y - 7, 1, 6, 0x2e6a2a);
            break;
        case 'sunflower':
            g.rect(x, y - 20, 1, 20, L[1]);
            g.rect(x - 4, y - 9, 4, 2, L[2]);
            g.rect(x + 1, y - 13, 4, 2, L[2]);
            g.disc(x, y - 22, 5, INK);
            g.disc(x, y - 22, 4, 0xf8c828);
            g.disc(x, y - 22, 2, 0x6a3a1a);
            g.px(x - 1, y - 23, 0x8a5a2a);
            break;
        case 'corn':
            g.rect(x, y - 20, 2, 20, L[2]);
            g.rect(x, y - 20, 1, 20, L[3]);
            for (const [dx, dy, w] of [[-5, -8, 5], [2, -12, 5], [-4, -15, 4], [2, -5, 4]])
                g.rect(x + dx, y + dy, w, 2, L[2]);
            if (season !== 'spring') {
                g.rect(x + 2, y - 13, 3, 6, INK);
                g.rect(x + 2, y - 12, 2, 4, 0xf0d050);
                g.px(x + 2, y - 12, 0xfff090);
            }
            g.rect(x, y - 23, 2, 3, 0xd8b060);
            break;
        case 'wheat':
            for (let i = -4; i <= 4; i += 2) {
                g.rect(x + i, y - 12 + Math.abs(i) / 2, 1, 12 - Math.abs(i) / 2, 0xc8a040);
                g.rect(x + i - 1, y - 14 + Math.abs(i) / 2, 3, 3, 0xe8c858);
            }
            break;
        default: // tomato on a stake
            g.rect(x + 3, y - 18, 1, 18, 0x8a5a38);
            leaves(x, y - 8, 2, 4);
            leaves(x, y - 14, 1, 4);
            for (const [dx, dy] of [[-3, -7], [2, -10], [-1, -14]]) {
                g.rect(x + dx - 1, y + dy - 1, 4, 4, INK);
                g.rect(x + dx, y + dy, 2, 2, 0xe04030);
                g.px(x + dx, y + dy, 0xff8070);
            }
        }
    }

    // ---------- simulation ----------

    trigger(name, env, ctx) {
        switch (name) {
        case 'train':
            this._spawnTrain();
            break;
        case 'tractor':
        case 'mail':
        case 'bike':
        case 'icecream':
        case 'camper':
            this._spawnCar(name, env);
            break;
        case 'hikers': {
            const dir = chance(0.5) ? 1 : -1;
            for (let i = 0; i < randi(2, 4); i++) {
                const p = makePerson(env, {kid: false});
                p.backpack = 0x4a6a3a;
                p.speed = 9;
                p.dir = dir;
                p.x = dir > 0 ? -16 - i * 20 : this.w + 16 + i * 20;
                p.y = this.roadY - 2;
                p.state = 'walk';
                this.people.push(p);
            }
            break;
        }
        case 'kite':
            this.kite = {x: rand(60, this.w - 60), t: 0, life: rand(60, 160), c: pick([0xe04848, 0xf0c030, 0x4890e0])};
            break;
        case 'deer':
        case 'rabbit':
        case 'fox': {
            const n = name === 'fox' ? 1 : randi(1, 3);
            const dir = chance(0.5) ? 1 : -1;
            for (let i = 0; i < n; i++)
                this.wild.push({kind: name, a: name === 'deer' ? 0xa86a3a : name === 'fox' ? 0xe0782a : pick([0xb08a6a, 0x8a7a6a, 0xe8e0d8]),
                    x: dir > 0 ? -30 - i * 26 : this.w + 30 + i * 26, y: this.meadowTop + rand(2, 6), dir, t: rand(5),
                    speed: name === 'fox' ? 14 : name === 'deer' ? 10 : 16, stop: 0});
            break;
        }
        case 'fireworks':
            for (let i = 0; i < randi(4, 9); i++)
                this.timers.add(i * rand(0.8, 2), () => ctx.sky.firework(this.church.x + rand(-80, 80)));
            break;
        }
    }

    _pickEvent(env) {
        const h = env.hour, night = env.dark > 0.6, twilight = env.dark > 0.2 && env.dark < 0.85;
        const dry = env.weather.v.rain < 0.2, P = env.people, V = env.traffic;
        return weighted([
            ['tractor', !night && h > 6 && h < 19 ? 2 * V : 0], ['mail', h > 8 && h < 14 ? V : 0],
            ['bike', !night && dry ? 1.5 * V : 0], ['hikers', !night && dry && h > 8 && h < 18 ? 1.5 * P : 0],
            ['kite', !night && dry && Math.abs(env.weather.wind) > 0.5 ? 1.5 : 0.1],
            ['deer', twilight ? 2.5 : night ? 0.8 : 0.1], ['rabbit', twilight ? 2 : !night ? 0.6 : 0.2], ['fox', night ? 1.5 : 0.1],
            ['icecream', env.season === 'summer' && h > 12 && h < 19 ? 0.8 * V : 0], ['camper', env.season === 'summer' ? 0.6 * V : 0.1 * V],
            ['fireworks', night && env.weekday === 6 && (h > 21 || h < 1) ? 0.4 : 0],
        ]);
    }

    _spawnTrain() {
        const dir = chance(0.5) ? 1 : -1, freight = chance(0.35);
        const cars = [];
        for (let i = 0; i < randi(3, 6); i++)
            cars.push(freight ? pick([0x8a4a3a, 0x4a6a8a, 0x6a6a5a, 0xc89a40]) : pick([0x3a7a5a, 0xa84838, 0x4a5a8a]));
        this.train = {dir, x: dir > 0 ? -cars.length * 42 - 50 : this.w + 10, cars, freight, t: 0};
    }

    _spawnCar(type, env) {
        const v = makeVehicle(type, env);
        v.dir = chance(0.5) ? 1 : -1;
        v.len = vehicleLength(v);
        v.x = v.dir > 0 ? -v.len - 4 : this.w + 4;
        if (type === 'tractor')
            v.speed = rand(12, 16);
        v.cur = v.speed;
        if (this.cars.some(c => c.dir === v.dir && Math.abs(c.x - v.x) < 90))
            return;
        this.cars.push(v);
    }

    update(dt, real, env, ctx) {
        this.t += real;
        this.timers.run(real);
        for (const w of this.wins)
            w.update(dt, real, env);
        this.mill.a += real * (0.4 + Math.abs(env.weather.wind) * 0.8);
        if (Math.random() < real / (env.night ? 90 : 25) * env.traffic)
            this._spawnCar(env.night ? pick(['hatch', 'sedan', 'van']) : pick(['hatch', 'sedan', 'van', 'beetle', 'tractor', 'bike', 'delivery']), env);
        for (const v of this.cars) {
            v.t += real;
            v.x += v.cur * v.dir * real;
        }
        this.cars = this.cars.filter(v => v.x > -v.len - 40 && v.x < this.w + 40);
        this.trainTimer -= real;
        if (this.trainTimer <= 0 && !this.train) {
            if (chance(env.traffic))
                this._spawnTrain();
            this.trainTimer = rand(90, 360) * (env.hour > 0.5 && env.hour < 5 ? 3 : 1) / Math.max(1, env.traffic);
        }
        if (this.train) {
            const tr = this.train;
            tr.t += real;
            tr.x += tr.dir * 46 * real;
            if (Math.random() < real * 5)
                this.smoke.push({x: tr.dir > 0 ? tr.x + tr.cars.length * 42 + 36 : tr.x + 6, y: this.railY - 30, t: 0, life: rand(2, 4), big: true});
            if ((tr.dir > 0 && tr.x > this.w + 20) || (tr.dir < 0 && tr.x < -tr.cars.length * 42 - 60))
                this.train = null;
        }
        const p = this.pasture;
        const ufo = ctx.sky.flyers.find(f => f.kind === 'ufo' && f.age > f.hover && f.age < f.hover + 14);
        for (const a of [...this.cows, ...this.sheep]) {
            a.t += real;
            a.timer -= real;
            if (a.timer <= 0) {
                a.timer = rand(3, 14);
                a.state = env.night && chance(0.7) ? 'lie' : weighted([['graze', 5], ['walk', 3], ['stand', 2], ['lie', 1]]);
                if (chance(0.3))
                    a.dir = -a.dir;
                if (chance(0.12))
                    a.moo = 2;
            }
            if (a.state === 'walk') {
                a.x += a.dir * 4 * real;
                if (a.x < p.x1 + 8 || a.x > p.x2 - 38)
                    a.dir = -a.dir;
                a.y = clamp(a.y + rand(-1, 1) * real * 3, p.y1 + 18, p.y2 - 2);
            }
            if (a.moo > 0)
                a.moo -= real;
            const under = ufo && Math.abs(ufo.x + 5 - (a.x + 14)) < 14;
            a.lift = under ? Math.min(60, a.lift + real * 10) : Math.max(0, a.lift - real * 20);
        }
        for (const c of this.chickens) {
            c.t += real;
            c.timer -= real;
            if (c.timer <= 0) {
                c.timer = rand(0.5, 3);
                c.state = chance(0.5) ? 'graze' : 'walk';
                if (chance(0.4))
                    c.dir = -c.dir;
            }
            if (c.state === 'walk') {
                c.x += c.dir * 8 * real;
                if (c.x < this.house.x - 20 || c.x > this.house.x + this.house.w + 80)
                    c.dir = -c.dir;
            }
        }
        for (const d of this.ducks) {
            d.t += real;
            d.x += d.dir * 3 * real;
            if (d.x < this.pond.x + 12 || d.x > this.pond.x + this.pond.w - 18)
                d.dir = -d.dir;
        }
        if (Math.random() < real / 6 && this.pond && !this._snowy(env))
            this.fish.push({x: this.pond.x + rand(20, this.pond.w - 20), y: this.pond.y + rand(8, this.pond.h - 6), t: 0});
        for (const f of this.fish)
            f.t += real;
        this.fish = this.fish.filter(f => f.t < 1.2);
        if (Math.random() < real / 4)
            this.dogDir = chance(0.5) ? 1 : -1;
        this.dogX = clamp(this.dogX + this.dogDir * real * 10 * (Math.sin(this.t * 0.3) > 0 ? 1 : 0), this.house.x - 30, this.house.x + this.house.w + 70);
        const h = env.hour;
        if (!this.farmer && ((h > 6 && h < 6.2) || (h > 17.5 && h < 17.7) || Math.random() < real / 300) && !env.night) {
            const f = makePerson(env, {kid: false});
            f.style = 'hat';
            f.shirt = 0x4c7cd0;
            f.pants = 0x5a6a9a;
            f.frames = [];
            f.dog = f.balloon = null;
            f.umbrella = env.weather.v.rain > 0.3 ? 0x303040 : null;
            f.x = this.houseDoor.x;
            f.target = chance(0.5) ? this.barn.x + this.barn.w / 2 - 6 : this.field.x + rand(10, this.field.w - 20);
            f.dir = Math.sign(f.target - f.x) || 1;
            f.state = 'walk';
            f.back = false;
            f.y = this.G + 6;
            f.water = f.target < this.barn.x || f.target > this.barn.x + this.barn.w;
            this.farmer = f;
            this.houseDoor.open = 1.2;
        }
        if (this.farmer) {
            const f = this.farmer;
            f.t += real;
            if (f.state === 'walk') {
                f.x += f.dir * f.speed * real;
                if ((f.target - f.x) * f.dir <= 0) {
                    f.state = 'wait';
                    f.waitT = rand(5, 14);
                }
            } else {
                f.waitT -= real;
                if (f.waitT <= 0) {
                    if (f.back) {
                        this.farmer = null;
                        this.houseDoor.open = 1.2;
                    } else {
                        f.back = true;
                        f.target = this.houseDoor.x;
                        f.dir = Math.sign(f.target - f.x) || 1;
                        f.state = 'walk';
                    }
                }
            }
        }
        this.houseDoor.open = Math.max(0, this.houseDoor.open - real);
        for (const pp of this.people) {
            pp.t += real;
            pp.x += pp.dir * pp.speed * real;
        }
        this.people = this.people.filter(pp => pp.x > -60 && pp.x < this.w + 60);
        for (const w of this.wild) {
            w.t += real;
            if (w.stop > 0) {
                w.stop -= real;
                continue;
            }
            w.x += w.dir * w.speed * real;
            if (Math.random() < real / 5)
                w.stop = rand(1, 4);
        }
        this.wild = this.wild.filter(w => w.x > -80 && w.x < this.w + 80);
        if (this.chimney && (env.season !== 'summer' || env.dark > 0.3) && Math.random() < real * 1.5)
            this.smoke.push({x: this.chimney.x, y: this.chimney.y, t: 0, life: rand(3, 6)});
        for (const s of this.smoke) {
            s.t += real;
            s.y -= (s.big ? 9 : 6) * real;
            s.x += (env.weather.wind * 7 + 2) * real;
        }
        this.smoke = this.smoke.filter(s => s.t < s.life);
        const wantFlies = env.season === 'summer' && env.dark > 0.5 ? 24 : env.season === 'spring' && env.dark > 0.5 ? 8 : 0;
        while (this.flies.length < wantFlies)
            this.flies.push({x: rand(this.w), y: rand(this.meadowTop, this.roadTop), p: rand(6.28), s: rand(0.5, 1.5)});
        if (this.flies.length > wantFlies)
            this.flies.length = wantFlies;
        for (const f of this.flies) {
            f.p += real * f.s;
            f.x += Math.sin(f.p * 1.3) * 5 * real;
            f.y += Math.cos(f.p) * 4 * real;
        }
        const wantB = (env.season === 'summer' || env.season === 'spring') && env.dark < 0.2 && env.weather.v.rain < 0.1 ? 7 : 0;
        while (this.butterflies.length < wantB)
            this.butterflies.push({x: rand(this.w), y: rand(this.meadowTop + 10, this.roadTop - 10), p: rand(6), c: pick([0xf8f0f0, 0xf0d050, 0xf080c0, 0x60b0f0])});
        if (this.butterflies.length > wantB)
            this.butterflies.length = wantB;
        for (const b of this.butterflies) {
            b.p += real;
            b.x += Math.sin(b.p * 0.7) * 12 * real;
            b.y += Math.cos(b.p * 1.1) * 8 * real;
        }
        if (this.kite) {
            this.kite.t += real;
            if (this.kite.t > this.kite.life)
                this.kite = null;
        }
        if (this.owl)
            this.owl.t += real;
        this.eventTimer -= real;
        if (this.eventTimer <= 0) {
            this.eventTimer = rand(40, 140);
            this.trigger(this._pickEvent(env), env, ctx);
        }
        if (env.holidays.newYear && env.dark > 0.5 && Math.random() < real)
            ctx.sky.firework(this.church.x + rand(-80, 80));
    }

    // ---------- dynamic rendering ----------

    renderDynamic(g, env) {
        const t = this.t;
        A.drawTufts(g, this.tufts, this._season(env), env.weather);
        if (this.train)
            this._renderTrain(g, env);
        for (const w of this.wild) {
            const pose = w.stop > 0 ? 'walk2' : Math.floor(w.t * 5) % 2 ? 'walk1' : 'walk2';
            const f = animalFigure(w.kind, w.a, 0, pose);
            g.footShadow(w.x + f.w / 2, w.y, f.w - 4, 0.25);
            drawFigure(g, f, w.x, w.y, w.dir < 0);
            if (env.dark > 0.6 && w.kind !== 'rabbit')
                g.pxE(w.dir > 0 ? w.x + f.w - 6 : w.x + 5, w.y - f.h + 4, 0xd0ff90);
        }
        g.compose(this.layerM, 0, this.h, true);
        this._drawTrees(g, env, -1e9, this.mill.y);
        // windmill sails
        if (this.mill.hub) {
            const [hx, hy] = this.mill.hub;
            for (let k = 0; k < 4; k++) {
                const a = this.mill.a + k * Math.PI / 2;
                const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
                const mk = this.mill.k, L = Math.round(30 * mk), sw = Math.round(6 * mk);
                for (let i = 4; i < L; i++) {
                    const sx = hx + ca * i, sy = hy + sa * i;
                    g.px(sx, sy, INK);
                    if (i > Math.round(8 * mk)) {
                        for (let j = 1; j < sw; j++)
                            g.px(sx + nx * j, sy + ny * j, (i + j) % 4 === 0 ? 0x8a6a40 : 0xf4ece0);
                        g.px(sx + nx * sw, sy + ny * sw, INK);
                    }
                }
            }
            g.rect(hx - 2, hy - 2, 5, 5, INK);
            g.rect(hx - 1, hy - 1, 3, 3, 0x8a5a38);
        }
        this._drawTrees(g, env, this.mill.y, this.pasture.y1);
        g.compose(this.layerB, 0, this.h, true);
        this._drawTrees(g, env, this.pasture.y1, this.yardFront);
        // pond life
        const pd = this.pond;
        if (!this._snowy(env)) {
            for (let i = 0; i < 4; i++) {
                const sx = pd.x + 14 + ((t * 4 + i * 23) % (pd.w - 28));
                g.blend(sx, pd.y + 6 + (i % 3) * 5, 5, 1, 0xffffff, 0.35);
            }
            for (const f of this.fish) {
                const k = f.t / 1.2, fy = f.y - Math.sin(k * Math.PI) * 8;
                g.rect(f.x + k * 8, fy, 4, 2, 0xe88838);
                g.px(f.x + k * 8 - 1, fy, 0xe88838);
                if (k > 0.85)
                    g.blend(f.x + 4, f.y, 6, 1, 0xffffff, 0.5);
            }
            if (env.dark < 0.6)
                for (const d of this.ducks)
                    this._duck(g, d);
        }
        // pasture animals and front fence
        const p = this.pasture;
        const animals = [...this.cows, ...this.sheep].sort((a, b) => a.y - b.y);
        for (const a of animals) {
            let pose = a.state === 'walk' ? (Math.floor(a.t * 3) % 2 ? 'walk1' : 'walk2') : a.state === 'graze' ? 'graze' : a.state === 'lie' ? 'lie' : 'walk2';
            if (a.lift > 0)
                pose = 'walk2';
            const f = animalFigure(a.kind, a.a, a.b, pose);
            g.footShadow(a.x + f.w / 2, a.y, (f.w - 6) * (a.lift ? 0.7 : 1), 0.3);
            drawFigure(g, f, a.x, a.y - a.lift, a.dir < 0);
            if (a.state === 'lie' && env.dark > 0.6 && Math.floor(t + a.x) % 6 < 3)
                g.text('Z', a.x + (a.dir < 0 ? -2 : f.w), a.y - f.h - 4 - Math.floor(t % 2) * 2, 0xe0e8ff, true);
            if (a.moo > 0)
                this._bubble(g, a.x + (a.dir > 0 ? f.w - 4 : -6), a.y - f.h - 12);
        }
        A.fence(g, p.x1, p.y2 + 8, p.x2 - p.x1, A.ramp(0xb07a48));
        // farmhouse windows and porch light
        for (const w of this.wins)
            w.render(g, env);
        if (this.houseDoor.open > 0)
            g.rectE(this.houseDoor.x + 1, this.G - 37, 16, 37, env.dark > 0.4 ? 0xffd890 : 0x3a2a24);
        if (env.lampsOn) {
            const d = this.houseDoor;
            g.rectE(d.x - 7, this.G - 39, 2, 2, 0xffd890);
            g.glow(d.x - 6, this.G - 38, 22, 0xffc870, 0.35);
            const bl = this.barnLamp;
            g.rectE(bl.x, bl.y, 4, 6, 0xffd890);
            g.glow(bl.x + 2, bl.y + 3, 20, 0xffc870, 0.3);
        }
        // chickens, dog, cat, farmer
        if (env.dark < 0.55) {
            for (const c of this.chickens) {
                const f = animalFigure('chicken', c.a, 0, c.state === 'graze' && Math.floor(c.t * 3) % 2 ? 'graze' : 'walk1');
                g.footShadow(c.x + f.w / 2, c.y, f.w - 2, 0.25);
                drawFigure(g, f, c.x, c.y, c.dir < 0);
            }
            const df = dogFigure(this.dog, Math.floor(t * 5));
            g.footShadow(this.dogX + df.w / 2, this.G + 4, df.w - 2, 0.25);
            drawFigure(g, df, this.dogX, this.G + 4, this.dogDir < 0);
        } else {
            drawFigure(g, dogFigure(this.dog, 0), this.houseDoor.x + 42, this.G + 2, false);
        }
        if (env.dark > 0.3 || Math.sin(t * 0.05) > 0.4)
            drawFigure(g, catFigure(this.cat, 'sit'), this.houseDoor.x - 18, this.G - 1, false);
        if (this.farmer) {
            const f = this.farmer;
            drawPerson(g, f, f.x, f.y, f.dir, env);
            if (f.state === 'wait' && f.water)
                for (let i = 0; i < 4; i++)
                    g.blend(f.x + 18 + i * 2, f.y - 14 + ((t * 20 + i * 3) % 12), 1, 2, 0x8ac8f8, 0.8);
        }
        g.compose(this.layerC, 0, this.h, true);
        this._drawTrees(g, env, this.yardFront, 1e9);
        // sprinkler in the morning
        if (this.sprinkler && env.hour > 6 && env.hour < 7.5 && !this._snowy(env)) {
            const {x, y} = this.sprinkler;
            for (let i = 0; i < 12; i++) {
                const a = i / 12 * Math.PI * 2 + t * 2;
                const r = (t * 30 + i * 5) % 18;
                g.blend(x + Math.cos(a) * r, y - 4 + Math.sin(a) * r * 0.4 - Math.sin(r / 18 * Math.PI) * 6, 1, 1, 0x9ad0ff, 0.8);
            }
        }
        // owl at night
        if (this.owl && env.dark > 0.6) {
            const tr = this.owl.tree;
            const ox = tr.x - 3, oy = tr.y - tr.s - 4;
            g.rect(ox - 1, oy - 9, 9, 10, INK);
            g.rect(ox, oy - 8, 7, 8, 0x8a6a4a);
            g.rect(ox + 1, oy - 4, 5, 3, 0xc8a878);
            const blink = Math.floor(this.owl.t * 0.5) % 7 === 0;
            g.rectE(ox + 1, oy - 7, 2, 2, blink ? 0x8a6a4a : 0xffe060);
            g.rectE(ox + 4, oy - 7, 2, 2, blink ? 0x8a6a4a : 0xffe060);
        }
        for (const s of this.smoke) {
            const a = 0.45 * (1 - s.t / s.life), r = (s.big ? 3 : 2) + Math.floor(s.t * 1.3);
            g.blend(s.x - r / 2, s.y - r / 2, r, r, 0xe0e0e8, a);
        }
        // bees around the hives
        if ((env.season === 'summer' || env.season === 'spring') && env.dark < 0.3)
            for (const b of this.bits)
                if (b.kind === 'beehive')
                    for (let i = 0; i < 5; i++) {
                        const a = t * (1.5 + i * 0.4) + i * 1.7;
                        g.rect(b.x + 7 + Math.cos(a) * (8 + i * 2), b.y - 20 + Math.sin(a * 1.3) * 5, 2, 1, i % 2 ? 0xf8d030 : 0x2a2420);
                    }
        // road traffic and walkers
        const items = this.cars.map(v => [v.dir > 0 ? this.roadY : this.roadY - 5, v]);
        items.sort((a, b) => a[0] - b[0]);
        for (const [y, v] of items)
            drawVehicle(g, v, y, env, env.lampsOn || env.weather.v.rain > 0.5);
        for (const pp of this.people)
            drawPerson(g, pp, pp.x, pp.y, pp.dir, env);
        if (this.kite) {
            const k = this.kite;
            const kx = k.x + Math.sin(k.t * 0.7) * 30, ky = this.meadowTop - 50 + Math.sin(k.t * 1.3) * 10;
            const cy = this.roadTop - 1;
            g.line(k.x + 10, cy - 20, kx, ky + 6, 0xe0e0e0);
            g.rect(kx - 4, ky - 5, 9, 12, INK);
            g.rect(kx - 3, ky - 4, 7, 10, k.c);
            g.rect(kx - 3, ky, 7, 1, highlight(k.c, 0.4));
            g.rect(kx, ky - 4, 1, 10, highlight(k.c, 0.4));
            for (let i = 1; i < 6; i++)
                g.rect(kx + Math.sin(k.t * 3 + i) * 2, ky + 6 + i * 3, 2, 2, [0xf0f0f0, k.c][i % 2]);
            if (!k.kid) {
                k.kid = makePerson(env, {kid: true});
                k.kid.balloon = k.kid.umbrella = k.kid.dog = null;
                k.kid.state = 'wait';
            }
            drawPerson(g, k.kid, k.x, cy, 1, env);
        }
        for (const f of this.flies) {
            if (Math.sin(f.p * 3) > 0.2) {
                g.rectE(f.x, f.y, 1, 1, 0xe0ff80);
                g.glow(f.x, f.y, 6, 0xc0ff60, 0.3);
            }
        }
        for (const b of this.butterflies) {
            const up = Math.floor(b.p * 8) % 2;
            g.rect(b.x, b.y, 1, 2, 0x3a2a2a);
            g.rect(b.x - 2, b.y - up, 2, 2, b.c);
            g.rect(b.x + 1, b.y - up, 2, 2, b.c);
        }
    }

    _bubble(g, x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        g.rect(x - 2, y - 2, 13, 11, INK);
        g.rect(x - 1, y - 1, 11, 9, 0xffffff);
        g.rect(x + 5, y, 1, 6, 0x3a3a60);
        g.rect(x + 2, y + 4, 3, 3, 0x3a3a60);
        g.rect(x + 6, y, 2, 2, 0x3a3a60);
    }

    _duck(g, d) {
        const x = Math.floor(d.x), y = Math.floor(d.y), f = d.dir < 0;
        if (d.baby) {
            g.rect(x - 1, y - 5, 8, 6, INK);
            g.rect(x, y - 4, 6, 4, 0xf0d850);
            g.rect(f ? x - 2 : x + 5, y - 7, 4, 4, INK);
            g.rect(f ? x - 1 : x + 6, y - 6, 2, 2, 0xf0d850);
            g.px(f ? x - 3 : x + 9, y - 5, 0xf08a20);
        } else {
            g.rect(x - 1, y - 7, 13, 8, INK);
            g.rect(x, y - 6, 11, 6, 0xf4f0e8);
            g.rect(x + 2, y - 5, 6, 2, 0xd8d4cc);
            g.rect(f ? x - 3 : x + 9, y - 11, 6, 6, INK);
            g.rect(f ? x - 2 : x + 10, y - 10, 4, 4, 0x3a8a4a);
            g.rect(f ? x - 5 : x + 14, y - 8, 3, 2, 0xf08a20);
        }
        g.blend(x - 2, y, 16, 1, 0xffffff, 0.3);
    }

    _renderTrain(g, env) {
        const tr = this.train, y = this.railY;
        const lit = env.dark > 0.4;
        let x = tr.x;
        const order = tr.dir > 0 ? [...tr.cars.map(c => ['car', c]), ['loco']] : [['loco'], ...tr.cars.map(c => ['car', c])];
        for (const [kind, c] of order) {
            if (kind === 'loco') {
                const f = tr.dir < 0, R = A.ramp(0x2a4a5a);
                g.rect(x - 1, y - 24, 42, 22, INK);
                g.rect(x, y - 16, 40, 13, R[2]);
                g.rect(x, y - 16, 40, 2, R[3]);
                g.rect(f ? x + 26 : x, y - 28, 14, 14, INK);
                g.rect(f ? x + 27 : x + 1, y - 27, 12, 12, R[2]);
                g.rect(f ? x + 29 : x + 3, y - 25, 8, 5, lit ? 0xffd890 : A.GLASS[1]);
                g.rect(f ? x + 4 : x + 30, y - 26, 6, 10, INK);
                g.rect(f ? x + 5 : x + 31, y - 25, 4, 9, 0x3a3a44);
                g.rect(x, y - 5, 40, 2, 0xd84838);
                for (let i = 0; i < 3; i++) {
                    g.disc(x + 8 + i * 12, y - 3, 4, INK);
                    g.disc(x + 8 + i * 12, y - 3, 3, 0x5a3a2a);
                    g.px(x + 8 + i * 12 + (Math.floor(tr.t * 8) % 2 ? 1 : -1), y - 3, 0xc8c8d0);
                }
                const lx = f ? x : x + 39;
                if (lit) {
                    g.rectE(lx - 1, y - 12, 2, 3, 0xfff0c0);
                    g.glow(lx, y - 11, 18, 0xfff0c0, 0.35);
                }
                x += 42;
            } else {
                const R = A.ramp(c);
                g.rect(x - 1, y - 24, 42, 22, INK);
                g.rect(x, y - 23, 40, 19, R[2]);
                g.rect(x, y - 23, 40, 2, R[3]);
                g.rect(x, y - 6, 40, 2, R[1]);
                if (!tr.freight) {
                    for (let i = 0; i < 4; i++) {
                        const wx = x + 3 + i * 9;
                        (lit ? g.rectE.bind(g) : g.rect.bind(g))(wx, y - 19, 7, 7, lit ? 0xffe0a0 : A.GLASS[1]);
                        if ((i + Math.floor(x / 42)) % 3 === 0)
                            (lit ? g.rectE.bind(g) : g.rect.bind(g))(wx + 2, y - 17, 3, 5, lit ? 0x6a4a40 : 0x3a3a4a);
                    }
                    if (lit)
                        g.glow(x + 20, y - 15, 22, 0xffd890, 0.12);
                } else {
                    for (let i = 4; i < 40; i += 6)
                        g.rect(x + i, y - 21, 1, 15, R[1]);
                }
                g.disc(x + 7, y - 3, 3, INK);
                g.disc(x + 33, y - 3, 3, INK);
                x += 42;
            }
        }
    }
}
