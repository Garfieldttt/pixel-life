// Retro arcade hall in side view, like the ones of the eighties: a gallery
// with more machines under the high windows, a neon sign, stairs, rows of
// upright cabinets with little games running on their screens, pinball,
// air hockey, a claw machine, a dance machine, a kiddie ride, the prize
// counter and a snack bar. People come in through the glass door, change
// money for tokens, play, watch, cheer at a new high score and go home.
// The hall keeps opening hours; Friday and Saturday nights are disco nights
// with colored spots on the blacklight carpet.
import {rand, randi, chance, pick, weighted, clamp} from './util.js';
import {mix} from './gfx.js';
import * as A from './art.js';
import {makePerson, drawPerson, personFigure} from './people.js';
import {Timers} from './timers.js';

const INK = A.INK;
const hash = (x, y, s = 0) => ((((x + s * 131) * 73856093) ^ ((y - s * 71) * 19349663)) >>> 0) % 1000;
const sh = (c, t = 0.3) => mix(c, 0x2a1040, t);
const hi = (c, t = 0.3) => mix(c, 0xfff4d0, t);
// triangle wave 0..1..0
const tri = v => 1 - Math.abs(((v % 2) + 2) % 2 - 1);

const NEON = [0xff4fb0, 0x40e0ff, 0xffe040, 0x9a60ff, 0x60ff90, 0xff7040];
const CAB_COLORS = [0x2a2a4a, 0xc83838, 0x2a5ab0, 0x1e1e24, 0xe8c040, 0x3a8a4a, 0x7a3aa0, 0xd86a20, 0xe8e4dc];
// the classics of the golden age, recognisable by their look alone
const GAMES = ['invaders', 'chomp', 'blocks', 'kong', 'pong', 'frog', 'rocks', 'racer', 'fight', 'bricks', 'jump', 'fish'];
const NAMES = ['ARCADE', 'PIXEL ARCADE', 'NEON ARCADE', 'STAR ARCADE', 'GAME ZONE', 'PLAYLAND', 'FUN CITY'];
const PLUSH = [0xf090b0, 0x80c0f0, 0xf0d050, 0x90e080, 0xc090f0, 0xf0a060, 0xf4f0e8];
const INITIALS = 'ABCDEFGHIJKLMNOPRSTUVWZ';

const WALL = [0x1c1434, 0x2a2048, 0x382c5c, 0x4a3c70, 0x5c4e88];
const CARPET = 0x221a3c;

// ---------------- scene ----------------

export class Arcade {
    constructor(w, h, env) {
        this.name = 'arcade';
        this.ownSky = true;
        this.w = w;
        this.h = h;
        this.horizon = h;
        this.timers = new Timers();
        this.layout(env);
    }

    // inside light: the hall lights when open, the windows and the exit
    // sign when shut, dimmed and colored on disco nights
    ambient(env) {
        const st = this._status(env);
        if (st.disco)
            return [0.56, 0.5, 0.78];
        if (st.lights)
            return [0.9, 0.84, 0.98];
        const day = 1 - env.dark;
        return [0.26 + day * 0.36, 0.26 + day * 0.36, 0.38 + day * 0.32];
    }

    // ---------- layout ----------

    layout(env) {
        const W = this.w, H = this.h;
        this.flip = chance(0.5);
        this.ceil = Math.round(H * 0.065);
        this.U = Math.round(H * 0.36);
        this.B = Math.round(H * 0.65);
        this.F = this.B + Math.round((H - this.B) * 0.55);
        this.frontLane = Math.min(H - 5, this.F + 26);
        this.name2 = pick(NAMES);
        this.seed = randi(1, 1e6);
        this.t = 0;
        const B = this.B, U = this.U;
        // stairs along the back wall: foot at the far end, up towards the
        // gallery, which ends where they arrive
        const run = Math.round((B - U) * 1.05);
        this.stairs = {x0: W - 22, y0: B, x1: W - 22 - run, y1: U};
        this.galleryEnd = this.stairs.x1;
        this.door = {x: 18, w: 46, h: 58};
        // ground floor along the back wall, from the door to the stairs
        this.back = [];
        const items = ['counter', 'snack', 'change', 'booth'];
        const widths0 = {counter: 108, snack: 88, change: 22, booth: 32};
        const order = [];
        for (const k of items)
            order.splice(randi(0, order.length), 0, k);
        // the big ones must fit: they get a place early on
        order.sort((a, b) => (widths0[b] > 60) - (widths0[a] > 60) || 0);
        let x = this.door.x + this.door.w + 14;
        const end = this.stairs.x1 + Math.round(run * 0.35);
        const widths = {counter: 108, snack: 88, change: 22, booth: 32};
        let slots = order.slice();
        while (x < end - 30) {
            const room = end - x;
            const want = slots.length && (chance(0.45) || room < 140 + slots.reduce((a, k) => a + widths0[k] + 14, 0)) ? slots[0] : 'cabs';
            if (want !== 'cabs') {
                if (widths[want] > room) {
                    slots.shift();
                    continue;
                }
                slots.shift();
                this.back.push({kind: want, x, w: widths[want]});
                x += widths[want] + randi(10, 18);
            } else {
                const n = Math.min(randi(2, 5), Math.floor((room - 8) / 25));
                if (n < 1)
                    break;
                for (let i = 0; i < n; i++, x += 25)
                    this.back.push(this._makeCab(x, B));
                x += randi(10, 20);
            }
        }
        this.cabs = this.back.filter(o => o.kind === 'cab');
        // the gallery: machines, a vending machine and a sofa
        this.upper = [];
        x = 16;
        while (x < this.galleryEnd - 40) {
            const room = this.galleryEnd - 16 - x;
            const r = Math.random();
            if (r < 0.12 && room > 60 && !this.upper.some(o => o.kind === 'sofa')) {
                this.upper.push({kind: 'sofa', x, w: 52});
                x += 52 + randi(10, 20);
            } else if (r < 0.22 && !this.upper.some(o => o.kind === 'vending')) {
                this.upper.push({kind: 'vending', x, w: 24});
                x += 24 + randi(8, 16);
            } else {
                const n = Math.min(randi(2, 6), Math.floor((room - 8) / 25));
                if (n < 1)
                    break;
                for (let i = 0; i < n; i++, x += 25) {
                    const c = this._makeCab(x, U - 4);
                    c.upper = true;
                    this.upper.push(c);
                    this.cabs.push(c);
                }
                x += randi(12, 26);
            }
        }
        // the front row on the floor
        this.front = [];
        const fw = {pinball: 54, hockey: 70, claw: 34, dance: 46, ride: 34, table: 40};
        const kinds = ['pinball', 'hockey', 'claw', 'dance', 'ride', 'table', 'pinball', 'claw', 'table'];
        x = randi(20, 50);
        const used = {};
        while (x < W - 60) {
            const k = weighted(kinds.map(kk => [kk, used[kk] ? (kk === 'pinball' || kk === 'table' || kk === 'claw' ? 1 / (1 + used[kk] * 2) : 0.05) : 1]));
            const w = fw[k];
            if (x + w > W - 16)
                break;
            const o = {kind: k, x, w, users: []};
            if (k === 'pinball')
                o.dir = chance(0.5) ? 1 : -1;
            if (k === 'claw')
                o.claw = {x: 0.5, y: 0, phase: 'idle', t: 0, prize: null, color: pick(NEON)};
            if (k === 'ride')
                o.kind2 = pick(['rocket', 'car', 'horse']);
            if (k === 'hockey')
                o.puck = {x: 0.5, v: 0.6};
            o.color = pick(CAB_COLORS);
            o.game = pick(GAMES);
            this.front.push(o);
            used[k] = (used[k] || 0) + 1;
            // pinball and air hockey need room at their ends for players
            x += w + (k === 'hockey' || k === 'pinball' ? randi(34, 48) : randi(28, 54));
        }
        this.gaps = [];
        let last = 0;
        for (const o of this.front) {
            const pad = o.kind === 'hockey' || o.kind === 'pinball' ? 20 : 4;
            if (o.x - pad - last > 22)
                this.gaps.push((last + o.x - pad) / 2);
            last = o.x + o.w + pad;
        }
        if (W - last > 22)
            this.gaps.push((last + W) / 2);
        if (this.flip)
            this._mirror();
        for (const o of this.front)
            this._frontStand(o);
        for (const o of this.upper)
            if (o.kind === 'sofa')
                o.seats = [o.x + 4, o.x + o.w - 22];
        this.counter = this.back.find(o => o.kind === 'counter');
        // the high score board hangs over the longest row of machines
        let best = null, row = [];
        for (const o of [...this.back, {kind: 'end'}]) {
            if (o.kind === 'cab' && (!row.length || Math.abs(o.x - row[row.length - 1].x) <= 26)) {
                row.push(o);
                continue;
            }
            if (row.length && (!best || row.length > best.length))
                best = row;
            row = o.kind === 'cab' ? [o] : [];
        }
        const mid = best ? (Math.min(...best.map(c => c.x)) + Math.max(...best.map(c => c.x)) + 24) / 2 : W / 2;
        this.boardX = Math.round(clamp(mid, 40, W - 40) - 28);
        this.snack = this.back.find(o => o.kind === 'snack');
        this.change = this.back.find(o => o.kind === 'change');
        this.booth = this.back.find(o => o.kind === 'booth');
        if (this.booth)
            this.booth.flash = 0;
        this.windows = [];
        this.scores = Array.from({length: 5}, (_, i) => ({name: this._initials(), score: (9 - i * 1.5 + rand(0, 1)) * 10000 | 0}));
        this.scores.sort((a, b) => b.score - a.score);
        this.people = [];
        this.staff = [];
        this.fx = [];
        this.bubbles = [];
        this.streaks = [];
        this.umbrellas = [];
        this.signFlicker = 0;
        this.doorOpen = 0;
        this.eventTimer = rand(15, 40);
        this.spawnTimer = 1;
        this.layerA = null;
        this.sprites = [];
        this._updateStaff(env);
        const n = this._target(env);
        for (let i = 0; i < n; i++)
            this._spawn(env, true);
    }

    _makeCab(x, base) {
        return {kind: 'cab', x, w: 24, base, game: pick(GAMES), color: pick(CAB_COLORS), trim: pick(NEON),
            mode: 'demo', t: rand(100), user: null, over: 0, broken: false, win: 0, seed: randi(0, 1e6)};
    }

    _mirror() {
        const W = this.w, m = o => {
            o.x = W - o.x - o.w;
        };
        for (const o of [...this.back, ...this.upper, ...this.front])
            m(o);
        m(this.door);
        const s = this.stairs;
        this.stairs = {x0: W - s.x0, y0: s.y0, x1: W - s.x1, y1: s.y1};
        this.galleryEnd = this.stairs.x1;
        this.gaps = this.gaps.map(gx => W - gx);
        for (const o of this.front)
            if (o.dir)
                o.dir = -o.dir;
    }

    _initials() {
        return [0, 1, 2].map(() => pick(INITIALS)).join('');
    }

    // ---------- clock and calendar ----------

    // opening hours: 10 to 23, Friday and Saturday until 1, Sunday 11
    // to 22; staff come half an hour early and leave half an hour late
    _status(env) {
        const h = env.hour, d = env.weekday;
        const late = d === 6 || d === 0 ? h < 1 : false;
        const open0 = d === 0 ? 11 : 10, close = d === 5 || d === 6 ? 25 : d === 0 ? 22 : 23;
        const hh = late ? h + 24 : h;
        const open = hh >= open0 && hh < close;
        const lights = hh >= open0 - 0.5 && hh < close + 0.5;
        const disco = open && (d === 5 || d === 6) && hh >= 20;
        const tourney = open && d === 6 && hh >= 15 && hh < 18;
        return {open, lights, disco, tourney, closing: lights && !open && hh >= close};
    }

    // how many guests: school is out in the afternoon, weekends are busy
    _target(env) {
        const st = this._status(env);
        if (!st.open)
            return 0;
        const h = env.hour < 2 ? env.hour + 24 : env.hour, wk = env.weekday === 0 || env.weekday === 6;
        let busy = h < 13 ? 0.25 : h < 15 ? 0.45 : h < 19 ? 0.85 : h < 22 ? 0.75 : 0.45;
        if (wk)
            busy = Math.max(busy, h < 12 ? 0.5 : 0.95);
        if (st.disco)
            busy = 1;
        if (env.weather.v.rain > 0.3)
            busy *= 1.2;
        return Math.round(this.w / 24 * busy * env.people);
    }

    // ---------- static layer ----------

    staticKey(env) {
        const st = this._status(env);
        return [st.lights ? 1 : 0, st.disco ? 1 : 0, env.season, Math.round(env.weather.snowCover * 2), env.holidays.halloween ? 1 : 0, env.holidays.christmas ? 1 : 0].join(':');
    }

    renderStatic(g, env) {
        if (!this.layerA) {
            this.layerA = g.layer();
            this.scratch = g.layer();
        }
        const st = this._status(env);
        this.layerA.fill(0);
        g.into(this.layerA, () => {
            this._drawRoom(g, env, st);
            for (const o of this.upper)
                this._drawBackItem(g, o, this.U - 4, env, st);
            this._drawStairs(g, env, st);
            for (const o of this.back)
                this._drawBackItem(g, o, this.B, env, st);
            this._drawDoor(g, env);
            this._drawFloor(g, env, st);
        });
        // things people pass behind or in front of are sprites
        const S = this.scratch;
        S.fill(0);
        this.sprites = [];
        const add = (y, hint, draw, extra = {}) => {
            const sp = g.masked(null, S, hint, draw);
            if (sp)
                this.sprites.push({y, sp, ...extra});
        };
        add(this.U, [this.flip ? this.galleryEnd - 4 : 0, this.U - 16, this.flip ? this.w - this.galleryEnd + 4 : this.galleryEnd + 4, 18], () => this._railing(g, env, st), {layer: 'gallery'});
        add(this.B - 1, [Math.min(this.stairs.x0, this.stairs.x1) - 4, this.U - 20, Math.abs(this.stairs.x0 - this.stairs.x1) + 8, this.B - this.U + 22], () => this._handrail(g), {layer: 'stairs'});
        for (const o of this.back)
            if (o.kind === 'counter' || o.kind === 'snack')
                add(this.B, [o.x - 4, this.B - 30, o.w + 8, 32], () => this._counterFront(g, o, st), {layer: 'staff', obj: o});
        for (const o of this.front)
            add(this.F, [o.x - 20, this.F - 70, o.w + 40, 74], () => this._drawFront(g, o, env, st), {layer: 'floor', obj: o});
        // the kiddie rides rock: their bodies are sprites of their own
        for (const s of this.sprites)
            if (s.obj?.kind === 'ride')
                s.body = g.masked(null, S, [s.obj.x - 4, this.F - 50, s.obj.w + 8, 50], () => this._rideBody(g, s.obj));
    }

    _drawRoom(g, env, st) {
        const W = this.w, H = this.h, U = this.U, B = this.B, C = this.ceil;
        // back wall: dark paint, a band of eighties zigzags at two heights
        g.rect(0, 0, W, B, WALL[1]);
        for (let y = C; y < B; y += 2)
            for (let x = (y / 2) % 2 ? 0 : 3; x < W; x += 6)
                if (hash(x, y, 3) < 140)
                    g.px(x, y, WALL[2]);
        for (const [y, ca, cb] of [[U - 64, NEON[0], NEON[1]], [B - 70, NEON[1], NEON[3]]]) {
            g.rect(0, y - 1, W, 9, WALL[0]);
            for (let x = 0; x < W; x++) {
                const z = Math.abs(((x % 12) + 12) % 12 - 6);
                g.px(x, y + z / 2 + 0.5, mix(ca, WALL[1], 0.45));
                g.px(x, y + 4 + z / 3, mix(cb, WALL[1], 0.55));
            }
        }
        // high windows on the gallery wall
        const wy = C + 10, wh = Math.round((U - 70 - wy) * 0.9);
        this.windows = [];
        if (wh > 12)
            for (let x = 30; x < W - 50; x += 92) {
                const ww = 56;
                if (Math.abs(x + ww / 2 - W / 2) < (this._signW() / 2 + 40))
                    continue;
                g.rect(x - 3, wy - 3, ww + 6, wh + 7, INK);
                g.rect(x - 2, wy - 2, ww + 4, wh + 5, 0x6a6a7a);
                g.rect(x - 4, wy + wh + 2, ww + 8, 3, INK);
                g.rect(x - 3, wy + wh + 2, ww + 6, 2, 0x8a8a9a);
                if (env.weather.snowCover > 0.3)
                    g.rect(x, wy + wh - 2, ww, 2, 0xe8f0fc);
                const panes = [];
                for (let i = 0; i < 3; i++)
                    panes.push([x + i * 19, wy, 18, wh]);
                this.windows.push(...panes);
            }
        // ceiling with a truss and spot lights
        g.rect(0, 0, W, C, 0x161226);
        for (let x = 0; x < W; x += 24)
            g.rect(x, 0, 1, C - 6, 0x221c38);
        g.rect(0, C - 7, W, 1, INK);
        g.rect(0, C - 6, W, 4, 0x4a4a5a);
        g.rect(0, C - 6, W, 1, 0x6a6a7a);
        for (let x = 0; x < W; x += 8)
            g.line(x, C - 5, x + 4, C - 3, 0x2a2a3a);
        g.rect(0, C - 2, W, 2, INK);
        this.spots = [];
        for (let x = 40; x < W; x += randi(70, 110)) {
            const c = pick([0xfff0d0, 0xfff0d0, ...NEON]);
            this.spots.push({x, y: C + 4, c, under: false});
            g.rect(x - 3, C - 2, 7, 6, INK);
            g.rect(x - 2, C - 1, 5, 4, 0x2a2a34);
            g.rect(x - 2, C + 3, 5, 1, mix(c, 0xffffff, 0.5));
            // the light cone down to the gallery
            if (st.lights && !st.disco)
                for (let y = C + 4; y < U - 4; y++) {
                    const half = 2 + (y - C) * 0.28;
                    g.blend(x - half, y, half * 2, 1, c, 0.05);
                }
        }
        // the gallery floor: a slab with a neon edge and cans underneath
        const gx0 = this.flip ? this.galleryEnd : 0, gx1 = this.flip ? W : this.galleryEnd;
        g.rect(gx0, U - 1, gx1 - gx0, 2, 0x3a3048);
        g.rect(gx0, U + 1, gx1 - gx0, 12, INK);
        g.rect(gx0, U + 2, gx1 - gx0, 9, 0x4a4058);
        g.rect(gx0, U + 2, gx1 - gx0, 1, 0x6a6080);
        g.rect(gx0, U + 9, gx1 - gx0, 2, 0x2e2640);
        g.rectE(gx0, U + 6, gx1 - gx0, 1, st.lights ? NEON[1] : 0x2a6a80);
        for (let x = gx0 + 30; x < gx1 - 10; x += randi(60, 90)) {
            const c = pick([0xfff0d0, 0xfff0d0, NEON[0], NEON[2]]);
            this.spots.push({x, y: U + 16, c, under: true});
            g.rect(x - 3, U + 12, 7, 5, INK);
            g.rect(x - 2, U + 12, 5, 4, 0x2a2a34);
            g.rect(x - 2, U + 16, 5, 1, mix(c, 0xffffff, 0.5));
            if (st.lights && !st.disco)
                for (let y = U + 17; y < B + 8; y++) {
                    const half = 2 + (y - U - 17) * 0.24;
                    g.blend(x - half, y, half * 2, 1, c, 0.04);
                }
        }
        // posters between the machines
        const posters = randi(5, 8);
        this.posters = [];
        for (let i = 0; i < posters; i++) {
            const px = randi(20, W - 60), py = randi(U + 22, B - 104);
            const s = this.stairs, sl = Math.min(s.x0, s.x1) - 36, sr = Math.max(s.x0, s.x1) + 4;
            if (Math.abs(px + 15 - this.boardX - 28) < 60 || (px > sl && px < sr) || this.posters?.some(q => Math.abs(q - px) < 44))
                continue;
            (this.posters ??= []).push(px);
            this._poster(g, px, py, i);
        }
        // seasonal dressing
        if (env.holidays.halloween)
            for (let x = 4; x < gx1 - gx0 - 4; x += 10) {
                const yy = U + 14 + Math.round(Math.sin(x / 30 * Math.PI) * 3);
                g.px(gx0 + x, yy, x % 20 ? 0xf08a20 : 0x8a40c0);
            }
        if (env.holidays.christmas)
            for (let x = 0; x < gx1 - gx0; x += 2)
                g.px(gx0 + x, U + 13 + Math.round(Math.abs(Math.sin(x / 40 * Math.PI)) * 4), 0x2a6a3a);
    }

    _signW() {
        return this.name2.length * 13;
    }

    _poster(g, x, y, i) {
        const w = 30, h = 40, kind = (this.seed + i) % 5, bg = pick([0x1e2a5a, 0x5a1e3a, 0x1e4a3a, 0x3a1e5a, 0x1a1a1a]);
        g.rect(x - 1, y - 1, w + 2, h + 2, INK);
        g.rect(x, y, w, h, bg);
        g.rect(x + 1, y + 1, w - 2, 1, hi(bg, 0.2));
        const cx = x + w / 2;
        switch (kind) {
        case 0: // rocket over a planet
            g.disc(cx, y + h - 6, 12, 0x6a3ac0);
            g.rect(cx - 2, y + 8, 5, 14, 0xe8e4dc);
            g.rect(cx - 1, y + 6, 3, 2, 0xd83a3a);
            g.rect(cx - 4, y + 18, 2, 4, 0xd83a3a);
            g.rect(cx + 3, y + 18, 2, 4, 0xd83a3a);
            g.rect(cx - 1, y + 22, 3, 3, 0xf0b030);
            break;
        case 1: // sports car on a sunset road
            for (let k = 0; k < 6; k++)
                g.rect(x + 2, y + 4 + k * 2, w - 4, 2, mix(0xf0c040, 0xd83a8a, k / 5));
            g.rect(x + 1, y + 16, w - 2, h - 17, 0x2a1a3a);
            g.line(cx, y + 16, x + 3, y + h - 2, 0xff4fb0);
            g.line(cx, y + 16, x + w - 4, y + h - 2, 0xff4fb0);
            g.rect(cx - 6, y + 26, 12, 4, 0xd83838);
            g.rect(cx - 4, y + 24, 8, 2, 0x5a8ac8);
            g.rect(cx - 6, y + 30, 3, 2, INK);
            g.rect(cx + 3, y + 30, 3, 2, INK);
            break;
        case 2: // robot
            g.rect(cx - 6, y + 8, 12, 9, 0xa8b0c0);
            g.rect(cx - 4, y + 11, 3, 2, 0x40e0ff);
            g.rect(cx + 1, y + 11, 3, 2, 0x40e0ff);
            g.rect(cx, y + 4, 1, 4, 0xa8b0c0);
            g.px(cx, y + 3, 0xff4040);
            g.rect(cx - 8, y + 18, 16, 12, 0x8a90a0);
            g.rect(cx - 3, y + 21, 6, 4, 0xffe040);
            g.rect(cx - 6, y + 30, 4, 6, 0x6a7080);
            g.rect(cx + 2, y + 30, 4, 6, 0x6a7080);
            break;
        case 3: // dragon head
            g.rect(cx - 9, y + 12, 16, 10, 0x3a9a4a);
            g.rect(cx + 7, y + 16, 6, 6, 0x3a9a4a);
            g.rect(cx - 5, y + 14, 2, 2, 0xffe040);
            g.rect(cx - 9, y + 9, 3, 4, 0x2a7a3a);
            g.rect(cx - 3, y + 9, 3, 4, 0x2a7a3a);
            for (let k = 0; k < 8; k++)
                g.px(cx + 13 + (k % 3), y + 18 - k, k % 2 ? 0xf08020 : 0xffd040);
            g.rect(x + 3, y + h - 8, w - 6, 3, 0xffd040);
            break;
        default: // joystick
            g.rect(cx - 9, y + 24, 18, 8, 0x2a2a30);
            g.rect(cx - 9, y + 24, 18, 1, 0x4a4a52);
            g.rect(cx - 1, y + 12, 2, 12, 0x8a8a92);
            g.disc(cx, y + 11, 4, 0xd83838);
            g.px(cx - 1, y + 9, 0xff9090);
            g.disc(cx + 6, y + 27, 1, 0xffe040);
        }
        // title strip
        g.rect(x + 3, y + h - 4, w - 6, 1, hi(bg, 0.5));
    }

    // ---------- machines and counters against the wall ----------

    _drawBackItem(g, o, base, env, st) {
        switch (o.kind) {
        case 'cab':
            this._cab(g, o, base, st);
            break;
        case 'counter':
            this._counterBack(g, o, base, st);
            break;
        case 'snack':
            this._snackBack(g, o, base, st);
            break;
        case 'change':
            this._changeMachine(g, o, base, st);
            break;
        case 'booth':
            this._boothBody(g, o, base);
            break;
        case 'vending':
            this._vending(g, o, base, st);
            break;
        case 'sofa':
            this._sofa(g, o, base);
            break;
        }
    }

    // Upright cabinet seen from the front, 24 wide and 46 tall: marquee
    // with the game's picture, screen in its bezel, control panel with
    // stick and buttons, coin door.
    _cab(g, c, base, st) {
        const x = c.x, w = c.w, col = c.color, R = A.ramp(col), top = base - 46;
        c.screen = [x + 3, top + 9, w - 6, 14];
        g.footShadow(x + w / 2, base, w + 6, 0.35);
        g.rect(x - 1, top - 1, w + 2, 47, INK);
        // side panels and front
        g.rect(x, top, w, 46, R[2]);
        g.rect(x, top, 2, 46, R[3]);
        g.rect(x + w - 2, top, 2, 46, R[1]);
        // side art stripes
        g.rect(x + 1, top + 26, 1, 16, c.trim);
        g.rect(x + w - 2, top + 26, 1, 16, sh(c.trim, 0.3));
        // marquee
        g.rect(x + 1, top, w - 2, 8, INK);
        this._marquee(g, c, x + 2, top + 1, w - 4, 6, st.lights);
        // bezel and screen
        g.rect(x + 1, top + 8, w - 2, 16, 0x141418);
        g.rect(x + 2, top + 8, w - 4, 1, 0x2a2a34);
        g.rect(x + 3, top + 9, w - 6, 14, 0x0c0c14);
        // control panel sticking out
        g.rect(x - 2, top + 25, w + 4, 6, INK);
        g.rect(x - 1, top + 26, w + 2, 4, R[3]);
        g.rect(x - 1, top + 26, w + 2, 1, R[4]);
        g.rect(x - 1, top + 29, w + 2, 1, R[1]);
        g.rect(x + 5, top + 24, 1, 3, 0x8a8a92);
        g.rect(x + 4, top + 23, 3, 2, 0xd83838);
        g.px(x + 4, top + 23, 0xff9090);
        for (const [bx, bc] of [[x + 12, 0xffe040], [x + 15, 0x40c0ff], [x + 18, 0x60e060]]) {
            g.rect(bx, top + 27, 2, 1, bc);
            g.px(bx, top + 27, hi(bc, 0.5));
        }
        // coin door with two lit slots
        g.rect(x + 7, top + 34, 10, 9, INK);
        g.rect(x + 8, top + 35, 8, 7, 0x4a4a52);
        g.rect(x + 8, top + 35, 8, 1, 0x6a6a72);
        for (const sx of [x + 9, x + 13]) {
            if (st.lights)
                g.rectE(sx, top + 37, 2, 3, 0xff4030);
            else
                g.rect(sx, top + 37, 2, 3, 0x6a2a2a);
        }
        g.rect(x + 1, base - 2, w - 2, 2, R[0]);
    }

    // the backlit marquee: a little picture of the game it runs
    _marquee(g, c, x, y, w, h, lit) {
        const R = (xx, yy, ww, hh, col) => (lit ? g.rectE(x + xx, y + yy, ww, hh, col) : g.rect(x + xx, y + yy, ww, hh, sh(col, 0.55)));
        const P = (xx, yy, col) => R(xx, yy, 1, 1, col);
        const bg = {invaders: 0x0a0a2a, chomp: 0x0a0a2a, blocks: 0x1a2a6a, kong: 0x2a0a0a, pong: 0x101010, frog: 0x1a6a2a,
            rocks: 0x0a0a1a, racer: 0xe8e8f0, fight: 0xc83818, bricks: 0x1a1a3a, jump: 0x5a9ae8, fish: 0x1a5aaa}[c.game] ?? 0x1a1a2a;
        R(0, 0, w, h, bg);
        R(0, 0, w, 1, hi(bg, 0.25));
        switch (c.game) {
        case 'invaders':
            for (const [ix, ic] of [[2, 0x60ff90], [8, 0xff4fb0], [14, 0x40e0ff]]) {
                R(ix, 1, 3, 1, ic);
                P(ix, 2, ic);
                P(ix + 2, 2, ic);
                P(ix + 1, 3, ic);
            }
            R(8, h - 1, 3, 1, 0x60ff90);
            break;
        case 'chomp':
            R(2, 1, 3, 4, 0xffe020);
            P(4, 2, bg);
            P(4, 3, bg);
            for (const dx of [7, 9, 11])
                P(dx, 3, 0xf0c8a0);
            R(14, 1, 3, 3, 0xff3030);
            P(14, 4, 0xff3030);
            P(16, 4, 0xff3030);
            P(15, 2, 0xffffff);
            break;
        case 'blocks':
            R(1, 3, 4, 2, 0x40e0f0);
            R(6, 2, 2, 3, 0xb050f0);
            R(8, 3, 1, 1, 0xb050f0);
            R(10, 1, 2, 2, 0xf0e040);
            R(10, 3, 2, 2, 0xf0e040);
            R(13, 2, 2, 1, 0xf04040);
            R(14, 3, 2, 2, 0xf04040);
            break;
        case 'kong':
            for (let k = 0; k < w; k++)
                P(k, h - 1 - Math.floor(k / 10), k % 3 ? 0xe03050 : 0xff90a0);
            R(2, 1, 4, 3, 0x9a5020);
            P(3, 2, 0xf0c090);
            P(10, 2, 0xc07030);
            P(14, 1, 0xff80c0);
            break;
        case 'pong':
            R(2, 1, 1, 3, 0xffffff);
            R(w - 3, 2, 1, 3, 0xffffff);
            P(9, 2, 0xffffff);
            for (let k = 0; k < h; k += 2)
                P(Math.floor(w / 2), k, 0x6a6a6a);
            break;
        case 'frog':
            R(0, 4, w, 2, 0x1a3aaa);
            R(3, 4, 4, 1, 0xa06030);
            R(7, 1, 3, 3, 0x40ff40);
            P(7, 1, 0xffff60);
            P(9, 1, 0xffff60);
            R(13, 4, 3, 1, 0xa06030);
            break;
        case 'rocks':
            for (const [rx, ry] of [[3, 2], [13, 3]]) {
                R(rx - 1, ry - 1, 3, 1, 0xc0c0c0);
                R(rx - 1, ry + 1, 3, 1, 0xc0c0c0);
                P(rx - 2, ry, 0xc0c0c0);
                P(rx + 2, ry, 0xc0c0c0);
            }
            P(9, 1, 0xffffff);
            R(8, 2, 3, 1, 0xffffff);
            break;
        case 'racer':
            for (let k = 0; k < w; k++)
                for (let r = 0; r < h; r++)
                    if ((k >> 1) % 2 === (r >> 1) % 2)
                        P(k, r, 0x1a1a1a);
            R(7, 1, 6, 3, 0xe03030);
            P(8, 4, 0x1a1a1a);
            P(11, 4, 0x1a1a1a);
            break;
        case 'fight':
            R(0, h - 1, w, 1, 0x6a2a0a);
            R(5, 1, 2, 4, 0x3a5aff);
            P(5, 1, 0xffd0a0);
            R(7, 2, 2, 1, 0x3a5aff);
            R(12, 1, 2, 4, 0xffffff);
            P(13, 1, 0xffd0a0);
            R(10, 2, 2, 1, 0xffd0a0);
            break;
        case 'bricks':
            for (let r = 0; r < 3; r++)
                for (let k = 0; k < w; k += 3)
                    R(k, r + 1, 2, 1, [0xff4040, 0xffa040, 0x40c0ff][r]);
            R(8, h - 1, 4, 1, 0xd0d0e0);
            break;
        case 'jump':
            R(0, h - 1, w, 1, 0xb06030);
            R(13, 1, 3, 3, 0xf0c040);
            P(14, 2, 0x8a5a10);
            R(3, 1, 2, 1, 0xe03030);
            R(3, 2, 2, 2, 0x3a5ae0);
            break;
        default:
            for (const [fx, fy, fc] of [[3, 2, 0xffa040], [10, 1, 0xffe040], [14, 3, 0xff6fb0]]) {
                R(fx, fy, 2, 1, fc);
                P(fx - 1, fy, 0xffffff);
            }
        }
    }

    _counterBack(g, o, base, st) {
        // shelves on the wall full of prizes, a big bear on top
        const x = o.x, w = o.w, top = base - 86;
        o.staffX = x + w / 2 - 9;
        g.rect(x - 1, top - 1, w + 2, 60, INK);
        g.rect(x, top, w, 58, 0x5a3a2a);
        for (let s = 0; s < 3; s++) {
            const sy = top + 16 + s * 19;
            g.rect(x, sy, w, 2, 0x8a5a3a);
            g.rect(x, sy + 2, w, 1, 0x3a2418);
            for (let px = x + 3; px < x + w - 8; px += 9) {
                const c = PLUSH[hash(px, sy, this.seed) % PLUSH.length], k = hash(px, s, 9) % 3;
                if (k === 0) {
                    // plush animal
                    g.disc(px + 3, sy - 6, 4, INK);
                    g.disc(px + 3, sy - 6, 3, c);
                    g.rect(px, sy - 11, 2, 2, c);
                    g.rect(px + 5, sy - 11, 2, 2, c);
                    g.px(px + 2, sy - 7, INK);
                    g.px(px + 4, sy - 7, INK);
                } else if (k === 1) {
                    // ball
                    g.disc(px + 3, sy - 4, 3, INK);
                    g.disc(px + 3, sy - 4, 2, c);
                    g.px(px + 2, sy - 5, 0xffffff);
                } else {
                    // boxed toy
                    g.rect(px, sy - 10, 7, 10, INK);
                    g.rect(px + 1, sy - 9, 5, 9, c);
                    g.rect(px + 2, sy - 7, 3, 3, 0xd0e8f8);
                }
            }
        }
        // giant bear on top of the shelves
        const bx = x + w - 22, by = top - 2;
        g.disc(bx, by - 10, 9, INK);
        g.disc(bx, by - 10, 8, 0xb07840);
        g.disc(bx, by - 22, 7, INK);
        g.disc(bx, by - 22, 6, 0xb07840);
        g.disc(bx - 5, by - 28, 2, 0xb07840);
        g.disc(bx + 5, by - 28, 2, 0xb07840);
        g.rect(bx - 3, by - 23, 1, 1, INK);
        g.rect(bx + 2, by - 23, 1, 1, INK);
        g.rect(bx - 1, by - 20, 3, 2, 0xe8c8a0);
        g.rect(bx - 4, by - 15, 8, 2, 0xd83838);
        // sign
        this._label(g, x + 6, top - 12, 'PRIZES', NEON[2], st.lights);
    }

    _counterFront(g, o, st) {
        const x = o.x, w = o.w, base = this.B;
        g.footShadow(x + w / 2, base, w + 8, 0.35);
        g.rect(x - 1, base - 25, w + 2, 25, INK);
        if (o.kind === 'counter') {
            // glass counter: prizes inside, lit
            g.rect(x, base - 24, w, 3, 0x9aa0b0);
            g.rect(x, base - 24, w, 1, 0xd0d4e0);
            g.rect(x, base - 21, w, 13, st.lights ? 0x8ab8d8 : 0x3a4a5a);
            for (let px = x + 4; px < x + w - 6; px += 8) {
                const c = PLUSH[hash(px, 1, this.seed) % PLUSH.length];
                g.rect(px, base - 15, 5, 5, c);
                g.px(px + 1, base - 15, hi(c, 0.5));
            }
            g.rect(x + 2, base - 20, 1, 10, 0xe8f4fc);
            g.rect(x, base - 8, w, 8, 0x5a3a2a);
            g.rect(x, base - 8, w, 1, 0x8a5a3a);
            // ticket eater on the end
            g.rect(x + w - 12, base - 32, 9, 8, INK);
            g.rect(x + w - 11, base - 31, 7, 7, 0xd83838);
            g.rect(x + w - 10, base - 29, 5, 1, INK);
        } else {
            g.rect(x, base - 24, w, 3, 0xd8d0c0);
            g.rect(x, base - 24, w, 1, 0xf4ece0);
            g.rect(x, base - 21, w, 21, 0xc83838);
            for (let px = x; px < x + w; px += 8)
                g.rect(px, base - 21, 4, 21, 0xf0e8dc);
            g.rect(x, base - 21, w, 1, 0x8a2a2a);
            // cups and a napkin box on the top
            g.rect(x + 6, base - 29, 4, 5, 0xf0e8dc);
            g.rect(x + 6, base - 29, 4, 1, 0xd83838);
            g.rect(x + 11, base - 28, 4, 4, 0xf0e8dc);
            g.rect(x + w - 16, base - 28, 7, 4, 0x8a8a92);
        }
    }

    _snackBack(g, o, base, st) {
        const x = o.x, w = o.w, top = base - 70;
        o.staffX = x + w / 2 - 9;
        // menu board
        g.rect(x + 4, top - 1, w - 8, 22, INK);
        g.rect(x + 5, top, w - 10, 20, 0x14141c);
        this._label(g, x + 10, top + 3, 'SNACKS', NEON[0], st.lights);
        for (let i = 0; i < 3; i++) {
            const ix = x + 12 + i * 22, iy = top + 12;
            g.rect(ix, iy, 4, 5, [0xf0e060, 0xd83838, 0x40a0e0][i]);
            g.rect(ix + 6, iy + 2, 8, 1, 0x8a8a9a);
        }
        // popcorn machine
        const px = x + 6;
        g.rect(px - 1, base - 52, 22, 26, INK);
        g.rect(px, base - 51, 20, 4, 0xd83838);
        g.rect(px, base - 47, 20, 16, st.lights ? 0xfff0c0 : 0x6a6050);
        for (let i = 0; i < 26; i++)
            g.rect(px + 1 + hash(i, 1, 5) % 18, base - 40 + hash(i, 2, 5) % 8, 2, 2, i % 3 ? 0xfff8e0 : 0xf0d070);
        g.rect(px, base - 31, 20, 5, 0xd83838);
        g.rect(px + 9, base - 47, 1, 16, 0xb02828);
        // slush machine: two drums
        o.slush = [];
        for (let k = 0; k < 2; k++) {
            const sx = x + w - 34 + k * 14;
            g.rect(sx - 1, base - 50, 13, 26, INK);
            g.rect(sx, base - 49, 11, 4, 0x8a8a92);
            g.rect(sx, base - 45, 11, 15, 0x14141c);
            o.slush.push([sx, base - 45, 11, 15, k ? 0xff4f80 : 0x40b0ff]);
            g.rect(sx, base - 30, 11, 6, 0xb0b0b8);
            g.rect(sx + 4, base - 28, 3, 2, 0x5a5a62);
        }
    }

    _changeMachine(g, o, base, st) {
        const x = o.x, w = o.w, top = base - 50;
        g.footShadow(x + w / 2, base, w + 4, 0.35);
        g.rect(x - 1, top - 1, w + 2, 51, INK);
        g.rect(x, top, w, 50, 0x8a8a96);
        g.rect(x, top, 2, 50, 0xb0b0bc);
        g.rect(x + w - 2, top, 2, 50, 0x6a6a76);
        g.rect(x + 2, top + 3, w - 4, 8, INK);
        if (st.lights)
            g.rectE(x + 3, top + 4, w - 6, 6, 0xffe040);
        else
            g.rect(x + 3, top + 4, w - 6, 6, 0x6a5a20);
        g.text('T', x + 9, top + 5, 0x3a2a0a, st.lights);
        g.rect(x + 5, top + 16, w - 10, 3, INK);
        g.rect(x + 6, top + 17, w - 12, 1, 0x40e060);
        g.rect(x + 7, top + 24, 8, 4, 0x2a2a30);
        g.rect(x + 4, top + 36, w - 8, 7, INK);
        g.rect(x + 5, top + 37, w - 10, 5, 0x3a3a42);
        o.tray = [x + 5, top + 37];
    }

    _boothBody(g, o, base) {
        const x = o.x, w = o.w, top = base - 56;
        g.footShadow(x + w / 2, base, w + 6, 0.35);
        g.rect(x - 1, top - 1, w + 2, 57, INK);
        g.rect(x, top, w, 56, 0x3a6ab0);
        g.rect(x, top, 2, 56, 0x5a8ad0);
        g.rect(x + w - 2, top, 2, 56, 0x2a4a80);
        g.rect(x + 2, top + 2, w - 4, 8, 0xf0e8dc);
        g.text('FOTO', x + 4, top + 4, 0xd83838);
        // opening with the curtain (drawn as it moves) and a stool inside
        o.door = [x + 4, top + 12, w - 12, 42];
        g.rect(x + 4, top + 12, w - 12, 42, 0x1a1a24);
        g.rect(x + 8, base - 12, 8, 2, 0x8a8a92);
        g.rect(x + 11, base - 10, 2, 9, 0x5a5a62);
        // photo slot on the side
        g.rect(x + w - 6, top + 30, 4, 10, INK);
        g.rect(x + w - 5, top + 31, 2, 8, 0x5a5a62);
        o.slot = [x + w - 5, top + 40];
    }

    _vending(g, o, base, st) {
        const x = o.x, w = o.w, top = base - 48;
        g.footShadow(x + w / 2, base, w + 4, 0.35);
        g.rect(x - 1, top - 1, w + 2, 49, INK);
        g.rect(x, top, w, 48, 0xc83838);
        g.rect(x, top, 2, 48, 0xe86060);
        g.rect(x + 2, top + 3, w - 9, 34, 0x14141c);
        for (let r = 0; r < 4; r++)
            for (let k = 0; k < 3; k++)
                g.rect(x + 3 + k * 5, top + 5 + r * 8, 3, 6, PLUSH[(r * 3 + k) % PLUSH.length]);
        if (st.lights)
            g.blend(x + 2, top + 3, w - 9, 34, 0xffffff, 0.12);
        g.rect(x + w - 6, top + 6, 4, 10, 0x2a2a30);
        g.rect(x + 3, top + 40, w - 9, 5, INK);
    }

    _sofa(g, o, base) {
        const x = o.x, w = o.w, c = 0x8a3a8a, R = A.ramp(c);
        g.footShadow(x + w / 2, base, w + 6, 0.35);
        g.rect(x - 1, base - 24, w + 2, 22, INK);
        g.rect(x, base - 23, w, 10, R[2]);
        g.rect(x, base - 23, w, 1, R[3]);
        g.rect(x, base - 13, w, 9, R[1]);
        g.rect(x - 2, base - 18, 6, 14, INK);
        g.rect(x - 1, base - 17, 4, 12, R[2]);
        g.rect(x + w - 4, base - 18, 6, 14, INK);
        g.rect(x + w - 3, base - 17, 4, 12, R[2]);
        g.rect(x + 2, base - 4, 3, 4, INK);
        g.rect(x + w - 5, base - 4, 3, 4, INK);
    }

    _label(g, x, y, s, c, lit) {
        const w = g.textWidth(s);
        g.rect(x - 2, y - 2, w + 4, 9, INK);
        g.rect(x - 1, y - 1, w + 2, 7, 0x14141c);
        g.text(s, x, y, lit ? c : sh(c, 0.6), lit);
    }

    // ---------- stairs, door, floor ----------

    _drawStairs(g, env, st) {
        const s = this.stairs, n = Math.round((s.y0 - s.y1) / 6), dir = s.x1 < s.x0 ? -1 : 1;
        const run = Math.abs(s.x0 - s.x1) / n;
        // the space under the stairs: a staff door
        const ux = dir < 0 ? s.x1 : s.x0;
        const dx = dir < 0 ? s.x1 + 12 : s.x1 - 34;
        g.rect(dx - 1, s.y0 - 41, 24, 41, INK);
        g.rect(dx, s.y0 - 40, 22, 40, 0x5a5a6a);
        g.rect(dx + 2, s.y0 - 38, 18, 36, 0x6a6a7a);
        g.rect(dx + 16, s.y0 - 22, 3, 2, 0xc8c8d0);
        g.rect(dx + 4, s.y0 - 34, 14, 5, 0xf0e8dc);
        g.rect(dx + 6, s.y0 - 32, 10, 1, 0x3a3a4a);
        void ux;
        // steps, each a tread and a riser, with a dark stringer below
        for (let i = 0; i < n; i++) {
            const y = s.y0 - (i + 1) * 6;
            const x0 = Math.round(s.x0 + dir * i * run), x1 = Math.round(s.x0 + dir * (i + 1) * run);
            const l = Math.min(x0, x1), w = Math.abs(x1 - x0) + 1;
            g.rect(l - 1, y - 1, w + 2, 8, INK);
            g.rect(l, y, w, 2, 0x8a8a96);
            g.rect(l, y, w, 1, 0xb0b0bc);
            g.rect(l, y + 2, w, 4, 0x4a4458);
            if (st.lights)
                g.rectE(l, y + 5, w, 1, NEON[3]);
        }
        // stringer
        for (let i = 0; i <= n * run; i++) {
            const x = Math.round(s.x0 + dir * i), y = s.y0 - Math.round(i / run * 6);
            g.rect(x, y + 1, 1, 6, 0x2a2438);
            g.px(x, y + 7, INK);
        }
    }

    _handrail(g) {
        const s = this.stairs, dir = s.x1 < s.x0 ? -1 : 1, len = Math.abs(s.x0 - s.x1);
        for (let i = 0; i <= len; i++) {
            const x = Math.round(s.x0 + dir * i), y = Math.round(s.y0 - (s.y0 - s.y1) * i / len) - 16;
            g.px(x, y - 1, INK);
            g.px(x, y, 0xc8c8d4);
            g.px(x, y + 1, 0x8a8a96);
            g.px(x, y + 2, INK);
            if (i % 16 === 0)
                g.rect(x, y + 2, 1, 14, 0x8a8a96);
        }
    }

    _railing(g, env, st) {
        const U = this.U, x0 = this.flip ? this.galleryEnd : 0, x1 = this.flip ? this.w : this.galleryEnd;
        g.rect(x0, U - 14, x1 - x0, 1, INK);
        g.rect(x0, U - 13, x1 - x0, 2, 0xc8c8d4);
        g.rect(x0, U - 11, x1 - x0, 1, INK);
        g.rect(x0, U - 6, x1 - x0, 1, 0x8a8a96);
        for (let x = x0 + 4; x < x1; x += 14) {
            g.rect(x - 1, U - 11, 3, 11, INK);
            g.px(x, U - 10, 0xc8c8d4);
            g.rect(x, U - 9, 1, 9, 0x8a8a96);
        }
        // glass panels between the posts
        g.blend(x0, U - 10, x1 - x0, 10, 0x9ad0f0, 0.12);
        if (env.holidays.christmas || this._status(env).tourney)
            for (let x = x0; x < x1; x += 3)
                g.px(x, U - 14 + Math.round(Math.abs(Math.sin(x / 24 * Math.PI)) * 3), 0x2a6a3a);
        void st;
    }

    _drawDoor(g, env) {
        const d = this.door, B = this.B, x = d.x, top = B - d.h;
        g.rect(x - 4, top - 4, d.w + 8, d.h + 4, INK);
        g.rect(x - 3, top - 3, d.w + 6, d.h + 3, 0x6a6a7a);
        g.rect(x - 3, top - 3, d.w + 6, 1, 0x9a9aaa);
        // two glass leaves; the view outside is drawn each frame
        this.doorPanes = [[x + 2, top + 2, d.w / 2 - 3, d.h - 4], [x + d.w / 2 + 1, top + 2, d.w / 2 - 3, d.h - 4]];
        for (const [px, py, pw, ph] of this.doorPanes) {
            g.rect(px - 2, py - 2, pw + 4, ph + 4, 0x8a8a96);
            g.rect(px, py, pw, ph, 0x2a3a4a);
        }
        g.rect(x + d.w / 2 - 1, top, 2, d.h, 0x5a5a6a);
        // exit sign and a mat
        this.exitSign = [x + d.w / 2 - 9, top - 14];
        g.rect(x - 6, B, d.w + 12, 4, 0x2a2a30);
        g.rect(x - 6, B, d.w + 12, 1, 0x3a3a42);
    }

    _drawFloor(g, env, st) {
        const W = this.w, H = this.h, B = this.B;
        // skirting
        g.rect(0, B - 3, W, 3, INK);
        g.rect(0, B - 2, W, 2, 0x2a2240);
        // blacklight carpet: dark with confetti shapes, glowing on disco
        // nights; a bit of perspective in the rows
        g.rect(0, B, W, H - B, CARPET);
        for (let y = B + 2; y < H; y += 7)
            for (let x = (y * 3) % 11; x < W; x += 11) {
                const v = hash(x, y, 77);
                if (v > 520)
                    continue;
                const c = mix(NEON[v % 6], CARPET, st.disco ? 0.1 : 0.45);
                const k = v % 4;
                const put = (xx, yy) => (st.disco ? g.pxE(xx, yy, c) : g.px(xx, yy, c));
                if (k === 0) {
                    put(x, y);
                    put(x + 1, y);
                    put(x + 2, y + 1);
                } else if (k === 1) {
                    put(x, y);
                    put(x + 1, y + 1);
                    put(x, y + 2);
                } else if (k === 2) {
                    put(x + 1, y);
                    put(x, y + 1);
                    put(x + 2, y + 1);
                } else {
                    put(x, y);
                }
            }
        // the floor gets darker towards the back wall
        for (let i = 0; i < 6; i++)
            g.blend(0, B + i * 2, W, 2, 0x0a0818, 0.3 - i * 0.05);
    }

    // ---------- the front row ----------

    // where the players of the front row stand or sit
    _frontStand(o) {
        const F = this.F, x = o.x, w = o.w;
        if (o.kind === 'pinball')
            o.stand = [(o.dir > 0 ? x : x + w) - o.dir * 12 - 9, F + 2];
        else if (o.kind === 'hockey')
            o.stand = [[x - 14, F + 2, 1], [x + w - 4, F + 2, -1]];
        else if (o.kind === 'claw')
            o.stand = [x + w / 2 - 9, F + 6];
        else if (o.kind === 'dance')
            o.stand = [x + w / 2 - 9, F - 4];
        else if (o.kind === 'ride') {
            o.stand = [x + w / 2 - 9, F - 8];
            o.watch = [x + w + 4, F + 8];
        } else if (o.kind === 'table') {
            const cx = x + w / 2;
            o.seats = [[cx - 30, 1], [cx + 12, -1]];
        }
    }

    _drawFront(g, o, env, st) {
        switch (o.kind) {
        case 'pinball':
            this._pinball(g, o);
            break;
        case 'hockey':
            this._hockey(g, o);
            break;
        case 'claw':
            this._claw(g, o);
            break;
        case 'dance':
            this._dance(g, o);
            break;
        case 'ride':
            this._rideBase(g, o);
            break;
        case 'table': {
            const F = this.F, cx = o.x + o.w / 2;
            g.footShadow(cx, F, 26, 0.35);
            g.rect(cx - 12, F - 19, 24, 4, INK);
            g.rect(cx - 11, F - 18, 22, 2, 0xe8e4dc);
            g.rect(cx - 1, F - 15, 3, 13, INK);
            g.rect(cx, F - 15, 1, 13, 0x8a8a96);
            g.rect(cx - 6, F - 2, 13, 2, INK);
            for (const [sx] of o.seats) {
                g.rect(sx + 4, F - 11, 10, 3, INK);
                g.rect(sx + 5, F - 10, 8, 1, 0xd83838);
                g.rect(sx + 8, F - 8, 2, 8, 0x5a5a62);
            }
            break;
        }
        }
        void env;
        void st;
    }

    // a point on the pinball playfield: i along from the player's end,
    // v = 0..4 across from the far rail
    _pfPt(o, i, v) {
        const L = o.w - 3;
        return [o.dir > 0 ? o.x + i : o.x + o.w - 1 - i, Math.round(this.F - 14 - i / L * 4) - 13 + v];
    }

    // Pinball in three-quarter view: chrome legs, the cabinet with flames on
    // its side sloping up to the head, the playfield under the glass with
    // flippers, slingshots, pop bumpers and lane arrows, and the head with
    // its backglass, score display and speaker grille.
    _pinball(g, o) {
        const F = this.F, d = o.dir, x = o.x, w = o.w, R = A.ramp(o.color);
        const X = i => (d > 0 ? x + i : x + w - 1 - i);
        const L = w - 3, D = 6, bw = 20, Lv = L - bw + 2;
        const yb = i => Math.round(F - 14 - i / L * 4);
        o.theme = o.theme || pick(['space', 'surf', 'star']);
        const art = NEON[(o.x >> 2) % 6], pf = {space: 0x1a2a6a, surf: 0x0a5a6a, star: 0x4a1a6a}[o.theme];
        g.footShadow(x + w / 2, F, w + 6, 0.35);
        // legs: the far pair a bit higher and darker
        const leg = (i, far) => {
            const lx = Math.min(X(i), X(i + 2)) + (far ? 2 : 0), top = yb(i) - (far ? 4 : 0), bot = far ? F - 3 : F;
            g.rect(lx - 1, top, 5, bot - top, INK);
            g.rect(lx, top, 3, bot - top - 1, far ? 0x6a6a76 : 0xb8b8c4);
            g.rect(lx + 2, top, 1, bot - top - 1, far ? 0x4a4a56 : 0x7a7a86);
            g.px(lx, top, far ? 0x8a8a96 : 0xe8e8f0);
            g.rect(lx - 1, bot - 2, 5, 2, 0x3a3a42);
        };
        leg(3, true);
        leg(L - 6, true);
        leg(3, false);
        leg(L - 6, false);
        // the cabinet, column by column along the slope
        for (let i = 0; i <= L; i++) {
            const xx = X(i), b = yb(i), r0 = b - 8 - D;
            g.rect(xx, r0 - 1, 1, D + 10, INK);
            g.px(xx, r0, 0xc8c8d4);
            for (let v = 1; v < D; v++)
                g.px(xx, r0 + v, mix(pf, 0x000000, (D - v) * 0.06));
            g.px(xx, b - 8, i < 2 ? 0xffffff : 0xe0e0ea);
            g.px(xx, b - 7, R[3]);
            g.rect(xx, b - 6, 1, 5, R[2]);
            g.px(xx, b - 1, R[1]);
            // flames licking along the side
            const f = (i + 3) % 10;
            if (i > 3 && i < L - 2 && f < 7) {
                const hgt = [1, 3, 5, 4, 2, 3, 1][f];
                g.rect(xx, b - 1 - hgt, 1, hgt, art);
                if (hgt > 2)
                    g.rect(xx, b - 1 - hgt + 2, 1, hgt - 2, hi(art, 0.45));
            }
        }
        // the player's end: front panel, flipper button, plunger
        const fb = yb(0);
        g.rect(Math.min(X(0), X(1)), fb - 7, 2, 7, R[1]);
        g.px(X(1), fb - 6, 0xff5050);
        g.px(X(1), fb - 5, 0xa02020);
        for (let k = 1; k <= 3; k++)
            g.px(X(-k), fb - 10, k === 3 ? 0xd83838 : 0xd0d0dc);
        g.px(X(-3), fb - 11, INK);
        g.px(X(-3), fb - 9, INK);
        g.px(X(-4), fb - 10, INK);
        // the playfield
        const P = (i, v, c) => {
            const [px, py] = this._pfPt(o, i, v);
            g.px(px, py, c);
        };
        // flippers, slingshots and the inlane arrows
        for (const [i, v] of [[5, 0], [6, 1], [5, 4], [6, 3]])
            P(i, v, 0xfff0a0);
        P(4, 0, 0xffffff);
        P(4, 4, 0xffffff);
        for (const [i, v] of [[8, 0], [9, 0], [10, 0], [9, 1], [8, 4], [9, 4], [10, 4], [9, 3]])
            P(i, v, v % 4 ? 0xffffff : 0xe03838);
        for (let k = 0; k < 4; k++) {
            const c = NEON[(k + 1) % 6];
            P(13 + k * 3, 1, c);
            P(14 + k * 3, 2, c);
            P(13 + k * 3, 3, c);
        }
        // drop targets and three pop bumpers
        for (let v = 1; v <= 3; v++)
            P(Lv - 12, v, 0xffe040);
        o.bumpers = [[Lv - 8, 0], [Lv - 5, 2], [Lv - 8, 3]];
        for (const [i, v] of o.bumpers) {
            P(i, v, 0xffffff);
            P(i + 1, v, 0xffffff);
            P(i, v + 1, sh(art, 0.2));
            P(i + 1, v + 1, sh(art, 0.4));
        }
        // a glint across the glass
        for (const s of [11, 26])
            for (let v = 0; v < D - 1; v++) {
                const [px, py] = this._pfPt(o, s + (D - v) * 1, v);
                g.blend(px, py, 1, 1, 0xffffff, 0.3);
            }
        // the head: front with the backglass, a strip of side towards the player
        const hb = yb(L) - 8 - D + 2, ht = hb - 30;
        const hx = d > 0 ? x + w - bw : x;
        g.rect(hx - 1, ht - 1, bw + 2, 32, INK);
        g.rect(hx, ht, bw, 30, R[2]);
        const sx = d > 0 ? hx : hx + bw - 4;
        g.rect(sx, ht, 4, 30, R[1]);
        g.rect(d > 0 ? sx + 4 : sx - 1, ht, 1, 30, INK);
        g.rect(sx, ht, 4, 1, R[2]);
        const fx = d > 0 ? hx + 5 : hx;
        g.rect(fx, ht, bw - 5, 1, R[4]);
        g.rect(fx, ht + 29, bw - 5, 1, R[0]);
        // backglass in a chrome frame
        g.rect(fx + 1, ht + 2, bw - 7, 15, 0xc8c8d4);
        g.rect(fx + 2, ht + 3, bw - 9, 13, 0x0a0a14);
        o.backglass = [fx + 2, ht + 3, bw - 9, 13];
        this._backglass(g, o, false);
        // score display and speaker grille
        g.rect(fx, ht + 18, bw - 5, 7, 0x0a0a0a);
        o.score = [fx + 1, ht + 19];
        for (let gx = fx + 2; gx < fx + bw - 7; gx += 2)
            g.px(gx, ht + 27, 0x1a1a22);
        // lamps on the top edge of the head
        for (let k = 0; k < 3; k++)
            g.px(fx + 3 + k * 5, ht - 1, NEON[k * 2]);
    }

    // the art on the backglass; lit = drawn emissive with chasing lamps
    _backglass(g, o, lit) {
        const [x, y, w, h] = o.backglass;
        const R = (xx, yy, ww, hh, c) => (lit ? g.rectE(x + xx, y + yy, ww, hh, c) : g.rect(x + xx, y + yy, ww, hh, sh(c, 0.55)));
        const P = (xx, yy, c) => R(xx, yy, 1, 1, c);
        const t = this.t;
        if (o.theme === 'space') {
            for (let r = 0; r < h; r++)
                R(0, r, w, 1, mix(0x1a0a4a, 0x4a1a7a, r / h));
            for (let k = 0; k < 6; k++)
                P(hash(k, 1, o.x) % w, hash(k, 2, o.x) % (h - 3), 0xffffff);
            R(4, 5, 5, 4, 0xf0a040);
            R(5, 4, 3, 6, 0xf0a040);
            P(5, 5, 0xfff0c0);
            R(2, 7, 9, 1, 0xfff0a0);
            R(w - 4, 1, 2, 3, 0xe0e0f0);
            P(w - 4, 4, 0xff6030);
        } else if (o.theme === 'surf') {
            for (let r = 0; r < h; r++)
                R(0, r, w, 1, r < 8 ? mix(0xff5a8a, 0xffc040, r / 8) : mix(0x2a8ad0, 0x1a4a9a, (r - 8) / 5));
            R(3, 5, 5, 3, 0xfff4a0);
            R(4, 4, 3, 1, 0xfff4a0);
            for (let k = 0; k < w; k += 3)
                P(k + 1, 9 + (k % 2), 0xa0e0ff);
            R(w - 3, 2, 1, 7, 0x2a1a1a);
            R(w - 5, 2, 5, 1, 0x1a3a1a);
            P(w - 6, 3, 0x1a3a1a);
            P(w - 1, 3, 0x1a3a1a);
        } else {
            for (let r = 0; r < h; r++)
                R(0, r, w, 1, mix(0x5a1a6a, 0x1a0a3a, r / h));
            const cx = Math.floor(w / 2);
            R(cx - 1, 2, 3, 9, 0xffe040);
            R(cx - 4, 5, 9, 2, 0xffe040);
            R(cx - 2, 4, 5, 5, 0xffe040);
            P(cx - 3, 10, 0xffe040);
            P(cx + 3, 10, 0xffe040);
            P(cx, 4, 0xffffff);
        }
        if (lit) {
            const busy = o.users.length && !o.users[0].moving;
            const step = Math.floor(t * (busy ? 8 : 2));
            const n = 2 * (w + h);
            for (let k = 0; k < n; k += 3) {
                if ((k / 3 + step) % 4)
                    continue;
                const kk = k % n;
                const [px, py] = kk < w ? [kk, 0] : kk < w + h ? [w - 1, kk - w] : kk < 2 * w + h ? [2 * w + h - 1 - kk, h - 1] : [0, n - 1 - kk];
                g.pxE(x + px, y + py, 0xffffff);
            }
        }
    }

    // Air hockey table in three-quarter view: the white playfield full of
    // air holes, the center line and circle, goal slots in the end rails,
    // an apron with chasing lights and the score unit on its pole.
    _hockey(g, o) {
        const F = this.F, x = o.x, w = o.w, R = A.ramp(o.color), D = 10, ap = F - 20;
        g.footShadow(x + w / 2, F, w + 6, 0.35);
        // legs, far pair first
        for (const far of [true, false])
            for (const lx0 of [x + 3, x + w - 10]) {
                const lx = lx0 + (far ? 3 : 0), bot = far ? F - 4 : F;
                g.rect(lx - 1, ap + 5, 9, bot - ap - 5, INK);
                g.rect(lx, ap + 5, 7, bot - ap - 6, far ? R[0] : R[1]);
                g.rect(lx, ap + 5, 1, bot - ap - 6, far ? R[1] : R[2]);
                g.rect(lx - 1, bot - 2, 9, 2, 0x2a2a32);
            }
        // a crossbar between the near legs
        g.rect(x + 10, F - 9, w - 20, 3, INK);
        g.rect(x + 10, F - 8, w - 20, 1, 0x9a9aa6);
        // the top
        const top = ap - D;
        g.rect(x - 1, top - 1, w + 2, D + 7, INK);
        g.rect(x, top, w, 2, R[3]);
        g.rect(x, top, w, 1, R[4]);
        for (let r = top + 2; r < ap - 1; r++)
            g.rect(x + 2, r, w - 4, 1, mix(0xc8d8e8, 0xeef4fa, (r - top) / D));
        for (let r = top + 3; r < ap - 1; r += 2)
            for (let c = x + 4 + (r % 4 ? 1 : 0); c < x + w - 4; c += 3)
                g.px(c, r, 0xa8bcd0);
        // end rails with the goal slots
        for (const ex of [x, x + w - 2]) {
            g.rect(ex, top, 2, D, R[2]);
            g.rect(ex, top + 3, 2, D - 6, 0x1a1a22);
        }
        // center line and circle, goal creases
        const cx = Math.round(x + w / 2), cy = top + Math.round(D / 2);
        g.rect(cx, top + 2, 1, D - 3, 0xe04848);
        for (let a = 0; a < 20; a++) {
            const ang = a / 20 * Math.PI * 2;
            g.px(Math.round(cx + Math.cos(ang) * 5), Math.round(cy + Math.sin(ang) * 2.3), 0x4a7ae0);
        }
        for (const [ex, s] of [[x + 2, 1], [x + w - 3, -1]])
            for (let a = -4; a <= 4; a++) {
                const ang = a / 4 * Math.PI / 2;
                g.px(Math.round(ex + s * Math.cos(ang) * 6), Math.round(cy + Math.sin(ang) * 3), 0x4a7ae0);
            }
        g.rect(x, ap - 1, w, 1, R[4]);
        o.surf = [x + 3, top + 2, w - 6, D - 3];
        // apron: light strip, a lightning bolt either side, the coin box
        g.rect(x, ap, w, 5, R[2]);
        g.rect(x, ap + 4, w, 1, R[1]);
        o.strip = [x + 2, ap + 1, w - 4];
        for (let c = x + 2; c < x + w - 2; c += 2)
            g.px(c, ap + 1, sh(NEON[(c >> 1) % 6], 0.5));
        for (const bx of [x + 8, x + w - 16])
            for (const [dx, dy] of [[4, 2], [3, 2], [2, 3], [3, 3], [4, 3], [1, 4]])
                g.px(bx + dx + 2, ap + dy - 1, 0xffe040);
        g.rect(cx - 4, ap + 1, 9, 4, 0x8a8a96);
        g.rect(cx - 3, ap + 2, 2, 2, 0x1a1a22);
        g.rect(cx + 2, ap + 2, 2, 2, 0x1a1a22);
        // score unit on a pole behind the middle
        g.rect(cx - 1, F - 50, 3, top - F + 50, INK);
        g.rect(cx, F - 50, 1, top - F + 50, 0x9a9aa6);
        g.rect(cx - 14, F - 60, 29, 11, INK);
        g.rect(cx - 13, F - 59, 27, 9, 0x2a2a34);
        g.rect(cx - 13, F - 59, 27, 1, 0x4a4a56);
        g.rect(cx - 13, F - 59, 2, 9, 0x3a6ae0);
        g.rect(cx + 12, F - 59, 2, 9, 0xe04848);
        o.digits = [[cx - 9, F - 57], [cx + 3, F - 57]];
        o.top = top;
    }

    // a plush toy, 7 wide: bear, bunny, cat or chick
    _plush(g, x, y, c, kind) {
        const rows = {
            bear: ['oo...oo', 'ocoooco', 'occhcco', 'oececeo', 'occpcco', '.ooooo.'],
            bunny: ['.o...o.', 'oco.oco', 'oco.oco', 'ocoooco', 'oececeo', 'occpcco', '.ooooo.'],
            cat: ['o.....o', 'oco.oco', 'occhcco', 'oececeo', 'occpcco', '.ooooo.'],
            chick: ['..ooo..', '.ochco.', 'occhcco', 'oececeo', 'occycco', '.ooooo.'],
        }[kind];
        const pal = {o: INK, c, h: hi(c, 0.45), e: 0x1a1020, p: mix(c, 0xff6080, 0.5), y: 0xf0a020};
        rows.forEach((row, r) => {
            for (let k = 0; k < row.length; k++)
                if (pal[row[k]] !== undefined)
                    g.px(x + k, y + r - rows.length + 1, pal[row[k]]);
        });
    }

    // Claw machine: lit sign on top, a glass box with chrome posts and a
    // pile of plush toys, the prize chute, joystick and button on a ledge,
    // coin slot and prize door below.
    _claw(g, o) {
        const F = this.F, x = o.x, w = o.w, R = A.ramp(o.color), top = F - 66, c = o.claw;
        g.footShadow(x + w / 2, F, w + 6, 0.35);
        g.rect(x - 1, top - 1, w + 2, 67, INK);
        // the sign box
        g.rect(x, top, w, 10, R[2]);
        g.rect(x, top, w, 1, R[4]);
        g.rect(x, top + 9, w, 1, R[0]);
        g.rect(x + 3, top + 2, w - 6, 6, 0x1a0a2a);
        o.sign = [x + 3, top + 2, w - 6, 6];
        this._clawSign(g, o, false);
        // the glass box
        const by = top + 10, bh = 32;
        for (let r = 0; r < bh; r++)
            g.rect(x + 2, by + r, w - 4, 1, mix(mix(c.color, 0x10082a, 0.75), 0x2a1a4a, r / bh));
        for (let k = x + 5; k < x + w - 4; k += 6)
            g.rect(k, by + 2, 1, bh - 14, mix(c.color, 0x10082a, 0.6));
        g.rect(x + 2, by + 1, w - 4, 1, 0x8a8a96);
        // plush pile; the chute stands in the corner the claw goes home to
        const kinds = ['bear', 'bunny', 'cat', 'chick'];
        const pileW = w - 16;
        for (let row = 0; row < 3; row++)
            for (let k = 0; k * 6 + (row % 2) * 3 < pileW - 6; k++) {
                const n = hash(k, row, o.x);
                this._plush(g, x + 3 + k * 6 + (row % 2) * 3, by + bh - 1 - row * 4 - (n % 2), PLUSH[n % PLUSH.length], kinds[(n >> 3) % 4]);
            }
        const chx = x + w - 13;
        g.rect(chx, by + bh - 11, 11, 11, mix(0x9ad0f0, 0x2a1a4a, 0.5));
        g.rect(chx, by + bh - 11, 11, 1, 0xffe040);
        g.rect(chx, by + bh - 11, 1, 11, 0xd8e8f0);
        g.rect(chx + 10, by + bh - 11, 1, 11, 0xd8e8f0);
        // chrome posts and two glints on the glass
        for (const px of [x, x + w - 2]) {
            g.rect(px, by, 2, bh, 0xb0b0bc);
            g.rect(px + (px === x ? 0 : 1), by, 1, bh, 0xe8e8f0);
        }
        for (let k = 0; k < 9; k++) {
            g.blend(x + 4 + k, by + 14 - k, 1, 2, 0xffffff, 0.25);
            g.blend(x + 7 + k, by + 22 - k, 1, 1, 0xffffff, 0.18);
        }
        o.box = [x + 2, by, w - 4, bh];
        // the ledge with stick and button
        g.rect(x - 3, by + bh, w + 6, 5, INK);
        g.rect(x - 2, by + bh + 1, w + 4, 3, R[3]);
        g.rect(x - 2, by + bh + 1, w + 4, 1, R[4]);
        g.rect(x + 8, by + bh - 2, 1, 3, 0x9a9aa6);
        g.rect(x + 7, by + bh - 4, 3, 2, 0xd83838);
        g.px(x + 7, by + bh - 4, 0xff9090);
        g.rect(x + w - 11, by + bh, 4, 1, 0xffe040);
        o.button = [x + w - 11, by + bh];
        // the cabinet: coin slots, prize door, kick plate
        const cy = by + bh + 5;
        g.rect(x, cy, w, F - cy, R[2]);
        g.rect(x, cy, 1, F - cy, R[3]);
        g.rect(x + w - 1, cy, 1, F - cy, R[1]);
        g.rect(x + 4, cy + 3, 7, 9, INK);
        g.rect(x + 5, cy + 4, 5, 7, 0xa8a8b4);
        g.rect(x + 7, cy + 5, 1, 3, 0x1a1a22);
        g.px(x + 6, cy + 9, 0xff4030);
        g.px(x + 8, cy + 9, 0xff4030);
        g.rect(x + w - 15, cy + 3, 12, 10, INK);
        g.rect(x + w - 14, cy + 4, 10, 8, 0x2a2a32);
        g.rect(x + w - 14, cy + 4, 10, 1, 0x8a8a96);
        g.rect(x + w - 11, cy + 9, 4, 1, 0x6a6a76);
        g.rect(x, F - 4, w, 4, 0x8a8a96);
        g.rect(x, F - 4, w, 1, 0xd0d0dc);
    }

    _clawSign(g, o, lit) {
        const [x, y, w] = o.sign, c = o.claw.color;
        const R = (xx, yy, ww, hh, col) => (lit ? g.rectE(x + xx, y + yy, ww, hh, col) : g.rect(x + xx, y + yy, ww, hh, sh(col, 0.5)));
        const cx = Math.floor(w / 2);
        R(cx - 3, 1, 2, 2, 0xff4f80);
        R(cx + 1, 1, 2, 2, 0xff4f80);
        R(cx - 3, 2, 6, 2, 0xff4f80);
        R(cx - 2, 4, 4, 1, 0xff4f80);
        R(cx - 1, 5, 2, 1, 0xff4f80);
        for (const sx of [2, w - 4]) {
            R(sx, 2, 1, 3, c);
            R(sx - 1, 3, 3, 1, c);
        }
    }

    // the four arrows of a dance pad, k: 0 left, 1 down, 2 up, 3 right
    _arrow(g, x, y, k, c, lit, small = false) {
        const rows = small
            ? [['.XX', 'XXX', '.XX'], ['XXX', 'XXX', '.X.'], ['.X.', 'XXX', 'XXX'], ['XX.', 'XXX', 'XX.']][k]
            : [['.X...', 'XXXXX', '.X...'], ['XXXXX', '.XXX.', '..X..'], ['..X..', '.XXX.', 'XXXXX'], ['...X.', 'XXXXX', '...X.']][k];
        rows.forEach((row, r) => {
            for (let i = 0; i < row.length; i++)
                if (row[i] === 'X')
                    (lit ? g.pxE(x + i, y + r, c) : g.px(x + i, y + r, c));
        });
    }

    // Dance machine: tower with a marquee, the screen, two big speakers and
    // light tubes; the stage with four arrow panels and the safety bar.
    _dance(g, o) {
        const F = this.F, x = o.x, w = o.w, R = A.ramp(o.color), top = F - 62;
        const tx = x + 7, tw = w - 14, tb = F - 9;
        g.footShadow(x + w / 2, F, w + 8, 0.35);
        g.rect(tx - 1, top - 1, tw + 2, tb - top + 1, INK);
        g.rect(tx, top, tw, tb - top, R[2]);
        g.rect(tx, top, 1, tb - top, R[3]);
        g.rect(tx + tw - 1, top, 1, tb - top, R[1]);
        // marquee with the four arrows
        g.rect(tx + 2, top + 1, tw - 4, 6, 0x10082a);
        o.marq = [tx + 3 + Math.floor((tw - 6 - 23) / 2), top + 2];
        for (let k = 0; k < 4; k++)
            this._arrow(g, o.marq[0] + k * 6, o.marq[1], k, sh(NEON[k], 0.5), false);
        // screen
        g.rect(tx + 2, top + 8, tw - 4, 19, 0x141418);
        g.rect(tx + 3, top + 9, tw - 6, 17, 0x0c0c14);
        o.screen = [tx + 3, top + 9, tw - 6, 17];
        // speakers
        for (const sx of [tx + 8, tx + tw - 9]) {
            g.disc(sx, top + 36, 6, INK);
            g.disc(sx, top + 36, 5, 0x2a2a32);
            g.disc(sx, top + 36, 3, 0x3a3a44);
            g.disc(sx, top + 36, 1, 0x8a8a96);
            g.px(sx - 2, top + 34, 0x5a5a66);
            g.disc(sx, top + 46, 2, INK);
            g.px(sx, top + 46, 0x8a8a96);
        }
        // light tubes up the sides
        o.tubes = [[tx + 1, top + 8], [tx + tw - 3, top + 8], tb - top - 8];
        for (const [lx, ly] of o.tubes.slice(0, 2))
            g.rect(lx, ly, 2, o.tubes[2], sh(NEON[1], 0.55));
        // the stage
        g.rect(x - 1, F - 11, w + 2, 11, INK);
        g.rect(x, F - 10, w, 6, 0x8a8a96);
        g.rect(x, F - 10, w, 1, 0xc8c8d4);
        g.rect(x, F - 4, w, 4, R[1]);
        g.rect(x, F - 4, w, 1, R[2]);
        o.strip = [x + 1, F - 2, w - 2];
        for (let c = x + 1; c < x + w - 1; c += 2)
            g.px(c, F - 2, sh(NEON[(c >> 1) % 4], 0.5));
        o.pads = [];
        const pw = Math.floor((w - 6) / 4);
        for (let k = 0; k < 4; k++) {
            const px = x + 3 + k * pw;
            g.rect(px, F - 9, pw - 1, 4, 0x3a3a46);
            g.rect(px, F - 9, pw - 1, 1, 0x5a5a66);
            o.pads.push([px + Math.floor((pw - 6) / 2), F - 8, k]);
            this._arrow(g, px + Math.floor((pw - 6) / 2), F - 8, k, sh(NEON[k], 0.5), false);
        }
        // safety bar behind the dancer
        for (const px of [x + 2, x + w - 4]) {
            g.rect(px - 1, F - 26, 4, 17, INK);
            g.rect(px, F - 26, 2, 16, 0xb8b8c4);
            g.px(px + 1, F - 26, 0x7a7a86);
        }
        g.rect(x + 1, F - 27, w - 2, 4, INK);
        g.rect(x + 2, F - 26, w - 4, 2, 0xb8b8c4);
        g.rect(x + 2, F - 26, w - 4, 1, 0xe8e8f0);
    }

    // the pedestal of a kiddie ride with its coin box
    _rideBase(g, o) {
        const F = this.F, x = o.x, w = o.w;
        g.footShadow(x + w / 2, F, w + 4, 0.35);
        g.rect(x - 1, F - 9, w + 2, 9, INK);
        g.rect(x, F - 8, w, 3, 0x7ab0f0);
        g.rect(x, F - 8, w, 1, 0xb0d4ff);
        g.rect(x, F - 5, w, 5, 0x3a6ab0);
        for (let c = x + 2; c < x + w - 2; c += 6)
            g.rect(c, F - 4, 3, 3, 0x2a4a8a);
        g.rect(x + 2, F - 1, w - 4, 1, 0x1a3a7a);
        // coin box on a post at the front corner
        const cx = x + w - 7;
        g.rect(cx - 1, F - 17, 8, 9, INK);
        g.rect(cx, F - 16, 6, 7, 0xffd040);
        g.rect(cx, F - 16, 6, 1, 0xfff0a0);
        g.rect(cx + 2, F - 14, 2, 3, 0x2a2a32);
        o.lamps = [[cx + 1, F - 10], [cx + 4, F - 10]];
    }

    // the body of the ride, drawn once as a sprite that rocks
    _rideBody(g, o) {
        const F = this.F, x = o.x, w = o.w, y = F - 8;
        const ell = (cx, cy, rx, ry, c) => {
            for (let r = -ry; r <= ry; r++) {
                const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (r / (ry + 0.5)) ** 2)));
                g.rect(cx - hw, cy + r, hw * 2 + 1, 1, c);
            }
        };
        // the spring the ride sits on
        for (let k = 0; k < 3; k++)
            g.rect(x + w / 2 - 3, y - 4 + k * 2, 6, 1, 0x9a9aa6);
        if (o.kind2 === 'horse') {
            const a = 0xd8a060, b = sh(a, 0.3), c = hi(a, 0.35), m = 0xf06aa0, n = sh(m, 0.3);
            // far legs, body, near legs
            for (const [lx, dx] of [[x + 10, -1], [x + 22, 1]])
                for (let r = 0; r < 7; r++)
                    g.px(lx + 1 + Math.round(dx * r * 0.3), y - 9 + r, b);
            ell(x + 16, y - 13, 9, 4, a);
            g.rect(x + 10, y - 17, 13, 1, c);
            g.rect(x + 9, y - 10, 15, 1, b);
            for (const [lx, dx] of [[x + 9, -1], [x + 21, 1]])
                for (let r = 0; r < 7; r++) {
                    g.rect(lx + Math.round(dx * r * 0.4), y - 10 + r, 2, 1, r > 5 ? 0x4a3a2a : a);
                }
            // neck and head
            for (let r = 0; r < 8; r++)
                g.rect(x + 21 + Math.round(r * 0.4), y - 15 - r, 5, 1, a);
            ell(x + 27, y - 25, 3, 2, a);
            g.rect(x + 27, y - 25, 5, 3, a);
            g.rect(x + 30, y - 23, 2, 1, b);
            g.px(x + 31, y - 24, INK);
            g.px(x + 27, y - 26, INK);
            g.px(x + 26, y - 27, 0xffffff);
            g.rect(x + 25, y - 29, 1, 2, a);
            g.rect(x + 27, y - 29, 1, 2, b);
            // mane, tail, bridle
            for (let r = 0; r < 10; r++)
                g.rect(x + 19 + Math.round(r * 0.45), y - 14 - r, 2, 1, r % 2 ? m : n);
            for (let r = 0; r < 9; r++)
                g.rect(x + 6 - Math.round(r * 0.5), y - 16 + r, 2, 1, r % 2 ? m : n);
            g.rect(x + 28, y - 25, 1, 3, 0xd83838);
            g.rect(x + 22, y - 19, 7, 1, 0xd83838);
            // saddle with a gold trim and a pole through it
            g.rect(x + 12, y - 19, 8, 3, 0xc83838);
            g.rect(x + 12, y - 17, 8, 1, 0xf0c040);
            g.rect(x + 15, y - 16, 2, 6, 0x8a2a2a);
            g.rect(x + 16, y - 34, 1, 15, 0xd8d8e4);
            g.rect(x + 15, y - 35, 3, 2, 0xf0c040);
            o.seat = y - 11;
        } else if (o.kind2 === 'car') {
            const a = 0xe04040, b = sh(a, 0.3), c = hi(a, 0.4);
            // a little convertible with a face on the bonnet
            g.rect(x + 3, y - 14, w - 7, 9, a);
            g.rect(x + 5, y - 17, 10, 3, a);
            g.rect(x + 3, y - 14, w - 7, 1, c);
            g.rect(x + 5, y - 17, 10, 1, c);
            g.rect(x + 3, y - 6, w - 7, 1, b);
            g.rect(x + 16, y - 15, 2, 2, 0x5a5a66);
            g.rect(x + 18, y - 19, 1, 5, 0xa0d0f0);
            g.rect(x + 19, y - 19, 1, 4, 0xd0ecff);
            for (const [ex, ey] of [[x + 23, y - 12], [x + 27, y - 12]]) {
                g.rect(ex, ey, 3, 3, 0xffffff);
                g.px(ex + 1, ey + 1, INK);
            }
            g.rect(x + 23, y - 8, 6, 1, b);
            g.rect(x + w - 4, y - 10, 1, 3, 0xfff0a0);
            g.rect(x + 2, y - 7, w - 5, 1, 0xd0d0dc);
            for (const wx of [x + 8, x + w - 10]) {
                g.disc(wx, y - 4, 3, 0x2a2a32);
                g.disc(wx, y - 4, 1, 0xc0c0cc);
            }
            g.disc(x + 9, y - 11, 2, 0xffffff);
            g.px(x + 9, y - 11, 0x3a6ae0);
            o.seat = y - 9;
        } else {
            const a = 0xe8e4dc, b = sh(a, 0.3), c = 0xffffff, r = 0xd83838;
            // rocket lying on its stand, nose forward
            const L = w - 6, cy = y - 12;
            for (let i = 0; i < L; i++) {
                const half = i > L - 9 ? Math.max(1, Math.round((L - i) * 0.6)) : 5;
                g.rect(x + 3 + i, cy - half, 1, half * 2 + 1, i > L - 9 ? r : a);
                g.px(x + 3 + i, cy - half, i > L - 9 ? hi(r, 0.4) : c);
                g.px(x + 3 + i, cy + half, i > L - 9 ? sh(r, 0.3) : b);
            }
            g.rect(x + 8, cy - 5, 1, 11, r);
            g.rect(x + 3, cy - 3, 2, 7, 0x5a5a66);
            g.disc(x + L - 10, cy - 1, 2, 0x5a5a66);
            g.disc(x + L - 10, cy - 1, 1, 0x40b0ff);
            g.px(x + L - 11, cy - 2, 0xc0f0ff);
            for (const [fy, s] of [[cy - 6, -1], [cy + 6, 1]])
                for (let k = 0; k < 4; k++)
                    g.rect(x + 3, fy + s * k, 6 - k, 1, k ? r : sh(r, 0.2));
            o.flame = [x + 1, cy];
            o.seat = cy - 3;
        }
    }

    // ---------- people ----------

    _guest(env, opts = {}) {
        const p = makePerson(env, {kid: opts.kid ?? chance(0.3)});
        p.dog = null;
        p.coffee = false;
        p.jogger = false;
        if (!opts.party)
            p.balloon = null;
        p.speed = p.kid ? rand(15, 20) : rand(11, 15);
        p.rainColor = p.umbrella || null;
        // guests appear just inside the glass door: the umbrella was shut
        // and left in the stand there
        p.indoor = true;
        p.zone = 'g';
        p.path = [];
        p.visits = randi(2, 5);
        p.tokens = 0;
        p.tickets = 0;
        p.state = 'walk';
        p.dir = 1;
        return p;
    }

    _spawn(env, anywhere = false, opts = {}) {
        const n = opts.n ?? (chance(0.45) ? 1 : randi(2, 3));
        const group = [];
        for (let i = 0; i < n; i++) {
            const p = this._guest(env, opts);
            const d = this.door;
            p.x = d.x + d.w / 2 - 9 + (i - (n - 1) / 2) * 12;
            p.y = this.B + 3 + i * 2;
            p.zone = 'g';
            group.push(p);
            this.people.push(p);
        }
        for (const p of group) {
            p.friends = group.filter(q => q !== p);
            p.inside = 0;
            if (anywhere) {
                // put early guests straight onto their place
                p.umbrella = null;
                p.tokens = randi(2, 10);
                this._nextActivity(p, env, true);
            } else {
                p.tokensFirst = !!this.change;
                this._nextActivity(p, env);
            }
        }
        // friends play air hockey together
        if (group.length >= 2 && chance(0.5)) {
            const h = this.front.find(o => o.kind === 'hockey' && !o.users.length);
            if (h) {
                h.users = [group[0], group[1]];
                for (let i = 0; i < 2; i++) {
                    const [sx, sy, dir] = h.stand[i];
                    this._goTo(group[i], {x: sx, y: sy, zone: 'g'}, {act: 'hockey', obj: h, dir, face: 'side', dur: rand(40, 90)}, anywhere);
                }
            }
        }
        return group;
    }

    _updateStaff(env) {
        const st = this._status(env);
        const want = st.lights ? [this.counter, this.snack].filter(Boolean) : [];
        if (want.length !== this.staff.length) {
            this.staff = want.map(o => {
                const p = makePerson(env, {kid: false, shirt: 0xd83838});
                p.umbrella = p.dog = p.balloon = p.bag = null;
                p.coffee = false;
                p.style = p.style === 'hat' ? 'cap' : p.style;
                p.state = 'idle';
                p.obj = o;
                p.x = o.staffX;
                p.off = 0;
                return p;
            });
        }
    }

    // Free places to go to.
    _options(p, env) {
        const out = [];
        const st = this._status(env);
        if (!st.open)
            return [['leave', 1]];
        if (p.tokensFirst && this.change)
            return [['tokens', 1]];
        const freeCabs = this.cabs.filter(c => !c.user && !c.broken);
        if (freeCabs.length)
            out.push(['cab', p.tokens > 0 ? 6 : 1]);
        const front = this.front.filter(o => !o.users.length && ['pinball', 'claw', 'dance'].includes(o.kind) || (o.kind === 'ride' && p.kid && !o.users.length));
        if (front.length)
            out.push(['front', 3]);
        if (this.people.some(q => q.act === 'play' || q.act === 'front'))
            out.push(['watch', 2]);
        if (this.snack && !p.ate)
            out.push(['snack', 1.2]);
        if (p.drink && this.front.some(o => o.kind === 'table' && o.users.length < 2))
            out.push(['table', 8]);
        if (this.booth && !this.booth.user && p.friends.length && !p.photo)
            out.push(['booth', 0.5]);
        if (this.counter && p.tickets > 20)
            out.push(['prize', 2]);
        if (this.change && p.tokens <= 0)
            out.push(['tokens', 3]);
        if (this.upper.some(o => o.kind === 'sofa' && (o.users || []).length < 2))
            out.push(['sofa', 0.5]);
        out.push(['wander', 0.6]);
        if (p.visits <= 0)
            return [['leave', 1]];
        return out;
    }

    _nextActivity(p, env, anywhere = false) {
        this._release(p);
        const what = weighted(this._options(p, env));
        p.visits--;
        switch (what) {
        case 'tokens': {
            p.tokensFirst = false;
            const o = this.change;
            this._goTo(p, {x: o.x + o.w / 2 - 9 + rand(-2, 2), y: this.B + 6, zone: 'g'}, {act: 'tokens', face: 'up', dur: rand(4, 8)}, anywhere);
            return;
        }
        case 'cab': {
            const free = this.cabs.filter(c => !c.user && !c.broken);
            // friends like neighboring machines
            const friend = p.friends.find(f => f.obj && f.obj.kind === 'cab');
            let c = pick(free);
            if (friend) {
                const near = free.filter(k => Math.abs(k.x - friend.obj.x) < 30 && k.upper === friend.obj.upper);
                if (near.length)
                    c = pick(near);
            }
            c.user = p;
            const y = c.upper ? this.U - 1 : this.B + 6;
            this._goTo(p, {x: c.x + c.w / 2 - 9, y, zone: c.upper ? 'u' : 'g'}, {act: 'play', obj: c, face: 'up', dur: rand(40, 150)}, anywhere);
            return;
        }
        case 'front': {
            const free = this.front.filter(o => !o.users.length && (['pinball', 'claw', 'dance'].includes(o.kind) || (o.kind === 'ride' && p.kid)));
            const o = pick(free);
            o.users = [p];
            const [sx, sy] = o.stand;
            const face = o.kind === 'pinball' ? 'side' : 'up';
            this._goTo(p, {x: sx, y: sy, zone: 'g'}, {act: 'front', obj: o, face, dir: o.dir || 1, dur: o.kind === 'claw' ? rand(14, 22) : o.kind === 'ride' ? rand(25, 40) : rand(40, 100)}, anywhere);
            if (o.kind === 'claw')
                o.claw.phase = 'wait';
            // a parent watches the little one on the ride
            if (o.kind === 'ride' && p.friends.length) {
                const f = p.friends.find(q => !q.kid && q.act !== 'front');
                if (f) {
                    this._release(f);
                    this._goTo(f, {x: o.watch[0], y: o.watch[1], zone: 'g'}, {act: 'watchkid', face: 'side', dir: -1, dur: 40}, anywhere);
                }
            }
            return;
        }
        case 'watch': {
            const players = this.people.filter(q => q !== p && (q.act === 'play' || q.act === 'front') && q.goal && !q.moving);
            const q = pick(players);
            if (!q) {
                this._wander(p, anywhere);
                return;
            }
            const side = chance(0.5) ? -1 : 1;
            const zone = q.zone;
            const y = zone === 'u' ? this.U - 1 : Math.min(this.h - 3, q.y + (q.act === 'front' ? 10 : 8));
            this._goTo(p, {x: clamp(q.x + side * rand(12, 18), 4, this.w - 22), y, zone}, {act: 'watch', target: q, face: 'up', dur: rand(10, 30)}, anywhere);
            return;
        }
        case 'snack': {
            const o = this.snack;
            p.ate = true;
            this._goTo(p, {x: o.x + rand(4, o.w - 22), y: this.B + 8, zone: 'g'}, {act: 'snack', face: 'up', dur: rand(5, 10)}, anywhere);
            return;
        }
        case 'booth': {
            const o = this.booth;
            o.user = p;
            p.photo = true;
            this._goTo(p, {x: o.x + o.w / 2 - 9, y: this.B + 4, zone: 'g'}, {act: 'booth', obj: o, face: 'up', dur: 12}, anywhere);
            const f = p.friends.find(q => !q.photo);
            if (f) {
                f.photo = true;
                this._release(f);
                this._goTo(f, {x: o.x + o.w / 2 - 3, y: this.B + 5, zone: 'g'}, {act: 'booth2', obj: o, face: 'up', dur: 12}, anywhere);
            }
            return;
        }
        case 'prize': {
            const o = this.counter;
            this._goTo(p, {x: o.x + rand(6, o.w - 30), y: this.B + 8, zone: 'g'}, {act: 'prize', face: 'up', dur: rand(8, 16)}, anywhere);
            return;
        }
        case 'sofa': {
            const o = this.upper.find(s => s.kind === 'sofa' && (s.users || []).length < 2);
            o.users = o.users || [];
            const seat = o.seats[o.users.length];
            o.users.push(p);
            this._goTo(p, {x: seat, y: this.U - 5, zone: 'u'}, {act: 'sofa', obj: o, face: 'side', dir: 1, dur: rand(30, 80)}, anywhere);
            return;
        }
        case 'table': {
            const o = pick(this.front.filter(t => t.kind === 'table' && t.users.length < 2));
            const [sx, dir] = o.seats.find(st => !o.users.some(u => u.seat === st)) || o.seats[0];
            o.users.push(p);
            p.seat = o.seats.find(st => st[0] === sx);
            this._goTo(p, {x: sx, y: this.F + 1, zone: 'g'}, {act: 'table', obj: o, face: 'side', dir, dur: rand(25, 60)}, anywhere);
            return;
        }
        case 'leave': {
            const d = this.door;
            this._goTo(p, {x: d.x + d.w / 2 - 9, y: this.B + 2, zone: 'g'}, {act: 'leave', face: 'up', dur: 0}, false);
            return;
        }
        default:
            this._wander(p, anywhere);
        }
    }

    _wander(p, anywhere) {
        const up = this.upper.length && chance(0.25);
        const y = up ? this.U - 1 : chance(0.5) ? rand(this.B + 12, Math.max(this.B + 14, this.F - 70)) : rand(this.F + 14, this.h - 3);
        this._goTo(p, {x: rand(10, this.w - 30), y, zone: up ? 'u' : 'g'}, {act: 'look', face: 'side', dur: rand(4, 12)}, anywhere);
    }

    _release(p) {
        const g = p.goal;
        if (!g)
            return;
        if (g.obj) {
            if (g.obj.user === p) {
                g.obj.user = null;
                if (g.obj.kind === 'cab')
                    g.obj.over = 3;
            }
            if (g.obj.users) {
                g.obj.users = g.obj.users.filter(q => q !== p);
                if (g.obj.kind === 'hockey' && g.obj.users.length === 1) {
                    // the partner stops as well
                    const q = g.obj.users[0];
                    g.obj.users = [];
                    if (q.goal)
                        q.goal.dur = Math.min(q.goal.dur, 0.5);
                }
                if (g.obj.kind === 'claw' && !g.obj.users.length)
                    g.obj.claw.phase = 'idle';
            }
        }
        p.goal = null;
        p.act = null;
    }

    // Route to the goal: through a gap in the front row, up or down the
    // stairs between the floors.
    _goTo(p, target, goal, anywhere = false) {
        p.goal = {...goal, target};
        p.act = goal.act;
        p.obj = goal.obj || null;
        if (anywhere) {
            p.x = target.x;
            p.y = target.y;
            p.zone = target.zone;
            p.path = [];
            this._arrive(p);
            p.goal.dur *= rand(0.2, 1);
            return;
        }
        const path = [];
        const s = this.stairs, F = this.F;
        const sideOf = y => (y > F + 2 ? 1 : -1);
        const ground = (from, to) => {
            if (sideOf(from.y) !== sideOf(to.y)) {
                const gx = this.gaps.reduce((a, b) => (Math.abs(b - (from.x + to.x) / 2) < Math.abs(a - (from.x + to.x) / 2) ? b : a), this.gaps[0] ?? from.x) - 9;
                const back = Math.max(this.B + 10, F - 70);
                const pts = [{x: gx, y: back}, {x: gx, y: F - 10}, {x: gx, y: F + 14}];
                path.push(...(sideOf(from.y) < 0 ? pts : pts.reverse()));
            } else if (from.y < F && to.y < F && Math.abs(from.y - to.y) < 4 && Math.abs(from.x - to.x) > 40 && to.y < this.B + 10) {
                // walk out a little from the machines and back in
                path.push({x: from.x + Math.sign(to.x - from.x) * 6, y: this.B + 16});
                path.push({x: to.x - Math.sign(to.x - from.x) * 6, y: this.B + 16});
            }
            path.push({x: to.x, y: to.y});
        };
        const foot = {x: s.x0 - 9 + (s.x1 < s.x0 ? 6 : -6), y: s.y0 + 4}, head = {x: s.x1 - 9, y: s.y1 - 1};
        if (p.zone === 'g' && target.zone === 'u') {
            ground(p, foot);
            path.push({x: head.x, y: head.y, zone: 'u', stairs: true});
            path.push({x: target.x, y: target.y});
        } else if (p.zone === 'u' && target.zone === 'g') {
            path.push({x: head.x, y: head.y});
            path.push({x: foot.x, y: foot.y, zone: 'g', stairs: true});
            ground(foot, target);
        } else if (p.zone === 'u') {
            path.push({x: target.x, y: target.y});
        } else {
            ground(p, target);
        }
        p.path = path;
        p.moving = true;
        p.state = 'walk';
    }

    _arrive(p) {
        const g = p.goal;
        p.moving = false;
        p.state = g.act === 'hockey' || g.act === 'front' && g.obj?.kind === 'dance' ? 'idle' : 'idle';
        p.face = g.face || 'side';
        if (g.dir)
            p.dir = g.dir;
        p.waitT = 0;
        if (g.act === 'play' && g.obj) {
            g.obj.mode = 'play';
            g.obj.t = 0;
            p.tokens = Math.max(0, p.tokens - 1);
        }
        if (g.act === 'tokens') {
            p.tokens += randi(4, 12);
            this._coins(this.change);
        }
        if (g.act === 'front' && g.obj?.kind === 'claw') {
            const c = g.obj.claw;
            c.phase = 'move';
            c.t = 0;
            c.tx = rand(0.15, 0.7);
            c.win = chance(0.3);
        }
        if (g.act === 'front' && g.obj?.kind === 'dance')
            p.state = 'dance';
        if (g.act === 'sofa' || g.act === 'table')
            p.state = 'sit';
        if (g.act === 'front' && g.obj?.kind === 'ride')
            p.state = 'sit';
        if (g.act === 'booth' || g.act === 'booth2') {
            p.hidden = true;
            if (g.act === 'booth')
                this._photo(g.obj);
        }
        if (g.act === 'prize' && p.tickets > 20) {
            p.tickets = 0;
            this.timers.add(rand(3, 6), () => {
                if (p.act === 'prize') {
                    p.prize = pick(PLUSH);
                    this._bubble(p, 'heart');
                }
            });
        }
        if (g.act === 'snack')
            this.timers.add(rand(2, 4), () => {
                if (p.act === 'snack')
                    p.drink = pick([0x40b0ff, 0xff4f80, 0xfff0c0]);
            });
        if (g.act === 'leave') {
            p.gone = true;
            this.doorOpen = 1;
        }
    }

    _photo(o) {
        for (let i = 0; i < 4; i++)
            this.timers.add(2 + i * 1.6, () => {
                o.flash = 0.25;
            });
        this.timers.add(10, () => {
            o.strip = 6;
        });
    }

    _coins(o) {
        if (!o?.tray)
            return;
        for (let i = 0; i < 8; i++)
            this.timers.add(i * 0.12, () => this.fx.push({kind: 'coin', x: o.tray[0] + rand(0, 10), y: o.tray[1], vy: 0, life: 1.2}));
    }

    _bubble(p, icon) {
        this.bubbles.push({p, icon, life: 2.5});
    }

    // ---------- events ----------

    trigger(name, env, ctx, inView = false) {
        const st = this._status(env);
        switch (name) {
        case 'highscore': {
            const players = this.people.filter(q => q.act === 'play' && !q.moving);
            const p = pick(players);
            if (!p)
                return;
            const c = p.goal.obj;
            c.win = 6;
            const score = this.scores[0].score + randi(500, 5000);
            const entry = {name: this._initials(), score, fresh: 30};
            this.scores.unshift(entry);
            this.scores.length = 5;
            p.hop = 2;
            p.tickets += 60;
            this._bubble(p, 'star');
            for (let i = 0; i < 24; i++)
                this.fx.push({kind: 'confetti', x: c.x + 12, y: c.base - 48, vx: rand(-30, 30), vy: rand(-50, -10), c: pick(NEON), life: rand(1.5, 3)});
            // the others come over to see
            const near = this.people.filter(q => q !== p && !q.moving && q.act !== 'play' && q.act !== 'leave' && q.zone === p.zone && q.act !== 'booth' && q.act !== 'booth2').slice(0, randi(2, 5));
            for (const q of near) {
                this._release(q);
                const y = p.zone === 'u' ? this.U - 1 : this.B + randi(14, 22);
                this._goTo(q, {x: clamp(p.x + rand(-26, 26), 4, this.w - 22), y, zone: p.zone}, {act: 'cheer', target: p, face: 'up', dur: rand(8, 15)});
            }
            if (p.goal)
                p.goal.dur = Math.max(p.goal.dur, 8);
            break;
        }
        case 'repair': {
            const c = pick(this.cabs.filter(k => !k.user && !k.broken));
            if (!c || !st.lights)
                return;
            c.broken = true;
            const t = this._guest(env, {kid: false});
            t.shirt = 0x3a5a8a;
            t.style = 'cap';
            t.frames = [];
            t.tech = true;
            t.visits = 0;
            this.people.push(t);
            const d = this.door;
            t.x = d.x + d.w / 2 - 9;
            t.y = this.B + 3;
            t.friends = [];
            if (inView) {
                t.x = c.x + c.w / 2 - 9;
                t.y = c.upper ? this.U - 1 : this.B + 7;
                t.zone = c.upper ? 'u' : 'g';
            }
            this._goTo(t, {x: c.x + c.w / 2 - 9, y: c.upper ? this.U - 1 : this.B + 7, zone: c.upper ? 'u' : 'g'}, {act: 'repair', obj: c, face: 'up', dur: rand(30, 60)}, inView);
            break;
        }
        case 'party': {
            if (!st.open)
                return;
            const group = this._spawn(env, inView, {n: randi(4, 6), kid: true, party: true});
            for (const p of group)
                if (!p.balloon && chance(0.6))
                    p.balloon = pick([0xf04848, 0xf0d040, 0x4890f0, 0xf080c0, 0x60d060]);
            this._bubble(group[0], 'note');
            break;
        }
        case 'cleaner': {
            if (!st.lights)
                return;
            const t = this._guest(env, {kid: false});
            t.shirt = 0x6a8a3a;
            t.frames = [];
            t.mop = true;
            t.visits = 0;
            t.friends = [];
            this.people.push(t);
            const y = rand(this.B + 14, Math.max(this.B + 16, this.F - 70));
            t.x = inView ? rand(40, this.w / 2) : this.door.x + this.door.w / 2 - 9;
            t.y = inView ? y : this.B + 3;
            this.sign = {x: clamp(t.x + rand(-40, 40), 10, this.w - 20), y: Math.round(y) + 4, life: 90};
            this._goTo(t, {x: rand(this.w * 0.5, this.w - 40), y, zone: 'g'}, {act: 'mop', face: 'side', dur: 2}, false);
            t.speed = 6;
            break;
        }
        case 'group':
            if (st.open)
                this._spawn(env, inView, {n: randi(3, 5), kid: chance(0.6)});
            break;
        case 'power': {
            // the lights flicker for a moment
            this.flicker = 1.2;
            break;
        }
        }
        void ctx;
    }

    _pickEvent(env) {
        const st = this._status(env);
        if (!st.lights)
            return null;
        return weighted([
            ['highscore', st.open ? 3 : 0], ['repair', 0.7], ['party', st.open && env.hour < 19 ? 0.8 : 0],
            ['cleaner', st.closing ? 4 : 0.5], ['group', st.open ? 1.5 : 0], ['power', 0.15],
        ]);
    }

    // ---------- update ----------

    update(dt, real, env) {
        this.t += real;
        this.timers.run(real);
        const st = this._status(env);
        this._updateStaff(env);
        this.eventTimer -= real;
        if (this.eventTimer <= 0) {
            this.eventTimer = rand(25, 70);
            const e = this._pickEvent(env);
            if (e)
                this.trigger(e, env, null);
        }
        if (st.tourney && !this.tourney) {
            this.tourney = true;
            this.trigger('highscore', env, null);
        } else if (!st.tourney) {
            this.tourney = false;
        }
        // guests arrive in ones, twos and threes
        this.spawnTimer -= real;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = rand(3, 9);
            if (this.people.filter(p => !p.tech && !p.mop).length < this._target(env))
                this._spawn(env);
        }
        if (!st.open)
            for (const p of this.people)
                if (p.act !== 'leave' && !p.tech && !p.mop && !p.moving)
                    this._nextActivity(p, env);
        this.doorOpen = Math.max(0, this.doorOpen - real * 0.8);
        for (const p of this.people)
            this._updatePerson(p, real, env);
        this.people = this.people.filter(p => !p.gone);
        for (const c of this.cabs) {
            c.t += real;
            c.over = Math.max(0, c.over - real);
            c.win = Math.max(0, c.win - real);
            if (!c.user && c.mode === 'play' && c.over <= 0)
                c.mode = 'demo';
        }
        for (const s of this.scores)
            if (s.fresh)
                s.fresh = Math.max(0, s.fresh - real);
        for (const o of this.front)
            this._updateFront(o, real);
        if (this.booth) {
            this.booth.flash = Math.max(0, this.booth.flash - real);
            if (this.booth.strip)
                this.booth.strip = Math.max(0, this.booth.strip - real);
        }
        for (const f of this.fx) {
            f.life -= real;
            if (f.kind === 'confetti') {
                f.vy += 60 * real;
                f.x += f.vx * real;
                f.y += f.vy * real;
                f.vx *= 0.98;
            } else if (f.kind === 'coin') {
                f.vy += 120 * real;
                f.y = Math.min(f.y + f.vy * real, this.change.tray[1] + 4);
            }
        }
        this.fx = this.fx.filter(f => f.life > 0);
        for (const b of this.bubbles)
            b.life -= real;
        this.bubbles = this.bubbles.filter(b => b.life > 0 && !b.p.gone);
        if (this.sign && (this.sign.life -= real) <= 0)
            this.sign = null;
        this.flicker = Math.max(0, (this.flicker || 0) - real);
        // the neon sign misses a beat now and then
        this.signFlicker = Math.max(0, this.signFlicker - real);
        if (Math.random() < real * 0.05)
            this.signFlicker = rand(0.1, 0.6);
        for (const s of this.streaks)
            s.life -= real;
        this.streaks = this.streaks.filter(s => s.life > 0);
        void dt;
    }

    _updatePerson(p, real, env) {
        p.t += real;
        if (p.hop)
            p.hop = Math.max(0, p.hop - real);
        if (p.moving) {
            const n = p.path[0];
            if (!n) {
                this._arrive(p);
                return;
            }
            const dx = n.x - p.x, dy = n.y - p.y, d = Math.hypot(dx, dy);
            const v = p.speed * real * (n.stairs ? 0.7 : 1);
            if (Math.abs(dx) > 0.5)
                p.dir = dx > 0 ? 1 : -1;
            p.face = Math.abs(dy) > Math.abs(dx) * 1.5 && !n.stairs ? (dy < 0 ? 'up' : 'down') : 'side';
            p.onStairs = !!n.stairs;
            if (d <= v) {
                p.x = n.x;
                p.y = n.y;
                if (n.zone)
                    p.zone = n.zone;
                p.path.shift();
                p.onStairs = false;
                // the umbrella is shut at the door
                if (p.umbrella && p.y > this.B + 6)
                    p.umbrella = null;
            } else {
                p.x += dx / d * v;
                p.y += dy / d * v;
            }
            if (p.mop && Math.random() < real * 4)
                this.streaks.push({x: p.x + (p.dir > 0 ? 18 : -6), y: p.y - 1, life: 20});
            return;
        }
        const g = p.goal;
        if (!g)
            return;
        p.waitT += real;
        // watchers face the one they watch
        if ((g.act === 'watch' || g.act === 'cheer') && g.target) {
            if (g.target.gone || g.target.moving)
                g.dur = Math.min(g.dur, p.waitT + 1);
        }
        if (g.act === 'cheer' && Math.random() < real * 0.5)
            p.hop = 0.5;
        if (g.act === 'play' && g.obj) {
            g.obj.mode = 'play';
            // some games pay out tickets
            if (Math.random() < real * 0.05)
                p.tickets += randi(1, 6);
        }
        if (g.act === 'mop') {
            // mop on along the floor until the far side
            if (p.waitT > g.dur) {
                if (chance(0.6)) {
                    this._goTo(p, {x: rand(10, this.w - 30), y: clamp(p.y + rand(-12, 12), this.B + 12, Math.max(this.B + 14, this.F - 70)), zone: 'g'}, {act: 'mop', face: 'side', dur: 1});
                } else {
                    const d = this.door;
                    this._goTo(p, {x: d.x + d.w / 2 - 9, y: this.B + 2, zone: 'g'}, {act: 'leave', face: 'up', dur: 0});
                    p.speed = 12;
                }
            }
            return;
        }
        if (p.waitT > g.dur) {
            if (g.act === 'booth' || g.act === 'booth2')
                p.hidden = false;
            if (g.act === 'repair' && g.obj) {
                g.obj.broken = false;
                g.obj.mode = 'demo';
                p.visits = 0;
            }
            if (g.act === 'play' && g.obj)
                g.obj.over = 3;
            if (g.act === 'front' && g.obj?.kind === 'claw' && g.obj.claw.won) {
                p.prize = g.obj.claw.won;
                g.obj.claw.won = null;
            }
            p.drink = g.act === 'snack' ? p.drink : null;
            p.seat = null;
            if (p.tech || p.mop)
                p.visits = 0;
            this._nextActivity(p, env);
        }
    }

    _updateFront(o, real) {
        if (o.kind === 'hockey') {
            const pk = o.puck;
            if (o.users.length === 2 && !o.users.some(u => u.moving)) {
                pk.x += pk.v * real;
                if (pk.x > 0.95 || pk.x < 0.05) {
                    pk.v = -Math.sign(pk.v) * rand(0.5, 1.4);
                    pk.x = clamp(pk.x, 0.05, 0.95);
                    if (chance(0.15)) {
                        // a goal
                        pk.x = 0.5;
                        o.scoreAB = o.scoreAB || [0, 0];
                        o.scoreAB[pk.v > 0 ? 0 : 1]++;
                        const scorer = o.users[pk.v > 0 ? 0 : 1];
                        scorer.hop = 0.8;
                    }
                }
            }
        }
        if (o.kind === 'claw') {
            const c = o.claw;
            c.t += real;
            const user = o.users[0];
            if (c.phase === 'move' && user && !user.moving) {
                c.x += Math.sign(c.tx - c.x) * real * 0.25;
                if (Math.abs(c.x - c.tx) < 0.02) {
                    c.phase = 'down';
                    c.t = 0;
                }
            } else if (c.phase === 'down') {
                c.y = Math.min(1, c.y + real * 0.5);
                if (c.y >= 1) {
                    c.phase = 'up';
                    c.prize = c.win ? pick(PLUSH) : null;
                }
            } else if (c.phase === 'up') {
                c.y = Math.max(0, c.y - real * 0.4);
                // most of the time it slips out of the claw on the way up
                if (c.prize && !c.win && c.y < 0.5)
                    c.prize = null;
                if (c.y <= 0)
                    c.phase = 'home';
            } else if (c.phase === 'home') {
                c.x += real * 0.25;
                if (c.x >= 0.85) {
                    c.x = 0.85;
                    if (c.prize && user) {
                        c.won = c.prize;
                        user.hop = 1.5;
                        this._bubble(user, 'heart');
                    }
                    c.prize = null;
                    c.phase = 'rest';
                    c.t = 0;
                }
            } else if (c.phase === 'rest' && c.t > 2) {
                c.phase = user ? 'move' : 'idle';
                c.tx = rand(0.15, 0.7);
                c.win = chance(0.25);
            }
        }
    }

    // ---------- dynamic drawing ----------

    renderDynamic(g, env) {
        const st = this._status(env);
        const lit = st.lights && this.flicker % 0.3 < 0.2;
        this._renderWindows(g, env);
        this._renderNeon(g, env, st, lit);
        this._renderBoard(g, st);
        // gallery: screens, people, then the railing in front of their legs
        for (const c of this.cabs)
            if (c.upper)
                this._renderScreen(g, c, st);
        this._renderStaffAt(g, env, 'u');
        for (const p of this.people)
            if (p.zone === 'u' && !p.onStairs)
                this._renderPerson(g, p, env);
        for (const s of this.sprites)
            if (s.layer === 'gallery')
                g.drawSprite(s.sp);
        // stairs
        for (const p of this.people)
            if (p.onStairs)
                this._renderPerson(g, p, env);
        for (const s of this.sprites)
            if (s.layer === 'stairs')
                g.drawSprite(s.sp);
        // ground floor back wall
        for (const c of this.cabs)
            if (!c.upper)
                this._renderScreen(g, c, st);
        this._renderSnack(g, st);
        this._renderBooth(g, st);
        for (const p of this.staff)
            this._renderStaff(g, p, env);
        for (const s of this.sprites)
            if (s.layer === 'staff')
                g.drawSprite(s.sp);
        this._renderExit(g, st);
        // the floor: everybody and the front row in depth order
        for (const s of this.streaks)
            g.blend(s.x, s.y, 14, 1, 0xa0c0e0, Math.min(0.25, s.life / 40));
        if (this.sign)
            this._wetSign(g, this.sign);
        const items = [];
        for (const p of this.people)
            if (p.zone === 'g' && !p.onStairs && !p.hidden && !(p.goal?.obj?.kind === 'ride' && p.act === 'front' && !p.moving))
                items.push({y: p.y + (p.goal?.act === 'front' && p.goal.obj?.kind === 'dance' ? 6 : 0), p});
        for (const s of this.sprites)
            if (s.layer === 'floor')
                items.push({y: s.y, s});
        items.sort((a, b) => a.y - b.y);
        for (const it of items) {
            if (it.p) {
                this._renderPerson(g, it.p, env);
            } else {
                const o = it.s.obj;
                if (o.kind === 'ride')
                    this._renderRide(g, o, env, it.s);
                else
                    g.drawSprite(it.s.sp);
                this._renderFrontLive(g, o, st, env);
            }
        }
        for (const f of this.fx)
            if (f.kind === 'confetti')
                g.pxE(f.x, f.y, f.c);
            else
                g.pxE(f.x, f.y, 0xf0c840);
        for (const b of this.bubbles)
            this._renderBubble(g, b);
        this._renderLights(g, env, st, lit);
    }

    _renderWindows(g, env) {
        const v = env.weather.v;
        for (const [x, y, w, h] of this.windows)
            this._outside(g, x, y, w, h, env, v, false);
        if (this.doorPanes)
            for (const [x, y, w, h] of this.doorPanes)
                this._outside(g, x, y, w, h, env, v, true);
    }

    // sky (and the street beyond the door) as seen through the glass
    _outside(g, x, y, w, h, env, v, street) {
        const sky = h * (street ? 0.55 : 1);
        for (let i = 0; i < h; i++) {
            let c;
            if (i < sky)
                c = mix(env.skyTop, env.skyBottom, i / sky);
            else
                c = i < sky + 2 ? 0x5a5a62 : mix(0x6a6a72, 0x4a4a52, (i - sky) / (h - sky));
            g.rectE(x, y + i, w, 1, mix(c, 0x101020, 0.15));
        }
        if (env.night && !street)
            for (let k = 0; k < 4; k++)
                g.pxE(x + hash(k, x, 3) % w, y + hash(k, y, 5) % h, 0xe8e8ff);
        if (street) {
            // a street lamp beyond the door at night
            if (env.lampsOn)
                g.rectE(x + w - 4, y + Math.round(sky) - 12, 2, 2, 0xfff0b0);
        }
        // rain runs down the glass
        if (v.rain > 0.15)
            for (let k = 0; k < w * h / 40 * v.rain; k++) {
                const rx = x + hash(k, x, 9) % w, ry = y + Math.floor((hash(k, y, 7) + this.t * 60 * (1 + k % 3)) % h);
                g.pxE(rx, ry, 0xa8c0e0);
                if (ry + 1 < y + h)
                    g.pxE(rx, ry + 1, 0x8aa0c0);
            }
        if (v.snow > 0.15)
            for (let k = 0; k < w * h / 50; k++) {
                const sx = x + Math.floor((hash(k, x, 2) + Math.sin(this.t + k) * 3 + w) % w), sy = y + Math.floor((hash(k, y, 4) + this.t * 12) % h);
                g.pxE(sx, sy, 0xf4f8ff);
            }
        // reflection
        g.blend(x + 1, y + 1, 1, h - 2, 0xffffff, 0.2, true);
        g.blend(x + 3, y + 1, 1, Math.round(h / 2), 0xffffff, 0.12, true);
    }

    _renderNeon(g, env, st, lit) {
        const s = this.name2, size = 3, w = this._signW();
        const x = Math.round(this.w / 2 - w / 2), y = this.ceil + 14;
        const on = lit || st.open;
        const tube = NEON[this.seed % NEON.length], tube2 = NEON[(this.seed + 1) % NEON.length];
        // backing board
        g.rect(x - 8, y - 6, w + 14, 30, INK);
        g.rect(x - 7, y - 5, w + 12, 28, 0x0e0c18);
        const flick = this.signFlicker > 0 ? Math.floor(this.t * 20) % 3 : -1;
        for (let n = 0; n < s.length; n++) {
            const off = !on || (flick >= 0 && n === (this.seed % s.length) && flick !== 0);
            this._neonChar(g, s[n], x + n * 13, y, size, off ? sh(tube, 0.6) : tube, !off);
        }
        // a sparkle underline
        const uy = y + 19;
        for (let i = 0; i < w; i++)
            if (on)
                g.pxE(x + i, uy, (i + Math.floor(this.t * 12)) % 8 < 4 ? tube2 : mix(tube2, 0xffffff, 0.5));
            else
                g.px(x + i, uy, sh(tube2, 0.6));
        if (on)
            g.glow(x + w / 2, y + 8, w * 0.7, tube, 0.16, 0.35);
        // small signs: a star and a bolt on the high wall
        const sx = this.flip ? 46 : this.w - 46;
        if (on) {
            const c = NEON[(this.seed + 2) % NEON.length], k = Math.floor(this.t * 2) % 2;
            const star = [[0, -6], [2, -2], [6, -2], [3, 1], [4, 6], [0, 3], [-4, 6], [-3, 1], [-6, -2], [-2, -2]];
            for (let i = 0; i < star.length; i++) {
                const [ax, ay] = star[i], [bx, by] = star[(i + 1) % star.length];
                g.line(sx + ax, this.U - 40 + ay, sx + bx, this.U - 40 + by, k ? c : mix(c, 0xffffff, 0.4), true);
            }
            g.glow(sx, this.U - 40, 14, c, 0.12);
        }
    }

    _neonChar(g, ch, x, y, s, c, on) {
        const F = {
            A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
            F: '111100110100100', G: '011100101101011', I: '111010010010111', K: '101101110101101', L: '100100100100111',
            M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101',
            S: '011100010001110', T: '111010010010010', U: '101101101101111', X: '101101010101101', Y: '101101010010010',
            Z: '111001010100111', ' ': '000000000000000',
        }[ch] || '000000000000000';
        for (let i = 0; i < 15; i++) {
            if (F[i] !== '1')
                continue;
            const px = x + (i % 3) * s, py = y + Math.floor(i / 3) * s;
            if (on) {
                g.rectE(px, py, s, s, c);
                g.pxE(px + 1, py + 1, mix(c, 0xffffff, 0.7));
            } else {
                g.rect(px, py, s, s, c);
            }
        }
    }

    _renderBoard(g, st) {
        // high score board above the middle of the ground floor
        const w = 56, h = 41, x = this.boardX, y = this.U + 24;
        g.rect(x - 2, y - 2, w + 4, h + 4, INK);
        g.rect(x - 1, y - 1, w + 2, h + 2, 0x3a3a4a);
        g.rect(x, y, w, h, 0x08080e);
        if (!st.lights) {
            g.text('CLOSED', x + 15, y + 14, 0x5a2a2a);
            return;
        }
        g.text('HI SCORE', x + 13, y + 2, NEON[(Math.floor(this.t * 2)) % NEON.length], true);
        this.scores.forEach((s, i) => {
            const blink = s.fresh && Math.floor(this.t * 4) % 2;
            const c = blink ? 0xffffff : [0xffe040, 0xc0c0d0, 0xe0904a, 0x9a9aaa, 0x9a9aaa][i];
            g.text(String(i + 1), x + 2, y + 9 + i * 6, c, true);
            g.text(s.name, x + 9, y + 9 + i * 6, c, true);
            g.text(String(s.score).padStart(6, '0'), x + 30, y + 9 + i * 6, c, true);
        });
    }

    _renderExit(g, st) {
        const [x, y] = this.exitSign;
        g.rect(x - 1, y - 1, 20, 9, INK);
        g.rectE(x, y, 18, 7, 0x1a8a3a);
        g.text('EXIT', x + 2, y + 1, 0xd8ffe0, true);
        g.glow(x + 9, y + 3, 14, 0x40ff80, st.lights ? 0.05 : 0.14);
        // umbrellas left at the door on a rainy day
        const wet = this.people.filter(p => p.rainColor && !p.umbrella && !p.gone).slice(0, 6);
        const ux = this.flip ? this.door.x - 14 : this.door.x + this.door.w + 4;
        if (wet.length) {
            g.rect(ux - 1, this.B - 12, 10, 12, INK);
            g.rect(ux, this.B - 11, 8, 11, 0x5a5a62);
            wet.forEach((p, i) => {
                g.rect(ux + 1 + (i % 3) * 2, this.B - 18 + (i % 2), 2, 7, p.rainColor);
                g.px(ux + 1 + (i % 3) * 2, this.B - 19 + (i % 2), INK);
            });
        }
    }

    _renderScreen(g, c, st) {
        if (!c.screen)
            return;
        const [x, y, w, h] = c.screen;
        if (!st.lights) {
            g.rect(x, y, w, h, 0x0c0c14);
            g.px(x + 2, y + 2, 0x3a3a4a);
            return;
        }
        let mode = c.broken ? 'broken' : c.win > 0 ? 'win' : c.mode === 'play' && c.user && !c.user.moving ? 'play' : c.over > 0 ? 'over' : 'demo';
        if (mode === 'demo' && (c.t + c.seed) % 14 < 4)
            mode = 'title';
        this._game(g, x, y, w, h, c.game, c.t + c.seed, mode, c);
        // light from the screen on whoever plays
        if (c.user && !c.user.moving)
            g.glow(x + w / 2, y + h + 6, 14, 0x6080ff, 0.08);
    }

    // The little games. Everything is drawn emissive in a few colors.
    _game(g, x, y, w, h, game, t, mode, c) {
        // clipped to the screen
        const E = (xx, yy, ww, hh, col) => {
            const x1 = Math.max(0, xx), y1 = Math.max(0, yy), x2 = Math.min(w, xx + ww), y2 = Math.min(h, yy + hh);
            if (x2 > x1 && y2 > y1)
                g.rectE(x + x1, y + y1, x2 - x1, y2 - y1, col);
        };
        const P = (xx, yy, col) => {
            if (xx >= 0 && yy >= 0 && xx < w && yy < h)
                g.pxE(x + xx, y + yy, col);
        };
        if (mode === 'broken') {
            for (let yy = 0; yy < h; yy++)
                for (let xx = 0; xx < w; xx++)
                    g.pxE(x + xx, y + yy, (hash(xx, yy, Math.floor(t * 20)) % 4) * 0x202020 + 0x101010);
            return;
        }
        if (mode === 'win') {
            const c1 = NEON[Math.floor(t * 8) % NEON.length];
            E(0, 0, w, h, sh(c1, 0.6));
            g.text('WIN', x + 2, y + 4, 0xffffff, true);
            return;
        }
        if (mode === 'over') {
            E(0, 0, w, h, 0x0a0a14);
            g.text('GAME', x, y + 1, 0xff4040, true);
            g.text('OVER', x, y + 7, 0xff4040, true);
            return;
        }
        if (mode === 'title') {
            E(0, 0, w, h, 0x0a0a1a);
            const col = c ? c.trim : NEON[0];
            for (let i = 0; i < 4; i++)
                E(1 + i * 4, 2 + (i % 2), 3, 3, i % 2 ? col : 0xffffff);
            if (Math.floor(t * 2) % 2)
                g.text('COIN', x, y + 8, 0xffe040, true);
            return;
        }
        const s = mode === 'demo' ? 0.6 : 1;
        const T = t * s;
        switch (game) {
        case 'invaders': {
            E(0, 0, w, h, 0x04040c);
            // the fleet marches side to side and creeps down, a saucer now and then
            const step = Math.floor(T * 2), fr = step % 2;
            const ox = [0, 1, 2, 1][step % 4], oy = Math.floor(T / 6) % 3;
            // two frames each: arms up, arms down
            const shapes = [[['.X.', 'X.X'], ['.X.', '.X.']], [['XXX', 'X.X'], ['XXX', '.X.']], [['X.X', 'XXX'], ['XXX', 'X.X']]];
            const killed = Math.floor(T * 0.7) % 13;
            for (let r = 0; r < 3; r++)
                for (let k = 0; k < 4; k++) {
                    if ((r * 4 + k) * 7 % 13 < killed)
                        continue;
                    const rows = shapes[r][fr];
                    rows.forEach((row, yy) => {
                        for (let xx = 0; xx < 3; xx++)
                            if (row[xx] === 'X')
                                P(1 + k * 4 + ox + xx, 2 + r * 3 + oy + yy, [0xff4fb0, 0x40e0ff, 0x60ff90][r]);
                    });
                }
            if (Math.floor(T / 5) % 3 === 0)
                E(Math.floor((T * 6) % (w + 4)) - 4, 0, 3, 1, 0xff4040);
            for (const bx of [2, 8, 14])
                E(bx, h - 4, 3, 1, 0x40c040);
            const cx = Math.round(w / 2 - 1 + Math.sin(T * 1.3) * (w / 2 - 2));
            E(cx - 1, h - 1, 3, 1, 0x60ff90);
            P(cx, h - 2, 0x60ff90);
            P(cx, h - 3 - Math.floor((T * 20) % (h - 3)), 0xffffff);
            break;
        }
        case 'chomp': {
            E(0, 0, w, h, 0x02020a);
            const wall = 0x2a3ae8;
            E(0, 0, w, 1, wall);
            E(0, h - 1, w, 1, wall);
            for (const yy of [4, 9]) {
                E(0, yy, 3, 2, wall);
                E(5, yy, 3, 2, wall);
                E(10, yy, 3, 2, wall);
                E(15, yy, 3, 2, wall);
            }
            // the yellow chomper runs along the middle eating dots, two
            // ghosts behind it; then it gets the big pill and turns round
            const lap = w + 14, u = (T * 6) % lap, power = Math.floor(T * 6 / lap) % 3 === 2;
            const px = Math.round(power ? w + 2 - u : u - 4);
            for (let xx = 1; xx < w; xx += 2) {
                P(xx, 2, 0xf0c8a0);
                P(xx, 12, 0xf0c8a0);
                if (power || xx > px + 2)
                    P(xx, 7, 0xf0c8a0);
            }
            if (Math.floor(T * 4) % 2)
                E(w - 2, 6, 2, 2, 0xffd0b0);
            const open = Math.floor(T * 8) % 2;
            const pac = open ? ['XX.', 'X..', 'XX.'] : ['XXX', 'XX.', 'XXX'];
            pac.forEach((row, yy) => {
                for (let xx = 0; xx < 3; xx++)
                    if (row[xx] === 'X')
                        P(power ? px + 2 - xx : px + xx, 6 + yy, 0xffe020);
            });
            [[0xff3030, 6], [0xffa0d0, 11]].forEach(([gc, gap]) => {
                const gx = power ? px - gap : px - gap;
                const col = power ? (Math.floor(T * 6) % 2 ? 0x2040ff : 0xf0f0ff) : gc;
                E(gx, 6, 3, 2, col);
                P(gx, 8, col);
                P(gx + 2, 8, col);
                if (!power) {
                    P(gx + (power ? 0 : 1), 7, 0xffffff);
                    P(gx + 2, 7, 0xffffff);
                }
            });
            break;
        }
        case 'blocks': {
            E(0, 0, w, h, 0x08081a);
            E(0, 0, 1, h, 0x8a8aa0);
            E(13, 0, 1, h, 0x8a8aa0);
            const COL = [0x40e0f0, 0xf0e040, 0xb050f0, 0x50e050, 0xf04040, 0x4060f0, 0xf09030];
            const PIECES = [[[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[2, 0], [0, 1], [1, 1], [2, 1]]];
            const cell = (cx, cy, col) => {
                E(1 + cx * 2, cy * 2, 2, 2, col);
                P(1 + cx * 2, cy * 2, hi(col, 0.5));
            };
            // the stack at the bottom with a few holes, a piece falling in
            const round = Math.floor(T / 4), seed = c ? c.seed : 3;
            const rows = 2 + round % 2;
            for (let r = 0; r < rows; r++)
                for (let k = 0; k < 6; k++)
                    if (hash(k, r + round * 3, seed) % 5)
                        cell(k, 6 - r, COL[hash(k, r, seed + round) % 7]);
            const pi = hash(round, 1, seed) % 7, pc = hash(round, 2, seed) % 3;
            const fall = Math.min(Math.floor((T % 4) * 1.8), 5 - rows);
            for (const [dx, dy] of PIECES[pi])
                cell(pc + dx, fall + dy - 1, COL[pi]);
            // the next piece
            const ni = hash(round + 1, 1, seed) % 7;
            for (const [dx, dy] of PIECES[ni])
                P(14 + dx, 2 + dy, COL[ni]);
            g.text(String(round % 10), x + 14, y + 7, 0xd0d0e0, true);
            break;
        }
        case 'kong': {
            E(0, 0, w, h, 0x02020a);
            // three slanted girders, ladders, the ape throwing barrels
            const g1 = xx => 4 + Math.floor(xx / 9), g2 = xx => 9 - Math.floor(xx / 9);
            for (let xx = 0; xx < w; xx++) {
                P(xx, g1(xx), xx % 3 ? 0xe03050 : 0xff90a0);
                P(xx, g2(xx), xx % 3 ? 0xe03050 : 0xff90a0);
                P(xx, h - 1, xx % 3 ? 0xe03050 : 0xff90a0);
            }
            for (const [lx, y0, y1] of [[14, g1(14) + 1, g2(14)], [3, g2(3) + 1, h - 1]])
                for (let yy = y0; yy < y1; yy++) {
                    P(lx, yy, 0x40e0e0);
                    P(lx + 2, yy, 0x40e0e0);
                    if (yy % 2)
                        P(lx + 1, yy, 0x40e0e0);
                }
            E(1, 1, 3, 3, 0x9a5020);
            P(2, 2, 0xf0c090);
            P(1, 1, 0x6a3010);
            E(4, 2, 1, 2, 0xb06a20);
            P(9, 1, 0xff80c0);
            P(9, 2, 0xff80c0);
            const len = w + 4 + w + 4 + w;
            for (const off of [0, len / 3, len * 2 / 3]) {
                const u = (T * 6 + off) % len;
                let bx, by;
                if (u < w) [bx, by] = [Math.floor(u), g1(Math.floor(u)) - 1];
                else if (u < w + 4) [bx, by] = [w - 1, g1(w - 1) - 1 + Math.floor((u - w) * 1.2)];
                else if (u < 2 * w + 4) [bx, by] = [w - 1 - Math.floor(u - w - 4), g2(w - 1 - Math.floor(u - w - 4)) - 1];
                else if (u < 2 * w + 8) [bx, by] = [0, g2(0) - 1 + Math.floor((u - 2 * w - 4) * 1.2)];
                else [bx, by] = [Math.floor(u - 2 * w - 8), h - 2];
                P(bx, by, 0xc07030);
                P(bx + 1, by, 0x8a4a1a);
            }
            const hx = 8 + Math.round(Math.sin(T * 0.8) * 5), jump = Math.floor(T * 3) % 4 === 0 ? 1 : 0;
            P(hx, h - 4 - jump, 0xff3030);
            P(hx, h - 3 - jump, 0x4060ff);
            P(hx, h - 2 - jump, 0x4060ff);
            break;
        }
        case 'pong': {
            E(0, 0, w, h, 0x000000);
            for (let yy = 0; yy < h; yy += 2)
                P(Math.floor(w / 2), yy, 0x8a8a8a);
            const sc = Math.floor(T / 7);
            g.text(String(sc % 10), x + 4, y + 1, 0x9a9a9a, true);
            g.text(String((sc * 3 + 1) % 10), x + 11, y + 1, 0x9a9a9a, true);
            const bx = 2 + Math.round(tri(T * 0.7) * (w - 5)), by = Math.round(tri(T * 1.1) * (h - 1));
            P(bx, by, 0xffffff);
            E(1, clamp(by - 1 + Math.round(Math.sin(T) * 1), 0, h - 3), 1, 3, 0xffffff);
            E(w - 2, clamp(by - 1 - Math.round(Math.sin(T * 1.3)), 0, h - 3), 1, 3, 0xffffff);
            break;
        }
        case 'frog': {
            // home bank, river with logs and turtles, median, road, start
            E(0, 0, w, 2, 0x20a040);
            for (const hx of [2, 8, 14])
                E(hx, 0, 2, 2, 0x0a2a4a);
            E(0, 2, w, 4, 0x1a2a8a);
            for (let r = 0; r < 4; r++) {
                const sp = (r % 2 ? -1 : 1) * (2 + r);
                for (let k = 0; k < 2; k++) {
                    const lx = Math.floor(((T * sp + k * 10 + r * 5) % (w + 6) + w + 6) % (w + 6)) - 6;
                    E(lx, 2 + r, r % 2 ? 3 : 5, 1, r % 2 ? 0x30c060 : 0xa06030);
                }
            }
            E(0, 6, w, 1, 0x9040b0);
            E(0, 7, w, 5, 0x0a0a0a);
            for (let r = 0; r < 4; r++) {
                const sp = (r % 2 ? 1 : -1) * (3 + r * 1.5);
                for (let k = 0; k < 2; k++) {
                    const cx = Math.floor(((T * sp + k * 9 + r * 4) % (w + 4) + w + 4) % (w + 4)) - 3;
                    E(cx, 7 + r + (r > 1 ? 1 : 0), 3, 1, [0xffe040, 0xff4040, 0xf0f0f0, 0xff40f0][r]);
                }
            }
            E(0, 12, w, 2, 0x9040b0);
            const hop = Math.floor(T * 1.5) % 7, fy = 12 - Math.floor(hop * 1.7), fx = 8 + (Math.floor(T / 5) % 3) - 1;
            E(fx, fy, 2, 2, 0x40ff40);
            P(fx, fy, 0xffff60);
            break;
        }
        case 'rocks': {
            E(0, 0, w, h, 0x000000);
            // outlines drifting across, the ship turning and shooting
            const ring = (cx, cy, r) => {
                for (let a = 0; a < r * 7; a++) {
                    const ang = a / (r * 7) * Math.PI * 2;
                    P(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), 0xc0c0c0);
                }
            };
            for (let k = 0; k < 3; k++) {
                const r = 3 - k % 2 - (k === 2 ? 1 : 0);
                const rx = ((hash(k, 1, 9) + T * (2 + k)) % (w + 6)) - 3, ry = ((hash(k, 2, 9) + T * (1 + k * 0.7)) % (h + 6)) - 3;
                ring(Math.round(rx), Math.round(ry), r);
            }
            const ang = Math.floor(T * 1.5) % 8 * Math.PI / 4, sx = Math.floor(w / 2), sy = Math.floor(h / 2);
            P(sx + Math.round(Math.cos(ang) * 2), sy + Math.round(Math.sin(ang) * 2), 0xffffff);
            P(sx + Math.round(Math.cos(ang + 2.4) * 1.5), sy + Math.round(Math.sin(ang + 2.4) * 1.5), 0xffffff);
            P(sx + Math.round(Math.cos(ang - 2.4) * 1.5), sy + Math.round(Math.sin(ang - 2.4) * 1.5), 0xffffff);
            const d = (T * 12) % 9;
            P(sx + Math.round(Math.cos(ang) * (3 + d)), sy + Math.round(Math.sin(ang) * (3 + d)), 0xffffff);
            break;
        }
        case 'racer': {
            E(0, 0, w, 3, 0x2a4a9a);
            for (let r = 3; r < h; r++) {
                const half = 1 + (r - 3) * (w / 2 - 1) / (h - 3);
                const stripe = Math.floor(r * 0.7 + T * 8) % 2;
                E(0, r, w, 1, stripe ? 0x2a8a3a : 0x3aa04a);
                E(Math.round(w / 2 - half), r, Math.round(half * 2), 1, 0x5a5a62);
                if ((Math.floor(r * 0.5 + T * 6)) % 3 === 0)
                    P(Math.floor(w / 2), r, 0xf0f0f0);
            }
            const cx = Math.round(w / 2 - 1 + Math.sin(T * 0.9) * 3);
            E(cx, h - 3, 3, 2, 0xff4040);
            const oy = Math.floor((T * 4) % (h - 4)) + 3;
            P(Math.round(w / 2 + (oy - 3) * 0.3), oy, 0xffe040);
            break;
        }
        case 'bricks': {
            E(0, 0, w, h, 0x0a0a1a);
            const gone = Math.floor(T * 0.8) % 12;
            for (let r = 0; r < 3; r++)
                for (let k = 0; k < Math.floor(w / 3); k++)
                    if ((r * 7 + k * 3) % 12 >= gone)
                        E(k * 3, 1 + r * 2, 2, 1, [0xff4040, 0xffe040, 0x40c0ff][r]);
            const bx = Math.round(tri(T * 0.9) * (w - 1)), byy = 7 + Math.round(tri(T * 1.3) * (h - 9));
            P(bx, byy, 0xffffff);
            const px = clamp(bx - 2, 0, w - 4);
            E(px, h - 1, 4, 1, 0xd0d0e0);
            break;
        }
        case 'jump': {
            // scrolling world: clouds, hills, brick and question blocks,
            // green pipes, a walking mushroom and the little plumber
            E(0, 0, w, h, 0x5a94f0);
            const sc = T * 5;
            const W2 = 40, at = xx => ((Math.floor(xx + sc) % W2) + W2) % W2;
            for (let xx = 0; xx < w; xx++) {
                const wx = at(xx);
                if (wx >= 3 && wx < 8)
                    P(xx, wx === 3 || wx === 7 ? 2 : 1, 0xffffff);
                if (wx >= 3 && wx < 8)
                    P(xx, 2, 0xffffff);
                const hill = 16 - Math.abs(wx - 22);
                if (hill > 0)
                    E(xx, h - 2 - Math.min(4, Math.ceil(hill / 2)), 1, Math.min(4, Math.ceil(hill / 2)), 0x2a9a3a);
                E(xx, h - 2, 1, 2, (wx + Math.floor(xx / 2)) % 2 ? 0xc06030 : 0x9a4a20);
                if (wx >= 10 && wx < 16)
                    P(xx, 5, wx === 12 ? (Math.floor(T * 3) % 2 ? 0xffd040 : 0xc09020) : 0xb05020);
                if (wx >= 30 && wx < 34) {
                    E(xx, h - 5, 1, 3, wx === 30 ? 0x80e080 : 0x20a020);
                    P(xx, h - 6, wx === 30 ? 0xa0f0a0 : 0x40c040);
                }
            }
            const ex = Math.round(w - ((T * 2) % (w + 4)));
            E(ex, h - 4, 2, 2, 0x9a5a2a);
            P(ex, h - 4, 0xd09060);
            const ph = (T * 5) % 9, jy = ph > 5 ? Math.round(Math.sin((ph - 5) / 4 * Math.PI) * 5) : 0;
            P(4, h - 6 - jy, 0xe02020);
            P(5, h - 6 - jy, 0xe02020);
            P(4, h - 5 - jy, 0xf0c090);
            E(4, h - 4 - jy, 2, 2, 0x2040d0);
            break;
        }
        case 'fight': {
            // dusk over the rooftops, two fighters trading blows
            for (let r = 0; r < h; r++)
                E(0, r, w, 1, mix(0xf07040, 0x5a1a6a, r / h));
            for (let xx = 0; xx < w; xx++)
                E(xx, h - 6 - hash(xx >> 2, 1, 4) % 4, 1, 4, 0x2a0a3a);
            E(0, h - 2, w, 2, 0x6a4a3a);
            const life = (T % 12) / 12;
            E(1, 1, 7, 1, 0x801010);
            E(10, 1, 7, 1, 0x801010);
            E(1, 1, Math.round(7 * (1 - life * 0.7)), 1, 0xf0e040);
            E(17 - Math.round(7 * (1 - life)), 1, Math.round(7 * (1 - life)), 1, 0xf0e040);
            const gap = 2 + Math.round(tri(T * 1.5) * 4), hitA = gap < 3 && Math.floor(T * 3) % 2, hitB = gap < 3 && !hitA;
            const fighter = (fx, d, body, band, punch) => {
                const by = h - 9;
                P(fx, by, 0xf0c090);
                P(fx + d, by, 0xf0c090);
                P(fx, by - 1, band);
                E(Math.min(fx, fx + d), by + 1, 2, 3, body);
                P(fx, by + 4, body);
                P(fx + d, by + 4, body);
                P(fx - d, by + 5, body);
                P(fx + 2 * d, by + 5, body);
                P(fx + 2 * d, by + 2, 0xf0c090);
                if (punch) {
                    P(fx + 3 * d, by + 2, 0xf0c090);
                    P(fx + 4 * d, by + 1, 0xffffff);
                }
            };
            fighter(Math.round(w / 2 - gap - 2), 1, 0xf4f0e8, 0xe02020, hitA);
            fighter(Math.round(w / 2 + gap + 1), -1, 0xe04020, 0x2a2a2a, hitB);
            break;
        }
        default: { // fish
            for (let r = 0; r < h; r++)
                E(0, r, w, 1, mix(0x2a6ac0, 0x0a1a4a, r / h));
            for (let i = 0; i < 3; i++) {
                const fx = Math.floor((hash(i, 3, 1) + T * (4 + i * 2)) % (w + 4)) - 2, fy = 2 + hash(i, 5, 1) % (h - 4);
                E(fx, fy, 2, 1, [0xffa040, 0xffe040, 0xff6fb0][i]);
                P(fx - 1, fy, 0xffffff);
            }
            P(Math.floor((T * 3) % w), h - 1 - Math.floor((T * 5) % 4), 0xa0e0ff);
            E(0, h - 1, w, 1, 0xd0b070);
        }
        }
        // scanlines
        for (let r = 1; r < h; r += 2)
            g.blend(x, y + r, w, 1, 0x000000, 0.22, true);
    }

    _renderSnack(g, st) {
        if (!this.snack?.slush)
            return;
        for (const [x, y, w, h, c] of this.snack.slush) {
            g.rectE(x, y, w, h, st.lights ? sh(c, 0.15) : sh(c, 0.7));
            if (st.lights)
                for (let i = 0; i < 3; i++) {
                    const sy = y + Math.floor((this.t * 6 + i * 5) % h);
                    g.rectE(x + 1, sy, w - 2, 1, hi(c, 0.4));
                }
            g.blend(x + 1, y + 1, 1, h - 2, 0xffffff, 0.3, true);
        }
    }

    _renderBooth(g, st) {
        const o = this.booth;
        if (!o?.door)
            return;
        const [x, y, w, h] = o.door;
        const occupied = this.people.some(p => p.hidden && p.goal?.obj === o);
        // the curtain is drawn across while someone is inside
        const cw = occupied ? w : 4;
        for (let i = 0; i < cw; i++)
            g.rect(x + i, y, 1, h, i % 3 === 0 ? 0x8a1a2a : 0xb02838);
        if (occupied) {
            // feet under the curtain
            g.rect(x + 3, y + h - 2, 3, 2, 0x2a2a30);
            g.rect(x + 9, y + h - 2, 3, 2, 0x2a2a30);
        }
        if (o.flash > 0) {
            g.blend(x, y, w, h, 0xffffff, 0.6, true);
            g.glow(x + w / 2, y + h / 2, 30, 0xffffff, 0.35);
        }
        if (o.strip > 0) {
            const [sx, sy] = o.slot, len = Math.min(10, Math.round((6 - o.strip) * 6));
            g.rect(sx, sy, 2, len, 0xf4f0e8);
        }
        void st;
    }

    _wetSign(g, s) {
        const {x, y} = s;
        g.rect(x - 1, y - 14, 9, 14, INK);
        g.rect(x, y - 13, 7, 12, 0xf0d020);
        g.rect(x + 3, y - 10, 1, 4, INK);
        g.px(x + 3, y - 4, INK);
        g.line(x - 1, y, x + 3, y - 14, INK);
    }

    _renderStaffAt() {
    }

    _renderStaff(g, p, env) {
        const o = p.obj;
        p.t += 0.016;
        // looks around, now and then steps aside
        const k = Math.floor((p.t + o.x) / 6) % 4;
        const x = o.staffX + (k === 1 ? -14 : k === 3 ? 12 : 0);
        p.state = 'idle';
        drawPerson(g, p, x, this.B - 8, k === 1 ? -1 : 1, env, k === 0 || k === 2 ? 'down' : 'side');
    }

    _renderPerson(g, p, env) {
        if (p.hidden)
            return;
        const act = p.goal?.act;
        let face = p.moving ? (p.face === 'side' ? 'side' : p.face) : p.face || 'side';
        if (p.moving && p.face === 'up' && !p.onStairs)
            face = 'up';
        const state0 = p.state;
        if (!p.moving) {
            p.state = state0 === 'sit' ? 'sit' : 'idle';
            // stepping on the dance pads
            if (state0 === 'dance')
                p.state = 'walk';
        }
        if (p.state === 'sit')
            face = 'side';
        let y = p.y;
        if (p.hop)
            y -= Math.round(Math.abs(Math.sin(p.hop * 10)) * 3);
        if (state0 === 'dance')
            y -= Math.floor(p.t * 4) % 2;
        // the kiddie ride rocks its rider
        if (act === 'front' && p.goal.obj?.kind === 'ride')
            y += Math.round(Math.sin(this.t * 4));
        drawPerson(g, p, p.x, y, p.dir, env, face);
        p.state = state0;
        const top = y - 34;
        // things in hand
        if (p.drink) {
            const hx = p.x + (face === 'side' ? (p.dir > 0 ? 14 : 1) : 14);
            g.rect(hx - 1, y - 18, 5, 6, INK);
            g.rect(hx, y - 17, 3, 4, p.drink);
            g.px(hx + 1, y - 20, 0xffffff);
        }
        if (p.prize) {
            const hx = p.x + (p.dir > 0 ? 13 : -1);
            g.disc(hx + 3, y - 16, 4, INK);
            g.disc(hx + 3, y - 16, 3, p.prize);
            g.px(hx + 2, y - 17, INK);
            g.px(hx + 4, y - 17, INK);
        }
        if (p.mop) {
            const mx = p.x + (p.dir > 0 ? 20 : -4);
            g.line(p.x + 9, y - 16, mx, y - 2, 0xb08a5a);
            g.rect(mx - 3, y - 2, 7, 2, 0xd8d8e0);
        }
        if (p.tech && !p.moving) {
            // the coin door hangs open, a tool box at the feet
            const c = p.goal?.obj;
            if (c?.kind === 'cab') {
                const base = c.base;
                g.rect(c.x + 7, base - 12, 10, 9, 0x0a0a0a);
                if (Math.random() < 0.05)
                    g.pxE(c.x + 9 + randi(0, 6), base - 10 + randi(0, 5), 0xffe080);
            }
            g.rect(p.x + 16, y - 6, 10, 6, INK);
            g.rect(p.x + 17, y - 5, 8, 4, 0xd83838);
        }
        void top;
    }

    _renderRide(g, o, env, s) {
        const F = this.F, x = o.x, w = o.w, rider = o.users[0] && !o.users[0].moving && o.users[0].act === 'front' ? o.users[0] : null;
        const rock = rider ? Math.round(Math.sin(this.t * 4)) : 0;
        g.drawSprite(s.sp);
        if (s.body) {
            s.body.box[1] += rock;
            g.drawSprite(s.body);
            s.body.box[1] -= rock;
        }
        if (rider) {
            if (o.flame)
                g.rectE(o.flame[0] - 2, o.flame[1] - 1 + rock, 3, 3, Math.floor(this.t * 10) % 2 ? 0xffe040 : 0xff8020);
            rider.dir = 1;
            drawPerson(g, rider, x + w / 2 - 12, (o.seat ?? F - 18) + 9 + rock, 1, env, 'side');
        }
        // lamps on the coin box blink while it runs
        if (o.lamps)
            o.lamps.forEach(([lx, ly], i) => g.pxE(lx, ly, rider && Math.floor(this.t * 3 + i) % 2 ? 0xffe040 : 0x8a2a2a));
    }

    // live bits of the front row machines
    _renderFrontLive(g, o, st, env) {
        const F = this.F;
        if (!st.lights)
            return;
        const busy = o.users.length && !o.users[0].moving;
        switch (o.kind) {
        case 'pinball': {
            this._backglass(g, o, true);
            o.points = (o.points || randi(1000, 9000)) + (busy ? randi(0, 4) : 0);
            const digits = String(o.points % 10000).padStart(4, '0');
            for (let i = 0; i < 4; i++)
                g.text(digits[i], o.score[0] + i * 4, o.score[1], 0xff8020, true);
            if (busy) {
                // the ball and the bumpers it hits
                const L = o.w - 3 - 18;
                const bi = Math.round(3 + tri(this.t * 0.9) * (L - 4)), bv = Math.round(2 + 1.6 * Math.sin(this.t * 3.1));
                const [bx, by] = this._pfPt(o, bi, bv);
                g.pxE(bx, by, 0xffffff);
                const hit = Math.floor(this.t * 5) % 3;
                const [i, v] = o.bumpers[hit];
                const [px, py] = this._pfPt(o, i, v);
                g.rectE(px - (o.dir > 0 ? 0 : 1), py, 2, 1, NEON[(hit + 2) % 6]);
                if (Math.floor(this.t * 8) % 2) {
                    const [fx, fy] = this._pfPt(o, 6, 1);
                    g.pxE(fx, fy, 0xffffff);
                }
            }
            break;
        }
        case 'hockey': {
            const [sx, sy, sw, shh] = o.surf;
            g.blend(sx, sy, sw, shh, 0xffffff, 0.12, true);
            const sc = o.scoreAB || [0, 0];
            o.digits.forEach(([dx, dy], i) => {
                g.rect(dx - 1, dy - 1, 7, 7, 0x0a0a0a);
                g.text(String(sc[i] % 10), dx + 1, dy, i ? 0xff5050 : 0x50a0ff, true);
            });
            const [lx, ly, lw] = o.strip, step = Math.floor(this.t * (busy ? 10 : 3));
            for (let c = 0; c < lw; c += 2)
                if ((c / 2 + step) % 5 < 2)
                    g.pxE(lx + c, ly, NEON[((lx + c) >> 1) % 6]);
            if (o.users.length === 2) {
                const px = Math.round(sx + 2 + o.puck.x * (sw - 5));
                const pv = Math.round(sy + (Math.sin(this.t * 2.3) + 1) / 2 * (shh - 2));
                g.rect(px, pv, 2, 1, 0xe03030);
                g.rect(px, pv + 1, 2, 1, 0x801818);
                for (const [mx, c] of [[sx + 2, 0x3a6ae0], [sx + sw - 4, 0xe04848]]) {
                    const my = clamp(Math.round(pv + (mx < px ? 0 : 0) - 1), sy, sy + shh - 3);
                    g.rect(mx, my, 3, 2, c);
                    g.px(mx + 1, my - 1, hi(c, 0.4));
                }
            }
            break;
        }
        case 'claw': {
            const [x, y, w, h] = o.box, c = o.claw;
            this._clawSign(g, o, true);
            // lights round the sign chase each other
            const [lx, ly, lw] = o.sign;
            for (let k = 0; k < lw; k += 3)
                g.pxE(lx + k, ly - 1, Math.floor(this.t * 6 + k / 3) % 4 ? sh(c.color, 0.3) : 0xffffff);
            const cx = Math.round(x + 3 + c.x * (w - 7)), cy = Math.round(y + 4 + c.y * (h - 17));
            g.rect(cx - 2, y + 1, 5, 2, 0x5a5a66);
            g.rect(cx, y + 3, 1, cy - y - 3, 0xc0c0cc);
            const open = c.phase === 'down' || c.phase === 'idle' || c.phase === 'wait' || c.phase === 'move';
            g.rect(cx - 1, cy, 3, 2, 0xd8d8e4);
            g.px(cx, cy, 0xffffff);
            if (open) {
                g.px(cx - 2, cy + 2, 0xc0c0cc);
                g.px(cx - 3, cy + 3, 0xc0c0cc);
                g.px(cx + 2, cy + 2, 0xc0c0cc);
                g.px(cx + 3, cy + 3, 0xc0c0cc);
                g.px(cx, cy + 2, 0xa0a0ac);
            } else {
                g.px(cx - 2, cy + 2, 0xc0c0cc);
                g.px(cx - 1, cy + 4, 0xc0c0cc);
                g.px(cx + 2, cy + 2, 0xc0c0cc);
                g.px(cx + 1, cy + 4, 0xc0c0cc);
            }
            if (c.prize) {
                g.rect(cx - 1, cy + 3, 3, 3, c.prize);
                g.px(cx - 1, cy + 4, INK);
                g.px(cx + 1, cy + 4, INK);
            }
            if (busy)
                g.pxE(o.button[0] + 1 + Math.floor(this.t * 4) % 2, o.button[1], 0xffffff);
            g.blend(x, y, w, h, 0xa0c0ff, 0.05, true);
            break;
        }
        case 'dance': {
            const [x, y, w, h] = o.screen;
            for (let r = 0; r < h; r++)
                g.rectE(x, y + r, w, 1, mix(0x2a0a4a, 0x0a1a4a, r / h));
            const lw = Math.floor((w - 4) / 4), sp = busy ? 12 : 5;
            // target row at the top, steps scrolling up to it
            for (let k = 0; k < 4; k++)
                this._arrow(g, x + 2 + k * lw + Math.floor((lw - 3) / 2), y + 2, k, 0x8a8aa8, true, true);
            for (let i = 0; i < 7; i++) {
                const lane = hash(i, 1, 7) % 4, ay = h - 1 - Math.floor((this.t * sp + hash(i, 2, 7) % h) % h);
                if (ay > 4 && ay < h - 3)
                    this._arrow(g, x + 2 + lane * lw + Math.floor((lw - 3) / 2), y + ay, lane, NEON[lane], true, true);
            }
            g.rectE(x + 1, y + h - 2, Math.round((w - 2) * (0.4 + 0.5 * tri(this.t * 0.2))), 1, 0x60ff90);
            const beat = Math.floor(this.t * (busy ? 4 : 1.5));
            for (const [px, py, k] of o.pads)
                if (beat % 4 === k)
                    this._arrow(g, px, py, k, NEON[k], true);
            for (let k = 0; k < 4; k++)
                this._arrow(g, o.marq[0] + k * 6, o.marq[1], k, beat % 4 === k ? 0xffffff : NEON[k], true);
            const [[ax, ay], [bx, by2], th] = o.tubes;
            for (let r = 0; r < th; r++) {
                const col = NEON[(Math.floor(r / 4) + beat) % 4];
                g.rectE(ax, ay + r, 2, 1, col);
                g.rectE(bx, by2 + r, 2, 1, col);
            }
            const [sx, sy, sw] = o.strip;
            for (let c = 0; c < sw; c += 2)
                g.pxE(sx + c, sy, NEON[((c >> 1) + beat) % 4]);
            if (busy)
                g.glow(o.x + o.w / 2, F - 6, 26, NEON[beat % 4], 0.1, 0.4);
            break;
        }
        case 'table': {
            const sitting = this.people.filter(p => p.goal?.obj === o && !p.moving);
            if (sitting.length)
                g.rect(o.x + o.w / 2 - 4, F - 22, 3, 3, 0xf0e8dc);
            break;
        }
        }
        void env;
    }

    _renderBubble(g, b) {
        const p = b.p;
        if (p.hidden)
            return;
        const x = Math.floor(p.x + 12), y = Math.floor(p.y - 50);
        g.rect(x - 1, y - 1, 13, 11, INK);
        g.rect(x, y, 11, 9, 0xf8f4ec);
        g.rect(x + 2, y + 10, 2, 2, INK);
        g.px(x + 2, y + 9, 0xf8f4ec);
        const cx = x + 5;
        if (b.icon === 'heart') {
            g.rect(cx - 3, y + 2, 2, 2, 0xe04060);
            g.rect(cx + 1, y + 2, 2, 2, 0xe04060);
            g.rect(cx - 3, y + 3, 6, 2, 0xe04060);
            g.rect(cx - 2, y + 5, 4, 1, 0xe04060);
            g.px(cx - 1, y + 6, 0xe04060);
        } else if (b.icon === 'star') {
            g.rect(cx - 1, y + 1, 2, 7, 0xf0b020);
            g.rect(cx - 3, y + 3, 6, 2, 0xf0b020);
            g.px(cx - 1, y + 2, 0xfff0a0);
        } else {
            g.rect(cx, y + 1, 1, 5, 0x3a2a4a);
            g.rect(cx - 2, y + 5, 3, 2, 0x3a2a4a);
            g.rect(cx + 1, y + 1, 2, 1, 0x3a2a4a);
        }
    }

    // pools of light from the spots, moving colored spots on disco night
    _renderLights(g, env, st, lit) {
        if (st.disco) {
            for (let i = 0; i < 6; i++) {
                const x = this.w / 2 + Math.sin(this.t * (0.3 + i * 0.07) + i * 2) * this.w * 0.45;
                const y = this.B + (this.h - this.B) * (0.3 + 0.3 * Math.sin(this.t * 0.5 + i));
                g.glow(x, y, 36, NEON[i], 0.22, 0.45);
            }
            // a mirror ball under the ceiling
            const bx = Math.round(this.w / 2 + (this.flip ? -140 : 140)), by = this.ceil + 18;
            g.rect(bx, this.ceil - 2, 1, 12, 0x8a8a96);
            g.disc(bx, by, 6, INK);
            g.disc(bx, by, 5, 0xa0a0b0);
            for (let i = 0; i < 6; i++)
                g.pxE(bx - 3 + (i * 7 + Math.floor(this.t * 6)) % 7, by - 3 + i, 0xffffff);
            return;
        }
        if (!lit)
            return;
        for (const s of this.spots)
            if (s.under)
                g.glow(s.x, this.B + 14, 30, s.c, 0.06, 0.3);
    }
}
