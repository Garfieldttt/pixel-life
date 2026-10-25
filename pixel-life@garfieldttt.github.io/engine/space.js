// Space opera motif: a nebula full of stars, a big planet whose day side
// follows the clock, a ring station with docking shuttles, fighter
// patrols and dogfights, huge wedge cruisers, freighters jumping to
// hyperspace, comets, probes and drifting asteroids.
import {rand, randi, chance, pick, weighted, clamp} from './util.js';
import {mix, scale, pack} from './gfx.js';
import {Cells, drawFigure, lightPos} from './figure.js';
import {Timers} from './timers.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const SPACE = 0x06050e;
const HULL = [0x2a2a36, 0x4a4a58, 0x74747e, 0x9c9ca4, 0xc8c8cc];
const NEBULAS = [[0x7a2a8a, 0x2a6ab0], [0xb04a3a, 0x6a2a8a], [0x2a8a8a, 0x3a3aa0], [0xc07a3a, 0xa03a6a], [0x3a8a5a, 0x2a4a9a]];
const PLANETS = ['desert', 'gas', 'ice', 'ocean', 'lava', 'forest', 'red'];
const LASER = {light: 0xff5050, dark: 0x60ff70};

// value noise and fractal sum
function noise(seed) {
    const h = (x, y) => {
        let v = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
        v = Math.imul(v ^ (v >>> 13), 1274126177);
        return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
    };
    return (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
}

function fbm(n, x, y, oct = 4) {
    let s = 0, a = 0.5, f = 1, tot = 0;
    for (let i = 0; i < oct; i++) {
        s += n(x * f, y * f) * a;
        tot += a;
        a *= 0.5;
        f *= 2.03;
    }
    return s / tot;
}

const unpackMix = (p, c, a) => {
    const r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
    return pack(Math.round(r + (((c >> 16) & 255) - r) * a), Math.round(g + (((c >> 8) & 255) - g) * a), Math.round(b + ((c & 255) - b) * a));
};

// ---------------- ships ----------------

const SHIPS = {};

function fighterLight() {
    const c = new Cells(19, 9);
    c.rect(1, 1, 6, 1, 0xb0b0b4);
    c.rect(1, 7, 6, 1, 0xb0b0b4);
    c.rect(6, 0, 7, 1, 0x8a8a90);
    c.rect(6, 8, 7, 1, 0x8a8a90);
    c.rect(3, 2, 2, 2, 0x9a9aa0);
    c.rect(3, 5, 2, 2, 0x9a9aa0);
    c.rect(0, 3, 15, 3, 0xe8e6de);
    c.rect(15, 4, 3, 1, 0xd8d6ce);
    c.rect(2, 3, 4, 1, 0xf4f2ea);
    c.rect(6, 4, 2, 1, 0xc84040);
    c.rect(9, 3, 3, 1, 0x3a4a6a);
    c.set(10, 3, 0x6a8ab0);
    c.light(0, 1, 0xff9060, 'eng');
    c.light(0, 7, 0xff9060, 'eng');
    return c.finish(0x1a1822);
}

function fighterDark() {
    const c = new Cells(11, 11);
    c.rect(0, 0, 2, 11, 0x3a3a4a);
    c.rect(9, 0, 2, 11, 0x3a3a4a);
    c.set(0, 5, 0x6a6a7a);
    c.set(10, 5, 0x6a6a7a);
    c.rect(2, 5, 2, 1, 0x7a7a88);
    c.rect(7, 5, 2, 1, 0x7a7a88);
    c.rect(4, 3, 3, 5, 0x9a9aa8);
    c.rect(3, 4, 5, 3, 0x9a9aa8);
    c.set(5, 5, 0x1a1a2a);
    c.set(4, 4, 0xc0c0cc);
    return c.finish(0x14121a);
}

function freighter() {
    const c = new Cells(46, 15);
    for (let x = 2; x < 40; x++) {
        const dx = (x - 21) / 19, hh = Math.round(Math.sqrt(Math.max(0, 1 - dx * dx)) * 4.5);
        c.rect(x, 8 - hh, 1, hh * 2, x % 7 === 0 ? 0xa8a498 : 0xc8c4b8);
        c.set(x, 8 - hh, 0xe0dcd0);
        c.set(x, 7 + hh, 0x8a8678);
    }
    c.rect(14, 2, 10, 2, 0xb0aca0);
    return c;
}

function shuttle() {
    const c = new Cells(28, 19);
    c.rect(4, 10, 18, 6, 0xd8d8dc);
    c.rect(4, 15, 18, 1, 0x9a9aa4);
    c.rect(21, 11, 4, 4, 0xc8c8d0);
    c.rect(25, 12, 2, 2, 0xb8b8c0);
    c.rect(22, 11, 3, 2, 0x3a4a6a);
    c.set(23, 11, 0x7a9ac0);
    for (let y = 0; y < 10; y++)
        c.rect(11 + Math.floor(y / 3), y, 4 - Math.floor(y / 4), 1, 0xc8c8d0);
    c.rect(8, 16, 9, 2, 0xb0b0b8);
    c.rect(2, 11, 2, 4, 0x6a6a74);
    for (let x = 6; x < 20; x += 3)
        c.set(x, 12, 0x3a4a6a);
    c.light(1, 12, 0x80c0ff, 'eng');
    c.light(1, 14, 0x80c0ff, 'eng');
    c.light(13, 0, 0xff4040, 'blink');
    return c.finish(0x1a1822);
}

function probe() {
    const c = new Cells(9, 14);
    c.rect(2, 1, 5, 5, 0x3a3a44);
    c.rect(3, 0, 3, 1, 0x4a4a54);
    c.set(3, 3, 0x2a2a30);
    for (let i = 0; i < 4; i++)
        c.rect(1 + i * 2, 6, 1, 6 + (i % 2) * 2, 0x5a5a64);
    c.light(5, 3, 0xff3030, 'eye');
    return c.finish(0x14121a);
}

function cruiser(L) {
    const Ht = Math.round(L * 0.19), Hb = Math.round(L * 0.07), top = Math.round(L * 0.11);
    const y0 = top + Ht, H = y0 + Hb + 2;
    const c = new Cells(L + 4, H);
    const s = randi(0, 1e6);
    const hh = (x, y) => ((((x + s) * 73856093) ^ (y * 19349663)) >>> 0) % 1000;
    const topAt = x => y0 - Math.floor(x / L * Ht);
    for (let x = 0; x < L; x++) {
        const t = topAt(x), b = y0 + Math.floor(x / L * Hb);
        for (let y = t; y <= b; y++) {
            let col = y < t + 2 ? HULL[4] : y < y0 - 1 ? HULL[3] : y <= y0 ? HULL[1] : y < b ? HULL[2] : HULL[1];
            if (y > t + 1 && y !== y0 && y !== y0 - 1) {
                const bx = Math.floor(x / 9), by = Math.floor(y / 4), v = hh(bx, by);
                if (v < 140)
                    col = mix(col, HULL[1], 0.45);
                else if (v > 900)
                    col = mix(col, HULL[4], 0.4);
            }
            if (x % 24 === 0 && y > t + 2 && hh(x, 7) < 600)
                col = HULL[1];
            c.set(x, y, col);
        }
    }
    // superstructure in tiers, then the bridge with its two domes
    let tx = Math.floor(L * 0.6), tw = Math.floor(L * 0.3), ty = topAt(tx + tw);
    for (let k = 0; k < 4; k++) {
        const th = 5 + (k === 3 ? 2 : 0);
        for (let x = tx; x < tx + tw; x++)
            for (let y = ty - th; y < Math.max(ty, topAt(x) + 1); y++)
                c.set(x, y, y === ty - th ? HULL[4] : (x + y) % 11 === 0 ? HULL[2] : HULL[3]);
        for (let x = tx + 2; x < tx + tw - 2; x += 3)
            if (hh(x, k) < 350)
                c.light(x, ty - 3, 0xfff0c0, 'win');
        ty -= th;
        tx += Math.floor(tw * 0.18);
        tw = Math.floor(tw * 0.64);
    }
    const bx = tx - Math.floor(tw * 0.5), bw = tw * 2;
    c.rect(bx, ty - 4, bw, 4, HULL[3]);
    c.rect(bx, ty - 4, bw, 1, HULL[4]);
    for (let x = bx + 2; x < bx + bw - 2; x += 2)
        c.light(x, ty - 2, 0xc8e0ff, 'win');
    for (const dx of [bx + 2, bx + bw - 5]) {
        c.rect(dx, ty - 8, 3, 3, HULL[3]);
        c.set(dx + 1, ty - 9, HULL[4]);
        c.rect(dx + 1, ty - 5, 1, 1, HULL[2]);
    }
    // engine block at the stern
    const eb = topAt(L - 1);
    c.rect(L - 2, eb - 2, 5, y0 + Hb - eb + 2, HULL[1]);
    const engines = [];
    for (let k = 0; k < 3; k++) {
        const ey = eb + Math.round((k + 0.6) * (y0 + Hb - eb) / 3.2);
        c.rect(L + 1, ey - 2, 2, 5, 0x6a8ab0);
        c.light(L + 2, ey, 0xd0e8ff, 'eng');
        engines.push(ey);
    }
    // rows of tiny windows
    for (let x = 6; x < L - 6; x += 2) {
        if (hh(x, 1) < 180)
            c.light(x, y0 - 3, 0xfff0c0, 'win');
        if (hh(x, 2) < 120 && y0 + 3 < y0 + Math.floor(x / L * Hb))
            c.light(x, y0 + 3, 0xfff0c0, 'win');
    }
    // hangar below the middle
    const hx = Math.floor(L * 0.45);
    c.rect(hx, y0 + Math.floor(0.45 * Hb) - 1, 14, 2, 0x1a1a24);
    const f = c.finish(0x14121c);
    f.hangar = [hx + 8, y0 + Math.floor(0.45 * Hb) + 1];
    f.L = L;
    return f;
}

function asteroid(r) {
    const n = noise(randi(0, 1e6));
    const s = r * 2 + 2, c = new Cells(s, s);
    const base = pick([0x6a5e54, 0x5a5a62, 0x7a6a5a, 0x4e4a50]);
    for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
            const dx = x - r, dy = y - r, a = Math.atan2(dy, dx);
            const rr = r * (0.72 + 0.35 * n(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5));
            const d = Math.hypot(dx, dy);
            if (d > rr)
                continue;
            const lit = (-dx - dy) / (rr * 1.4) + 0.3 - (n(x * 0.5, y * 0.5) > 0.7 ? 0.35 : 0);
            c.set(x, y, lit > 0.55 ? mix(base, 0xfff0d8, 0.35) : lit > 0.1 ? base : lit > -0.4 ? mix(base, 0x140c20, 0.4) : mix(base, 0x140c20, 0.65));
        }
    }
    return c.finish(0x100c16);
}

function ship(kind) {
    if (!SHIPS[kind]) {
        if (kind === 'freighter') {
            const c = freighter();
            c.rect(16, 0, 1, 2, 0x9a9690);
            c.rect(14, 0, 5, 1, 0xd0ccc0);
            c.rect(33, 8, 9, 3, 0xc0bcb0);
            c.rect(41, 8, 3, 2, 0x3a4a6a);
            c.set(42, 8, 0x8ab0d0);
            c.rect(36, 5, 8, 2, 0xb8b4a8);
            for (let x = 8; x < 34; x += 5)
                c.set(x, 9, 0x6a665e);
            for (let y = 6; y < 11; y++)
                c.light(1, y, 0xa0d0ff, 'eng');
            SHIPS[kind] = c.finish(0x1a1822);
        } else {
            SHIPS[kind] = {light: fighterLight, dark: fighterDark, shuttle, probe}[kind]();
        }
    }
    return SHIPS[kind];
}

// ---------------- scene ----------------

export class Space {
    constructor(w, h, env) {
        this.name = 'space';
        this.ownSky = true;
        this.w = w;
        this.h = h;
        this.horizon = h;
        this.timers = new Timers();
        this.layout(env);
    }

    ambient() {
        return [1, 1, 1];
    }

    layout(env) {
        const W = this.w, H = this.h;
        this.t = 0;
        this.flip = chance(0.5);
        this.nebula = pick(NEBULAS);
        this.seed = randi(1, 1e6);
        this.kind = pick(PLANETS);
        // either a huge planet filling the bottom like an orbit view, or
        // a round planet in a lower corner
        if (chance(0.4)) {
            const R = Math.round(W * rand(1.1, 1.6));
            this.planet = {R, cx: W * rand(0.3, 0.7), cy: H - H * rand(0.18, 0.26) + R, rings: false};
        } else {
            const R = Math.round(H * rand(0.3, 0.42));
            this.planet = {R, cx: this.flip ? W - R * rand(0.6, 1) : R * rand(0.6, 1), cy: H - R * rand(0.45, 0.8), rings: this.kind === 'gas' ? chance(0.8) : chance(0.2)};
        }
        this.planet.tilt = rand(-0.3, 0.3);
        const p = this.planet;
        const huge = p.R > H;
        const sx = huge ? W * (chance(0.5) ? rand(0.12, 0.3) : rand(0.7, 0.88)) : this.flip ? W * rand(0.18, 0.35) : W * rand(0.6, 0.8);
        this.station = {x: Math.round(sx), y: Math.round(H * rand(0.3, 0.42)), rx: randi(56, 76)};
        this.station.ry = Math.round(this.station.rx * 0.32);
        this.station.dock = {x: this.station.x, y: this.station.y + 46};
        this.moon = chance(0.75) ? {R: randi(10, 22), x: randi(30, W - 30), y: randi(24, Math.round(H * 0.22)), kind: pick(['moon', 'ice', 'red'])} : null;
        if (this.moon && Math.abs(this.moon.x - this.station.x) < 120)
            this.moon.x = (this.moon.x + W / 2) % W;
        this.galaxy = chance(0.6) ? {x: rand(0.1, 0.9) * W, y: rand(0.08, 0.3) * H, r: randi(14, 24), a: rand(6.28)} : null;
        this.beacons = [];
        this.twinkle = [];
        this.cruisers = [];
        this.fighters = [];
        this.lasers = [];
        this.sparks = [];
        this.freighters = [];
        this.shuttles = [];
        this.streaks = [];
        this.comets = [];
        this.probes = [];
        this.rocks = [];
        for (let i = 0; i < randi(2, 6); i++)
            this._spawnRock(true);
        this.eventTimer = rand(6, 20);
        this.cruiserTimer = rand(60, 240);
        this.shuttleTimer = rand(10, 60);
        if (chance(0.6 * env.traffic))
            this.trigger('cruiser', null, null, true);
        this.layerA = this.bg = null;
    }

    // ---------- static ----------

    staticKey(env) {
        return `space:${Math.round(env.hour * 3)}`;
    }

    _lightDir(env) {
        // the day side turns with the clock: noon faces us, midnight is
        // a thin lit rim around the dark planet
        const a = (env.hour - 12) / 12 * Math.PI;
        const side = this.flip ? -1 : 1;
        let lx = Math.sin(a) * side * 0.95 + 0.25 * side, ly = -0.45, lz = Math.cos(a);
        const l = Math.hypot(lx, ly, lz);
        return [lx / l, ly / l, lz / l];
    }

    renderStatic(g, env) {
        if (!this.layerA)
            this.layerA = g.layer();
        if (!this.bg)
            this.bg = this._background(g);
        this.layerA.set(this.bg);
        g.into(this.layerA, () => {
            const L = this._lightDir(env);
            if (this.moon)
                this._sphere(g, this.moon.x, this.moon.y, this.moon.R, this.moon.kind, L, false);
            const p = this.planet;
            this._sphere(g, p.cx, p.cy, p.R, this.kind, L, p.rings);
            this._station(g);
        });
    }

    _background(g) {
        const W = this.w, H = this.h, t = new Uint32Array(W * H);
        const n1 = noise(this.seed), n2 = noise(this.seed + 7), n3 = noise(this.seed + 13);
        const [ca, cb] = this.nebula;
        const sc = 1 / Math.max(120, W / 9);
        const bgA = pack((SPACE >> 16) & 255, (SPACE >> 8) & 255, SPACE & 255);
        // the nebula is sampled on a coarse grid and interpolated, the
        // dithering per pixel keeps the chunky look
        const S = 4, gw = Math.ceil(W / S) + 2, gh = Math.ceil(H / S) + 2;
        const dens = new Float32Array(gw * gh), hues = new Float32Array(gw * gh);
        for (let j = 0; j < gh; j++) {
            for (let i = 0; i < gw; i++) {
                const x = i * S, y = j * S;
                const v = fbm(n1, x * sc, y * sc, 5);
                const dust = fbm(n3, x * sc * 2, y * sc * 2, 3);
                dens[j * gw + i] = clamp((v - 0.44) / 0.28, 0, 1) * clamp(1.3 - dust * 1.1, 0, 1);
                hues[j * gw + i] = clamp((fbm(n2, x * sc * 0.7, y * sc * 0.7, 3) - 0.35) * 2.5, 0, 1);
            }
        }
        const lerp2 = (a, x, y) => {
            const i = Math.floor(x / S), j = Math.floor(y / S), fx = x / S - i, fy = y / S - j, k = j * gw + i;
            return (a[k] * (1 - fx) + a[k + 1] * fx) * (1 - fy) + (a[k + gw] * (1 - fx) + a[k + gw + 1] * fx) * fy;
        };
        const tones = [];
        for (let h = 0; h <= 8; h++)
            for (let lv = 0; lv <= 5; lv++)
                tones.push(lv === 0 ? bgA : unpackMix(bgA, mix(mix(ca, cb, h / 8), 0xfff0f0, lv > 4 ? 0.25 : 0), lv * 0.12));
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const d = lerp2(dens, x, y);
                const lv = Math.min(5, Math.floor(d * 5 + BAYER[(y & 3) * 4 + (x & 3)]));
                t[y * W + x] = tones[Math.round(lerp2(hues, x, y) * 8) * 6 + lv];
            }
        }
        if (this.galaxy) {
            const gl = this.galaxy;
            for (let i = 0; i < 900; i++) {
                const arm = i % 2, k = Math.random();
                const ang = gl.a + arm * Math.PI + k * 5.5, rr = k * gl.r;
                const x = Math.round(gl.x + Math.cos(ang) * rr + rand(-1.5, 1.5)), y = Math.round(gl.y + Math.sin(ang) * rr * 0.4 + rand(-1, 1));
                if (x >= 0 && y >= 0 && x < W && y < H)
                    t[y * W + x] = unpackMix(t[y * W + x], 0xd8d0ff, 0.25 + (1 - k) * 0.4);
            }
            for (let y = -2; y <= 2; y++)
                for (let x = -4; x <= 4; x++) {
                    const i = Math.round(gl.y + y) * W + Math.round(gl.x + x);
                    if (i >= 0 && i < t.length && x * x / 16 + y * y / 4 <= 1)
                        t[i] = unpackMix(t[i], 0xfff0d8, 0.8 - (x * x / 16 + y * y / 4) * 0.5);
                }
        }
        // stars: mostly faint dots, some crosses, a few with long spikes
        const STARS = [0xffffff, 0xd8e4ff, 0xfff0d8, 0xffd8b8, 0xb8ccff];
        for (let i = 0; i < W * H / 150; i++) {
            const x = randi(0, W - 1), y = randi(0, H - 1), c = pick(STARS), b = rand(0.25, 1);
            const i0 = y * W + x;
            t[i0] = unpackMix(t[i0], c, b);
            const r = Math.random();
            if (r < 0.04 || r > 0.996) {
                const len = r > 0.996 ? randi(3, 5) : 1;
                for (let k = 1; k <= len; k++) {
                    const a = b * (1 - k / (len + 1)) * 0.8;
                    for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) {
                        const xx = x + dx, yy = y + dy;
                        if (xx >= 0 && yy >= 0 && xx < W && yy < H)
                            t[yy * W + xx] = unpackMix(t[yy * W + xx], c, a);
                    }
                }
                if (this.twinkle.length < 70)
                    this.twinkle.push({x, y, c, p: rand(6.28), f: rand(0.6, 2.5)});
            }
        }
        return t;
    }

    _surface(kind, n, n2, lon, lat) {
        // -> [color, night light or 0]
        const u = lon * 2.2 + 10, v = lat * 2.2 + 10;
        if (kind === 'gas') {
            const b = lat * 9 + fbm(n, u * 1.5, v * 6, 3) * 3;
            const BANDS = [0xe8d8b0, 0xd8b07a, 0xc08458, 0xece2c8, 0xa86a48, 0xd8c098];
            let c = mix(BANDS[((Math.floor(b) % 6) + 6) % 6], BANDS[((Math.floor(b) + 1) % 6 + 6) % 6], b - Math.floor(b) > 0.7 ? 0.5 : 0);
            const dx = (lon - 0.3) * 3, dy = (lat + 0.25) * 6;
            if (dx * dx + dy * dy < 1)
                c = mix(c, 0xc84a30, 0.6 - (dx * dx + dy * dy) * 0.4);
            return [c, 0];
        }
        const h = fbm(n, u, v, 5);
        if (kind === 'desert') {
            const R = [0xf0d8a0, 0xe0b878, 0xc89858, 0xa87444, 0x8a5a38];
            let c = R[clamp(Math.floor((h - 0.3) * 11), 0, 4)];
            if (Math.abs(fbm(n2, u * 2, v * 2, 3) - 0.5) < 0.015)
                c = R[4];
            return [c, 0];
        }
        if (kind === 'red') {
            const R = [0xe0905a, 0xc87048, 0xa85438, 0x8a4030];
            const pole = Math.abs(lat) > 1.25 - h * 0.3;
            return [pole ? 0xf4f0ec : R[clamp(Math.floor((h - 0.3) * 9), 0, 3)], 0];
        }
        if (kind === 'ice') {
            const R = [0xf4faff, 0xd8ecf8, 0xb0d0ec, 0x88aed8];
            let c = R[clamp(Math.floor((h - 0.3) * 9), 0, 3)];
            if (Math.abs(fbm(n2, u * 2, v * 2, 3) - 0.5) < 0.012)
                c = 0x6a90c0;
            return [c, 0];
        }
        if (kind === 'lava') {
            const crack = Math.abs(fbm(n2, u * 1.5, v * 1.5, 4) - 0.5) < 0.025;
            return crack ? [0xff8a30, 0xff7020] : [h > 0.52 ? 0x4a3a3a : 0x2e2228, 0];
        }
        const clouds = fbm(n2, u * 1.3 + lat, v * 2.6, 4);
        if (kind === 'forest') {
            const c = h > 0.62 ? 0x8a9a5a : h > 0.38 ? 0x3a7a3a : 0x2a5a8a;
            return [clouds > 0.6 ? 0xf0f4f4 : clouds > 0.56 ? mix(c, 0xf0f4f4, 0.5) : c, 0];
        }
        // ocean world with continents, clouds and city lights at night
        const land = h > 0.53;
        let c = land ? (h > 0.66 ? 0x9a8a5a : h > 0.6 ? 0x5a8a3a : 0x4a9a4a) : h > 0.48 ? 0x3a7ab8 : 0x2a5a9a;
        if (Math.abs(lat) > 1.3 - h * 0.25)
            c = 0xf0f4f8;
        const cloud = clouds > 0.6;
        if (cloud)
            c = 0xf4f6f8;
        else if (clouds > 0.56)
            c = mix(c, 0xf4f6f8, 0.5);
        const city = land && !cloud && Math.abs(lat) < 1.1 && fbm(n2, u * 9, v * 9, 2) > 0.62 ? 0xffd890 : 0;
        return [c, city];
    }

    _atmo(kind) {
        return {desert: 0xf0c890, gas: 0xf0d8b0, ice: 0xa8d8ff, ocean: 0x7ab8ff, lava: 0xff8050, forest: 0x9ad0ff, red: 0xf0a080, moon: 0, }[kind] ?? 0;
    }

    // Lit sphere with texture, terminator dithering, rim glow and rings.
    _sphere(g, cx, cy, R, kind, [lx, ly, lz], rings) {
        const W = this.w, H = this.h, t = g.t;
        const n = noise(this.seed + R), n2 = noise(this.seed + R + 3);
        const atmo = this._atmo(kind), rim = atmo ? Math.max(3, Math.round(R * 0.025)) : 0;
        const big = R > H;
        const x1 = Math.max(0, Math.floor(cx - R - rim)), x2 = Math.min(W, Math.ceil(cx + R + rim));
        const y1 = Math.max(0, Math.floor(cy - R - rim)), y2 = Math.min(H, Math.ceil(cy + R + rim));
        const tex = kind === 'moon' ? null : kind;
        for (let y = y1; y < y2; y++) {
            for (let x = x1; x < x2; x++) {
                const dx = (x + 0.5 - cx) / R, dy = (y + 0.5 - cy) / R, d2 = dx * dx + dy * dy;
                const i = y * W + x;
                if (d2 > 1) {
                    if (!atmo)
                        continue;
                    const d = Math.sqrt(d2), k = (d - 1) * R / rim;
                    if (k >= 1)
                        continue;
                    const lit = clamp((dx * lx + dy * ly) / d + 0.35, 0, 1);
                    if (lit > 0)
                        t[i] = unpackMix(t[i], atmo, (1 - k) * (1 - k) * lit * 0.75);
                    continue;
                }
                const nz = Math.sqrt(1 - d2);
                let lam = dx * lx + dy * ly + nz * lz;
                let col, night = 0;
                if (tex) {
                    const lat = Math.asin(clamp(dy, -1, 1)) * (big ? 6 : 1), lon = Math.atan2(dx, nz) * (big ? 6 : 1);
                    [col, night] = this._surface(tex, n, n2, lon, lat);
                } else {
                    const h = fbm(n, dx * 3 + 5, dy * 3 + 5, 4);
                    const crater = fbm(n2, dx * 6 + 9, dy * 6 + 9, 2);
                    col = mix(0xb8b4b0, 0x6a666a, clamp((h - 0.35) * 2.4, 0, 1));
                    if (crater > 0.66)
                        col = mix(col, 0x4a4650, 0.5);
                }
                // stepped light with dithered bands
                const shade = clamp(lam * 1.1 + 0.05, 0, 1);
                const lv = Math.floor(shade * 6 + BAYER[(y & 3) * 4 + (x & 3)] - 0.5) / 6;
                let c = scale(mix(col, 0x281838, (1 - clamp(lv, 0, 1)) * 0.25), 0.1 + 0.9 * clamp(lv, 0, 1));
                if (atmo && lam > -0.1)
                    c = mix(c, atmo, Math.pow(1 - nz, 3) * 0.55 * clamp(lam + 0.2, 0, 1));
                if (night && lam < -0.05 && (tex === 'lava' || (x * 7 + y * 13) % 5 < 2))
                    c = mix(c, night, clamp(-lam * 3, 0, 0.85));
                t[i] = pack((c >> 16) & 255, (c >> 8) & 255, c & 255);
            }
        }
        if (rings)
            this._rings(g, cx, cy, R, lz);
    }

    _rings(g, cx, cy, R, lz) {
        const W = this.w, H = this.h, t = g.t, tilt = this.planet.tilt;
        const r1 = R * 1.35, r2 = R * 2.15, sq = 0.17, ca = Math.cos(tilt), sa = Math.sin(tilt);
        const n = noise(this.seed + 99);
        const bright = 0.55 + 0.4 * Math.abs(lz);
        const x1 = Math.max(0, Math.floor(cx - r2)), x2 = Math.min(W, Math.ceil(cx + r2));
        const y1 = Math.max(0, Math.floor(cy - r2 * 0.5)), y2 = Math.min(H, Math.ceil(cy + r2 * 0.5));
        for (let y = y1; y < y2; y++) {
            for (let x = x1; x < x2; x++) {
                const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
                const u = dx * ca + dy * sa, v = (-dx * sa + dy * ca) / sq;
                const r = Math.hypot(u, v);
                if (r < r1 || r > r2)
                    continue;
                // the far half of the ring hides behind the planet
                if (v < 0 && dx * dx + dy * dy < R * R)
                    continue;
                const k = (r - r1) / (r2 - r1);
                const dens = n(k * 40, 3.3) * 0.8 + 0.2 - (k > 0.62 && k < 0.68 ? 1 : 0);
                if (dens < 0.35)
                    continue;
                const shadow = v > 0 && Math.abs(u) < R && lz > -0.2 ? 1 : 0.55;
                const c = mix(0x8a6a4a, 0xf0e0c0, clamp(dens * bright * (v > 0 ? 1 : 0.85), 0, 1));
                t[y * W + x] = unpackMix(t[y * W + x], c, clamp(dens, 0.4, 0.95) * shadow);
            }
        }
    }

    _station(g) {
        const s = this.station, H = HULL;
        const {x, y, rx, ry} = s;
        // solar wings on a truss above the ring
        const ay = y - 30;
        g.rect(x - rx - 46, ay, (rx + 46) * 2, 2, H[2]);
        g.rect(x - rx - 46, ay, (rx + 46) * 2, 1, H[3]);
        for (const side of [-1, 1]) {
            for (let k = 0; k < 3; k++) {
                const px = side < 0 ? x - rx - 44 + k * 24 : x + rx + 46 - (k + 1) * 24 + 2;
                if (Math.abs(px + 10 - x) < 20)
                    continue;
                for (const py of [ay - 12, ay + 3]) {
                    g.rect(px, py, 20, 10, 0x8a8a96);
                    g.rect(px + 1, py + 1, 18, 8, 0x1e2a6a);
                    for (let gx = px + 1; gx < px + 19; gx += 4)
                        g.rect(gx, py + 1, 1, 8, 0x3a5ab0);
                    g.rect(px + 1, py + 5, 18, 1, 0x3a5ab0);
                    g.px(px + 2, py + 2, 0x8ab0f0);
                }
            }
            this.beacons.push({x: x + side * (rx + 46), y: ay, c: side < 0 ? 0xff4040 : 0x40ff60, p: side < 0 ? 0 : 0.5});
        }
        // ring: back half, hub, front half
        const ring = front => {
            for (let yy = -ry - 1; yy <= ry + 1; yy++) {
                if (front ? yy < 0 : yy >= 0)
                    continue;
                for (let xx = -rx - 1; xx <= rx + 1; xx++) {
                    const eo = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry);
                    const ei = (xx * xx) / ((rx - 8) * (rx - 8)) + (yy * yy) / ((ry - 4) * (ry - 4));
                    if (eo > 1 || ei < 1)
                        continue;
                    const edge = eo > 0.86 || ei < 1.12;
                    let c = front ? (yy > ry * 0.55 ? H[2] : H[3]) : H[1];
                    if (edge)
                        c = front ? H[4] : H[2];
                    if (front && !edge && (xx & 7) === 0)
                        c = H[1];
                    g.px(x + xx, y + yy, c);
                }
            }
        };
        ring(false);
        g.rect(x - rx + 4, y - 1, rx * 2 - 8, 3, H[2]);
        g.rect(x - rx + 4, y - 1, rx * 2 - 8, 1, H[3]);
        // hub with bands, windows, antenna and docking collar
        const ht = y - 44, hb = y + 40;
        for (let xx = -9; xx <= 9; xx++) {
            const c = xx < -5 ? H[1] : xx < 0 ? H[2] : xx < 5 ? H[3] : H[2];
            g.rect(x + xx, ht, 1, hb - ht, c);
        }
        for (let yy = ht + 6; yy < hb; yy += 9) {
            g.rect(x - 9, yy, 19, 1, H[1]);
            for (let xx = -6; xx <= 6; xx += 3)
                if (((xx + yy) & 3) !== 0)
                    g.pxE(x + xx, yy + 4, 0xffe0a0);
        }
        g.rect(x - 12, ht - 4, 25, 4, H[3]);
        g.rect(x - 12, ht - 4, 25, 1, H[4]);
        g.rect(x, ht - 16, 1, 12, H[3]);
        g.rect(x - 4, ht - 18, 9, 2, H[4]);
        g.rect(x - 12, hb, 25, 4, H[2]);
        g.rect(x - 6, hb + 4, 13, 3, H[1]);
        this.beacons.push({x, y: ht - 18, c: 0xff4040, p: 0.25}, {x: x - 6, y: hb + 6, c: 0xffd040, p: 0.7}, {x: x + 6, y: hb + 6, c: 0xffd040, p: 0.2});
        ring(true);
        // lit windows along the front of the ring
        for (let a = 0.15; a < Math.PI - 0.1; a += 0.09) {
            const wx = Math.round(x + Math.cos(a) * (rx - 4)), wy = Math.round(y + Math.sin(a) * (ry - 2));
            if (Math.abs(wx - x) > 10 && Math.random() < 0.75)
                g.pxE(wx, wy, pick([0xffe0a0, 0xfff0d0, 0xa8d0ff]));
        }
        this.beacons.push({x: x - rx, y, c: 0xff4040, p: 0.1}, {x: x + rx, y, c: 0xff4040, p: 0.6});
        s.dock = {x, y: hb + 8};
    }

    // ---------- events ----------

    trigger(name, env, ctx, anywhere = false) {
        const W = this.w, H = this.h;
        if (name === 'cruiser') {
            if (this.cruisers.length)
                return;
            const f = cruiser(randi(230, 330));
            const dir = chance(0.5) ? 1 : -1;
            const x = anywhere ? rand(-f.w * 0.3, W - f.w * 0.7) : dir > 0 ? -f.w - 10 : W + 10;
            this.cruisers.push({f, x, y: Math.round(H * rand(0.12, 0.55)) + f.h, dir, v: rand(5, 9), launch: rand(15, 40)});
        } else if (name === 'patrol') {
            this._patrol(chance(0.5) ? 'light' : 'dark');
        } else if (name === 'dogfight') {
            this._dogfight();
        } else if (name === 'freighter' || name === 'jump' || name === 'arrive') {
            const dir = chance(0.5) ? 1 : -1, y = H * rand(0.1, 0.7);
            const mode = name === 'freighter' ? pick(['pass', 'jump', 'arrive']) : name;
            const fr = {dir, y, v: rand(30, 50), mode, t: 0, x: dir > 0 ? -50 : W + 6, state: 'fly', alpha: 1};
            if (mode === 'jump')
                fr.at = rand(0.3, 0.7) * W;
            if (mode === 'arrive') {
                fr.x = rand(0.2, 0.6) * W;
                fr.state = 'arrive';
                fr.v = 400;
            }
            this.freighters.push(fr);
        } else if (name === 'shuttle') {
            if (this.shuttles.length < 2)
                this._shuttle();
        } else if (name === 'comet') {
            const dir = chance(0.5) ? 1 : -1;
            this.comets.push({x: dir > 0 ? -20 : W + 20, y: rand(0.05, 0.35) * H, vx: dir * rand(10, 18), vy: rand(1, 4), t: 0});
        } else if (name === 'asteroids') {
            for (let i = 0; i < randi(3, 7); i++)
                this._spawnRock(false);
        } else if (name === 'probe') {
            const dir = chance(0.5) ? 1 : -1;
            this.probes.push({x: dir > 0 ? -12 : W + 12, y: rand(0.15, 0.8) * H, dir, t: rand(6), v: rand(6, 10)});
        }
    }

    _patrol(side, from) {
        const W = this.w, H = this.h;
        const dir = from ? from.dir : chance(0.5) ? 1 : -1;
        const n = randi(2, 4), y0 = from ? from.y : H * rand(0.1, 0.85), v = rand(50, 75);
        const x0 = from ? from.x : dir > 0 ? -24 : W + 24;
        for (let i = 0; i < n; i++)
            this.fighters.push({side, x: x0 - dir * i * rand(16, 26), y0: y0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * rand(7, 11), dir, v, ph: rand(6.28), amp: rand(1, 3), t: 0});
    }

    _dogfight() {
        const W = this.w, H = this.h;
        const dir = chance(0.5) ? 1 : -1, y = H * rand(0.2, 0.75);
        const prey = chance(0.5) ? 'light' : 'dark', hunter = prey === 'light' ? 'dark' : 'light';
        const v = rand(80, 110);
        const lead = {side: prey, x: dir > 0 ? -20 : W + 20, y0: y, dir, v, ph: rand(6.28), amp: rand(18, 34), w: rand(1.2, 2), t: 0, weave: true};
        this.fighters.push(lead);
        const fight = {lead, kill: chance(0.35) ? (chance(0.6) ? 'lead' : 'hunter') : null, at: rand(0.3, 0.7)};
        for (let i = 0; i < randi(1, 3); i++)
            this.fighters.push({side: hunter, x: lead.x - dir * (36 + i * 22), y0: y, dir, v, ph: 0, amp: 0, t: 0, chase: lead, lag: 0.4 + i * 0.25, off: (i % 2 ? 1 : -1) * i * 6, fire: rand(0.3, 1.2), fight});
        lead.fight = fight;
        if (chance(0.5))
            lead.fire = rand(1, 3);
    }

    _shuttle() {
        const W = this.w, s = this.station;
        const from = chance(0.5) ? -1 : 1;
        const docked = chance(0.4);
        this.shuttles.push({x: docked ? s.dock.x - 13 : from < 0 ? -30 : W + 30, y: docked ? s.dock.y + 14 : s.dock.y + rand(30, 90), dir: -from, state: docked ? 'wait' : 'in', timer: rand(20, 60), t: 0});
    }

    _spawnRock(anywhere) {
        const W = this.w, H = this.h, dir = chance(0.5) ? 1 : -1;
        const r = weighted([[randi(2, 4), 5], [randi(5, 9), 3], [randi(10, 16), 1]]);
        this.rocks.push({f: asteroid(r), x: anywhere ? rand(0, W) : dir > 0 ? -2 * r - 4 : W + 4, y: rand(0.05, 0.95) * H, vx: dir * rand(2, 8) / Math.sqrt(r), vy: rand(-0.5, 0.5)});
    }

    _explode(x, y, big = 1) {
        for (let i = 0; i < 26 * big; i++) {
            const a = rand(6.28), v = rand(10, 55) * big;
            this.sparks.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.5, 1.4), c: pick([0xfff0a0, 0xffb040, 0xff6020, 0xffffff])});
        }
        this.sparks.push({x, y, vx: 0, vy: 0, life: 0.6, c: 0xfff0c0, flash: 14 * big});
    }

    // ---------- update ----------

    update(dt, real, env) {
        const W = this.w, H = this.h;
        this.t += real;
        this.timers.run(real);
        this.eventTimer -= real;
        if (this.eventTimer <= 0) {
            this.eventTimer = rand(8, 30);
            const V = env.traffic;
            this.trigger(weighted([['patrol', 5 * V], ['dogfight', 2 * V], ['freighter', 3 * V], ['comet', 0.3], ['asteroids', 1], ['probe', 0.8 * V]]), env);
        }
        this.cruiserTimer -= real;
        if (this.cruiserTimer <= 0) {
            this.cruiserTimer = rand(180, 480) / Math.max(1, env.traffic);
            if (chance(env.traffic))
                this.trigger('cruiser', env);
        }
        this.shuttleTimer -= real;
        if (this.shuttleTimer <= 0) {
            this.shuttleTimer = rand(25, 90) / Math.max(1, env.traffic);
            if (chance(env.traffic))
                this.trigger('shuttle', env);
        }
        for (const c of this.cruisers) {
            c.x += c.dir * c.v * real;
            c.launch -= real;
            if (c.launch <= 0) {
                c.launch = rand(40, 90);
                const hx = c.dir > 0 ? c.x + c.f.w - c.f.hangar[0] : c.x + c.f.hangar[0];
                if (hx > 0 && hx < W)
                    this._patrol(chance(0.7) ? 'dark' : 'light', {x: hx, y: c.y - c.f.h + c.f.hangar[1] + 8, dir: c.dir});
            }
        }
        this.cruisers = this.cruisers.filter(c => c.x > -c.f.w - 20 && c.x < W + 20);
        for (const f of this.fighters) {
            f.t += real;
            f.x += f.dir * f.v * real;
            if (f.chase) {
                const ty = f.chase.dead ? f.y : f.chase.y + f.off;
                f.y = f.y === undefined ? ty : f.y + (ty - f.y) * Math.min(1, real / f.lag);
            } else {
                f.y = f.y0 + Math.sin(f.t * (f.w || 1.3) + f.ph) * f.amp;
            }
            if (f.fire !== undefined && !f.dead) {
                f.fire -= real;
                const onScreen = f.x > 0 && f.x < W;
                if (f.fire <= 0 && onScreen) {
                    f.fire = f.chase ? rand(0.4, 1.4) : rand(2, 4);
                    const nose = f.dir > 0 ? f.x + 18 : f.x;
                    const d = f.chase ? f.dir : -f.dir;
                    this.lasers.push({x: f.chase ? nose : f.x + 9, y: f.y + 4, vx: d * 340, c: LASER[f.side], life: 1.6});
                }
            }
            const fight = f.fight;
            if (fight && fight.kill && !fight.done && !f.dead) {
                const pos = f.dir > 0 ? f.x / W : 1 - f.x / W;
                const victim = fight.kill === 'lead' ? f === fight.lead : f !== fight.lead && f.chase;
                if (victim && pos > fight.at) {
                    fight.done = true;
                    f.dead = true;
                    this._explode(f.x + 8, f.y + 4);
                }
            }
        }
        this.fighters = this.fighters.filter(f => !f.dead && f.x > -120 && f.x < W + 120);
        for (const l of this.lasers) {
            l.x += l.vx * real;
            l.life -= real;
        }
        this.lasers = this.lasers.filter(l => l.life > 0 && l.x > -20 && l.x < W + 20);
        for (const s of this.sparks) {
            s.x += s.vx * real;
            s.y += s.vy * real;
            s.vx *= 1 - real * 0.8;
            s.vy *= 1 - real * 0.8;
            s.life -= real;
        }
        this.sparks = this.sparks.filter(s => s.life > 0);
        for (const fr of this.freighters) {
            fr.t += real;
            if (fr.state === 'fly') {
                fr.x += fr.dir * fr.v * real;
                if (fr.mode === 'jump' && (fr.dir > 0 ? fr.x > fr.at : fr.x < fr.at)) {
                    fr.state = 'charge';
                    fr.t = 0;
                }
            } else if (fr.state === 'charge') {
                fr.x += fr.dir * fr.v * real * Math.max(0, 1 - fr.t);
                if (fr.t > 1.2) {
                    fr.state = 'jump';
                    fr.t = 0;
                    fr.sx = fr.x;
                    this._hyperStreaks(fr);
                }
            } else if (fr.state === 'jump') {
                fr.x += fr.dir * real * 2600 * fr.t;
                if (fr.t > 0.35) {
                    fr.state = 'gone';
                    this.sparks.push({x: fr.sx + (fr.dir > 0 ? 40 : 0), y: fr.y + 7, vx: 0, vy: 0, life: 0.5, c: 0xd8ecff, flash: 18});
                }
            } else if (fr.state === 'arrive') {
                if (fr.t < 0.05)
                    this.sparks.push({x: fr.x + 22, y: fr.y + 7, vx: 0, vy: 0, life: 0.4, c: 0xd8ecff, flash: 16});
                fr.v = Math.max(40, fr.v - real * 900);
                fr.x += fr.dir * fr.v * real;
                if (fr.v <= 40)
                    fr.state = 'fly';
            }
        }
        this.freighters = this.freighters.filter(fr => fr.state !== 'gone' && fr.x > -80 && fr.x < W + 80);
        for (const s of this.streaks)
            s.life -= real;
        this.streaks = this.streaks.filter(s => s.life > 0);
        this._updateShuttles(real);
        for (const c of this.comets) {
            c.t += real;
            c.x += c.vx * real;
            c.y += c.vy * real;
        }
        this.comets = this.comets.filter(c => c.x > -120 && c.x < W + 120 && c.y < H + 40);
        for (const p of this.probes) {
            p.t += real;
            p.x += p.dir * p.v * real;
        }
        this.probes = this.probes.filter(p => p.x > -30 && p.x < W + 30);
        for (const r of this.rocks) {
            r.x += r.vx * real;
            r.y += r.vy * real;
        }
        this.rocks = this.rocks.filter(r => r.x > -60 && r.x < W + 60);
        if (this.rocks.length < 2 && chance(real / 20))
            this._spawnRock(false);
    }

    _hyperStreaks(fr) {
        for (let i = 0; i < 26; i++)
            this.streaks.push({x: fr.x + rand(-60, 60), y: fr.y + 7 + rand(-50, 50), len: rand(30, 160), dir: fr.dir, life: rand(0.3, 0.7), max: 0.7});
    }

    _updateShuttles(real) {
        const W = this.w, d = this.station.dock;
        for (const s of this.shuttles) {
            s.t += real;
            if (s.state === 'in') {
                const tx = d.x - 13, ty = d.y + 14;
                const dx = tx - s.x, dy = ty - s.y, dist = Math.hypot(dx, dy);
                const v = Math.min(45, 6 + dist * 0.35);
                if (dist < 1) {
                    s.state = 'wait';
                    s.timer = rand(30, 90);
                } else {
                    s.x += dx / dist * v * real;
                    s.y += dy / dist * v * real;
                    if (Math.abs(dx) > 4)
                        s.dir = dx > 0 ? 1 : -1;
                }
            } else if (s.state === 'wait') {
                s.timer -= real;
                if (s.timer <= 0) {
                    s.state = 'out';
                    s.dir = chance(0.5) ? 1 : -1;
                    s.v = 0;
                }
            } else {
                s.v = Math.min(55, s.v + real * 12);
                s.x += s.dir * s.v * real;
                s.y += real * s.v * 0.25;
            }
        }
        this.shuttles = this.shuttles.filter(s => s.state !== 'out' || (s.x > -40 && s.x < W + 40));
    }

    // ---------- render ----------

    renderDynamic(g) {
        const t = this.t;
        for (const s of this.twinkle) {
            const b = 0.5 + 0.5 * Math.sin(t * s.f + s.p);
            if (b > 0.75)
                g.pxE(s.x, s.y, mix(0x808090, s.c, b));
        }
        for (const c of this.comets) {
            const len = 70, nx = -c.vx / Math.hypot(c.vx, c.vy), ny = -c.vy / Math.hypot(c.vx, c.vy);
            for (let i = 1; i < len; i++) {
                const a = (1 - i / len) * 0.7;
                const sp = i / 9;
                g.blend(c.x + nx * i, c.y + ny * i - sp / 2, 1, 1 + sp, mix(0x80c0ff, 0xe8f4ff, 1 - i / len), a, true);
            }
            g.glow(c.x, c.y, 6, 0xc0e0ff, 0.5);
            g.pxE(c.x, c.y, 0xffffff);
        }
        for (const p of this.probes) {
            const f = ship('probe');
            const bob = Math.sin(p.t * 1.5) * 2;
            drawFigure(g, f, p.x, p.y + bob, p.dir < 0);
            if (Math.sin(p.t * 4) > 0) {
                const [lx, ly] = lightPos(f, f.lights[0], p.x, p.y + bob, p.dir < 0);
                g.pxE(lx, ly, 0xff4040);
            }
        }
        for (const b of this.beacons) {
            if (((t * 0.8 + b.p) % 1) < 0.18) {
                g.pxE(b.x, b.y, b.c);
                g.glow(b.x + 0.5, b.y + 0.5, 4, b.c, 0.4);
            }
        }
        for (const c of this.cruisers)
            this._renderCruiser(g, c);
        for (const s of this.shuttles)
            this._renderShip(g, ship('shuttle'), s.x, s.y, s.dir, s.state !== 'wait');
        for (const fr of this.freighters) {
            if (fr.state === 'jump') {
                const len = Math.abs(fr.x - fr.sx) + 46;
                const x0 = fr.dir > 0 ? fr.sx : fr.x;
                g.rectE(x0, fr.y + 6, len, 2, 0xe8f4ff);
                g.blend(x0, fr.y + 4, len, 6, 0xa0d0ff, 0.35, true);
            } else {
                this._renderShip(g, ship('freighter'), fr.x, fr.y + 15, fr.dir, true, fr.state === 'charge' ? 1.5 : 1);
            }
        }
        for (const s of this.streaks) {
            const a = s.life / s.max;
            const x = s.dir > 0 ? s.x - s.len * (1 - a) : s.x;
            g.blend(x, s.y, s.len * (1 - a * 0.5), 1, 0xe0f0ff, a * 0.8, true);
        }
        for (const f of this.fighters) {
            const sp = ship(f.side);
            this._renderShip(g, sp, f.x, f.y + sp.h, f.dir, true);
        }
        for (const l of this.lasers) {
            g.rectE(l.x, l.y, 7, 1, l.c);
            g.blend(l.x, l.y - 1, 7, 3, l.c, 0.3, true);
        }
        for (const s of this.sparks) {
            if (s.flash) {
                g.glow(s.x, s.y, s.flash * (1.2 - s.life), s.c, s.life);
                continue;
            }
            g.blend(s.x, s.y, 1, 1, s.c, Math.min(1, s.life * 1.5), true);
        }
        for (const r of this.rocks)
            drawFigure(g, r.f, r.x, r.y);
    }

    _renderShip(g, f, x, bottom, dir, engines, boost = 1) {
        const flip = dir < 0;
        drawFigure(g, f, x, bottom, flip);
        for (const l of f.lights) {
            const [lx, ly] = lightPos(f, l, x, bottom, flip);
            if (l.kind === 'eng' && engines) {
                const ex = flip ? lx + 1 : lx - 1;
                g.pxE(lx, ly, 0xffffff);
                g.blend(flip ? ex : ex - 2 * boost, ly, 3 * boost, 1, l.c, 0.6, true);
                g.glow(lx + 0.5, ly + 0.5, 3 * boost, l.c, 0.35);
            } else if (l.kind === 'blink' && Math.sin(this.t * 5) > 0.6) {
                g.pxE(lx, ly, l.c);
            }
        }
    }

    _renderCruiser(g, c) {
        const f = c.f, flip = c.dir > 0;
        drawFigure(g, f, c.x, c.y, flip);
        for (const l of f.lights) {
            const [lx, ly] = lightPos(f, l, c.x, c.y, flip);
            if (l.kind === 'eng') {
                g.glow(lx + 0.5, ly + 0.5, 9, 0x6aa8ff, 0.55);
                g.rectE(lx - 1, ly - 1, 2, 3, 0xe8f4ff);
            } else {
                g.pxE(lx, ly, l.c);
            }
        }
    }
}
