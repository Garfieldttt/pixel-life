// Harbor in side view: a container terminal with its gantry cranes on one
// side, the old town with the ferry pier on the other, the harbor mouth
// with the mole and the lighthouse in between and the open sea behind it.
// In front lie the fishing jetty, the marina and the promenade.
// Everything is drawn at the scale of its depth: 17 px/m on the promenade
// (a person is 31 px), 6 px/m at the marina, 2.5 px/m in the basin and
// 0.4 px/m on the horizon.
// The container ship is unloaded and loaded box by box, leaves with a tug
// and the next one comes in; the ferry calls by day, the cutters go out at
// dawn and come home with the gulls; anglers, walkers and a fish kiosk on
// the promenade, the lighthouse sweeping the night.
import {rand, randi, chance, pick, weighted, clamp, steppedLevel} from './util.js';
import {mix} from './gfx.js';
import * as A from './art.js';
import {makePerson, drawPerson, personFigure} from './people.js';
import {makeShip, drawShip} from './ships.js';
import {Timers} from './timers.js';

const K_FAR = 0.4, K_MID = 2.5, K_NEAR = 6;
const INK = A.INK;
const hash = (x, y, s = 0) => ((((x + s * 131) * 73856093) ^ ((y - s * 71) * 19349663)) >>> 0) % 1000;
const sh = (c, t = 0.3) => mix(c, 0x2a1040, t);
const hi = (c, t = 0.3) => mix(c, 0xfff4d0, t);
const WATER = [0x86bcd0, 0x4e94b2, 0x2f7298, 0x245c80];
const BOX = [0xc83a2a, 0x2a5aa8, 0x2a8a5a, 0xe0a020, 0x8a8a92, 0xe86a20, 0x3a3a44, 0xe8e8e8, 0x6a3a8a, 0x1a7a9a, 0x9a2a3a];
const PASTEL = [0xe8c058, 0xd86a4a, 0x5a9ac8, 0xe89a6a, 0x8ab868, 0xf0e0c0, 0xc85a6a, 0x6ab0a8, 0xe8d090];
const CW = 15, CH = 6; // a 20 ft box at the basin scale: 6.1 x 2.6 m
const SHIRTS = [0xd84848, 0x4c7cd0, 0xf0d050, 0x5cae5c, 0xe8e8e8, 0x3a3a4a, 0xe876a0, 0xf08a30];

export class Harbor {
    constructor(w, h, env) {
        this.name = 'harbor';
        this.w = w;
        this.h = h;
        this.timers = new Timers();
        this.layout(env);
    }

    // ---------- layout ----------

    layout(env) {
        const W = this.w, H = this.h;
        this.horizon = Math.round(H * 0.42);
        this.moleY = this.horizon + Math.max(6, Math.round(H * 0.022));
        this.Yq = Math.round(H * 0.62);
        this.Wm = this.Yq + 8;
        this.Ws = this.Wm + 12;
        this.Ws2 = this.Ws + 9;
        this.Yn = Math.round(H * 0.8);
        this.Wn = this.Yn + 2;
        this.Wl = this.Yn + 18;
        this.Yp = H - 44;
        // terminal | mouth | town, mirrored at random
        this.flip = chance(0.5);
        const tw = Math.round(W * 0.5), mw = Math.round(W * 0.17);
        const span = (a, b) => (this.flip ? [W - b, W - a] : [a, b]);
        this.term = span(0, tw);
        this.mouth = span(tw, tw + mw);
        this.town = span(tw + mw, W);
        // inbound ships run from the town edge towards the terminal edge
        this.dirIn = this.flip ? 1 : -1;
        this.realT = 0;
        this.layerA = this.layerB = this.layerN = this.layerC = null;
        this._layoutTown();
        this._layoutTerminal();
        this._layoutNear();
        this._layoutFront(env);
        // the container ship at its berth, busy from the start
        this.berth = {ship: null, state: 'empty', t: rand(30, 120)};
        if (chance(0.85)) {
            const s = this._boxShip();
            s.x = this.berthX;
            s.y = this.Wm;
            this.berth.ship = s;
            this.berth.state = 'moored';
            this.berth.t = 0;
            s.unload = randi(0, 12);
            s.load = randi(6, 14);
        }
        this.cranes.forEach(c => (c.raise = this.berth.ship ? 0 : 1));
        this.ferry = {s: makeShip('ferry', K_MID), state: 'away', t: rand(20, 200), y: this.Ws};
        this.ferry.s.dir = this.dirIn;
        this.tugs = [];
        this.boats = [];
        this.nearBoats = [];
        this.far = [];
        this.trucks = [];
        this.puffs = [];
        this.fx = [];
        this.gulls = [];
        for (let i = 0; i < randi(4, 8); i++)
            this._gull(rand(0, W), rand(this.horizon - 40, this.Yn), chance(0.5) ? 'mid' : 'near');
        this.farT = rand(5, 60);
        this.eventTimer = rand(40, 120);
        if (chance(0.7))
            this._farShip(rand(this.mouth[0] - 40, this.mouth[1]));
    }

    _layoutTown() {
        const [a, b] = this.town, Yq = this.Yq;
        // a row of narrow gabled houses on the quay, a second row up the hill
        this.houses = [];
        this.hillHouses = [];
        for (let x = a + 6; x < b - 14;) {
            const w = randi(14, 22), floors = randi(3, 4);
            this.houses.push({x, w, h: Math.round(floors * 7.5), floors, c: pick(PASTEL), roof: pick([0x8a3a2a, 0x6a3a30, 0x3a3a48, 0x9a4a2a]), step: chance(0.35), seed: randi(0, 1e6)});
            x += w + (chance(0.2) ? randi(2, 6) : 0);
        }
        // terraces up the hill, the higher rows further away and hazier
        for (let band = 0; band < 4; band++)
            for (let x = a + randi(0, 14); x < b - 10;) {
                const w = randi(11, 17);
                if (chance(0.82))
                    this.hillHouses.push({x, w, band, h: randi(11, 17), c: mix(pick(PASTEL), 0xa8b8c8, 0.1 + (3 - band) * 0.08), roof: mix(pick([0x8a3a2a, 0x6a3a30, 0x3a3a48, 0x9a4a2a]), 0x8a98a8, 0.1 + (3 - band) * 0.06), seed: randi(0, 1e6)});
                x += w + randi(1, 9);
            }
        this.church = {x: Math.round(a + (b - a) * rand(0.3, 0.7))};
        this.ferryBerth = Math.round((a + b) / 2);
        this.townFolk = [];
        this.cafe = [];
        for (let x = a + rand(20, 40); x < b - 20; x += rand(60, 120))
            this.cafe.push({x: Math.round(x), c: pick([0xd84848, 0xf0f0f0, 0x2a6ab0, 0xe8a020])});
        this.townLamps = [];
        for (let x = a + 12; x < b - 6; x += 34)
            this.townLamps.push(Math.round(x));
    }

    _layoutTerminal() {
        const [a, b] = this.term, W = b - a;
        // stacks of boxes in three rows, a shed, the office, light masts
        this.stacks = [];
        this.rows = Math.max(3, Math.floor((this.Yq - 8 - this.horizon - 14) / 11));
        for (let row = 0; row < this.rows; row++) {
            for (let x = a + randi(2, 12); x < b - CW;) {
                const run = randi(3, 8);
                for (let k = 0; k < run && x < b - CW; k++, x += CW)
                    this.stacks.push({x, row, n: randi(1, 4), seed: randi(0, 1e6)});
                x += randi(10, 30);
            }
        }
        this.office = {x: this.flip ? b - 64 : a + 14, w: 50};
        this.shed = {x: this.flip ? a + 30 : b - 130, w: 100};
        this.masts = [];
        for (let x = a + 40; x < b - 20; x += randi(90, 140))
            this.masts.push(Math.round(x));
        this.rtgs = [];
        for (let x = a + randi(40, 80); x < b - 60; x += randi(150, 220))
            this.rtgs.push(Math.round(x));
        this.turbines = [];
        for (let x = a + randi(20, 60); x < b - 20; x += randi(70, 120))
            this.turbines.push({x: Math.round(x), a: rand(6.28), s: rand(0.7, 1.2), h: randi(26, 34)});
        // the berth: the ship lies along the quay with its bow outwards
        this.maxShip = Math.min(200 * K_MID, W - 40);
        const L = Math.round(this.maxShip);
        this.berthX = this.flip ? b - 20 - L : a + 20;
        // gantry cranes on the quay, each working its part of the ship
        const n = clamp(Math.floor(W / 160), 2, 3);
        this.cranes = [];
        for (let i = 0; i < n; i++)
            this.cranes.push({x: Math.round(this.berthX + L * (i + 0.6) / (n + 0.4)), tx: null, y: this.Yq - 92, raise: 1, steps: [], load: null, t: 0, c: pick([0xd8402c, 0xd8402c, 0x2a6ab8, 0xe8b020]), side: 'sea', idx: i, n});
        const cc = this.cranes[0].c;
        this.cranes.forEach(c => (c.c = cc));
    }

    _layoutNear() {
        const W = this.w;
        // the fishing jetty at the terminal edge, the marina pontoon beyond
        const jw = Math.round(W * 0.3), gap = Math.round(W * 0.05);
        this.jetty = this.flip ? [W - jw, W] : [0, jw];
        this.marina = this.flip ? [Math.round(W * 0.08), W - jw - gap] : [jw + gap, W - Math.round(W * 0.08)];
        this.cutters = [];
        const [j0, j1] = this.jetty;
        for (let x = j0 + 14; x < j1 - 100;) {
            const s = makeShip('fishing', K_NEAR);
            s.dir = this.flip ? 1 : -1;
            if (x + s.L > j1 - 6)
                break;
            this.cutters.push({s, home: x, x, state: 'moored', y: this.Wn});
            x += s.L + randi(16, 30);
        }
        this.slips = [];
        const [m0, m1] = this.marina;
        for (let x = m0 + 6; x < m1 - 30;) {
            const s = makeShip(weighted([['yacht', 3], ['motor', 1.5], ['dinghy', 0.4]]), K_NEAR);
            s.dir = chance(0.5) ? 1 : -1;
            if (x + s.L > m1 - 4)
                break;
            this.slips.push({s, x});
            x += s.L + randi(6, 14);
        }
        this.pontoonFolk = [];
        this.pontoonLamps = [];
        for (let x = m0 + 20; x < m1 - 10; x += 70)
            this.pontoonLamps.push(Math.round(x));
    }

    _layoutFront(env) {
        const W = this.w, Yp = this.Yp;
        this.kiosk = {x: Math.round(rand(0.2, 0.7) * W), w: 72};
        const used = [[this.kiosk.x - 10, this.kiosk.x + this.kiosk.w + 10]];
        const free = (x, w) => !used.some(([a, b]) => x + w > a && x < b);
        const place = (x, w) => (used.push([x - 4, x + w + 4]), x);
        this.lamps = [];
        for (let x = rand(40, 90); x < W - 20; x += rand(190, 240))
            if (free(x - 6, 12))
                this.lamps.push(place(Math.round(x), 0));
        this.benches = [];
        for (let x = rand(80, 160); x < W - 70; x += rand(220, 340))
            if (free(x, 52))
                this.benches.push(place(Math.round(x), 52));
        this.ring = null;
        for (let k = 0; k < 20 && !this.ring; k++) {
            const x = Math.round(rand(20, W - 40));
            if (free(x, 22))
                this.ring = place(x, 22);
        }
        this.crates = null;
        for (let k = 0; k < 20 && !this.crates; k++) {
            const x = Math.round(rand(20, W - 60));
            if (free(x, 40))
                this.crates = place(x, 40);
        }
        // bollards along the edge where nothing stands in front
        this.bollards = [];
        for (let x = rand(20, 60); x < W - 14; x += rand(110, 150))
            if (x + 12 < this.kiosk.x - 4 || x > this.kiosk.x + this.kiosk.w + 4)
                this.bollards.push(Math.round(x));
        this.perched = this.bollards.filter(() => chance(0.3)).map(bx => ({bx, t: rand(5), state: 'sit', x: bx + 1, y: Yp - 11, vx: 0, vy: 0}));
        this.people = [];
        const nAng = Math.round((env.dark < 0.6 ? randi(1, 2) : randi(0, 1)) * Math.min(1.5, env.people));
        for (let i = 0; i < nAng; i++)
            this._angler(env);
        const nWalk = Math.round(randi(2, 4) * env.people);
        for (let i = 0; i < nWalk; i++)
            this._walker(env, rand(0, W));
        this.tufts = null;
    }

    _angler(env) {
        const W = this.w;
        for (let k = 0; k < 30; k++) {
            const x = Math.round(rand(20, W - 40));
            const clear = !this.benches.some(b => x + 20 > b - 6 && x < b + 58) && !(x + 20 > this.kiosk.x - 6 && x < this.kiosk.x + this.kiosk.w + 6) &&
                !this.people.some(q => q.angler && Math.abs(q.x - x) < 70) && !this.lamps.some(l => Math.abs(l - x - 9) < 14);
            if (!clear)
                continue;
            const p = makePerson(env, {kid: chance(0.12), jogger: false});
            p.balloon = p.dog = p.bag = null;
            p.coffee = false;
            p.x = x;
            p.y = this.Yp + 14;
            p.dir = 1;
            p.state = 'fish';
            p.angler = true;
            p.bob = 0;
            p.catchT = rand(30, 160);
            this.people.push(p);
            return;
        }
    }

    _walker(env, x) {
        const p = makePerson(env);
        p.dir = chance(0.5) ? 1 : -1;
        p.x = x ?? (p.dir > 0 ? -24 : this.w + 24);
        p.y = this.h - randi(4, 14);
        p.state = 'walk';
        p.look = rand(10, 60);
        this.people.push(p);
    }

    _boxShip() {
        const m = Math.min(rand(150, 200), this.maxShip / K_MID);
        const s = makeShip('container', K_MID, m);
        s.dir = this.dirIn;
        s.x = this.berthX + (this.dirIn > 0 ? Math.round(this.maxShip) - s.L : 0);
        return s;
    }

    // ---------- static layers ----------

    staticKey(env) {
        this.darkLevel = steppedLevel(env.dark, this.darkLevel, 4);
        this.wetLevel = steppedLevel(env.weather.wet, this.wetLevel, 1);
        return [this.darkLevel, env.lampsOn ? 1 : 0, Math.round(env.weather.snowCover * 4), this.wetLevel, env.season].join(':');
    }

    _snow(env) {
        return env.weather.snowCover > 0.3 ? env.weather.snowCover : 0;
    }

    renderStatic(g, env) {
        if (!this.layerA) {
            this.layerA = g.layer();
            this.layerB = g.layer();
            this.layerN = g.layer();
            this.layerC = g.layer();
            this.scratch = g.layer();
        }
        for (const l of [this.layerA, this.layerB, this.layerN, this.layerC])
            l.fill(0);
        g.into(this.layerA, () => {
            this._drawWater(g, env);
            this._drawFarCoast(g, env);
            this._drawMole(g, env);
            this._drawJetty(g, env);
        });
        g.into(this.layerB, () => {
            this._drawTerminal(g, env);
            this._drawTown(g, env);
            this._drawQuays(g, env);
        });
        g.into(this.layerN, () => this._drawPontoon(g, env));
        g.into(this.layerC, () => this._drawFront(g, env));
    }

    _drawWater(g, env) {
        const W = this.w, Y0 = this.horizon, Y1 = this.Yp + 6;
        for (let y = Y0; y < Y1; y++) {
            const u = (y - Y0) / (Y1 - Y0);
            const c = u < 0.35 ? mix(WATER[0], WATER[1], u / 0.35) : u < 0.7 ? mix(WATER[1], WATER[2], (u - 0.35) / 0.35) : mix(WATER[2], WATER[3], (u - 0.7) / 0.3);
            g.rect(0, y, W, 1, c);
            // ripples: short and close far away, longer and sparser near
            const len = 1 + Math.round(u * 7), step = 6 + Math.round(u * 26);
            for (let x = hash(y, 1, 4) % step; x < W; x += step + hash(x, y, 4) % step) {
                const v = hash(x, y, 5);
                if (v < 350)
                    g.rect(x, y, len, 1, v < 120 ? hi(c, 0.18) : sh(c, 0.12));
            }
        }
        g.rect(0, Y0, W, 1, hi(WATER[0], 0.25));
    }

    // hills on the far shore beyond the terminal and the town
    _drawFarCoast(g, env) {
        const W = this.w, Y = this.horizon, [m0, m1] = this.mouth;
        const haze = mix(env.skyBottom ?? 0xa8c8e8, 0x7a8aa0, 0.35);
        const snow = this._snow(env);
        for (let x = 0; x < W; x++) {
            const d = x < m0 ? m0 - x : x > m1 ? x - m1 : 0;
            if (!d)
                continue;
            const hgt = Math.round(Math.min(1, d / 40) * (14 + 8 * Math.sin(x * 0.011 + 2) + 4 * Math.sin(x * 0.037)));
            g.rect(x, Y - hgt, 1, hgt + 1, haze);
            if (snow && hgt > 16)
                g.px(x, Y - hgt, 0xe8ecf4);
            if (hgt > 3 && hash(x, 3, 2) < 260)
                g.rect(x, Y - hgt + 2, 1, 2, sh(haze, 0.12));
        }
    }

    // the mole runs out from the terminal into the mouth, the lighthouse at
    // its head; a green beacon on the town side marks the other side
    _drawMole(g, env) {
        const [m0, m1] = this.mouth, y = this.moleY, mw = m1 - m0;
        const x0 = this.flip ? m0 + Math.round(mw * 0.35) : m0, x1 = this.flip ? m1 : m1 - Math.round(mw * 0.35);
        g.rect(x0, y - 3, x1 - x0, 4, 0x8a8a8a);
        g.rect(x0, y - 3, x1 - x0, 1, 0xb0b0b0);
        for (let x = x0; x < x1; x += 3)
            g.px(x + (hash(x, 1, 6) % 2), y - 1, 0x6a6a72);
        g.rect(x0, y + 1, x1 - x0, 1, 0x5a6a7a);
        // the lighthouse: 20 m at about 1.5 px/m, red and white rings
        const lx = this.flip ? x0 + 4 : x1 - 8, top = y - 34;
        this.lighthouse = [lx + 2, top + 2];
        g.rect(lx - 2, y - 5, 9, 3, 0x9a9a9a);
        for (let r = 0; r < 28; r++) {
            const yy = y - 5 - r, inset = Math.round(r * 0.06);
            const c = Math.floor(r / 6) % 2 ? 0xf0f0f0 : 0xd83a2a;
            g.rect(lx - 1 + inset, yy, 7 - inset * 2, 1, c);
            g.px(lx + 5 - inset, yy, sh(c, 0.25));
        }
        g.rect(lx - 2, top + 4, 9, 1, INK);
        g.rect(lx, top + 1, 5, 3, 0x3a4a5a);
        g.rect(lx - 1, top, 7, 1, 0xd83a2a);
        g.px(lx + 2, top - 1, 0xd83a2a);
        // green beacon on the far side of the mouth
        const bx = this.flip ? m0 + 6 : m1 - 8;
        g.rect(bx - 3, y + 2, 8, 2, 0x8a8a8a);
        g.rect(bx, y - 10, 3, 12, 0x2a9a4a);
        g.rect(bx, y - 6, 3, 2, 0xf0f0f0);
        this.beaconG = [bx + 1, y - 11];
    }

    _drawTerminal(g, env) {
        const [a, b] = this.term, Yq = this.Yq, Y0 = this.horizon, snow = this._snow(env);
        // the paved yard between the far shore and the quay, darker and
        // hazier towards the back, with painted lanes between the rows
        const haze = env.skyBottom ?? 0xa8c8e8;
        for (let y = Y0 + 1; y < Yq; y++) {
            const u = (y - Y0) / (Yq - Y0);
            g.rect(a, y, b - a, 1, mix(mix(mix(0x8a8a88, 0x9e9c98, u), 0xe4e8f0, snow * 0.85), haze, (1 - u) * 0.35));
        }
        for (let row = 0; row < this.rows; row++) {
            const ly = Yq - 8 - row * 11 + 1;
            for (let x = a; x < b; x += 12)
                g.rect(x, ly, 6, 1, mix(row % 3 ? 0xd8d8d0 : 0xe8c040, haze, row * 0.06));
        }
        for (let i = 0; i < (b - a) * 2; i++)
            g.px(a + hash(i, 2, 3) % (b - a), Y0 + 2 + hash(i, 4, 3) % (Yq - Y0 - 4), 0x7e7e7c);
        // the shed and the office behind the stacks
        const sd = this.shed, sy = Y0 + 16;
        g.rect(sd.x - 1, sy - 22, sd.w + 2, 23, INK);
        g.rect(sd.x, sy - 21, sd.w, 21, 0x8aa0b0);
        for (let x = sd.x + 2; x < sd.x + sd.w; x += 3)
            g.rect(x, sy - 21, 1, 21, 0x7a90a0);
        g.rect(sd.x - 2, sy - 24, sd.w + 4, 3, snow ? 0xe8ecf4 : 0x5a6a7a);
        for (let k = 0; k < 3; k++)
            g.rect(sd.x + 10 + k * 30, sy - 14, 16, 14, 0x4a5a68);
        const of = this.office, oy = Y0 + 22, oh = 34;
        g.rect(of.x - 1, oy - oh - 1, of.w + 2, oh + 1, INK);
        g.rect(of.x, oy - oh, of.w, oh, 0xe8e4dc);
        this.officeWins = [];
        for (let f = 0; f < 4; f++)
            for (let x = of.x + 3; x < of.x + of.w - 3; x += 5) {
                g.rect(x, oy - oh + 4 + f * 8, 3, 4, 0x4a6a8a);
                this.officeWins.push([x, oy - oh + 4 + f * 8]);
            }
        g.rect(of.x, oy - oh, of.w, 2, snow ? 0xf0f4fa : 0xb8b4ac);
        this.officeSign = [of.x + Math.round(of.w / 2) - 7, oy - oh - 7];
        g.rect(this.officeSign[0] - 2, this.officeSign[1] - 1, 19, 7, 0x2a4a7a);
        g.text('PORT', this.officeSign[0], this.officeSign[1], 0xf0f0f0);
        // stacks: back rows first, a little higher up and hazier
        for (const st of [...this.stacks].sort((p, q) => q.row - p.row)) {
            const base = Yq - 8 - st.row * 11;
            if (base - st.n * CH < Y0 - 2 || (st.row > 2 && st.x + CW > this.shed.x - 4 && st.x < this.shed.x + this.shed.w + 4) || (st.row > 1 && st.x + CW > this.office.x - 4 && st.x < this.office.x + this.office.w + 4))
                continue;
            for (let k = 0; k < st.n; k++) {
                const c = mix(BOX[hash(st.seed, k, 1) % BOX.length], haze, Math.min(0.5, st.row * 0.07));
                this._box(g, st.x, base - (k + 1) * CH, c);
            }
            if (snow)
                g.rect(st.x, base - st.n * CH, CW - 1, 1, 0xf0f4fa);
        }
        // rubber-tyred gantries over the stacks
        for (const rx of this.rtgs) {
            const base = Yq - 17, top = base - 32;
            for (const lx of [rx, rx + 40]) {
                g.rect(lx - 1, top, 4, base - top, INK);
                g.rect(lx, top, 2, base - top, 0xf0c030);
                g.rect(lx - 1, base - 2, 4, 2, 0x2a2a2a);
            }
            g.rect(rx - 2, top - 3, 46, 4, INK);
            g.rect(rx - 1, top - 2, 44, 2, 0xf0c030);
            g.rect(rx + 16, top + 1, 6, 4, 0xe8e4dc);
        }
        // floodlight masts
        for (const mx of this.masts) {
            const top = Yq - 82;
            g.rect(mx - 1, top, 3, Yq - 6 - top, INK);
            g.rect(mx, top, 1, Yq - 6 - top, 0xb8bcc4);
            g.rect(mx - 4, top - 2, 9, 3, INK);
            g.rect(mx - 3, top - 1, 7, 1, 0xe8e8e0);
        }
    }

    _box(g, x, y, c) {
        g.rect(x, y, CW - 1, CH - 1, c);
        g.rect(x, y, CW - 1, 1, hi(c, 0.3));
        for (let i = x + 2; i < x + CW - 2; i += 2)
            g.rect(i, y + 1, 1, CH - 3, sh(c, 0.18));
        g.rect(x, y + CH - 1, CW - 1, 1, sh(c, 0.55));
        g.rect(x + CW - 2, y + 1, 1, CH - 2, sh(c, 0.35));
    }

    _drawTown(g, env) {
        const [a, b] = this.town, Yq = this.Yq, Y0 = this.horizon, snow = this._snow(env);
        const base = Yq - 4;
        // the hill behind, green with trees, rising from the quay
        const top = x => Math.round(Y0 - 18 - 14 * Math.sin((x - a) / (b - a) * Math.PI) - 4 * Math.sin(x * 0.05));
        const fade = x => Math.min(1, Math.min(x - a, b - x) / 30);
        const hill = env.season === 'winter' && snow ? 0xc8d0d8 : {spring: 0x6a9a58, summer: 0x5a8a4a, autumn: 0x8a8a4a, winter: 0x6a7a5a}[env.season];
        for (let x = a; x < b; x++) {
            const t = Math.round(top(x) + (1 - fade(x)) * 30);
            g.rect(x, t, 1, base - t, hill);
            if (hash(x, 1, 7) < 300)
                g.rect(x, t, 1, 2, hi(hill, 0.2));
        }
        // trees dotted over the hill
        const tc = A.leafRamp(env.season);
        for (let x = a + 6; x < b - 6; x += 7 + hash(x, 2, 7) % 9) {
            const t = Math.round(top(x) + (1 - fade(x)) * 30) + 4 + hash(x, 3, 7) % 10;
            const r = 2 + hash(x, 4, 7) % 2;
            g.disc(x, t, r + 1, INK);
            g.disc(x, t, r, tc[2]);
            g.px(x - 1, t - 1, tc[3]);
        }
        // the church high up on the hill
        const cx = this.church.x, ct = top(cx) + 6;
        g.rect(cx - 9, ct - 14, 22, 15, INK);
        g.rect(cx - 8, ct - 13, 20, 14, 0xf0e8d8);
        g.rect(cx - 1, ct - 34, 8, 21, INK);
        g.rect(cx, ct - 33, 6, 20, 0xf0e8d8);
        for (let r = 0; r < 12; r++)
            g.rect(cx + 3 - Math.floor((12 - r) / 4), ct - 46 + r, 1 + Math.floor((12 - r) / 4) * 2, 1, snow ? 0xe8ecf4 : 0x4a7a6a);
        g.px(cx + 3, ct - 48, 0xd8b040);
        g.rect(cx + 2, ct - 28, 2, 3, 0x3a3a4a);
        this.churchClock = [cx + 3, ct - 22];
        g.disc(cx + 3, ct - 22, 2, 0xf8f4ea);
        g.rect(cx - 6, ct - 9, 2, 4, 0x6a8aa8);
        g.rect(cx + 6, ct - 9, 2, 4, 0x6a8aa8);
        // the upper row of houses on the slope
        this.townWins = [];
        const quayTop = base - 34;
        for (const hh of [...this.hillHouses].sort((p, q) => p.band - q.band)) {
            const t0 = Math.round(top(hh.x + hh.w / 2) + (1 - fade(hh.x + hh.w / 2)) * 30);
            const by = Math.round(t0 + 16 + (quayTop - t0 - 10) * hh.band / 3.4) + hash(hh.seed, 1, 1) % 4;
            if (by - hh.h < t0 + 2 || by > quayTop + 8)
                continue;
            g.rect(hh.x - 1, by - hh.h - 1, hh.w + 2, hh.h + 1, INK);
            g.rect(hh.x, by - hh.h, hh.w, hh.h, hh.c);
            for (let r = 0; r < 6; r++)
                g.rect(hh.x - 1 + r, by - hh.h - 1 - r, hh.w + 2 - r * 2, 1, snow ? 0xe8ecf4 : hh.roof);
            for (let y = by - hh.h + 3; y < by - 3; y += 6)
                for (let x = hh.x + 3; x < hh.x + hh.w - 2; x += 4) {
                    g.rect(x, y, 2, 3, 0x4a5a6a);
                    this.townWins.push([x, y, hash(x, y, 2)]);
                }
        }
        // the quay row: tall narrow houses, gables to the water
        for (const hs of this.houses) {
            const t = base - hs.h;
            g.rect(hs.x - 1, t - 1, hs.w + 2, hs.h + 1, INK);
            g.rect(hs.x, t, hs.w, hs.h, hs.c);
            g.rect(hs.x + hs.w - 2, t, 2, hs.h, sh(hs.c, 0.15));
            g.rect(hs.x, base - 2, hs.w, 2, sh(hs.c, 0.3));
            // gable: stepped or plain
            const gh = Math.round(hs.w / 2);
            for (let r = 0; r < gh; r++) {
                const inset = hs.step ? Math.floor(r / 3) * 3 : r;
                if (inset * 2 >= hs.w)
                    break;
                g.rect(hs.x + inset - 1, t - 1 - r, hs.w - inset * 2 + 2, 1, INK);
                g.rect(hs.x + inset, t - 1 - r, hs.w - inset * 2, 1, hs.step ? hs.c : snow ? 0xeef2f8 : hs.roof);
            }
            g.rect(hs.x + Math.round(hs.w / 2) - 1, t - gh + 2, 2, 2, 0x3a4a5a);
            for (let f = 0; f < hs.floors; f++) {
                const y = t + 2 + f * 7.5;
                for (let x = hs.x + 2; x < hs.x + hs.w - 3; x += 4) {
                    if (f === hs.floors - 1 && Math.abs(x - hs.x - hs.w / 2) < 3)
                        continue;
                    g.rect(x, Math.round(y), 2, 4, 0x3a4a5e);
                    g.px(x, Math.round(y), 0xf0f0f0);
                    this.townWins.push([x, Math.round(y), hash(x, Math.round(y), 3)]);
                }
            }
            const dx = hs.x + Math.round(hs.w / 2) - 1;
            g.rect(dx, base - 6, 3, 6, sh(hs.c, 0.5));
        }
    }

    _drawQuays(g, env) {
        const W = this.w, Yq = this.Yq, snow = this._snow(env), wet = this.wetLevel;
        const pave = snow ? 0xe8ecf2 : wet ? 0x8a8a90 : 0xb4b0a8;
        for (const [a, b, stone] of [[...this.term, false], [...this.town, true]]) {
            // the quay top and the wall down to the water, fenders on it
            g.rect(a, Yq - 4, b - a, 5, pave);
            if (stone)
                for (let x = a; x < b; x += 4)
                    g.px(x + (Math.floor(x / 4) % 2) * 2, Yq - 2, sh(pave, 0.12));
            g.rect(a, Yq, b - a, 1, hi(pave, 0.3));
            const wall = stone ? 0x6a6458 : 0x5a5a62;
            g.rect(a, Yq + 1, b - a, this.Wm - Yq - 3, wall);
            for (let x = a; x < b; x += stone ? 6 : 10)
                g.rect(x, Yq + 1 + (stone ? (Math.floor(x / 6) % 2) * 2 : 0), 1, stone ? 2 : this.Wm - Yq - 3, sh(wall, 0.3));
            g.rect(a, this.Wm - 3, b - a, 1, 0x3a4a3a);
            for (let x = a + 8; x < b; x += 26) {
                g.rect(x, Yq + 1, 3, this.Wm - Yq - 3, 0x1a1a1e);
                g.rect(x, Yq - 6, 3, 2, 0x2a2a30);
            }
        }
        // the mouth: rocks where the land meets the water
        for (const x0 of [this.mouth[0], this.mouth[1] - 6])
            for (let k = 0; k < 6; k++)
                g.disc(x0 + k + (hash(k, x0, 1) % 3), Yq + 2 - k % 3, 2, k % 2 ? 0x7a7a7a : 0x8a8a8a);
        void W;
    }

    // a wooden jetty behind the cutters, piles into the water
    _drawJetty(g, env) {
        const [a, b] = this.jetty, y = this.Wn - 9, snow = this._snow(env);
        g.rect(a, y, b - a, 3, snow ? 0xe8ecf2 : 0x9a7a52);
        g.rect(a, y, b - a, 1, snow ? 0xf8faff : 0xb8966a);
        for (let x = a; x < b; x += 5)
            g.px(x, y + 1, 0x7a5a3a);
        g.rect(a, y + 3, b - a, 1, 0x4a3a2a);
        for (let x = a + 4; x < b; x += 18) {
            g.rect(x, y - 3, 3, 10, 0x5a4030);
            g.rect(x, y - 3, 3, 1, 0x7a5a40);
        }
        // nets and fish boxes on the jetty
        for (let x = a + 30; x < b - 20; x += 90) {
            g.rect(x, y - 3, 10, 3, 0x3a7ab0);
            g.rect(x + 12, y - 4, 8, 4, 0x3a6a4a);
        }
    }

    // the floating pontoon of the marina, seen almost edge on (2 m wide)
    _drawPontoon(g, env) {
        const [a, b] = this.marina, y = this.Yn, snow = this._snow(env);
        g.rect(a, y, b - a, 4, snow ? 0xe8ecf2 : 0xa88a62);
        g.rect(a, y, b - a, 1, snow ? 0xf8faff : 0xc8a87a);
        for (let x = a + 2; x < b; x += 4)
            g.rect(x, y + 1, 1, 3, 0x8a6a48);
        g.rect(a, y + 4, b - a, 3, 0x4a4a52);
        g.rect(a, y + 4, b - a, 1, 0x6a6a72);
        for (let x = a + 10; x < b; x += 40) {
            g.rect(x, y - 1, 4, 1, 0x3a3a40);
            g.rect(x + 1, y - 2, 2, 1, 0x3a3a40);
        }
        // a gangway up to the promenade at the end
        const gx = this.flip ? b - 8 : a;
        g.rect(gx, y - 1, 8, 1, 0x8a8a96);
        for (const lx of this.pontoonLamps) {
            g.rect(lx, y - 7, 2, 7, 0x3a3a44);
            g.rect(lx - 1, y - 9, 4, 2, 0xe8e8e0);
        }
    }

    _drawFront(g, env) {
        const W = this.w, H = this.h, Yp = this.Yp, snow = this._snow(env), wet = this.wetLevel;
        // granite coping along the edge, then the promenade paving
        const cope = snow ? 0xe8ecf2 : 0xa8a8a8;
        g.rect(0, Yp, W, 6, cope);
        g.rect(0, Yp, W, 1, hi(cope, 0.4));
        g.rect(0, Yp + 5, W, 1, sh(cope, 0.3));
        for (let x = 0; x < W; x += 34 + hash(x, 1, 2) % 10)
            g.rect(x, Yp + 1, 1, 4, sh(cope, 0.25));
        const R = A.ramp(snow ? 0xd8dce4 : wet ? 0x8a7a6a : 0xb8a07a);
        A.flagstones(g, 0, Yp + 6, W, H - Yp - 6, R, 11, {mossRate: snow ? 0 : 60});
        if (snow)
            for (let i = 0; i < W; i += 3)
                g.px(i, Yp + 6 + hash(i, 2, 9) % (H - Yp - 6), 0xf4f8ff);
        // iron bollards on the coping (0.8 m)
        for (const bx of this.bollards) {
            // base plate, a waisted post and a wide cap
            g.rect(bx - 2, Yp + 2, 13, 4, INK);
            g.rect(bx - 1, Yp + 3, 11, 2, 0x3a3a46);
            g.rect(bx + 1, Yp - 5, 7, 8, INK);
            g.rect(bx + 2, Yp - 4, 5, 7, 0x2e2e3a);
            g.rect(bx + 2, Yp - 4, 1, 7, 0x5a5a6a);
            g.rect(bx - 1, Yp - 10, 11, 6, INK);
            g.rect(bx, Yp - 9, 9, 4, 0x2e2e3a);
            g.rect(bx, Yp - 9, 9, 1, 0x5a5a6a);
            g.rect(bx + 1, Yp - 8, 2, 2, 0x4a4a58);
            if (snow)
                g.rect(bx, Yp - 10, 9, 1, 0xf4f8ff);
        }
        // a life ring on its post
        if (this.ring !== null) {
            const rx = this.ring;
            g.rect(rx + 9, Yp - 22, 3, 36, INK);
            g.rect(rx + 10, Yp - 21, 1, 34, 0x8a8a96);
            g.disc(rx + 10, Yp - 8, 9, INK);
            for (let a = 0; a < 32; a++) {
                const t = a / 32 * Math.PI * 2, c = Math.floor(a / 4) % 2 ? 0xf0f0f0 : 0xf06020;
                for (const r of [6, 7])
                    g.px(Math.round(rx + 10 + Math.cos(t) * r), Math.round(Yp - 8 + Math.sin(t) * r), c);
            }
            g.disc(rx + 10, Yp - 8, 4, INK);
            g.disc(rx + 10, Yp - 8, 3, 0);
        }
        // fish crates and a coil of rope
        if (this.crates !== null) {
            const cx = this.crates, cy = Yp + 22;
            for (const [dx, dy, c] of [[0, 0, 0x3a7ab0], [16, 0, 0x3a7ab0], [8, -9, 0xe85a2a]]) {
                g.rect(cx + dx - 1, cy + dy - 10, 17, 11, INK);
                g.rect(cx + dx, cy + dy - 9, 15, 9, c);
                g.rect(cx + dx, cy + dy - 9, 15, 1, hi(c, 0.35));
                g.rect(cx + dx + 2, cy + dy - 6, 11, 1, sh(c, 0.3));
            }
            g.disc(cx + 34, cy - 4, 6, INK);
            g.disc(cx + 34, cy - 4, 5, 0xc8a870);
            g.disc(cx + 34, cy - 4, 3, 0xa88850);
            g.disc(cx + 34, cy - 4, 1, 0x6a5030);
        }
        // benches facing the water: we see their backs
        for (const bx of this.benches) {
            const by = Yp + 20;
            g.rect(bx - 1, by - 18, 54, 11, INK);
            for (let r = 0; r < 3; r++)
                g.rect(bx, by - 17 + r * 3, 52, 2, r === 0 ? 0xb07840 : 0x9a6a3a);
            g.rect(bx + 4, by - 7, 3, 8, 0x3a3a44);
            g.rect(bx + 45, by - 7, 3, 8, 0x3a3a44);
            g.rect(bx - 1, by - 9, 54, 2, 0x7a5430);
        }
        // lamp posts (4 m)
        this.lampHeads = [];
        for (const lx of this.lamps) {
            const by = Yp + 12, top = by - 68;
            g.rect(lx - 2, by - 4, 6, 4, INK);
            g.rect(lx - 1, by - 3, 4, 3, 0x2a3a4a);
            g.rect(lx, top + 8, 2, by - top - 11, 0x2a3a4a);
            g.rect(lx - 1, top + 8, 1, by - top - 11, INK);
            g.rect(lx + 2, top + 8, 1, by - top - 11, INK);
            g.rect(lx - 4, top + 1, 10, 8, INK);
            g.rect(lx - 3, top + 2, 8, 6, 0xf0e8c8);
            g.rect(lx - 5, top, 12, 2, 0x2a3a4a);
            g.rect(lx - 1, top - 2, 4, 2, 0x2a3a4a);
            this.lampHeads.push([lx + 1, top + 5]);
        }
        // the fish kiosk: a wooden hut with an awning and a hatch
        const k = this.kiosk, kb = Yp + 18, kt = kb - 56;
        g.rect(k.x - 1, kt - 1, k.w + 2, 57, INK);
        A.wallPlanks(g, k.x, kt + 8, k.w, 48, A.ramp(0x4a7a9a), 3);
        g.rect(k.x + 8, kt + 18, k.w - 16, 18, 0x2a2a30);
        this.hatch = [k.x + 8, kt + 18, k.w - 16, 18];
        g.rect(k.x + 6, kt + 36, k.w - 12, 3, 0xd8c8a8);
        g.rect(k.x - 4, kt - 4, k.w + 8, 12, INK);
        for (let i = 0; i < k.w + 6; i++)
            g.rect(k.x - 3 + i, kt - 3, 1, 10, Math.floor(i / 8) % 2 ? 0xf0f0f0 : 0x2a6ab0);
        for (let i = 0; i < k.w + 6; i += 8)
            g.rect(k.x - 3 + i, kt + 7, 4, 2, Math.floor(i / 8) % 2 ? 0xf0f0f0 : 0x2a6ab0);
        g.rect(k.x + k.w / 2 - 16, kt - 14, 32, 10, INK);
        g.rect(k.x + k.w / 2 - 15, kt - 13, 30, 8, 0xf8f0d8);
        g.text('FISH', k.x + k.w / 2 - 8, kt - 12, 0x2a4a7a);
        if (snow) {
            g.rect(k.x - 3, kt - 4, k.w + 6, 1, 0xf4f8ff);
            for (const bx of this.benches)
                g.rect(bx, Yp + 2, 52, 1, 0xf4f8ff);
        }
    }

    // ---------- ships ----------

    _sprite(g, s) {
        const key = `${s.dir}:${s.sails ? 1 : 0}`;
        let sp = s.sprites[key];
        if (!sp) {
            const OX = 60, OY = Math.min(this.h - 12, 200), L = s.L;
            g.unlit(() => {
                sp = g.masked(null, this.scratch, [OX - 50, OY - 190, L + 100, 200], () => {
                    s.lights = drawShip(g, s, OX, OY, s.dir);
                });
            });
            sp.ox = sp.box[0] - OX;
            sp.oy = sp.box[1] - OY;
            s.sprites[key] = sp;
            if (s.kind === 'container' && !s.cargo)
                this._fillCargo(s);
        }
        return sp;
    }

    _fillCargo(s) {
        const [b0, b1] = s.lights.bays;
        const n = Math.floor((b1 - b0) / CW);
        s.cargo = [];
        for (let i = 0; i < n; i++) {
            const h = s.loaded === false ? randi(0, 2) : randi(3, 6);
            s.cargo.push(Array.from({length: h}, () => pick(BOX)));
        }
    }

    // screen x of the left edge and the deck y of a cargo column
    _col(s, i) {
        const b0 = s.lights.bays[0] + i * CW;
        const x = s.dir > 0 ? Math.round(s.x) + b0 : Math.round(s.x) + s.L - b0 - CW;
        return [x, Math.round(s.y) + s.lights.deckAt(b0 + CW / 2)];
    }

    _drawShip(g, s, env, y = s.y) {
        const sp = this._sprite(g, s);
        // small craft rock on the swell
        const amp = s.k >= K_NEAR ? 1 : s.L < 90 ? (env.weather.v.breeze > 0.5 ? 1 : 0) : 0;
        const bob = amp ? Math.round(Math.sin(this.realT * 1.4 + s.t) * amp) : 0;
        sp.box[0] = Math.round(s.x) + sp.ox;
        sp.box[1] = Math.round(y) + bob + sp.oy;
        g.drawSprite(sp);
        if (s.cargo)
            this._drawCargo(g, s);
        this._shipLights(g, s, env, Math.round(y) + bob);
    }

    _drawCargo(g, s) {
        s.cargo.forEach((col, i) => {
            const [x, dy] = this._col(s, i);
            for (let k = 0; k < col.length; k++)
                this._box(g, x, dy - (k + 1) * CH, col[k]);
        });
    }

    _pt(s, i, dy, wl) {
        return [s.dir > 0 ? Math.round(s.x) + i : Math.round(s.x) + s.L - 1 - i, wl + dy];
    }

    _shipLights(g, s, env, wl) {
        const lt = s.lights, dark = env.dark > 0.45;
        if (!lt)
            return;
        if (lt.funnel && (s.speed > 0.5 || s.kind === 'tug') && Math.random() < 0.08) {
            const [fx, fy] = this._pt(s, lt.funnel[0], lt.funnel[1], wl);
            this.puffs.push({x: fx, y: fy, t: 0, life: rand(2, 4), r: s.k >= K_NEAR ? 3 : 2});
        }
        if (!dark)
            return;
        const late = env.hour > 23 || env.hour < 5;
        lt.windows.forEach(([i, dy], n) => {
            if (hash(n, Math.floor(s.t), 4) % 100 < (late ? 25 : 60)) {
                const [x, y] = this._pt(s, i, dy, wl);
                g.pxE(x, y, 0xffe0a0);
            }
        });
        for (const [i, dy] of lt.mast) {
            const [x, y] = this._pt(s, i, dy, wl);
            g.pxE(x, y, 0xffffff);
            g.glow(x, y, 4, 0xffffff, 0.3);
        }
        if (s.speed > 0.5 && lt.side) {
            // we see the starboard side when the bow points right: green
            const [x, y] = this._pt(s, lt.side[0], lt.side[1], wl);
            const c = s.dir > 0 ? 0x40ff70 : 0xff4040;
            g.pxE(x, y, c);
            g.glow(x, y, 4, c, 0.35);
        }
        if (lt.stern) {
            const [x, y] = this._pt(s, lt.stern[0], lt.stern[1], wl);
            g.pxE(x, y, 0xfff4e0);
        }
        for (const [i, dy] of lt.lamps) {
            const [x, y] = this._pt(s, i, dy, wl);
            g.glow(x, y + 3, Math.round(2.5 * s.k), 0xfff0c0, 0.12);
        }
    }

    // ---------- cranes ----------

    _craneWork(cr, s, real) {
        const restY = this.Yq - 92, landY = this.Yq - 2;
        // each crane works the part of the ship in front of it, counted
        // from the left on screen (the cranes keep their order on the rail)
        const cols = s.cargo.length, r = s.dir > 0 ? cr.idx : cr.n - 1 - cr.idx;
        const c0 = Math.floor(cols * r / cr.n), c1 = Math.floor(cols * (r + 1) / cr.n);
        if (!cr.steps.length) {
            const unload = s.unload > 0;
            if (!unload && s.load <= 0)
                return;
            // the gantries share one rail: keep clear of the neighbours
            const others = this.cranes.filter(o => o !== cr);
            // and they cannot pass each other: stay on our side of each
            const clear = cx => others.every(o => (o.x < cr.x ? cx >= Math.max(o.x, o.tx ?? o.x) + 56 : cx <= Math.min(o.x, o.tx ?? o.x) - 56));
            let best = -1;
            for (let i = c0; i < c1; i++) {
                const h = s.cargo[i].length, [x] = this._col(s, i);
                if (!clear(x + Math.floor(CW / 2)))
                    continue;
                if (unload ? h > 0 && (best < 0 || h > s.cargo[best].length) : h < 6 && (best < 0 || h < s.cargo[best].length))
                    best = i;
            }
            if (best < 0)
                return;
            const [x] = this._col(s, best);
            const cx = x + Math.floor(CW / 2);
            cr.tx = cx;
            if (unload)
                s.unload--;
            else
                s.load--;
            cr.steps = unload
                ? [['move', cx], ['side', 'sea'], ['y', 'stack', best], ['grab', best], ['y', restY], ['wait', 2.5], ['side', 'land'], ['y', landY], ['drop'], ['y', restY], ['wait', rand(4, 16)]]
                : [['move', cx], ['side', 'land'], ['y', landY], ['grab'], ['y', restY], ['wait', 2.5], ['side', 'sea'], ['y', 'stack', best], ['drop', best], ['y', restY], ['wait', rand(4, 16)]];
        }
        const st = cr.steps[0];
        switch (st[0]) {
        case 'move': {
            const d = st[1] - cr.x, v = 6 * real;
            cr.x += Math.abs(d) < v ? d : Math.sign(d) * v;
            if (Math.abs(st[1] - cr.x) < 0.01)
                cr.steps.shift();
            break;
        }
        case 'side':
            cr.side = st[1];
            cr.steps.shift();
            break;
        case 'y': {
            let ty = st[1];
            if (ty === 'stack') {
                const [, dy] = this._col(s, st[2]);
                ty = dy - (s.cargo[st[2]].length + (cr.load ? 1 : 0)) * CH - 2;
            }
            const d = ty - cr.y, v = (d > 0 ? 16 : 12) * real;
            cr.y += Math.abs(d) < v ? d : Math.sign(d) * v;
            if (Math.abs(ty - cr.y) < 0.01)
                cr.steps.shift();
            break;
        }
        case 'wait':
            cr.t += real;
            if (cr.t > st[1]) {
                cr.t = 0;
                cr.steps.shift();
            }
            break;
        case 'grab':
            cr.t += real;
            if (cr.t > 1) {
                cr.t = 0;
                if (st[1] !== undefined) {
                    cr.load = s.cargo[st[1]].pop();
                } else {
                    cr.load = pick(BOX);
                }
                cr.steps.shift();
            }
            break;
        case 'drop':
            cr.t += real;
            if (cr.t > 1) {
                cr.t = 0;
                if (st[1] !== undefined) {
                    s.cargo[st[1]].push(cr.load);
                } else {
                    // a truck takes the box away along the quay
                    this.trucks.push({x: cr.x - 20, dir: this.flip ? 1 : -1, c: cr.load, speed: rand(16, 22)});
                }
                cr.load = null;
                cr.steps.shift();
            }
            break;
        }
    }

    _updateCranes(real) {
        const b = this.berth, s = b.state === 'moored' ? b.ship : null;
        for (const cr of this.cranes) {
            const want = s ? 0 : 1;
            cr.raise = clamp(cr.raise + Math.sign(want - cr.raise) * real / 8, 0, 1);
            if (!s || cr.raise > 0) {
                cr.steps = [];
                cr.load = null;
                cr.y += (this.Yq - 92 - cr.y) * Math.min(1, real * 2);
                cr.side = 'sea';
                continue;
            }
            if (s.cargo)
                this._craneWork(cr, s, real);
        }
    }

    // the crane seen from the water: the portal on the quay, the boom
    // pointing at us (raised when no ship is in), the house on top
    _drawCrane(g, cr, env) {
        const Yq = this.Yq, cx = Math.round(cr.x), c = cr.c, dk = sh(c, 0.3);
        const portal = Yq - 45, boom = Yq - 104;
        for (const lx of [cx - 23, cx + 19]) {
            g.rect(lx - 1, portal, 6, Yq - portal - 2, INK);
            g.rect(lx, portal, 4, Yq - portal - 2, c);
            g.rect(lx + 3, portal, 1, Yq - portal - 2, dk);
            g.rect(lx - 2, Yq - 4, 8, 3, 0x2a2a30);
        }
        g.rect(cx - 25, portal - 4, 50, 5, INK);
        g.rect(cx - 24, portal - 3, 48, 3, c);
        for (const lx of [cx - 20, cx + 17]) {
            g.rect(lx - 1, boom, 5, portal - boom, INK);
            g.rect(lx, boom, 3, portal - boom, c);
        }
        g.line(cx - 18, boom + 6, cx + 17, portal - 6, dk);
        g.line(cx + 17, boom + 6, cx - 18, portal - 6, dk);
        // the boom end on, or raised up into the sky
        const up = Math.round(cr.raise * 120);
        if (up > 2) {
            g.rect(cx - 6, boom - up, 12, up, INK);
            g.rect(cx - 5, boom - up, 10, up, c);
            for (let y = boom - up + 3; y < boom; y += 6)
                g.line(cx - 5, y, cx + 4, y + 3, dk);
        }
        g.rect(cx - 16, boom - 1, 32, 12, INK);
        g.rect(cx - 15, boom, 30, 10, c);
        for (let x = cx - 13; x < cx + 14; x += 4)
            g.rect(x, boom + 2, 2, 6, dk);
        // machinery house and the A-frame with its stays
        g.rect(cx - 14, boom - 10, 28, 10, INK);
        g.rect(cx - 13, boom - 9, 26, 8, 0xf0f0f0);
        g.rect(cx - 13, boom - 9, 26, 1, 0xffffff);
        g.rect(cx + 6, boom - 7, 3, 5, 0x5a6a7a);
        const apex = boom - 46;
        g.line(cx - 12, boom - 10, cx - 1, apex, INK);
        g.line(cx + 12, boom - 10, cx + 1, apex, INK);
        g.line(cx - 11, boom - 10, cx, apex, c);
        g.line(cx + 11, boom - 10, cx, apex, c);
        g.rect(cx - 2, apex - 1, 5, 3, c);
        this._apex = [cx, apex - 2];
        // the cab under the boom
        g.rect(cx - 4, boom + 10, 8, 6, INK);
        g.rect(cx - 3, boom + 11, 6, 4, 0x8ac0e8);
        if (env.dark > 0.45) {
            if (Math.floor(this.realT * 1.2 + cr.idx) % 2)
                g.pxE(cx, apex - 2, 0xff3020);
            g.glow(cx, apex - 2, 5, 0xff3020, 0.3);
            g.glow(cx, boom + 14, 20, 0xfff0d0, 0.1, 1.6);
        }
    }

    _drawSpreader(g, cr) {
        const cx = Math.round(cr.x), y = Math.round(cr.y), top = this.Yq - 94;
        g.rect(cx - 5, top, 1, y - top, 0x3a3a44);
        g.rect(cx + 4, top, 1, y - top, 0x3a3a44);
        g.rect(cx - 8, y, 17, 2, INK);
        g.rect(cx - 7, y, 15, 1, 0xf0c030);
        if (cr.load)
            this._box(g, cx - 7, y + 2, cr.load);
    }

    // ---------- traffic ----------

    _laneBusy() {
        const b = this.berth.state, f = this.ferry.state;
        return b === 'arriving' || b === 'leaving' || f === 'in' || f === 'out';
    }

    _updateBerth(real, env) {
        const b = this.berth, W = this.w;
        b.t += real;
        const s = b.ship;
        switch (b.state) {
        case 'empty':
            if (b.t > 0 && !this._laneBusy() && this.ferry.state !== 'docked') {
                const n = this._boxShip();
                n.loaded = true;
                n.unload = randi(25, 50);
                n.load = randi(25, 50);
                n.home = n.x;
                n.x = this.dirIn < 0 ? W + 30 : -n.L - 30;
                n.y = this.Ws;
                n.speed = 12;
                b.ship = n;
                b.state = 'arriving';
                b.t = 0;
                this._tugFor(n);
            }
            break;
        case 'arriving': {
            const d = s.home - s.x;
            s.speed = clamp(Math.abs(d) * 0.05, 1.2, 14);
            s.x += Math.sign(d) * Math.min(Math.abs(d), s.speed * real);
            s.y = this.Wm + (this.Ws - this.Wm) * clamp(Math.abs(d) / 160, 0, 1);
            if (Math.abs(d) < 0.3) {
                s.x = s.home;
                s.y = this.Wm;
                s.speed = 0;
                b.state = 'moored';
                b.t = 0;
                this._horn(s);
                this._releaseTug();
            }
            break;
        }
        case 'moored':
            if ((s.unload <= 0 && s.load <= 0 && this.cranes.every(c => !c.steps.length) && b.t > 600) || b.t > 3600 / Math.max(0.3, env.traffic)) {
                if (!this._laneBusy()) {
                    b.state = 'leaving';
                    b.t = 0;
                    this._horn(s);
                    this._tugFor(s);
                }
            }
            break;
        case 'leaving': {
            // stern first, back out of the berth and away
            s.speed = Math.min(12, 1 + b.t * 0.25);
            s.x -= this.dirIn * s.speed * real;
            s.y = this.Wm + (this.Ws - this.Wm) * clamp(b.t / 25, 0, 1);
            if (s.x > W + 40 || s.x + s.L < -40) {
                b.ship = null;
                b.state = 'empty';
                b.t = -rand(120, 420) / Math.max(0.3, env.traffic);
                this._releaseTug();
            }
            break;
        }
        }
    }

    _tugFor(s) {
        const t = makeShip('tug', K_MID);
        t.dir = this.dirIn;
        t.escort = s;
        t.y = this.Ws2;
        this.tugs = [t];
    }

    _releaseTug() {
        for (const t of this.tugs) {
            t.escort = null;
            t.speed = 16;
            t.dir = -this.dirIn;
        }
    }

    _updateTugs(real) {
        for (const t of this.tugs) {
            if (t.escort) {
                const s = t.escort, stern = s.dir > 0 ? s.x : s.x + s.L;
                t.x = s.dir > 0 ? stern + 30 : stern - 30 - t.L;
                t.speed = s.speed;
            } else {
                t.x += t.dir * t.speed * real;
            }
        }
        this.tugs = this.tugs.filter(t => t.escort || (t.x > -t.L - 40 && t.x < this.w + 40));
    }

    _horn(s) {
        if (s.lights?.funnel) {
            this.timers.add(0.1, () => {
                const [x, y] = this._pt(s, s.lights.funnel[0], s.lights.funnel[1], Math.round(s.y));
                for (let i = 0; i < 6; i++)
                    this.puffs.push({x: x + rand(-2, 2), y: y - i, t: 0, life: rand(1.5, 2.5), r: 2, white: true});
            });
        }
    }

    _updateFerry(real, env) {
        const f = this.ferry, s = f.s, W = this.w, h = env.hour;
        if (f.state === 'away' || f.state === 'docked')
            f.t -= real;
        const berthX = Math.round(this.ferryBerth - s.L / 2);
        switch (f.state) {
        case 'away':
            if (f.t <= 0 && h > 6 && h < 22 && !this._laneBusy() && this.berth.state !== 'arriving') {
                f.state = 'in';
                s.x = this.dirIn < 0 ? W + 20 : -s.L - 20;
                s.speed = 14;
                f.y = this.Ws;
            }
            break;
        case 'in': {
            const d = berthX - s.x;
            s.speed = clamp(Math.abs(d) * 0.06, 1, 14);
            s.x += Math.sign(d) * Math.min(Math.abs(d), s.speed * real);
            f.y = this.Wm + (this.Ws - this.Wm) * clamp(Math.abs(d) / 90, 0, 1);
            if (Math.abs(d) < 0.3) {
                f.state = 'docked';
                f.t = rand(150, 260);
                s.speed = 0;
                this._horn(s);
                // passengers walk off along the town quay
                for (let i = 0; i < randi(3, 7); i++)
                    this.timers.add(i * rand(1, 3), () => this._townFolk(this.ferryBerth + rand(-8, 8)));
            }
            break;
        }
        case 'docked':
            if (f.t <= 0 && !this._laneBusy()) {
                f.state = 'out';
                f.t = 0;
                this._horn(s);
            }
            break;
        case 'out':
            f.t += real;
            s.speed = Math.min(14, 1 + f.t * 0.6);
            s.x += this.dirIn * s.speed * real;
            f.y = this.Wm + (this.Ws - this.Wm) * clamp(f.t / 14, 0, 1);
            if (s.x > W + 40 || s.x + s.L < -40) {
                f.state = 'away';
                f.t = rand(500, 1100) / Math.max(0.3, env.traffic);
            }
            break;
        }
        s.y = f.y;
    }

    _townFolk(x) {
        const [a, b] = this.town;
        this.townFolk.push({x, dir: chance(0.5) ? 1 : -1, speed: rand(2, 4), c: pick(SHIRTS), t: rand(5), stop: 0, a, b});
    }

    _updateTownFolk(real, env) {
        const [a, b] = this.town;
        for (const p of this.townFolk) {
            p.t += real;
            if (p.stop > 0) {
                p.stop -= real;
                continue;
            }
            p.x += p.dir * p.speed * real;
            if (Math.random() < real / 15)
                p.stop = rand(2, 10);
            if (p.x < a + 2 || p.x > b - 3)
                p.gone = true;
        }
        this.townFolk = this.townFolk.filter(p => !p.gone);
        const want = (env.dark > 0.7 ? 2 : 7) * env.people * (b - a) / 300;
        if (this.townFolk.length < want && Math.random() < real / 4)
            this._townFolk(this.dirIn < 0 ? b - 4 : a + 3);
    }

    // a boat passing through the basin on the near lane of the two
    _passing(kind, opts = {}) {
        const s = makeShip(kind, opts.k ?? K_MID);
        s.dir = opts.dir ?? (chance(0.5) ? 1 : -1);
        s.sails = !!opts.sails;
        s.speed = opts.speed ?? rand(8, 14);
        s.x = s.dir > 0 ? -s.L - 30 - (opts.delay || 0) : this.w + 30 + (opts.delay || 0);
        s.y = opts.y ?? this.Ws2;
        s.gulls = opts.gulls;
        (opts.near ? this.nearBoats : this.boats).push(s);
        return s;
    }

    _updateBoats(list, real) {
        for (const s of list)
            s.x += s.dir * s.speed * real;
        return list.filter(s => (s.dir > 0 ? s.x < this.w + 60 : s.x + s.L > -60));
    }

    _updateCutters(real, env) {
        const out = this.flip ? 1 : -1;
        for (const c of this.cutters) {
            const s = c.s;
            if (c.state === 'leaving') {
                s.speed = Math.min(10, (s.speed || 0) + real * 2);
                s.dir = out;
                c.x += out * s.speed * real;
                if (c.x > this.w + 40 || c.x + s.L < -40)
                    c.state = 'out';
            } else if (c.state === 'returning') {
                s.dir = -out;
                const d = c.home - c.x;
                s.speed = clamp(Math.abs(d) * 0.08, 1, 10);
                c.x += Math.sign(d) * Math.min(Math.abs(d), s.speed * real);
                if (Math.abs(d) < 0.3) {
                    c.state = 'moored';
                    s.speed = 0;
                    // the gulls stay a while, then spread out
                    this.timers.add(rand(20, 40), () => this.gulls.forEach(gl => gl.follow === c && (gl.follow = null)));
                }
            }
            s.x = c.x;
        }
        void env;
    }

    _farShip(x) {
        const kind = weighted([['freighter', 3], ['tanker', 1.5], ['cruise', 1], ['sail', 1]]);
        const L = {freighter: randi(60, 80), tanker: randi(70, 95), cruise: randi(90, 120), sail: randi(6, 9)}[kind];
        const dir = chance(0.5) ? 1 : -1;
        this.far.push({kind, L, dir, x: x ?? (dir > 0 ? this.mouth[0] - L - 10 : this.mouth[1] + 10), speed: kind === 'sail' ? rand(1, 2) : rand(1.5, 3), c: pick(BOX), hull: pick([0x2a3a5a, 0x5a2a2a, 0x3a3a3a])});
    }

    _drawFar(g, env) {
        const [m0, m1] = this.mouth, Y = this.horizon + 1, dark = env.dark > 0.45;
        const haze = env.skyBottom ?? 0xa8c8e8;
        const put = (x, y, w, h, c) => {
            const x1 = Math.max(m0, x), x2 = Math.min(m1, x + w);
            if (x2 > x1)
                g.rect(x1, y, x2 - x1, h, mix(c, haze, 0.35));
        };
        const lit = (x, y, c = 0xfff0c0) => x >= m0 && x < m1 && g.pxE(x, y, c);
        for (const f of this.far) {
            const x = Math.round(f.x), L = f.L, fw = f.dir > 0;
            if (f.kind === 'sail') {
                put(x, Y - 1, L, 1, 0xf0f0f0);
                for (let r = 0; r < 6; r++)
                    put(x + 2 + (fw ? r >> 1 : 0), Y - 2 - r, Math.max(1, 3 - (r >> 1)), 1, 0xf8f8f8);
                continue;
            }
            if (f.kind === 'cruise') {
                put(x, Y - 4, L, 4, 0xf4f4f8);
                put(x + 6, Y - 10, L - 20, 6, 0xf4f4f8);
                put(x + 12, Y - 14, L - 40, 4, 0xe8e8f0);
                put(fw ? x + 30 : x + L - 36, Y - 18, 6, 4, f.c);
                if (dark)
                    for (let i = x + 4; i < x + L - 6; i += 2)
                        for (const yy of [Y - 3, Y - 7, Y - 12])
                            if (hash(i, yy, 3) < 600)
                                lit(i, yy);
            } else if (f.kind === 'tanker') {
                put(x, Y - 4, L, 4, 0x8a2a2a);
                put(x, Y - 5, L, 1, 0x3a3a3a);
                put(fw ? x + 2 : x + L - 10, Y - 12, 8, 7, 0xf0f0f0);
                put(fw ? x + 3 : x + L - 7, Y - 15, 3, 3, f.c);
                for (let i = x + 14; i < x + L - 10; i += 9)
                    put(i, Y - 6, 2, 1, 0x6a6a6a);
            } else {
                put(x, Y - 4, L, 4, f.hull);
                for (let i = x + 12; i < x + L - 6; i += 5)
                    put(i, Y - 6 - hash(i, 2, 1) % 4, 4, 2 + hash(i, 2, 1) % 4, BOX[hash(i, 3, 1) % BOX.length]);
                put(fw ? x + 2 : x + L - 9, Y - 13, 7, 9, 0xf0f0f0);
            }
            if (dark) {
                lit(fw ? x + L - 2 : x + 1, Y - 6, 0xffffff);
                lit(fw ? x + 3 : x + L - 4, Y - 14, 0xffffff);
            }
        }
    }

    // ---------- gulls ----------

    _gull(x, y, depth, follow = null) {
        this.gulls.push({x, y, depth, vx: rand(-14, 14) || 4, vy: 0, t: rand(5), follow, cx: x, cy: y});
    }

    _updateGulls(real) {
        const W = this.w;
        for (const gl of this.gulls) {
            gl.t += real;
            let tx = gl.cx + Math.sin(gl.t * 0.31 + gl.x * 0.01) * 80, ty = gl.cy + Math.sin(gl.t * 0.53) * 18;
            if (gl.follow) {
                const s = gl.follow.s;
                tx = gl.follow.x + s.L / 2 + Math.sin(gl.t * 0.9) * s.L * 0.6;
                ty = this.Wn - 70 + Math.sin(gl.t * 1.3) * 16;
            }
            gl.vx += clamp(tx - gl.x, -60, 60) * real * 0.5;
            gl.vy += clamp(ty - gl.y, -40, 40) * real * 0.6;
            const sp = Math.hypot(gl.vx, gl.vy), max = gl.follow ? 26 : 18;
            if (sp > max) {
                gl.vx *= max / sp;
                gl.vy *= max / sp;
            }
            gl.x += gl.vx * real;
            gl.y += gl.vy * real;
            if (!gl.follow && Math.random() < real / 40) {
                gl.cx = clamp(gl.cx + rand(-120, 120), 0, W);
                gl.cy = clamp(gl.cy + rand(-20, 20), this.horizon - 50, this.Yn - 20);
            }
        }
        // gulls on the bollards take off now and then and come back
        for (const p of this.perched) {
            p.t += real;
            if (p.state === 'sit') {
                if (Math.random() < real / 90 || this.people.some(q => !q.angler && Math.abs(q.x + 9 - p.bx - 4) < 14 && q.y < this.Yp + 40)) {
                    p.state = 'fly';
                    p.vx = rand(-30, 30) || 20;
                    p.vy = -rand(30, 45);
                    p.t = 0;
                }
            } else if (p.state === 'fly') {
                p.x += p.vx * real;
                p.y += p.vy * real;
                p.vy += 6 * real;
                if (p.t > rand(6, 20) && p.y < this.Yp - 40) {
                    p.state = 'land';
                }
            } else {
                const tx = p.bx + 1, ty = this.Yp - 11;
                p.x += clamp(tx - p.x, -40 * real, 40 * real);
                p.y += clamp(ty - p.y, -30 * real, 30 * real);
                if (Math.abs(tx - p.x) < 0.5 && Math.abs(ty - p.y) < 0.5) {
                    p.state = 'sit';
                    p.t = 0;
                }
            }
        }
    }

    // a flying gull: wingspan about 1.4 m at the scale of its depth
    _drawGull(g, x, y, depth, t) {
        x = Math.round(x);
        y = Math.round(y);
        const fr = Math.floor(t * 6) % 3;
        if (depth === 'mid') {
            const wy = fr === 0 ? -1 : fr === 1 ? 0 : 1;
            g.px(x - 2, y + wy, 0x9aa0a8);
            g.px(x - 1, y, 0xf0f0f0);
            g.px(x, y, 0xf8f8f8);
            g.px(x + 1, y, 0xf0f0f0);
            g.px(x + 2, y + wy, 0x9aa0a8);
            return;
        }
        if (depth === 'near') {
            const wy = fr === 0 ? -2 : fr === 1 ? 0 : 1;
            g.rect(x - 1, y, 3, 1, 0xf8f8f8);
            g.px(x + 2, y, 0xf0b020);
            for (const s of [-1, 1]) {
                g.px(x + s * 2, y + Math.round(wy / 2), 0xb8c0c8);
                g.px(x + s * 3, y + wy, 0xb8c0c8);
                g.px(x + s * 4, y + wy, 0x2a2a30);
            }
            return;
        }
        // front: a big gull close by (wingspan 24 px)
        const wy = fr === 0 ? -5 : fr === 1 ? 0 : 3;
        g.rect(x - 4, y - 1, 9, 3, INK);
        g.rect(x - 3, y, 7, 2, 0xf8f8f8);
        g.rect(x + 4, y - 2, 3, 3, 0xf8f8f8);
        g.px(x + 7, y - 1, 0xf0b020);
        g.px(x + 5, y - 2, INK);
        for (const s of [-1, 1])
            for (let k = 1; k <= 10; k++) {
                const yy = y + Math.round(wy * k / 10);
                g.px(x + s * (k + 1), yy, k > 8 ? 0x2a2a30 : 0xb8c0c8);
                g.px(x + s * (k + 1), yy - 1, INK);
            }
    }

    // sitting on a bollard (about 0.5 m long)
    _drawPerched(g, p) {
        const x = Math.round(p.x), y = Math.round(p.y);
        if (p.state !== 'sit') {
            this._drawGull(g, x, y, 'front', p.t);
            return;
        }
        const look = Math.floor(p.t / 3) % 3 === 2 ? -1 : 1;
        g.rect(x - 1, y - 5, 10, 6, INK);
        g.rect(x, y - 4, 8, 4, 0xf8f8f8);
        g.rect(x + 1, y - 4, 5, 2, 0x9aa4b0);
        g.rect(x - 1, y - 3, 2, 1, 0x2a2a30);
        const hx = look > 0 ? x + 6 : x;
        g.rect(hx - 1, y - 8, 5, 5, INK);
        g.rect(hx, y - 7, 3, 3, 0xf8f8f8);
        g.px(look > 0 ? hx + 3 : hx - 1, y - 6, 0xf0b020);
        g.px(look > 0 ? hx + 4 : hx - 2, y - 6, 0xf0b020);
        g.px(look > 0 ? hx + 2 : hx, y - 7, INK);
    }

    // ---------- small people ----------

    // a person at the marina scale (11 px)
    _small(g, x, y, c, step, face = 0) {
        x = Math.round(x);
        y = Math.round(y);
        g.rect(x - 1, y - 11, 5, 12, INK);
        g.rect(x, y - 10, 3, 3, 0xf0c098);
        g.rect(x, y - 11, 3, 1, 0x4a3020);
        g.rect(x, y - 7, 3, 4, c);
        g.rect(x, y - 3, 1, 3, 0x2a3a5a);
        g.rect(x + 2, y - 3 + step, 1, 3 - step, 0x2a3a5a);
        if (face)
            g.px(face > 0 ? x + 2 : x, y - 9, INK);
    }

    // a person at the basin scale (5 px)
    _dot(g, x, y, c, step) {
        x = Math.round(x);
        y = Math.round(y);
        g.px(x, y - 4, 0xf0c098);
        g.rect(x, y - 3, 2, 2, c);
        g.px(x, y - 1, 0x2a2a3a);
        g.px(x + 1, y - 1 + step, 0x2a2a3a);
    }

    _updatePontoon(real, env) {
        const [a, b] = this.marina;
        for (const p of this.pontoonFolk) {
            p.t += real;
            if (p.stop > 0) {
                p.stop -= real;
                continue;
            }
            p.x += p.dir * 5 * real;
            if (Math.random() < real / 12)
                p.stop = rand(3, 12);
            if (p.x < a + 2 || p.x > b - 6)
                p.dir *= -1;
        }
        const want = env.dark > 0.6 ? 0 : Math.round((env.season === 'summer' ? 3 : 1.5) * env.people);
        if (this.pontoonFolk.length < want && Math.random() < real / 20)
            this.pontoonFolk.push({x: this.flip ? b - 10 : a + 4, dir: this.flip ? -1 : 1, t: 0, stop: 0, c: pick(SHIRTS)});
        else if (this.pontoonFolk.length > want && Math.random() < real / 30)
            this.pontoonFolk.shift();
    }

    // ---------- the promenade ----------

    _kioskOpen(env) {
        const h = env.hour;
        return h >= 10 && h < 19 && env.weekday !== 1 && env.season !== 'winter';
    }

    _updatePeople(real, env) {
        const W = this.w, open = this._kioskOpen(env);
        for (const p of this.people) {
            p.t += real;
            if (p.angler) {
                p.catchT -= real;
                if (p.catchT <= 0) {
                    p.catchT = rand(60, 240);
                    if (chance(0.6))
                        this.fx.push({kind: 'fish', x: p.x + 31, y: this.Yp - 3, t: 0, p});
                }
                continue;
            }
            if (p.state === 'wait' || p.state === 'look') {
                p.waitT -= real;
                if (p.waitT <= 0) {
                    p.state = 'walk';
                    p.y = this.h - randi(4, 14);
                }
                continue;
            }
            p.x += p.dir * p.speed * real;
            p.look -= real;
            // stop at the edge to look out over the water, or buy fish
            if (p.look <= 0 && p.x > 30 && p.x < W - 50) {
                p.look = rand(30, 90);
                const k = this.kiosk;
                if (open && Math.abs(p.x - (k.x + k.w / 2)) < 40 && chance(0.5)) {
                    p.state = 'wait';
                    p.waitT = rand(10, 25);
                    p.y = this.Yp + 26;
                    p.x = k.x + 10 + rand(0, k.w - 30);
                } else if (chance(0.4) && !this.benches.some(b => p.x + 18 > b && p.x < b + 52)) {
                    p.state = 'look';
                    p.waitT = rand(5, 15);
                    p.y = this.Yp + 18;
                }
            }
        }
        this.people = this.people.filter(p => p.angler || (p.x > -40 && p.x < W + 40));
        if (Math.random() < real / 18 * env.people && this.people.filter(p => !p.angler).length < 3 + 3 * env.people)
            this._walker(env);
        // anglers come and go with the light
        const nAng = this.people.filter(p => p.angler).length;
        if (Math.random() < real / 300) {
            if (nAng && (env.weather.v.rain > 0.6 || chance(0.3)))
                this.people.splice(this.people.findIndex(p => p.angler), 1);
            else if (nAng < 2 && env.weather.v.rain < 0.6)
                this._angler(env);
        }
        for (const f of this.fx)
            f.t += real;
        this.fx = this.fx.filter(f => f.t < 1.6);
    }

    _drawAngler(g, p, env) {
        drawPerson(g, p, p.x, p.y, 1, env, 'up');
        const f = personFigure(p, 0, 'up');
        // the rod held up over the water, the line down to the float
        const hx = p.x + f.w - 3, hy = p.y - (p.kid ? 13 : 17);
        const tx = hx + 16, ty = hy - 38;
        g.line(hx, hy, tx, ty, 0x5a3a2a);
        g.px(hx, hy, INK);
        const bob = Math.round(Math.sin(this.realT * 2 + p.x) * 0.6);
        const fy = this.Yp - 3 + bob;
        g.line(tx, ty, tx + 1, fy - 1, 0xc8d0d8);
        g.px(tx + 1, fy, 0xe83030);
        g.px(tx + 1, fy - 1, 0xf8f8f8);
    }

    // ---------- update ----------

    update(dt, real, env, ctx) {
        this.realT += real;
        this.timers.run(real);
        this._updateBerth(real, env);
        this._updateCranes(real);
        this._updateTugs(real);
        this._updateFerry(real, env);
        this.boats = this._updateBoats(this.boats, real);
        this.nearBoats = this._updateBoats(this.nearBoats, real);
        this._updateCutters(real, env);
        for (const tr of this.trucks)
            tr.x += tr.dir * tr.speed * real;
        this.trucks = this.trucks.filter(tr => tr.x > -60 && tr.x < this.w + 60);
        for (const f of this.far)
            f.x += f.dir * f.speed * real;
        this.far = this.far.filter(f => f.x > this.mouth[0] - f.L - 20 && f.x < this.mouth[1] + 20);
        this.farT -= real;
        if (this.farT <= 0) {
            this.farT = rand(60, 240) / Math.max(0.3, env.traffic);
            this._farShip();
        }
        for (const s of this.slips)
            s.s.x = s.x;
        for (const p of this.puffs) {
            p.t += real;
            p.y -= 4 * real;
            p.x += (env.weather.wind * 6 + 1) * real;
        }
        this.puffs = this.puffs.filter(p => p.t < p.life);
        this._updateGulls(real);
        this._updateTownFolk(real, env);
        this._updatePontoon(real, env);
        this._updatePeople(real, env);
        // the cutters go out at dawn and come home in the late morning
        const h = env.hour;
        if (h > 4.5 && h < 8 && Math.random() < real / 200) {
            const c = this.cutters.find(q => q.state === 'moored');
            if (c && !c.busy)
                c.state = 'leaving';
        }
        if (h > 10 && h < 16 && Math.random() < real / 240)
            this._cutterHome();
        this.eventTimer -= real;
        if (this.eventTimer <= 0) {
            this.eventTimer = rand(70, 200);
            this.trigger(this._pickEvent(env), env, ctx);
        }
        if (env.holidays.newYear && env.dark > 0.5 && Math.random() < real * 1.2)
            ctx?.sky.firework();
    }

    _cutterHome() {
        const c = this.cutters.find(q => q.state === 'out');
        if (!c)
            return;
        const out = this.flip ? 1 : -1;
        c.state = 'returning';
        c.x = out > 0 ? this.w + 30 : -c.s.L - 30;
        for (let i = 0; i < randi(5, 10); i++)
            this._gull(c.x + rand(0, c.s.L), this.Wn - rand(50, 90), 'near', c);
    }

    trigger(name, env, ctx, inView = false) {
        switch (name) {
        case 'tallship': {
            const s = this._passing('tallship', {sails: chance(0.7), speed: rand(5, 8)});
            s.y = this.Ws2;
            if (inView)
                s.x = this.w * 0.3;
            break;
        }
        case 'tug':
            this._passing('tug', {speed: rand(12, 18)});
            break;
        case 'pilot':
            this._passing('pilot', {speed: rand(18, 26)});
            break;
        case 'cutter':
            this._passing('fishing', {speed: rand(8, 12)});
            break;
        case 'regatta': {
            const dir = chance(0.5) ? 1 : -1;
            for (let i = 0; i < randi(3, 6); i++)
                this._passing('racer', {dir, sails: true, speed: rand(6, 9), delay: i * rand(25, 50)});
            break;
        }
        case 'yacht':
            this._passing('yacht', {k: K_NEAR, near: true, sails: chance(0.6), y: this.Wl, speed: rand(6, 10)});
            break;
        case 'motorboat':
            this._passing('motor', {k: K_NEAR, near: true, y: this.Wl, speed: rand(14, 22)});
            break;
        case 'rowboat': {
            const s = this._passing('dinghy', {k: K_NEAR, near: true, y: this.Wl, speed: rand(3, 5)});
            s.rower = pick(SHIRTS);
            break;
        }
        case 'cutterOut': {
            const c = this.cutters.find(q => q.state === 'moored');
            if (c)
                c.state = 'leaving';
            break;
        }
        case 'cutterHome':
            this._cutterHome();
            break;
        case 'far':
            this._farShip(inView ? (this.mouth[0] + this.mouth[1]) / 2 - 40 : undefined);
            break;
        case 'gulls':
            for (let i = 0; i < randi(5, 9); i++)
                this._gull(rand(0, this.w), rand(this.horizon - 30, this.Yn - 30), pick(['mid', 'near']));
            break;
        case 'ship':
            if (this.berth.state === 'empty')
                this.berth.t = 1;
            break;
        case 'ferry':
            this.ferry.t = 0;
            break;
        case 'fireworks':
            for (let i = 0; i < randi(6, 12); i++)
                this.timers.add(i * rand(0.6, 1.5), () => ctx?.sky.firework(rand(this.w * 0.2, this.w * 0.8)));
            break;
        }
    }

    _pickEvent(env) {
        const day = env.dark < 0.5, h = env.hour, dry = env.weather.v.rain < 0.2, warm = env.season === 'summer' || env.season === 'spring';
        const calm = env.weather.v.breeze < 0.7, V = env.traffic;
        return weighted([
            ['tallship', day && dry ? (env.season === 'summer' ? 0.8 : 0.3) : 0], ['tug', 1 * V], ['pilot', 0.8 * V],
            ['cutter', day ? 0.6 : 0.2], ['regatta', day && dry && warm && env.weekday % 6 === 0 ? 1.2 : day && dry && warm ? 0.3 : 0],
            ['yacht', day && dry ? (warm ? 1.5 : 0.4) : 0], ['motorboat', day && dry && calm ? (warm ? 1.2 : 0.3) * V : 0],
            ['rowboat', day && dry && calm && warm ? 0.6 : 0], ['gulls', 0.8], ['far', 0.6],
            ['fireworks', !day && env.season === 'summer' && env.weekday === 6 && h > 21.5 ? 0.6 : 0],
        ]);
    }

    // ---------- dynamic rendering ----------

    renderDynamic(g, env) {
        const t = this.realT, dark = env.dark > 0.45, lamps = env.lampsOn;
        this._drawWaves(g, env);
        if (dark)
            this._drawReflections(g, env);
        this._drawFar(g, env);
        // lighthouse and the beacon at the mouth
        if (dark) {
            const [lx, ly] = this.lighthouse, ph = (t / 6) % 1;
            if (ph < 0.12) {
                g.pxE(lx, ly, 0xffffff);
                g.glow(lx, ly, 10, 0xfff4c0, 0.6);
            }
            // the beam sweeps round: bright when it points our way
            const a = Math.cos(t * Math.PI * 2 / 6), len = Math.round(Math.abs(Math.sin(t * Math.PI * 2 / 6)) * 140);
            if (len > 8) {
                const dir = a > 0 ? 1 : -1;
                for (let k = 2; k < len; k += 1)
                    g.blend(lx + dir * k, ly - 1 - Math.floor(k / 40), 1, 1 + Math.floor(k / 20), 0xfff4c0, 0.22 * (1 - k / len), true);
            }
            if ((t / 3) % 1 < 0.3) {
                g.pxE(this.beaconG[0], this.beaconG[1], 0x40ff60);
                g.glow(this.beaconG[0], this.beaconG[1], 5, 0x40ff60, 0.4);
            }
        }
        // wind turbines on the far hills behind the terminal
        for (const tb of this.turbines) {
            const base = this.horizon - 4, top = base - tb.h;
            g.rect(tb.x, top, 1, tb.h, 0xc8ccd4);
            tb.a += 0;
            const a0 = t * tb.s * 1.6 + tb.a;
            for (let k = 0; k < 3; k++) {
                const a = a0 + k * Math.PI * 2 / 3;
                for (let r = 1; r < 10; r++)
                    g.px(Math.round(tb.x + Math.cos(a) * r), Math.round(top + Math.sin(a) * r), 0xe0e4ec);
            }
            if (dark && Math.floor(t) % 2)
                g.pxE(tb.x, top - 1, 0xff3020);
        }
        g.compose(this.layerB, 0, this.Wm + 2, true);
        // town at night: windows, lamps along the quay, the church clock
        if (lamps) {
            const late = env.hour > 23 || env.hour < 6;
            for (const [x, y, v] of this.townWins)
                if ((v + Math.floor(env.hour * 3) * 37) % 100 < (late ? 12 : 45))
                    g.rectE(x, y, 2, y > this.Yq - 30 ? 4 : 3, v % 3 ? 0xffd890 : 0xffe8c0);
            for (const lx of this.townLamps) {
                g.pxE(lx, this.Yq - 12, 0xfff0c0);
                g.glow(lx, this.Yq - 11, 8, 0xffe0a0, 0.3);
            }
            g.pxE(this.churchClock[0], this.churchClock[1], 0xfff8e0);
            g.glow(this.churchClock[0], this.churchClock[1], 4, 0xfff0c0, 0.4);
            for (const [x, y] of this.officeWins)
                if (hash(x, y, Math.floor(env.hour)) % 100 < (late ? 10 : 35))
                    g.rectE(x, y, 3, 4, 0xe0f0ff);
            g.text('PORT', this.officeSign[0], this.officeSign[1], 0xf0f0f0, true);
            for (const mx of this.masts)
                g.glow(mx, this.Yq - 80, 14, 0xfff4d8, 0.22, 1.3);
        }
        if (env.holidays.christmas)
            for (const hs of this.houses)
                for (let x = hs.x; x < hs.x + hs.w; x += 2)
                    g.pxE(x, this.Yq - 4 - hs.h - 1, [0xff4040, 0x40ff60, 0xffd040, 0x60a0ff][(x + Math.floor(t * 2)) % 4]);
        // town quay: people, the café, the street lamps
        for (const p of this.townFolk)
            this._dot(g, p.x, this.Yq - 1, p.c, p.stop > 0 ? 0 : Math.floor(p.t * 4) % 2);
        if (env.season === 'summer' && !dark && env.weather.v.rain < 0.2)
            for (const c of this.cafe) {
                g.rect(c.x - 4, this.Yq - 9, 9, 2, c.c);
                g.px(c.x - 5, this.Yq - 8, sh(c.c, 0.3));
                g.px(c.x + 5, this.Yq - 8, sh(c.c, 0.3));
                g.rect(c.x, this.Yq - 7, 1, 5, 0x5a5a62);
                g.rect(c.x - 2, this.Yq - 3, 5, 1, 0x8a6a4a);
            }
        for (const lx of this.townLamps)
            g.rect(lx, this.Yq - 11, 1, 7, 0x3a3a44);
        // the terminal: trucks on the quay, cranes, loads on the land side
        for (const tr of this.trucks)
            this._truck(g, tr);
        for (const cr of this.cranes)
            this._drawCrane(g, cr, env);
        for (const cr of this.cranes)
            if (cr.side === 'land' && cr.raise === 0)
                this._drawSpreader(g, cr);
        // ships in the basin, far to near
        const mid = [];
        if (this.berth.ship)
            mid.push([this.berth.ship.y, () => {
                this._drawShip(g, this.berth.ship, env);
                for (const cr of this.cranes)
                    if (cr.side === 'sea' && cr.raise === 0)
                        this._drawSpreader(g, cr);
            }]);
        else
            mid.push([this.Wm, () => this.cranes.forEach(cr => cr.side === 'sea' && cr.raise === 0 && this._drawSpreader(g, cr))]);
        if (this.ferry.state !== 'away')
            mid.push([this.ferry.y, () => this._drawShip(g, this.ferry.s, env)]);
        for (const s of [...this.tugs, ...this.boats])
            mid.push([s.y, () => this._drawShip(g, s, env)]);
        // buoys at the mouth, sorted in with the ships
        const [m0, m1] = this.mouth;
        for (const [bx, c] of [[m0 + 8, this.flip ? 0x2a9a4a : 0xd83a2a], [m1 - 10, this.flip ? 0xd83a2a : 0x2a9a4a]])
            mid.push([this.Ws + 4, () => this._buoy(g, bx, c, dark)]);
        mid.sort((p, q) => p[0] - q[0]).forEach(([, f]) => f());
        for (const gl of this.gulls)
            if (gl.depth === 'mid')
                this._drawGull(g, gl.x, gl.y, 'mid', gl.t);
        // the fishing jetty and the marina
        for (const c of this.cutters)
            if (c.state !== 'out')
                this._drawShip(g, c.s, env, this.Wn);
        for (const sl of this.slips) {
            sl.s.speed = 0;
            this._drawShip(g, sl.s, env, this.Wn);
        }
        g.compose(this.layerN, this.Yn - 12, this.Yn + 8, true);
        for (const p of this.pontoonFolk)
            this._small(g, p.x, this.Yn + 1, p.c, p.stop > 0 ? 0 : Math.floor(p.t * 4) % 2, p.dir);
        if (lamps)
            for (const lx of this.pontoonLamps) {
                g.rectE(lx, this.Yn - 8, 2, 1, 0xfff0c0);
                g.glow(lx + 1, this.Yn - 8, 10, 0xffe8b0, 0.3);
            }
        for (const s of this.nearBoats) {
            this._drawShip(g, s, env);
            if (s.rower)
                this._rower(g, s);
        }
        for (const p of this.puffs) {
            const a = Math.max(0, 0.6 * (1 - p.t / p.life));
            g.blend(Math.round(p.x) - p.r, Math.round(p.y) - p.r, p.r * 2, p.r * 2, p.white ? 0xf8f8ff : 0x9a9aa4, a);
        }
        for (const gl of this.gulls)
            if (gl.depth === 'near')
                this._drawGull(g, gl.x, gl.y, 'near', gl.t);
        // the promenade
        g.compose(this.layerC, this.Yp - 80, this.h, true);
        this._drawKiosk(g, env);
        if (lamps)
            for (const [lx, ly] of this.lampHeads) {
                g.rectE(lx - 3, ly - 3, 6, 6, 0xfff0c0);
                g.glow(lx, ly, 26, 0xffe0a0, 0.22);
            }
        for (const p of this.perched)
            this._drawPerched(g, p);
        for (const f of this.fx)
            if (f.kind === 'fish') {
                // a fish on the line flips up out of the water
                const u = Math.min(1, f.t / 1.2), x = Math.round(f.x), y = Math.round(f.y - Math.sin(u * Math.PI) * 10 - u * 14);
                g.rect(x - 2, y - 1, 5, 3, INK);
                g.rect(x - 1, y, 3, 1, 0xd8e0e8);
                g.px(x + 2, y + (Math.floor(f.t * 10) % 2), 0xa8b8c8);
            }
        for (const p of [...this.people].sort((a, b) => a.y - b.y)) {
            if (p.angler)
                this._drawAngler(g, p, env);
            else
                drawPerson(g, p, p.x, p.y, p.dir, env, p.state === 'walk' ? 'side' : 'up');
        }
    }

    _buoy(g, bx, c, dark) {
        const t = this.realT, by = this.Ws + 4 + Math.round(Math.sin(t * 1.3 + bx) * 0.7);
        g.rect(bx - 1, by - 6, 5, 7, INK);
        g.rect(bx, by - 5, 3, 5, c);
        g.px(bx + 1, by - 7, 0x3a3a44);
        if (dark && Math.floor(t * 0.8 + bx) % 3 === 0) {
            const lc = c === 0xd83a2a ? 0xff5040 : 0x50ff70;
            g.pxE(bx + 1, by - 8, lc);
            g.glow(bx + 1, by - 8, 5, lc, 0.4);
        }
    }

    _drawKiosk(g, env) {
        const [x, y, w, h] = this.hatch, open = this._kioskOpen(env);
        if (open) {
            g.rect(x, y, w, h, 0x5a4a3a);
            g.rect(x + 4, y + h - 6, w - 8, 4, 0xa8b8c8);
            for (let i = x + 6; i < x + w - 6; i += 6)
                g.rect(i, y + h - 7, 4, 2, i % 12 ? 0xd8e0e8 : 0xe89a6a);
            this._small(g, x + w / 2 - 2, y + h + 2, 0xf0f0f0, 0);
            g.rect(x + w / 2 - 6, y + 5, 12, 4, 0xf0f0f0);
        } else {
            for (let r = 0; r < h; r += 2)
                g.rect(x, y + r, w, 1, r % 4 ? 0x8a8a92 : 0x7a7a82);
        }
        if (env.lampsOn && open)
            g.blend(x, y, w, h, 0xffe8b0, 0.3, true);
    }

    _truck(g, tr) {
        const x = Math.round(tr.x), y = this.Yq - 1, f = tr.dir > 0;
        g.rect(x, y - 3, 40, 2, 0x3a3a44);
        for (const wx of [x + 3, x + 10, x + 30, x + 36])
            g.rect(wx, y - 1, 3, 2, 0x1a1a1e);
        const cx = f ? x + 32 : x;
        g.rect(cx, y - 9, 8, 7, INK);
        g.rect(cx + 1, y - 8, 6, 5, 0xe8e8e0);
        g.rect(f ? cx + 5 : cx + 1, y - 7, 2, 2, 0x6a9ac0);
        if (tr.c)
            this._box(g, f ? x + 1 : x + 9, y - 3 - CH, tr.c);
    }

    _rower(g, s) {
        const x = Math.round(s.x + s.L / 2), y = Math.round(s.y - 6), pull = Math.floor(this.realT * 1.5) % 2;
        this._small(g, x - 1, y, s.rower, 0, s.dir);
        g.line(x - 6, y - 4 + pull, x + 8, y + 5 - pull, 0xc8a070);
    }

    _drawWaves(g, env) {
        const W = this.w, t = this.realT, Y0 = this.horizon, Y1 = this.Yp;
        const br = env.weather.v.breeze, wind = env.weather.wind >= 0 ? 1 : -1;
        const n = Math.round(W * (Y1 - Y0) / 520);
        for (let i = 0; i < n; i++) {
            const y = Y0 + 2 + hash(i, 1, 21) % (Y1 - Y0 - 2), u = (y - Y0) / (Y1 - Y0);
            const ph = Math.sin(t * (0.8 + (i % 5) * 0.15) + i);
            if (ph < 0.55)
                continue;
            const sp = (2 + u * 8) * wind;
            const x = ((hash(i, 2, 21) % W) + t * sp + W * 10) % W;
            const len = 1 + Math.round(u * 5 * (ph - 0.4));
            const c = br > 0.75 && u > 0.4 && i % 7 === 0 ? 0xf0f6fa : mix(WATER[u < 0.5 ? 0 : 1], 0xffffff, 0.35);
            g.rect(Math.round(x), y, len, 1, c);
        }
    }

    // lights mirrored in the water as broken vertical streaks
    _drawReflections(g, env) {
        const t = this.realT;
        const streak = (x, y0, len, c, a) => {
            for (let k = 0; k < len; k += 2) {
                const dx = Math.round(Math.sin(t * 2.2 + k * 0.7 + x) * (1 + k / 12));
                g.blend(x + dx, y0 + k, 2, 1, c, a * (1 - k / len), true);
            }
        };
        if (env.lampsOn) {
            for (const lx of this.townLamps)
                streak(lx, this.Wm, 14, 0xffd890, 0.45);
            for (const lx of this.pontoonLamps)
                streak(lx, this.Yn + 8, 22, 0xffe0a0, 0.45);
            if (!this.berth.ship)
                for (const mx of this.masts)
                    streak(mx, this.Wm, 18, 0xfff4d8, 0.3);
        }
        const [lx] = this.lighthouse;
        if ((t / 6) % 1 < 0.12)
            streak(lx, this.moleY + 2, 12, 0xfff4c0, 0.5);
        for (const s of [this.berth.ship, this.ferry.state !== 'away' ? this.ferry.s : null, ...this.boats, ...this.tugs].filter(Boolean))
            if (s.lights)
                for (const [i] of s.lights.mast) {
                    const [x] = this._pt(s, i, 0, 0);
                    streak(x, Math.round(s.y) + 1, 12, 0xfff8e0, 0.35);
                }
    }
}
