// Airport in side view: the terminal with its glass front and jet bridges,
// the control tower, a hangar and a radar, the apron with planes at the
// gates, the taxiway and the runway, spotters at the fence in front.
// Planes land into the wind, roll out, taxi in and are unloaded, fuelled
// and catered; then they are pushed back, taxi out and take off. Nights
// are quiet but for the odd cargo flight; snow brings the ploughs.
import {rand, randi, chance, pick, weighted, clamp, steppedLevel} from './util.js';
import {mix} from './gfx.js';
import * as A from './art.js';
import {makePerson, drawPerson} from './people.js';
import {makePlane, drawPlane, AIRLINES, CARGO, PRIVATE} from './planes.js';
import {Timers} from './timers.js';

const INK = A.INK;
const hash = (x, y, s = 0) => ((((x + s * 131) * 73856093) ^ ((y - s * 71) * 19349663)) >>> 0) % 1000;
const sh = (c, t = 0.3) => mix(c, 0x2a1040, t);
const hi = (c, t = 0.3) => mix(c, 0xfff4d0, t);
const ASPHALT = 0x4a4a56, CONCRETE = 0xb4b2ac, MARK = 0xf0f0f0, YELLOW = 0xf0c030;
const VEST = [0xf08020, 0xe8e030];

export class Airport {
    constructor(w, h, env) {
        this.name = 'airport';
        this.w = w;
        this.h = h;
        this.timers = new Timers();
        this.layout(env);
    }

    // ---------- layout ----------

    layout(env) {
        const W = this.w, H = this.h;
        this.horizon = Math.round(H * 0.5);
        this.termBase = Math.round(H * 0.625);
        this.apronY = this.termBase + 26;
        this.taxiY = this.apronY + 20;
        this.rwyTop = this.taxiY + 10;
        this.rwyY = this.rwyTop + 17;
        this.rwyBot = this.rwyTop + 25;
        this.fenceY = H - 40;
        this.pathY = H - 6;
        // tower and radar on one side, the hangar on the other
        this.flip = chance(0.5);
        const side = (x, w) => (this.flip ? W - x - w : x);
        this.tower = {x: side(Math.round(W * 0.07), 34), w: 34};
        this.hangar = {x: side(W - Math.round(W * 0.2) - 6, Math.round(W * 0.2)), w: Math.round(W * 0.2)};
        this.radar = {x: side(Math.round(W * 0.025), 10) + 5};
        const t0 = Math.round(W * 0.15), t1 = W - Math.round(W * 0.24);
        this.term = {x: this.flip ? W - t1 : t0, w: t1 - t0};
        // behind the terminal: a hotel at one end, the car park at the other
        this.hotel = {x: this.flip ? this.term.x - 8 : this.term.x + this.term.w - 52, w: 60};
        this.garage = {x: this.flip ? this.term.x + this.term.w - 96 : this.term.x + 10, w: 110};
        this.garageCars = Array.from({length: 40}, () => (chance(0.75) ? pick([0xd84848, 0x4870c8, 0xe8c040, 0xf0eee6, 0x40404c, 0xb0b8c0, 0x58a060]) : 0));
        // the runway is used into the wind; the touchdown point and the
        // threshold are on the side the planes come from
        this.D = env.weather.wind > 0 ? -1 : 1;
        this.thrX = this.D > 0 ? Math.round(W * 0.06) : W - Math.round(W * 0.06);
        this.touchX = this.D > 0 ? Math.round(W * 0.22) : W - Math.round(W * 0.22);
        // gates along the terminal
        const n = Math.max(2, Math.floor(this.term.w / 200));
        this.gates = [];
        for (let i = 0; i < n; i++)
            this.gates.push({x: Math.round(this.term.x + this.term.w * (i + 0.5) / n), plane: null, ext: 0, name: 'A' + (i + 1)});
        this.masts = [this.term.x + 14, this.term.x + this.term.w - 14];
        this.planes = [];
        this.queue = [];
        this.inbound = [];
        this.fx = [];
        this.crew = [];
        this.plows = null;
        this.salute = null;
        this.realT = 0;
        this.arrT = rand(5, 20);
        this.eventTimer = rand(60, 160);
        this.signs = [];
        for (let x = rand(60, 120); x < W - 40; x += rand(150, 260))
            this.signs.push({x: Math.round(x), text: pick(['A', 'B', 'C', 'A1', 'B2', 'C3', 'D'])});
        this.windX = this.D > 0 ? Math.round(W * 0.42) : W - Math.round(W * 0.42);
        // spotters along the fence, walkers on the path
        this.people = [];
        const nSpot = Math.round(randi(4, 8) * env.people);
        for (let i = 0; i < nSpot; i++)
            this._spotter(env, rand(20, W - 40));
        this.benches = [];
        for (let x = rand(40, 120); x < W - 60; x += rand(220, 380))
            this.benches.push(Math.round(x));
        this.bushes = [];
        for (let x = rand(0, 30); x < W; x += rand(70, 160))
            this.bushes.push({x: Math.round(x), w: randi(14, 26), seed: randi(0, 1e6)});
        this.layerA = this.layerC = null;
        // hares live in the grass of every airfield
        this.hares = Array.from({length: randi(2, 4)}, () => ({x: rand(20, W - 20), y: rand(this.rwyBot + 10, this.fenceY - 6), dir: chance(0.5) ? 1 : -1, hop: 0, t: rand(5)}));
        // tufts in the grass between runway and fence
        this.tufts = A.makeTufts(A.tuftClumps(W * (this.fenceY - this.rwyBot) / 260, () => [randi(4, W - 4), randi(this.rwyBot + 6, this.fenceY - 4)],
            (x, y) => x > 3 && x < W - 4 && y > this.rwyBot + 4 && y < this.fenceY - 2 && Math.abs(x - this.windX) > 8), randi(0, 1e6));
        // the apron is busy from the start
        for (const gt of this.gates)
            if (chance(0.75))
                this._parkAt(gt, rand(0, 0.9));
    }

    _airliner(env) {
        const night = env.hour >= 23 || env.hour < 5.5;
        if (night && chance(0.7))
            return makePlane(chance(0.3) ? 'jumbo' : 'wide', CARGO);
        const type = weighted([['narrow', 6], ['wide', 2], ['regional', 3]]);
        return makePlane(type, pick(AIRLINES));
    }

    _parkAt(gt, phase) {
        const p = this._airliner({hour: 12});
        p.dir = -this.D;
        p.y = this.apronY;
        p.x = Math.round(gt.x - p.T.L / 2);
        p.state = 'parked';
        p.turn = rand(90, 200);
        p.age = p.turn * phase;
        p.gate = gt;
        gt.plane = p;
        gt.ext = 1;
        this.planes.push(p);
    }

    _spotter(env, x) {
        const p = makePerson(env, {kid: chance(0.15)});
        p.umbrella = null;
        p.balloon = null;
        p.x = Math.round(x);
        p.y = this.pathY - randi(0, 3);
        p.dir = chance(0.5) ? 1 : -1;
        p.state = 'wait';
        p.spot = true;
        p.tripod = !p.kid && chance(0.35);
        p.face = 'up';
        this.people.push(p);
    }

    // ---------- static layers ----------

    staticKey(env) {
        this.darkLevel = steppedLevel(env.dark, this.darkLevel, 4);
        this.wetLevel = steppedLevel(env.weather.wet, this.wetLevel, 1);
        return [this.darkLevel, env.lampsOn ? 1 : 0, Math.round(env.weather.snowCover * 4), this.wetLevel, env.season].join(':');
    }

    renderStatic(g, env) {
        if (!this.layerA) {
            this.layerA = g.layer();
            this.layerC = g.layer();
            this.scratch = g.layer();
        }
        this.layerA.fill(0);
        this.layerC.fill(0);
        g.into(this.layerA, () => {
            this._drawFar(g, env);
            this._drawHangar(g, env);
            this._drawTower(g, env);
            this._drawTerminal(g, env);
            this._drawApron(g, env);
            this._drawRunway(g, env);
            this._drawGrass(g, env);
        });
        g.into(this.layerC, () => this._drawFront(g, env));
        // planes look the same by day and night; drawn again only now and
        // then, when the static layers change
        for (const p of this.planes)
            p.sprites = {};
    }

    _snow(env) {
        return env.weather.snowCover > 0.3 ? env.weather.snowCover : 0;
    }

    // hazy hills and a far town on the horizon
    _drawFar(g, env) {
        const W = this.w, Y = this.horizon;
        const haze = mix(env.skyBottom ?? 0xa8c8e8, 0x8a9ab0, 0.35);
        for (let x = 0; x < W; x++) {
            const hgt = 10 + Math.round(8 * Math.sin(x * 0.006 + 1) + 5 * Math.sin(x * 0.021));
            g.rect(x, Y - hgt, 1, hgt + 1, haze);
        }
        const town = mix(haze, 0x6a7a90, 0.3);
        for (let x = 0; x < W;) {
            const bw = 6 + hash(x, 1, 3) % 14, bh = 6 + hash(x, 2, 3) % 22;
            if (hash(x, 3, 3) % 3)
                g.rect(x, Y - bh, bw, bh + 1, town);
            x += bw + hash(x, 4, 3) % 10;
        }
        const field = env.season === 'winter' && this._snow(env) ? 0xd8dce4 : {spring: 0x7aa85a, summer: 0x8aa85a, autumn: 0x9a9a5a, winter: 0x8a9a6a}[env.season];
        g.rect(0, Y, W, this.termBase - Y, field);
        for (let x = 0; x < W; x += 3) {
            const v = hash(x, 5, 9);
            if (v < 400)
                g.rect(x, Y - 2 - v % 4, 3, 3 + v % 4, sh(field, 0.25));
        }
    }

    _drawTower(g, env) {
        const t = this.tower, B = this.termBase, cx = t.x + t.w / 2;
        const shaftW = 12, top = Math.round(this.horizon - this.h * 0.33), cabH = 18;
        // the base building
        g.rect(t.x - 4, B - 22, t.w + 8, 22, INK);
        g.rect(t.x - 3, B - 21, t.w + 6, 21, 0xd8d4cc);
        g.rect(t.x - 3, B - 21, t.w + 6, 2, 0xa8a49c);
        for (let x = t.x; x < t.x + t.w; x += 6)
            g.rect(x, B - 15, 4, 5, 0x5a7a9a);
        // the shaft with a stripe of windows
        g.rect(cx - shaftW / 2 - 1, top + cabH, shaftW + 2, B - 21 - top - cabH, INK);
        g.rect(cx - shaftW / 2, top + cabH, shaftW, B - 21 - top - cabH, 0xe4e0d8);
        g.rect(cx - shaftW / 2, top + cabH, 2, B - 21 - top - cabH, 0xf4f0e8);
        g.rect(cx + shaftW / 2 - 2, top + cabH, 2, B - 21 - top - cabH, 0xb8b4ac);
        for (let y = top + cabH + 6; y < B - 26; y += 6)
            g.rect(cx - 1, y, 2, 3, 0x5a7a9a);
        // the cab: a wide ring under the cab, slanted glass, the roof
        g.rect(cx - 13, top + cabH, 26, 3, INK);
        g.rect(cx - 12, top + cabH, 24, 2, 0xc8c4bc);
        g.rect(cx - 16, top + 3, 32, cabH - 3, INK);
        for (let r = 0; r < cabH - 5; r++) {
            const inset = Math.round(r * 0.25);
            g.rect(cx - 15 + inset, top + 4 + r, 30 - inset * 2, 1, mix(0x3a5a7a, 0x6a9ac0, r / cabH));
        }
        for (let x = cx - 12; x < cx + 13; x += 6)
            g.rect(x, top + 4, 1, cabH - 6, 0x2a3a4a);
        g.blend(cx - 10, top + 5, 3, cabH - 8, 0xffffff, 0.25);
        this.cab = [cx - 14, top + 4, 28, cabH - 6];
        g.rect(cx - 17, top, 34, 4, INK);
        g.rect(cx - 16, top + 1, 32, 2, 0xe8e4dc);
        g.rect(cx - 6, top - 3, 12, 3, 0xb8b4ac);
        g.rect(cx, top - 14, 1, 11, 0x8a8a96);
        g.rect(cx - 3, top - 9, 7, 1, 0x8a8a96);
        this.beacon = [cx, top - 15];
        if (this._snow(env))
            g.rect(cx - 16, top, 32, 1, 0xf4f8ff);
    }

    _drawHangar(g, env) {
        const hg = this.hangar, B = this.termBase, x = hg.x, w = hg.w, h = Math.round(w * 0.38);
        // arched roof seen from the gable end, doors wide open
        for (let i = 0; i < w; i++) {
            const u = (i / (w - 1)) * 2 - 1, rh = Math.round(h * Math.sqrt(1 - u * u * 0.85));
            g.rect(x + i, B - rh - 1, 1, rh + 1, INK);
            g.rect(x + i, B - rh, 1, rh, i % 6 === 0 ? 0x9aa0a8 : 0xb8bec6);
            g.px(x + i, B - rh, 0xd8dee6);
        }
        const dx = x + 8, dw = w - 16, dh = Math.round(h * 0.62);
        g.rect(dx, B - dh, dw, dh, 0x2a2c36);
        for (let r = 0; r < dh; r++)
            g.rect(dx, B - dh + r, dw, 1, mix(0x1a1c24, 0x4a4c56, r / dh));
        // roof trusses and a row of lamps inside, the floor shining
        for (let k = dx + 6; k < dx + dw; k += 14) {
            g.line(k, B - dh, k + 7, B - dh + 6, 0x3a3c46);
            g.line(k + 7, B - dh + 6, k + 14, B - dh, 0x3a3c46);
        }
        g.rect(dx, B - dh + 6, dw, 1, 0x3a3c46);
        this.hangarLamps = [];
        for (let k = dx + 10; k < dx + dw - 6; k += 20) {
            g.rect(k - 2, B - dh + 7, 5, 2, 0xd8d8e0);
            this.hangarLamps.push([k, B - dh + 9]);
        }
        g.rect(dx, B - 4, dw, 4, 0x5a5c66);
        g.rect(dx, B - 4, dw, 1, 0x7a7c86);
        // a business jet in for service, only its front half in the light
        this.hangarDoor = [dx, B - dh, dw, dh];
        g.rect(dx, B - dh - 4, dw, 3, 0x6a7078);
        g.text('HANGAR 2', x + Math.round(w / 2 - 15), B - dh - 10, 0x2a3a5a);
        if (this._snow(env))
            for (let i = 0; i < w; i++) {
                const u = (i / (w - 1)) * 2 - 1, rh = Math.round(h * Math.sqrt(1 - u * u * 0.85));
                if (Math.abs(u) < 0.8)
                    g.px(x + i, B - rh, 0xf4f8ff);
            }
        // radar mast
        const rx = this.radar.x, top = B - 46;
        for (let y = top; y < B; y++) {
            const half = Math.round(1 + (y - top) * 0.08);
            g.px(rx - half, y, 0x6a6a76);
            g.px(rx + half, y, 0x6a6a76);
            if ((y - top) % 5 === 0)
                g.rect(rx - half, y, half * 2 + 1, 1, 0x8a8a96);
        }
        this.radar.top = top;
    }

    _drawTerminal(g, env) {
        const T = this.term, B = this.termBase, x = T.x, w = T.w, h = 74;
        const top = B - h;
        this._drawHotel(g, env);
        this._drawGarage(g, env);
        // service floor, arrivals behind glass, a tall departures hall and
        // a wavy steel roof over it all
        g.rect(x - 1, top - 1, w + 2, h + 1, INK);
        g.rect(x, B - 14, w, 14, 0xc8c4bc);
        g.rect(x, B - 14, w, 1, 0xe0dcd4);
        for (let gx = x + 6; gx < x + w - 10; gx += 26) {
            g.rect(gx, B - 11, 14, 11, 0x6a6e78);
            for (let r = 0; r < 11; r += 2)
                g.rect(gx, B - 11 + r, 14, 1, 0x7a7e88);
        }
        const glassBand = (gy, gh, c0, c1, step) => {
            for (let r = 0; r < gh; r++)
                g.rect(x, gy + r, w, 1, mix(c0, c1, r / gh));
            for (let gx = x; gx < x + w; gx += step)
                g.rect(gx, gy, 1, gh, 0x2a3a4a);
            for (let k = 0; k < w; k += 46)
                for (let r = 0; r < gh; r++)
                    g.blend(x + k + r, gy + r, 5, 1, 0xffffff, 0.14);
        };
        // arrivals
        const ay = B - 33;
        g.rect(x, ay - 2, w, 2, 0xd8d4cc);
        glassBand(ay, 19, 0x7aa8d0, 0x3a6a9a, 6);
        // departures hall with a floor line
        const dy = top + 9, dh = ay - 4 - dy;
        g.rect(x, ay - 4, w, 2, 0xe8e4dc);
        glassBand(dy, dh, 0x9ac8ec, 0x3a6a9a, 10);
        g.rect(x, dy + Math.round(dh * 0.55), w, 1, 0x2a3a4a);
        this.glass = [x, dy, w, dh];
        this.glass2 = [x, ay, w, 19];
        for (let i = -4; i < w + 4; i++) {
            const bump = Math.round(4 * Math.abs(Math.sin((i / w) * Math.PI * 3)));
            g.rect(x + i, top - bump - 1, 1, 10 + bump, INK);
            g.rect(x + i, top - bump, 1, 9 + bump, 0xd0d4dc);
            g.px(x + i, top - bump, 0xf0f4fa);
            g.px(x + i, top + 8, 0x8a8e98);
            if (i % 12 === 0)
                g.rect(x + i, top - bump + 2, 1, 6 + bump, 0xb0b4bc);
            if (this._snow(env))
                g.px(x + i, top - bump, 0xffffff);
        }
        // the name on the roof
        const name = 'AIRPORT';
        this.roofSign = [Math.round(x + w / 2 - g.textWidth(name, 2) / 2), top - 20, name];
        g.rect(this.roofSign[0] - 4, top - 23, g.textWidth(name, 2) + 8, 15, INK);
        g.rect(this.roofSign[0] - 3, top - 22, g.textWidth(name, 2) + 6, 13, 0x2a3a5a);
        g.text(name, this.roofSign[0], top - 20, 0xe8eef8, false, 2);
        // jet bridge rotundas and gate numbers
        for (const gt of this.gates) {
            const rx = gt.x + (this.D > 0 ? 34 : -34);
            gt.rot = rx;
            g.rect(rx - 7, B - 26, 14, 26, INK);
            g.rect(rx - 6, B - 25, 12, 25, 0xb8bcc4);
            g.rect(rx - 6, B - 25, 12, 2, 0xd8dce4);
            g.rect(rx - 6, B - 25, 2, 25, 0xc8ccd4);
            g.rect(rx - 6, ay - 4, g.textWidth(gt.name) + 4, 7, 0x2a3a5a);
            g.text(gt.name, rx - 4, ay - 3, 0xf0c030);
        }
    }

    _drawHotel(g, env) {
        const o = this.hotel, B = this.termBase - 30, x = o.x, w = o.w, top = this.horizon - Math.round(this.h * 0.2);
        g.rect(x - 1, top - 1, w + 2, B - top + 1, INK);
        g.rect(x, top, w, B - top, 0xe8dcc8);
        g.rect(x, top, 3, B - top, 0xf4ecdc);
        g.rect(x + w - 3, top, 3, B - top, 0xc8bca8);
        this.hotelWins = [];
        for (let y = top + 14; y < B - 6; y += 9)
            for (let wx = x + 6; wx < x + w - 6; wx += 8) {
                g.rect(wx, y, 5, 5, 0x3a5a7a);
                g.px(wx, y, 0x6a8aaa);
                this.hotelWins.push([wx, y]);
            }
        g.rect(x - 2, top - 4, w + 4, 4, 0xa89c88);
        g.rect(x + 8, top + 3, w - 16, 8, 0x8a2a3a);
        g.text('HOTEL', x + Math.round(w / 2 - 9), top + 4, 0xf8e8c0);
        this.hotelSign = [x + Math.round(w / 2 - 9), top + 4];
        void env;
    }

    _drawGarage(g, env) {
        const o = this.garage, B = this.termBase - 20, x = o.x, w = o.w, deck = 11, n = 8, top = B - deck * n;
        g.rect(x - 1, top - 3, w + 2, B - top + 3, INK);
        for (let k = 0; k < n; k++) {
            const y = top + k * deck;
            g.rect(x, y - 2, w, 3, 0xc8c4bc);
            g.rect(x, y + 1, w, deck - 1, 0x3a3a44);
            for (let c = 0; c < 10; c++) {
                const car = this.garageCars[(k * 10 + c) % this.garageCars.length];
                if (car) {
                    const cx = x + 4 + c * 11;
                    g.rect(cx, y + deck - 6, 9, 4, car);
                    g.rect(cx + 2, y + deck - 8, 5, 2, sh(car, 0.2));
                    g.px(cx + 3, y + deck - 8, 0x8ab0d0);
                }
            }
            for (let px = x; px < x + w; px += 22)
                g.rect(px, y + 1, 2, deck - 1, 0xb8b4ac);
        }
        g.rect(x + w - 16, top - 12, 12, 12, 0x2a5ad0);
        g.text('P', x + w - 11, top - 9, 0xffffff);
        void env;
    }

    _drawApron(g, env) {
        const W = this.w, B = this.termBase, y1 = this.taxiY + 6, snow = this._snow(env);
        g.rect(0, B, W, this.taxiY - 6 - B, CONCRETE);
        for (let y = B + 6; y < this.taxiY - 6; y += 7)
            g.rect(0, y, W, 1, sh(CONCRETE, 0.12));
        for (let x = 0; x < W; x += 28)
            g.rect(x + ((x / 28) % 2 ? 0 : 14), B, 1, this.taxiY - 6 - B, sh(CONCRETE, 0.1));
        for (let i = 0; i < 40; i++) {
            const x = hash(i, 1, 4) % W, y = B + 3 + hash(i, 2, 4) % (this.taxiY - B - 10);
            g.rect(x, y, 3 + i % 4, 1, sh(CONCRETE, 0.22));
        }
        // lead-in lines, stop bars and the red safety line
        for (const gt of this.gates) {
            for (let k = 0; k < 18; k++) {
                const u = k / 17, lx = Math.round(gt.x - this.D * (60 - 60 * Math.sin(u * Math.PI / 2))), ly = Math.round(this.taxiY - 6 - u * (this.taxiY - 8 - this.apronY));
                g.rect(lx, ly, 3, 1, YELLOW);
            }
            g.rect(gt.x - 20, this.apronY + 2, 40, 1, YELLOW);
        }
        g.rect(0, B + 3, W, 1, 0xd04040);
        // floodlight masts between the gates
        for (const mx of this.masts) {
            g.rect(mx - 1, B - 50, 3, 52, INK);
            g.rect(mx, B - 50, 1, 52, 0x9a9aa6);
            g.rect(mx - 5, B - 53, 11, 4, INK);
            g.rect(mx - 4, B - 52, 9, 2, 0xd8d8e0);
        }
        // taxiway with its yellow center line
        g.rect(0, this.taxiY - 6, W, 11, ASPHALT);
        g.rect(0, this.taxiY - 6, W, 1, sh(ASPHALT, 0.2));
        g.rect(0, this.taxiY - 1, W, 1, YELLOW);
        for (let x = 0; x < W; x += 24) {
            g.rect(x, this.taxiY - 7, 1, 2, 0x5a5a66);
            g.rect(x + 12, this.taxiY + 5, 1, 2, 0x5a5a66);
        }
        if (snow)
            for (let x = 0; x < W; x += 2)
                if (hash(x, 7, 2) % 3)
                    g.px(x, this.taxiY - 6, 0xf4f8ff);
        // a strip of grass with taxiway signs
        g.rect(0, this.taxiY + 5, W, this.rwyTop - this.taxiY - 5, snow ? 0xe8eef8 : A.GRASS[env.season][2]);
        for (const s of this.signs) {
            const tw = g.textWidth(s.text) + 4;
            g.rect(s.x - 1, this.taxiY + 2, tw + 2, 7, INK);
            g.rect(s.x, this.taxiY + 3, tw, 5, YELLOW);
            g.text(s.text, s.x + 2, this.taxiY + 3, 0x1a1a1a);
        }
        void y1;
    }

    _drawRunway(g, env) {
        const W = this.w, y0 = this.rwyTop, y1 = this.rwyBot, snow = this._snow(env);
        g.rect(0, y0, W, y1 - y0, ASPHALT);
        for (let i = 0; i < W * 3; i++) {
            const x = hash(i, 1, 6) % W, y = y0 + 1 + hash(i, 2, 6) % (y1 - y0 - 2);
            g.px(x, y, i % 2 ? sh(ASPHALT, 0.15) : hi(ASPHALT, 0.08));
        }
        // rubber where the wheels come down
        for (let i = 0; i < 90; i++) {
            const x = this.touchX + this.D * (hash(i, 3, 6) % 160), y = this.rwyY - 5 + hash(i, 4, 6) % 8;
            g.rect(x, y, 2 + i % 4, 1, sh(ASPHALT, 0.28));
        }
        g.rect(0, y0 + 1, W, 1, MARK);
        g.rect(0, y1 - 2, W, 1, MARK);
        const cy = Math.round((y0 + y1) / 2);
        for (let x = 0; x < W; x += 24)
            g.rect(x, cy, 12, 1, MARK);
        // threshold bars, the number, touchdown markings
        const tx = this.thrX, d = this.D;
        for (let k = 0; k < 8; k++)
            g.rect(tx + d * k * 4, y0 + 3, 2, y1 - y0 - 6, MARK);
        const num = d > 0 ? '09' : '27';
        g.text(num, tx + d * 44 - (d > 0 ? 0 : 15), y0 + 6, MARK, false, 2);
        for (let k = 0; k < 4; k++) {
            const mx = this.touchX + d * k * 40;
            g.rect(mx, y0 + 4, 14, 2, MARK);
            g.rect(mx, y1 - 6, 14, 2, MARK);
        }
        // edge light fittings
        for (let x = 6; x < W; x += 20) {
            g.px(x, y0, 0x8a8a96);
            g.px(x, y1, 0x8a8a96);
        }
        if (env.weather.wet > 0.5)
            for (let x = 0; x < W; x += 2)
                if (hash(x, 9, 1) % 4 === 0)
                    g.blend(x, y0 + 3 + hash(x, 8, 1) % (y1 - y0 - 6), 6, 1, 0xa0b0c8, 0.25);
        if (snow)
            for (let x = 0; x < W; x++) {
                g.px(x, y0, 0xf4f8ff);
                if (hash(x, 5, 5) % 2)
                    g.px(x, y1 - 1, 0xf0f4fc);
            }
    }

    _drawGrass(g, env) {
        const W = this.w, y0 = this.rwyBot, snow = this._snow(env);
        if (snow) {
            // drifts with blue shadows and a few stalks poking through
            g.rect(0, y0, W, this.h - y0, 0xeef2fa);
            for (let y = y0 + 2; y < this.h; y += 3)
                for (let x = (y * 7) % 13; x < W; x += 13) {
                    const v = hash(x, y, 21);
                    if (v < 300)
                        g.rect(x, y, 4 + v % 9, 1, v % 2 ? 0xd8e0f0 : 0xffffff);
                    else if (v > 960)
                        g.rect(x, y - 2, 1, 3, 0x8a8a6a);
                }
        } else
            A.grass(g, 0, y0, W, this.h - y0, env.season, 17);
        // the glide path antenna and a row of approach lights
        const ax = this.touchX - this.D * 30;
        g.rect(ax, y0 + 2, 1, 16, 0x8a8a96);
        g.rect(ax - 2, y0 + 2, 5, 3, 0xd84040);
        g.rect(ax - 2, y0 + 8, 5, 3, 0xf0f0f0);
        this.approach = [];
        for (let k = 1; k <= 5; k++) {
            const lx = this.thrX - this.D * k * 12;
            if (lx < 2 || lx > W - 3)
                continue;
            g.rect(lx, this.rwyY - 2, 1, 6, 0x6a6a76);
            g.rect(lx - 2, this.rwyY - 3, 5, 1, 0x8a8a96);
            this.approach.push(lx);
        }
        // windsock pole
        g.rect(this.windX - 1, y0 + 4, 3, 34, INK);
        g.rect(this.windX, y0 + 4, 1, 34, 0xe8e8f0);
        g.rect(this.windX - 3, y0 + 36, 7, 3, 0x8a8a96);
    }

    _drawFront(g, env) {
        const W = this.w, F = this.fenceY, snow = this._snow(env);
        // gravel path for the spotters
        g.rect(0, F + 2, W, this.h - F - 2, snow ? 0xe0e4ec : 0xc8b898);
        for (let i = 0; i < W * 2; i++) {
            const x = hash(i, 1, 8) % W, y = F + 3 + hash(i, 2, 8) % (this.h - F - 3);
            g.px(x, y, i % 3 ? 0xa89878 : 0xe0d4b8);
        }
        // chain-link fence with posts and barbed wire on angled arms
        const top = F - 26;
        for (let x = 0; x < W; x++) {
            for (let y = top + 4; y < F; y++)
                if ((x + y) % 4 === 0 || (x - y + 400) % 4 === 0)
                    g.px(x, y, 0x9aa0a8);
        }
        g.rect(0, top + 4, W, 1, 0xb8bec6);
        g.rect(0, F - 1, W, 1, 0x8a9098);
        for (let x = 8; x < W; x += 30) {
            g.rect(x - 1, top, 3, F - top + 2, INK);
            g.rect(x, top, 1, F - top + 2, 0xc8ced6);
            g.rect(x, top - 3, 1, 3, 0x9aa0a8);
            g.px(x + 1, top - 4, 0x9aa0a8);
        }
        for (const wy of [top - 2, top + 1])
            for (let x = 0; x < W; x++)
                g.px(x, wy + (x % 6 === 0 ? -1 : 0), x % 6 === 0 ? 0x6a7078 : 0x9aa0a8);
        // bushes planted along the visitors' side
        for (const b of this.bushes)
            A.bush(g, b.x, F + 4, b.w, A.leafRamp(env.season), b.seed);
        // benches and a sign
        for (const bx of this.benches) {
            g.rect(bx - 1, F + 14, 28, 4, INK);
            g.rect(bx, F + 15, 26, 2, 0x9a6a3a);
            g.rect(bx + 2, F + 18, 2, 6, 0x5a5a62);
            g.rect(bx + 22, F + 18, 2, 6, 0x5a5a62);
        }
        const sx = this.D > 0 ? W - 90 : 40;
        g.rect(sx - 1, F - 46, 52, 18, INK);
        g.rect(sx, F - 45, 50, 16, 0x2a5a9a);
        g.text('SPOTTER', sx + 11, F - 43, 0xffffff);
        g.text('POINT', sx + 15, F - 36, 0xf0c030);
        g.rect(sx + 24, F - 28, 2, 30, 0x8a8a96);
    }

    // ---------- planes ----------

    // the plane's sprite for its direction, gear and pitch step; built
    // unlit through the scratch layer and sheared for the climb
    _sprite(g, p) {
        const k = Math.round(p.pitch * 40), key = `${p.dir}:${p.gear ? 1 : 0}:${k}`;
        let s = p.sprites[key];
        if (s)
            return s;
        const base = `${p.dir}:${p.gear ? 1 : 0}:0`;
        let b = p.sprites[base];
        if (!b) {
            const OX = 60, OY = 150, L = p.T.L;
            g.unlit(() => {
                b = g.masked(null, this.scratch, [OX - 6, OY - 90, L + 12, 100], () => {
                    p.lights = drawPlane(g, p, OX, OY, p.dir, p.gear);
                });
            });
            b.ox = b.box[0] - OX;
            b.oy = b.box[1] - OY;
            p.sprites[base] = b;
        }
        if (!k)
            return b;
        // shear the columns about the main gear
        const [, , bw, bh] = b.box, pivot = (p.dir > 0 ? p.lights.main : p.T.L - 1 - p.lights.main) - b.ox;
        const off = c => -Math.round(p.dir * (c - pivot) * k / 40);
        let lo = 0, hiO = 0;
        for (let c = 0; c < bw; c++) {
            lo = Math.min(lo, off(c));
            hiO = Math.max(hiO, off(c));
        }
        const nh = bh + hiO - lo, px = new Uint32Array(bw * nh), mask = new Uint8Array(bw * nh);
        for (let c = 0; c < bw; c++) {
            const o = off(c) - lo;
            for (let r = 0; r < bh; r++) {
                const v = b.px[r * bw + c];
                if (v) {
                    px[(r + o) * bw + c] = v;
                    mask[(r + o) * bw + c] = 1;
                }
            }
        }
        s = {box: [0, 0, bw, nh], px, mask, ox: b.ox, oy: b.oy + lo};
        p.sprites[key] = s;
        return s;
    }

    // a point of the plane (facing-right frame, relative to x0/base) on screen
    _pt(p, [i, dy]) {
        const L = p.T.L, col = p.dir > 0 ? i : L - 1 - i, pivot = p.dir > 0 ? p.lights.main : L - 1 - p.lights.main;
        return [Math.round(p.x) + col, Math.round(p.y) + dy - Math.round(p.dir * (col - pivot) * Math.round(p.pitch * 40) / 40)];
    }

    _drawPlane(g, p, env) {
        const s = this._sprite(g, p);
        s.box[0] = Math.round(p.x) + s.ox;
        s.box[1] = Math.round(p.y) + s.oy;
        if (p.y >= this.termBase && p.state !== 'approach' && p.state !== 'climb')
            g.footShadow(Math.round(p.x + p.T.L / 2), Math.round(p.y) + 1, p.T.L * 0.8, 0.3);
        else if (p.state === 'approach' || p.state === 'climb') {
            // its shadow races over the ground below
            const gy = p.state === 'approach' ? this.rwyY + 1 : this.rwyY + 1;
            const a = clamp(0.3 - (gy - p.y) / 300, 0, 0.3);
            if (a > 0.02)
                g.footShadow(Math.round(p.x + p.T.L / 2), gy, p.T.L * 0.7, a);
        }
        g.drawSprite(s);
        this._planeLights(g, p, env);
    }

    _planeLights(g, p, env) {
        const lt = p.lights, t = this.realT + p.t, dark = env.dark > 0.45;
        if (!lt)
            return;
        // propellers turn whenever the engines run
        for (const [i, dy, r] of lt.props) {
            const [x, y] = this._pt(p, [i, dy]);
            if (p.engines > 0.5) {
                for (let k = -r; k <= r; k++)
                    g.blend(x, y + k, 1, 1, 0xe0e4ec, 0.35);
            } else {
                g.rect(x, y - r, 1, r * 2 + 1, 0x3a3a44);
            }
            g.px(x, y, 0x8a8a96);
        }
        if (dark && !p.liv.noWindows && p.engines + (p.state === 'parked' ? 1 : 0) > 0)
            for (const w of lt.windows) {
                const [x, y] = this._pt(p, w);
                g.pxE(x, y, 0xffe0a0);
            }
        if (dark && lt.logo) {
            const [x, y] = this._pt(p, lt.logo);
            g.glow(x, y, 9, 0xffffff, 0.12);
        }
        if (lt.nav && (dark || p.engines > 0)) {
            const [x, y] = this._pt(p, lt.nav);
            const c = p.dir > 0 ? 0x30ff60 : 0xff3030;
            g.pxE(x, y, c);
            if (dark)
                g.glow(x, y, 3, c, 0.3);
        }
        if (p.engines > 0 && Math.floor(t * 1.2) % 2 === 0 && (t * 1.2) % 1 < 0.15)
            for (const b of lt.beacon) {
                const [x, y] = this._pt(p, b);
                g.pxE(x, y, 0xff3020);
                g.glow(x, y, 4, 0xff3020, 0.35);
            }
        const air = p.state === 'approach' || p.state === 'climb' || p.state === 'takeoff' || p.state === 'rollout';
        if (air && (t * 1.1) % 1 < 0.08)
            for (const st of lt.strobe) {
                const [x, y] = this._pt(p, st);
                g.pxE(x, y, 0xffffff);
                g.glow(x, y, 5, 0xffffff, 0.4);
            }
        // landing and taxi lights, with a beam at night
        if (p.engines > 0 && p.state !== 'parked' && p.state !== 'push') {
            const land = air;
            for (const l of land ? lt.land : lt.land.slice(-1)) {
                const [x, y] = this._pt(p, l);
                g.pxE(x, y, 0xfff8e0);
                if (dark || land) {
                    g.glow(x, y, land ? 6 : 3, 0xfff0c0, dark ? 0.4 : 0.2);
                    if (dark)
                        for (let i = 2; i < 40; i++)
                            g.add(x + p.dir * i, y - i * (p.pitch * 0.6) + i * 0.08, 1, 1 + i * 0.2, 0xfff0c0, 0.16 * (1 - i / 40));
                }
            }
        }
    }

    _free(gt) {
        return !gt.plane;
    }

    _arrive(env, plane) {
        const p = plane || this._airliner(env);
        p.dir = this.D;
        p.state = 'approach';
        p.speed = p.T.L < 50 ? 34 : p.T.L < 90 ? 48 : 58;
        p.engines = 1;
        p.gear = 1;
        p.pitch = 0.03;
        p.x = this.D > 0 ? -p.T.L - 20 : this.w + 20;
        p.y = this.rwyY - 80;
        p.age = 0;
        this.planes.push(p);
        return p;
    }

    _runwayBusy() {
        return this.planes.some(p => ['approach', 'rollout', 'takeoff', 'climb', 'lineup'].includes(p.state));
    }

    _main(p) {
        return p.x + (p.dir > 0 ? p.lights?.main ?? p.T.L * 0.4 : p.T.L - 1 - (p.lights?.main ?? p.T.L * 0.4));
    }

    _updatePlane(p, real, env) {
        const W = this.w, L = p.T.L;
        p.age = (p.age || 0) + real;
        const off = () => p.x > W + 40 || p.x + L < -40;
        switch (p.state) {
        case 'approach': {
            p.x += p.dir * p.speed * real;
            const d = (this.touchX - this._main(p)) * p.dir;
            const h = Math.max(0, d * 0.3);
            p.y = this.rwyY - h;
            p.pitch = h < 10 ? 0.07 : 0.02;
            if (p.goAround && h < 22) {
                p.state = 'climb';
                p.climbV = 0;
            } else if (d <= 0) {
                p.state = 'rollout';
                p.y = this.rwyY;
                for (let i = 0; i < 10; i++)
                    this.fx.push({kind: 'smoke', x: this._main(p) + rand(-4, 4), y: this.rwyY - rand(0, 4), vx: -p.dir * rand(4, 14), vy: rand(-4, -1), life: rand(1, 2)});
            }
            break;
        }
        case 'rollout':
            p.pitch = Math.max(0, p.pitch - real * 0.08);
            p.speed = Math.max(14, p.speed - real * (p.T.L < 50 ? 10 : 7));
            p.x += p.dir * p.speed * real;
            if (env.weather.wet > 0.5 && Math.random() < real * 30)
                this.fx.push({kind: 'spray', x: this._main(p), y: this.rwyY - 1, vx: -p.dir * rand(10, 25), vy: rand(-8, -2), life: rand(0.4, 0.9)});
            if (off()) {
                p.state = 'away';
                // back along the taxiway a little later, to a free gate
                const gt = p.T.L > 70 && !p.liv.noWindows ? this.gates.find(gg => this._free(gg)) : null;
                if (gt)
                    gt.plane = p;
                this.timers.add(rand(6, 14), () => {
                    p.state = gt ? 'taxiIn' : 'taxiPass';
                    p.gate = gt;
                    p.dir = -this.D;
                    p.speed = 12;
                    p.y = this.taxiY;
                    p.x = p.dir < 0 ? W + 10 : -L - 10;
                    p.sprites = {};
                });
            }
            break;
        case 'taxiIn': {
            const tx = p.gate.x - L / 2;
            p.x += p.dir * 12 * real;
            if ((tx - p.x) * p.dir <= 30) {
                p.state = 'dock';
                p.dockFrom = p.x;
            }
            break;
        }
        case 'dock': {
            // a slow turn in: along the lead-in line up to the stop bar
            const tx = p.gate.x - L / 2;
            p.x += Math.sign(tx - p.x) * Math.min(Math.abs(tx - p.x), 8 * real);
            p.y = Math.max(this.apronY, p.y - 3.2 * real);
            if (p.y <= this.apronY && Math.abs(tx - p.x) < 0.5) {
                p.state = 'parked';
                p.age = 0;
                p.turn = rand(90, 200);
                this.timers.add(4, () => {
                    p.engines = 0;
                });
            }
            break;
        }
        case 'parked': {
            const gt = p.gate;
            gt.ext = Math.min(1, gt.ext + real * 0.25);
            if (p.age > p.turn) {
                gt.ext = Math.max(0, gt.ext - real * 0.5);
                if (gt.ext <= 0 && !this.planes.some(q => q.state === 'push')) {
                    p.state = 'push';
                    p.engines = 0.6;
                }
            }
            break;
        }
        case 'push':
            p.y = Math.min(this.taxiY, p.y + 2.4 * real);
            if (p.y >= this.taxiY) {
                p.state = 'taxiOut';
                p.engines = 1;
                p.gate.plane = null;
                p.gate = null;
            }
            break;
        case 'taxiOut':
        case 'taxiPass':
            p.x += p.dir * 12 * real;
            if (off()) {
                if (p.state === 'taxiOut') {
                    p.state = 'holding';
                    this.queue.push(p);
                } else {
                    p.state = 'done';
                }
            }
            break;
        case 'takeoff':
            p.speed = Math.min(95, p.speed + real * (p.T.L < 50 ? 8 : 11));
            p.x += p.dir * p.speed * real;
            if (p.speed > 52)
                p.pitch = Math.min(0.14, p.pitch + real * 0.07);
            if (p.speed > 60 && p.pitch > 0.08) {
                p.state = 'climb';
                p.climbV = 0;
            }
            break;
        case 'climb':
            p.speed = Math.min(100, p.speed + real * 6);
            p.pitch = Math.min(0.16, p.pitch + real * 0.04);
            p.x += p.dir * p.speed * real;
            p.climbV = Math.min(p.speed * 0.26, (p.climbV || 0) + real * 8);
            p.y -= p.climbV * real;
            if (p.gear && this.rwyY - p.y > 26) {
                p.gear = 0;
            }
            if (off() || p.y < -60)
                p.state = 'done';
            break;
        }
    }

    // ---------- people and events ----------

    _updatePeople(real, env) {
        const W = this.w;
        for (const p of this.people) {
            p.t += real;
            if (p.spot) {
                // spotters turn their cameras on anything on the runway
                const busy = this.planes.some(q => (q.state === 'takeoff' || q.state === 'climb' || q.state === 'approach' || q.state === 'rollout') && Math.abs(q.x + q.T.L / 2 - p.x) < 200);
                p.shoot = busy;
                continue;
            }
            p.x += p.dir * p.speed * real;
        }
        this.people = this.people.filter(p => p.spot || (p.x > -40 && p.x < W + 40));
        // now and then somebody walks by
        if (Math.random() < real / 25 * env.people && this.people.filter(p => !p.spot).length < 4) {
            const p = makePerson(env);
            p.dir = chance(0.5) ? 1 : -1;
            p.x = p.dir > 0 ? -20 : W + 20;
            p.y = this.pathY - randi(4, 8);
            p.state = 'walk';
            this.people.push(p);
        }
    }

    trigger(name, env, ctx) {
        switch (name) {
        case 'jumbo':
            this.inbound.push(makePlane('jumbo', pick(AIRLINES)));
            break;
        case 'cargo':
            this.inbound.push(makePlane('wide', CARGO));
            break;
        case 'bizjet':
            this.inbound.push(makePlane('bizjet', pick(PRIVATE)));
            break;
        case 'cessna':
            this.inbound.push(makePlane('cessna', pick(PRIVATE)));
            break;
        case 'goaround': {
            const p = this._airliner(env);
            p.goAround = true;
            this.inbound.push(p);
            break;
        }
        case 'salute': {
            // two fire engines spray an arch of water over a taxiing plane
            const p = this.planes.find(q => q.state === 'taxiIn') || null;
            this.salute = {t: 0, x: p ? p.gate.x : this.w / 2};
            break;
        }
        case 'plow':
            this.plows = {x: this.D > 0 ? -60 : this.w + 60, dir: this.D};
            break;
        case 'fireworks':
            for (let i = 0; i < randi(6, 12); i++)
                this.timers.add(i * rand(0.6, 1.5), () => ctx.sky.firework());
            break;
        }
    }

    _pickEvent(env) {
        const day = env.dark < 0.5, h = env.hour;
        return weighted([
            ['jumbo', day ? 0.8 : 0.2], ['cargo', h < 6 || h > 22 ? 2 : 0.3], ['bizjet', day ? 1 : 0.2],
            ['cessna', day && env.weather.v.rain < 0.2 ? 1.2 : 0], ['goaround', 0.5 + env.weather.v.breeze * 0.5],
            ['salute', day ? 0.3 : 0], ['plow', this._snowing(env) ? 3 : 0],
            ['fireworks', env.holidays.newYear && env.dark > 0.5 ? 3 : 0],
        ]);
    }

    _snowing(env) {
        return env.weather.snowCover > 0.3 || env.weather.v.snow > 0.3;
    }

    // seconds between landings: busy mornings and evenings, quiet nights
    _interval(env) {
        const h = env.hour, V = Math.max(0.2, env.traffic);
        const base = h >= 23 || h < 5.5 ? 600 : (h >= 6 && h < 10) || (h >= 16 && h < 21) ? 40 : h >= 21 ? 110 : 65;
        return base * rand(0.7, 1.4) / V;
    }

    update(dt, real, env, ctx) {
        this.realT += real;
        this.timers.run(real);
        for (const p of this.planes)
            this._updatePlane(p, real, env);
        this.planes = this.planes.filter(p => p.state !== 'done');
        // the runway: departures in the queue go first when nothing lands
        this.arrT -= real;
        if (!this._runwayBusy()) {
            const next = this.queue[0];
            if (next && (this.arrT > 12 || chance(0.5))) {
                this.queue.shift();
                next.dir = this.D;
                next.state = 'takeoff';
                next.speed = 24;
                next.pitch = 0;
                next.gear = 1;
                next.y = this.rwyY;
                next.x = this.D > 0 ? -next.T.L - 10 : this.w + 10;
                next.sprites = {};
            } else if (this.inbound.length) {
                this._arrive(env, this.inbound.shift());
            } else if (this.arrT <= 0) {
                this.arrT = this._interval(env);
                this._arrive(env);
            }
        }
        for (const f of this.fx) {
            f.x += f.vx * real;
            f.y += f.vy * real;
            f.vy += (f.kind === 'water' ? 30 : -1) * real;
            f.life -= real;
        }
        this.fx = this.fx.filter(f => f.life > 0);
        if (this.salute) {
            this.salute.t += real;
            if (this.salute.t > 30)
                this.salute = null;
            else if (this.salute.t > 4 && this.salute.t < 24)
                for (const s of [-1, 1])
                    if (Math.random() < real * 40)
                        this.fx.push({kind: 'water', x: this.salute.x + s * 70, y: this.taxiY - 14, vx: -s * rand(26, 34), vy: rand(-48, -40), life: rand(2.4, 2.8)});
        }
        if (this.plows) {
            this.plows.x += this.plows.dir * 26 * real;
            if (this.plows.x > this.w + 200 || this.plows.x < -200)
                this.plows = null;
        }
        this._updatePeople(real, env);
        this._updateHares(real);
        this.eventTimer -= real;
        if (this.eventTimer <= 0) {
            this.eventTimer = rand(80, 220);
            this.trigger(this._pickEvent(env), env, ctx);
        }
        if (env.holidays.newYear && env.dark > 0.5 && Math.random() < real * 1.2)
            ctx.sky.firework();
    }

    // ---------- dynamic rendering ----------

    renderDynamic(g, env) {
        const t = this.realT, dark = env.dark > 0.45, lamps = env.lampsOn;
        // hotel rooms light up one by one in the evening
        if (lamps) {
            const late = env.hour > 23 || env.hour < 6;
            this.hotelWins.forEach(([wx, wy], i) => {
                if (hash(i, Math.floor(env.hour * 2), 5) % 100 < (late ? 15 : 55))
                    g.rectE(wx, wy, 5, 5, hash(i, 2, 5) % 3 ? 0xffd890 : 0xc8e0ff);
            });
            g.text('HOTEL', this.hotelSign[0], this.hotelSign[1], 0xfff0c0, true);
        }
        // people in the terminal halls, lit at night
        const [gx, gy, gw, gh] = this.glass;
        if (lamps) {
            for (let k = 0; k < gw; k += 10)
                g.blend(gx + k + 1, gy, 9, gh, 0xffe8b0, 0.16 + (hash(k, 1, 3) % 3) * 0.06, true);
            const [ax, ay, aw, ah] = this.glass2;
            for (let k = 0; k < aw; k += 6)
                g.blend(ax + k + 1, ay, 5, ah, 0xffe8b0, 0.14 + (hash(k, 2, 3) % 3) * 0.05, true);
        }
        for (let i = 0; i < Math.round(gw / 14); i++) {
            const sp = (hash(i, 1, 2) % 2 ? 1 : -1) * (3 + hash(i, 2, 2) % 6);
            const x = gx + ((hash(i, 3, 2) + t * sp) % gw + gw) % gw, floor = hash(i, 4, 2) % 2;
            const y = gy + (floor ? gh - 1 : Math.round(gh / 2) - 1);
            const c = lamps ? 0x3a2a3a : 0x1a2a4a;
            g.rect(Math.floor(x), y - 5, 2, 5, c);
            g.px(Math.floor(x), y - 6, c);
        }
        if (lamps) {
            const [sx, sy, txt] = this.roofSign;
            g.text(txt, sx, sy, 0xfff4d0, true, 2);
            g.glow(sx + g.textWidth(txt, 2) / 2, sy + 4, 30, 0xfff0c0, 0.12, 0.35);
            const [cx, cy, cw, ch] = this.cab;
            g.blend(cx, cy, cw, ch, 0x80ffb0, 0.3, true);
            for (const mx of this.masts)
                g.glow(mx, this.termBase - 50, 16, 0xfff0c0, 0.3);
            const [hx, hy, hw, hh] = this.hangarDoor;
            g.blend(hx, hy, hw, hh, 0xfff0d0, 0.25, true);
        }
        // the hangar guest: a business jet nose in the light
        this._renderHangarJet(g, env);
        // tower beacon: white and green flashes
        if (dark) {
            const ph = (t * 0.8) % 1;
            if (ph < 0.1 || (ph > 0.5 && ph < 0.6)) {
                const c = ph < 0.1 ? 0xffffff : 0x40ff80;
                g.pxE(this.beacon[0], this.beacon[1], c);
                g.glow(this.beacon[0], this.beacon[1], 8, c, 0.45);
            }
        }
        // radar antenna turning
        {
            const w = Math.round(Math.abs(Math.cos(t * 1.3)) * 7) + 1, rx = this.radar.x, ry = this.radar.top - 3;
            g.rect(rx - w, ry, w * 2 + 1, 3, INK);
            g.rect(rx - w + 1, ry + 1, w * 2 - 1, 1, 0xd8d8e0);
            g.rect(rx, ry + 3, 1, 2, 0x6a6a76);
        }
        // apron: jet bridges, planes at the gates and their service
        for (const p of this.planes)
            if (!p.lights)
                this._sprite(g, p);
        const apron = this.planes.filter(p => p.y < this.taxiY - 0.5 && p.y >= this.apronY - 0.5 && p.state !== 'approach' && p.state !== 'climb');
        for (const gt of this.gates)
            this._renderBridge(g, gt, env);
        for (const p of apron.sort((a, b) => a.y - b.y)) {
            this._drawPlane(g, p, env);
            if (p.state === 'parked' || p.state === 'push')
                this._renderService(g, p, env);
            if (p.state === 'dock')
                this._marshaller(g, p);
        }
        // taxiway
        for (const p of this.planes)
            if (p.y >= this.taxiY - 0.5 && p.y < this.rwyTop && p.state !== 'approach' && p.state !== 'climb')
                this._drawPlane(g, p, env);
        if (this.salute)
            this._renderSalute(g);
        // runway lights, approach lights
        if (dark || env.weather.v.fog > 0.4) {
            for (let x = 6; x < this.w; x += 20) {
                g.pxE(x, this.rwyTop, 0xfff4e0);
                g.pxE(x, this.rwyBot, 0xfff4e0);
            }
            for (let x = 0; x < this.w; x += 24) {
                g.pxE(x, this.taxiY - 7, 0x4080ff);
                g.pxE(x + 12, this.taxiY + 5, 0x4080ff);
            }
            for (let k = 0; k < 6; k++)
                g.pxE(this.thrX + this.D * k * 4, this.rwyTop + 2 + k * 3, 0x40ff60);
            const n = this.approach.length, step = Math.floor(t * 8) % (n + 3);
            this.approach.forEach((lx, k) => {
                g.rectE(lx - 2, this.rwyY - 3, 5, 1, 0xfff4e0);
                if (n - 1 - k === step) {
                    g.pxE(lx, this.rwyY - 4, 0xffffff);
                    g.glow(lx, this.rwyY - 4, 8, 0xffffff, 0.5);
                }
            });
        }
        if (this.plows)
            this._renderPlows(g, env);
        // the runway and the sky
        for (const p of this.planes)
            if (p.state === 'approach' || p.state === 'climb' || p.state === 'rollout' || p.state === 'takeoff')
                this._drawPlane(g, p, env);
        for (const f of this.fx) {
            if (f.kind === 'smoke')
                g.blend(Math.round(f.x), Math.round(f.y), 3, 2, 0xe0e0e8, Math.min(0.6, f.life * 0.4));
            else if (f.kind === 'spray')
                g.blend(Math.round(f.x), Math.round(f.y), 2, 1, 0xe8f0ff, Math.min(0.6, f.life));
            else
                g.blend(Math.round(f.x), Math.round(f.y), 1, 2, 0xc0e0ff, 0.7);
        }
        for (const hr of this.hares)
            this._renderHare(g, hr, env);
        A.drawTufts(g, this.tufts, this._snow(env) ? 'winter' : env.season, env.weather);
        this._renderWindsock(g, env);
        g.compose(this.layerC, this.fenceY - 50, this.h, true);
        // spotters and walkers
        for (const p of [...this.people].sort((a, b) => a.y - b.y)) {
            drawPerson(g, p, p.x, p.y, p.dir, env, p.spot ? 'up' : 'side');
            if (p.spot && p.tripod)
                this._tripod(g, p);
            else if (p.spot && p.shoot && !p.kid) {
                // phone held up high
                g.rect(p.x + 12, p.y - 36, 3, 4, INK);
                g.rect(p.x + 13, p.y - 35, 1, 2, dark ? 0xc0e0ff : 0x3a4a6a);
                if (dark)
                    g.pxE(p.x + 13, p.y - 35, 0xc0e0ff);
            }
        }
    }

    _renderHangarJet(g, env) {
        const [hx, , hw] = this.hangarDoor, B = this.termBase;
        const cx = hx + Math.round(hw / 2), c = 0xf0f0f4, r = Math.round(hw * 0.09);
        // nose-on: the wings and engines out to the sides, the tail above
        const wy = B - 9 - r;
        for (const s of [-1, 1]) {
            for (let i = 0; i < Math.round(hw * 0.42); i++)
                g.rect(cx + s * (r + i), wy + Math.round(i * 0.12), 1, 2, i % 2 ? 0xc8ccd6 : 0xb8bcc8);
            g.disc(cx + s * (r + 6), wy + 4, 3, 0x8a8e9a);
            g.disc(cx + s * (r + 6), wy + 4, 2, 0x2a2a36);
        }
        g.rect(cx - 1, wy - r - 12, 3, 12, 0x1a1a2a);
        g.rect(cx - 6, wy - r - 12, 13, 2, 0x1a1a2a);
        g.disc(cx, wy, r + 1, 0xb8bcc8);
        g.disc(cx, wy, r, c);
        g.rect(cx - r + 2, wy - Math.round(r / 2), r * 2 - 3, 2, 0x2a3a5a);
        g.rect(cx, wy + r, 1, B - 4 - wy - r, 0x8a8a96);
        g.rect(cx - 1, B - 7, 3, 3, 0x2a2a30);
        // a work stand, a mechanic and a tool trolley
        const sx = cx + r + 14;
        g.rect(sx, wy - 2, 10, 2, 0xf0c030);
        g.rect(sx + 1, wy, 1, B - 4 - wy, 0x8a8a96);
        g.rect(sx + 8, wy, 1, B - 4 - wy, 0x8a8a96);
        this._tiny(g, sx + 3, wy - 2, 0x3a5aa0, Math.floor(this.realT * 2) % 2);
        g.rect(cx - r - 24, B - 12, 12, 7, 0xc83838);
        g.rect(cx - r - 24, B - 12, 12, 1, 0xe86060);
        g.rect(cx - r - 23, B - 5, 2, 1, 0x2a2a30);
        g.rect(cx - r - 15, B - 5, 2, 1, 0x2a2a30);
        if (env.lampsOn)
            for (const [lx, ly] of this.hangarLamps) {
                g.pxE(lx, ly, 0xfff4d0);
                g.glow(lx, ly + 6, 10, 0xfff0c0, 0.12, 0.6);
            }
    }

    // a ground crew member about 10 px tall at the back of the scene
    _tiny(g, x, y, vest, step = 0) {
        x = Math.round(x);
        y = Math.round(y);
        g.rect(x, y - 9, 2, 2, 0xd8a074);
        g.px(x, y - 10, 0x2a2a30);
        g.rect(x, y - 7, 2, 4, vest);
        g.px(x, y - 5, 0xf0f0f0);
        g.rect(x, y - 3, 1, 3, 0x2a2a3a);
        g.rect(x + 1, y - 3 + step, 1, 3 - step, 0x2a2a3a);
    }

    _marshaller(g, p) {
        const nose = p.dir > 0 ? p.x + p.T.L + 10 : p.x - 12, y = this.apronY + 4;
        this._tiny(g, nose, y, VEST[0]);
        const up = Math.floor(this.realT * 2) % 2;
        for (const s of [-1, 1]) {
            const wx = nose + (s < 0 ? -1 : 2), wy = y - 8 - (up ? 3 : 1);
            g.rectE(wx + (s < 0 ? -1 : 0), wy, 1, 3, 0xff8020);
        }
    }

    _renderBridge(g, gt, env) {
        // the tunnel runs from the rotunda out to the front door of the plane
        const B = this.termBase, p = gt.plane && (gt.plane.state === 'parked' || gt.plane.state === 'push') ? gt.plane : null;
        const ext = p ? gt.ext : 0;
        const rx = gt.rot, door = p ? this._pt(p, p.lights.door) : [rx - this.D * 20, B - 4];
        const ex = Math.round(rx + (door[0] - rx) * ext * 0.9 + (1 - ext) * (-this.D * 10)), ey = Math.round(B - 16 + (door[1] - (B - 16)) * ext);
        const n = Math.max(1, Math.abs(ex - rx));
        for (let i = 0; i <= n; i++) {
            const u = i / n, x = Math.round(rx + (ex - rx) * u), y = Math.round(B - 16 + (ey - (B - 16)) * u);
            g.rect(x, y - 1, 1, 12, INK);
            g.rect(x, y, 1, 10, 0xc8ccd4);
            g.px(x, y, 0xe8ecf4);
            g.px(x, y + 9, 0x9a9ea8);
            if (i % 3 !== 0)
                g.rect(x, y + 3, 1, 3, env.lampsOn ? 0xffe0a0 : 0x4a6a8a);
            // the telescope joints
            if (i === Math.round(n * 0.45) || i === Math.round(n * 0.75))
                g.rect(x, y - 1, 1, 12, 0x8a8e98);
        }
        // the cab at the door and its wheeled leg
        g.rect(ex - 4, ey - 2, 9, 12, INK);
        g.rect(ex - 3, ey - 1, 7, 10, 0xb8bcc4);
        g.rect(ex, ey + 10, 1, Math.max(0, this.apronY - ey - 12), 0x6a6a76);
        g.rect(ex - 2, this.apronY - 3, 5, 3, 0x2a2a30);
    }

    // turnaround: baggage carts and belt loader, fuel truck, catering
    // truck with its box raised, and the pushback tug at the end
    _renderService(g, p, env) {
        const f = p.age / p.turn, y = this.apronY + 3, d = p.dir;
        const at = i => this._pt(p, [i, 0])[0];
        const slide = (a, b, from) => {
            const k = Math.min(clamp((f - a) / 0.05, 0, 1), clamp((b - f) / 0.05, 0, 1));
            return k <= 0 ? null : (1 - k) * from;
        };
        const lamps = env.lampsOn;
        // belt loader and baggage train at the rear hold
        let o = p.state === 'parked' ? slide(0.04, 0.85, 80) : null;
        if (o !== null) {
            const bx = at(Math.round(p.T.L * 0.26)), by = this._pt(p, [0, p.lights.belly])[1];
            g.line(bx - d * 2, y - 3, bx + d * 10, by + 2, 0x3a3a42);
            g.line(bx - d * 2, y - 4, bx + d * 10, by + 1, 0x5a5a62);
            const k = (this.realT * 0.8) % 1;
            g.rect(Math.round(bx - d * 2 + d * 12 * k), Math.round(y - 5 + (by - y + 6) * k), 2, 2, pick([0xc83838, 0x3a5aa0, 0x2a2a30]));
            const tx = bx - d * (28 + o);
            this._tug(g, tx, y + 2, -d, 0xf0c030, lamps);
            for (let i = 0; i < 2; i++)
                this._cart(g, tx - d * (14 + i * 12), y + 2);
            this._tiny(g, bx - d * 6, y + 1, VEST[1], Math.floor(this.realT * 3) % 2);
        }
        // fuel truck under the wing
        o = p.state === 'parked' ? slide(0.25, 0.65, 90) : null;
        if (o !== null) {
            const fx = at(p.lights.main + 6) - d * o;
            g.rect(fx - 16, y - 9, 28, 8, INK);
            g.rect(fx - 15, y - 8, 20, 6, 0xf0f0f0);
            g.rect(fx - 15, y - 6, 20, 1, 0xd84040);
            g.rect(fx + 6, y - 8, 6, 6, 0xd84040);
            g.rect(fx + 8, y - 7, 3, 2, 0x5a7aa0);
            g.disc(fx - 10, y - 1, 2, 0x2a2a30);
            g.disc(fx + 8, y - 1, 2, 0x2a2a30);
            if (o < 1)
                g.line(fx - 4, y - 8, at(p.lights.main + 10), this._pt(p, [0, p.lights.belly])[1] + 3, 0x2a2a30);
        }
        // catering truck with the box up at the rear door
        o = p.state === 'parked' ? slide(0.15, 0.55, 90) : null;
        if (o !== null) {
            const [dx, dy] = this._pt(p, p.lights.rearDoor);
            const cx = dx - d * 6 + d * o * 0;
            const lift = clamp((f - 0.2) / 0.05, 0, 1) * clamp((0.5 - f) / 0.05, 0, 1);
            const boxY = Math.round(y - 12 - (y - 12 - dy - 2) * lift);
            g.rect(cx - 8, y - 6, 18, 5, INK);
            g.rect(cx - 7, y - 5, 16, 3, 0x6a6a76);
            g.disc(cx - 4, y - 1, 2, 0x2a2a30);
            g.disc(cx + 6, y - 1, 2, 0x2a2a30);
            for (let yy = boxY + 10; yy < y - 6; yy += 2) {
                g.px(cx - 3, yy, 0x8a8a96);
                g.px(cx + 4, yy + 1, 0x8a8a96);
            }
            g.rect(cx - 7, boxY - 1, 16, 11, INK);
            g.rect(cx - 6, boxY, 14, 9, 0xf4f4f8);
            g.rect(cx - 6, boxY + 3, 14, 2, 0x2a5ad0);
        }
        // pushback tug at the nose
        if (f > 0.9 || p.state === 'push') {
            const nx = d > 0 ? p.x + p.T.L + 4 : p.x - 22;
            this._tug(g, nx, Math.round(p.y) + 3, -d, 0xe8e8ec, lamps, true);
            g.line(d > 0 ? nx : nx + 18, Math.round(p.y) - 1, this._pt(p, [p.T.L - 6, -2])[0], Math.round(p.y) - 2, 0x2a2a30);
        }
    }

    _tug(g, x, y, dir, c, lamps, big = false) {
        const w = big ? 18 : 12;
        x = Math.round(x);
        g.rect(x - 1, y - 7, w + 2, 6, INK);
        g.rect(x, y - 6, w, 4, c);
        g.rect(x, y - 6, w, 1, hi(c, 0.4));
        const cab = dir > 0 ? x + w - 6 : x + 1;
        g.rect(cab - 1, y - 11, 6, 5, INK);
        g.rect(cab, y - 10, 4, 3, 0x5a7aa0);
        g.disc(x + 3, y - 1, 2, 0x2a2a30);
        g.disc(x + w - 3, y - 1, 2, 0x2a2a30);
        if (Math.floor(this.realT * 2) % 2)
            g.pxE(cab + 2, y - 12, 0xffa020);
        if (lamps)
            g.pxE(dir > 0 ? x + w : x - 1, y - 5, 0xfff0c0);
    }

    _cart(g, x, y) {
        x = Math.round(x);
        g.rect(x - 1, y - 8, 11, 7, INK);
        g.rect(x, y - 7, 9, 5, 0x5a5a66);
        for (let i = 0; i < 3; i++)
            g.rect(x + 1 + i * 3, y - 6, 2, 3, [0xc83838, 0x3a5aa0, 0x2a2a30, 0xe8a030][(x + i) % 4]);
        g.disc(x + 2, y - 1, 1, 0x2a2a30);
        g.disc(x + 7, y - 1, 1, 0x2a2a30);
    }

    _renderSalute(g) {
        const s = this.salute;
        for (const k of [-1, 1]) {
            const x = Math.round(s.x + k * 70), y = this.taxiY - 6;
            g.rect(x - 12, y - 10, 26, 10, INK);
            g.rect(x - 11, y - 9, 24, 8, 0xd83838);
            g.rect(x - 11, y - 9, 24, 1, 0xf07070);
            g.rect(x + (k > 0 ? -9 : 5), y - 13, 5, 4, 0xe8e8ec);
            g.disc(x - 6, y, 2, 0x2a2a30);
            g.disc(x + 6, y, 2, 0x2a2a30);
            if (Math.floor(this.realT * 3) % 2)
                g.pxE(x, y - 11, 0x4080ff);
        }
    }

    _renderPlows(g, env) {
        const P = this.plows;
        for (let i = 0; i < 3; i++) {
            const x = Math.round(P.x - P.dir * i * 44), y = this.rwyY + 2 + (i % 2) * 3;
            g.rect(x - 16, y - 12, 32, 11, INK);
            g.rect(x - 15, y - 11, 30, 9, 0xf0a020);
            g.rect(x + (P.dir > 0 ? 6 : -14), y - 16, 9, 6, INK);
            g.rect(x + (P.dir > 0 ? 7 : -13), y - 15, 7, 4, 0x5a7aa0);
            g.rect(x + P.dir * 16 - (P.dir > 0 ? 0 : 3), y - 7, 4, 7, 0xd8d8e0);
            g.disc(x - 9, y - 1, 3, 0x2a2a30);
            g.disc(x + 9, y - 1, 3, 0x2a2a30);
            if (Math.floor(this.realT * 3 + i) % 2) {
                g.pxE(x, y - 13, 0xffa020);
                g.glow(x, y - 13, 7, 0xffa020, 0.35);
            }
            // a white plume thrown up to the side
            for (let k = 0; k < 6; k++)
                g.blend(x + P.dir * (18 + k * 2), y - 4 - k - Math.round(Math.sin(this.realT * 9 + k) * 1.5), 2, 2, 0xffffff, 0.6 - k * 0.08);
        }
        void env;
    }

    _renderWindsock(g, env) {
        // a cone of five stripes: limp in a calm, straight out in a gale
        const x = this.windX, y = this.rwyBot + 5, lean = env.weather.grassLean(x);
        const s = clamp(Math.abs(lean) * 0.9, 0.15, 1), dir = lean < 0 ? -1 : 1;
        g.rect(x - 1, y - 1, 3, 9, INK);
        g.rect(x, y, 1, 7, 0x8a8a96);
        for (let k = 0; k < 5; k++) {
            const sx = x + dir * (2 + k * 4), sy = y + Math.round(k * (1 - s) * 3 + Math.sin(this.realT * 6 + k) * s * 0.7);
            const h = 7 - k;
            g.rect(dir > 0 ? sx : sx - 3, sy - 1 + Math.floor(k / 2), 4, h + 2, INK);
            g.rect(dir > 0 ? sx : sx - 3, sy + Math.floor(k / 2), 4, h, k % 2 ? 0xf4f4f8 : 0xf06020);
            g.px(dir > 0 ? sx : sx - 3, sy + Math.floor(k / 2), k % 2 ? 0xffffff : 0xff8a50);
        }
    }

    // hares sit, nibble, sit up and now and then hop a few lengths; a
    // plane rolling by sends them off in a hurry
    _updateHares(real) {
        const loud = this.planes.some(p => (p.state === 'takeoff' || p.state === 'rollout') && p.speed > 40);
        for (const h of this.hares) {
            h.t -= real;
            if (h.hop > 0) {
                h.hop -= real;
                h.x += h.dir * (h.fast ? 34 : 16) * real;
                if (h.x < 6 || h.x > this.w - 6)
                    h.dir = -h.dir;
                continue;
            }
            if (h.t <= 0 || (loud && !h.fast && chance(real * 2))) {
                h.fast = loud;
                h.hop = loud ? rand(1.2, 2.2) : rand(0.4, 1);
                if (chance(0.3))
                    h.dir = -h.dir;
                h.t = rand(3, 12);
                h.up = chance(0.3);
            }
        }
    }

    _renderHare(g, h, env) {
        const x = Math.round(h.x), y = Math.round(h.y), d = h.dir, hop = h.hop > 0;
        const c = env.season === 'winter' ? 0x9a8a7a : 0x9a7a5a, dk = sh(c, 0.3), lt = hi(c, 0.35);
        const air = hop ? Math.round(Math.abs(Math.sin(this.realT * 14)) * 3) : 0;
        g.footShadow(x, y, 8, 0.25);
        const X = i => (d > 0 ? x + i : x - i);
        const P = (i, yy, cc) => g.px(X(i), y - air + yy, cc);
        const rows = hop
            ? [[-4, -3, 'ddcccc'], [-3, -2, 'cccccccl'], [-4, -1, 'dcccccccc'], [-3, 0, 'd..d.d']]
            : h.up
                ? [[1, -9, 'l.'], [1, -8, 'cl'], [1, -7, 'cc'], [0, -6, 'cccc'], [-1, -5, 'cccce'], [-2, -4, 'dcccc'], [-2, -3, 'dcccc'], [-2, -2, 'dccc'], [-2, -1, 'ddcc'], [-2, 0, 'dd.d']]
                : [[1, -7, 'l'], [1, -6, 'cl'], [1, -5, 'cc'], [-3, -4, 'dccccce'], [-4, -3, 'dcccccc'], [-4, -2, 'dccccc'], [-3, -1, 'dccc'], [-3, 0, 'd..d']];
        for (const [i0, yy, str] of rows)
            for (let k = 0; k < str.length; k++) {
                const ch = str[k];
                if (ch !== '.')
                    P(i0 + k, yy, ch === 'd' ? dk : ch === 'l' ? lt : ch === 'e' ? 0x2a1a1a : c);
            }
        P(-4 - (hop ? 1 : 0), -3, 0xf4f0e8);
    }

    _tripod(g, p) {
        const x = Math.round(p.x + (p.dir > 0 ? 20 : -6)), y = p.y;
        g.line(x, y - 18, x - 3, y, 0x3a3a42);
        g.line(x, y - 18, x + 3, y, 0x3a3a42);
        g.line(x, y - 18, x, y, 0x3a3a42);
        g.rect(x - 3, y - 23, 7, 5, INK);
        g.rect(x - 2, y - 22, 5, 3, 0x3a3a44);
        g.rect(x - 1, y - 27, 3, 5, 0x2a2a30);
        g.px(x, y - 27, 0x6a8ab0);
    }
}
