// Households and the windows they live behind. Each household follows its
// own daily routine; every window re-decides its light and activity at
// random intervals, so the facade never repeats.
import {rand, randi, chance, pick, weighted} from './util.js';
import {mix, shadow, highlight} from './gfx.js';
import {INK, windowGlass, windowMullions} from './art.js';
import {makeCat, catFigure} from './people.js';
import {drawFigure} from './figure.js';

const LAMPS = [0xffd890, 0xffe2a8, 0xffcc80, 0xfff0d0, 0xffd0a0, 0xe8f0ff];
const WALLS = [0xe8d8b8, 0xd8c8e0, 0xc8e0d0, 0xf0d0c0, 0xd0d8e8, 0xf0e8c8];
const CURTAINS = [0xd85050, 0x4c7cd0, 0x5cae5c, 0xe8a640, 0x9a5cba, 0xf2ecd8, 0xe876a0, 0x40a8a8];

const TYPES = {
    worker: () => ({wake: rand(5.8, 7.4), leave: rand(7.3, 8.6), back: rand(16.3, 18.8), sleep: rand(22, 24.2), weekendHome: 0.7}),
    family: () => ({wake: rand(6, 7.2), leave: rand(7.6, 8.4), back: rand(14.5, 17), sleep: rand(21.5, 23.5), weekendHome: 0.6}),
    student: () => ({wake: rand(8.5, 11), leave: rand(11, 13), back: rand(14, 17), sleep: rand(24.5, 27), weekendHome: 0.5}),
    retired: () => ({wake: rand(5.8, 7.8), leave: rand(9.5, 10.5), back: rand(11.5, 13), sleep: rand(20.8, 22.8), weekendHome: 0.8}),
    owl: () => ({wake: rand(11, 13.5), leave: rand(14, 16), back: rand(17, 19), sleep: rand(27, 29), weekendHome: 0.6}),
    shift: () => ({wake: rand(13, 15), leave: rand(20.5, 21.5), back: rand(29.5, 30.5), sleep: rand(30.6, 31.5), weekendHome: 0.4}),
    // medieval town: up with the morning bell, abed soon after curfew
    craft: () => ({wake: rand(4.6, 6), leave: 99, back: 99, sleep: rand(20.6, 22), weekendHome: 1}),
    field: () => ({wake: rand(4.3, 5.5), leave: rand(5.8, 6.8), back: rand(17.5, 19), sleep: rand(20.3, 21.5), weekendHome: 0.8}),
    wealthy: () => ({wake: rand(6, 7.5), leave: rand(9, 11), back: rand(12, 15), sleep: rand(21.5, 23), weekendHome: 0.6}),
};

export class Household {
    constructor(era = 'modern') {
        this.kind = era === 'medieval'
            ? weighted([['craft', 5], ['field', 3], ['wealthy', 1]])
            : weighted([['worker', 5], ['family', 3], ['student', 2], ['retired', 2], ['owl', 1], ['shift', 0.6]]);
        this.era = era;
        Object.assign(this, TYPES[this.kind]());
        this.lamp = era === 'medieval' ? pick([0xffb860, 0xffc070, 0xffa850]) : pick(LAMPS);
        this.wall = era === 'medieval' ? pick([0xb8a080, 0xa89070, 0xc8b090, 0xb09878]) : pick(WALLS);
        this.curtain = pick(CURTAINS);
        this.cat = chance(0.3) ? makeCat() : null;
        this.partyLover = chance(0.08);
        this.gamer = era !== 'medieval' && chance(0.15);
        this.people = this.kind === 'family' ? randi(3, 4) : randi(1, 2);
        this.hair = pick([0x3a2418, 0x6a3c20, 0xe8c060, 0x24202a, 0xc04030, 0xd0d0d0]);
        this.outage = 0;
        this.picture = chance(0.5) ? pick([0xd84848, 0x4c7cd0, 0xe8a640, 0x5cae5c]) : 0;
        this.shelf = chance(0.4);
    }

    // 'sleep' | 'away' | 'home'
    state(env) {
        // routines may run past midnight (sleep 26 = 2:00)
        let h = env.hour;
        if (h < this.wake && h + 24 < this.sleep)
            h += 24;
        if (h < this.wake || h >= this.sleep)
            return 'sleep';
        const weekend = env.weekday === 0 || env.weekday === 6;
        const goesOut = weekend ? this._weekendOut(env) : true;
        if (goesOut && h >= this.leave && h < this.back)
            return 'away';
        return 'home';
    }

    _weekendOut(env) {
        const day = Math.floor(env.date.getTime() / 86400000);
        return ((day * 2654435761 + this.wake * 1000) % 100) / 100 > this.weekendHome;
    }
}

export class Win {
    constructor(x, y, w, h, hh, role, kind = 'home') {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.hh = hh;
        this.role = role;
        this.kind = kind;
        this.lit = false;
        this.act = 'none';
        this.timer = rand(0, 20);
        this.t = rand(10);
        this.px = rand(1, w - 2);
        this.pdir = chance(0.5) ? 1 : -1;
        this.curtains = chance(0.7) ? pick(['open', 'open', 'half', 'closed']) : 'none';
        this.blinds = false;
        this.plant = chance(0.15) ? pick([0x5cae5c, 0xe86060, 0xf0d050, 0xc070e0]) : 0;
        this.pumpkin = false;
        // only a few households put a pumpkin in the window for Halloween
        this.halloween = chance(0.06);
        this.xmas = chance(0.3) ? pick(['star', 'candles', 'lights']) : null;
        if (kind === 'medieval') {
            // horn or oiled cloth in most windows, leaded glass in a few;
            // wooden shutters closed for the night
            this.curtains = 'none';
            this.halloween = false;
            this.xmas = chance(0.5) ? 'candles' : null;
            this.leaded = chance(0.22);
        }
        this.flicker = 0;
        this.decide(null);
    }

    decide(env) {
        if (!env)
            return;
        const hh = this.hh;
        this.pumpkin = env.holidays.halloween && this.role !== 'bed' && this.halloween;
        if (this.kind === 'office') {
            const work = env.weekday > 0 && env.weekday < 6;
            const h = env.hour;
            let p = work ? (h > 7 && h < 18.5 ? 0.85 : h > 6.5 && h < 21 ? 0.3 : 0.03) : (h > 9 && h < 17 ? 0.08 : 0.02);
            if (env.dark < 0.2 && p > 0.1)
                p = 0.6;
            this.lit = chance(p);
            this.act = this.lit ? weighted([['none', 4], ['walker', 2], ['pc', 4], ['cleaner', h > 20 || h < 6 ? 3 : 0]]) : 'none';
            return;
        }
        if (this.kind === 'shop')
            return;
        const st = hh.state(env);
        const medieval = this.kind === 'medieval';
        const h = env.hour;
        const needLight = env.dark > 0.35 || env.weather.v.dim > 0.3;
        let p = 0;
        if (st === 'sleep') {
            p = chance(0.04) ? 1 : 0; // night bathroom trip
            this.blinds = medieval || chance(0.5);
        } else if (st === 'away') {
            p = chance(0.03) ? 1 : 0; // forgot to switch off
            this.blinds = false;
        } else {
            this.blinds = false;
            const meal = (h > 6.5 && h < 8) || (h > 11.8 && h < 13.2) || (h > 17.8 && h < 20);
            if (this.role === 'living')
                p = 0.8;
            else if (this.role === 'kitchen')
                p = meal ? 0.85 : 0.3;
            else
                p = (h < hh.wake + 1 || h > hh.sleep - 1.2) ? 0.75 : 0.2;
            if (!needLight)
                p *= 0.12;
        }
        if (hh.outage > 0)
            p = 0;
        const wasLit = this.lit;
        this.lit = chance(p);
        this.visible = !this.lit && st === 'home' && !needLight && chance(0.45);
        if (this.lit || this.visible) {
            const weekendNight = (env.weekday === 5 || env.weekday === 6) && (h > 20 || h < 2);
            const acts = medieval ? [
                ['none', 3], ['walker', 4], ['cook', this.role === 'kitchen' ? 6 : 1], ['read', hh.kind === 'wealthy' ? 2 : 0.3],
                ['window', 1.5], ['couple', hh.people > 1 ? 1.5 : 0], ['wave', 0.3], ['spin', this.role === 'living' ? 2 : 0.5],
                ['party', this.role === 'tavern' ? 10 : 0],
            ] : [
                ['none', 3], ['walker', 4], ['tv', this.role === 'living' && h > 17 ? 6 : 1],
                ['cook', this.role === 'kitchen' ? 6 : 0], ['read', 2], ['window', 1.5],
                ['couple', hh.people > 1 ? 1.5 : 0], ['wave', 0.3], ['dance', 0.6],
                ['party', hh.partyLover && weekendNight ? 12 : 0.15], ['game', hh.gamer ? 3 : 0.2],
                ['plantcare', !needLight ? 1 : 0],
            ];
            if (!wasLit || chance(0.6))
                this.act = weighted(acts);
        } else {
            this.act = 'none';
        }
        this.catHere = hh.cat && chance(0.25) ? (chance(0.5) ? 'sit' : 'walk') : null;
    }

    update(dt, real, env) {
        this.t += real;
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = rand(60, 600);
            this.decide(env);
        }
        if (this.act === 'walker' || this.act === 'cleaner' || this.act === 'cook' || this.catHere === 'walk') {
            this.px += this.pdir * real * (this.act === 'cleaner' ? 2 : 3);
            if (this.px < 0 || this.px > this.w - 2) {
                this.pdir = -this.pdir;
                this.px = Math.max(0, Math.min(this.w - 2, this.px));
            }
        }
        if (this.flicker > 0)
            this.flicker -= real;
    }

    render(g, env) {
        const {x, y, w, h} = this;
        const hh = this.hh;
        const night = env.dark;
        if (this.kind === 'shop')
            return;
        const fr = this.frameR || [0x5a3420, 0x7a4a30, 0x9a6440, 0xb88050, 0xd8a070];
        const medieval = this.kind === 'medieval';
        if (medieval && !this.lit && !this.visible) {
            if (this.blinds) {
                // closed wooden shutters
                g.rect(x, y, w, h, 0x6a4a2a);
                for (let i = 0; i < w; i += 4)
                    g.rect(x + i, y, 1, h, 0x4a3018);
                g.rect(x, y + 3, w, 1, 0x3a2410);
                g.rect(x, y + h - 4, w, 1, 0x3a2410);
                g.rect(x + Math.floor(w / 2), y, 1, h, INK);
            } else {
                for (let i = 0; i < h; i++)
                    g.rect(x, y + i, w, 1, mix(0x2a2018, 0x4a3828, i / h));
                if (this.leaded)
                    for (let i = 0; i < h; i++)
                        g.rect(x, y + i, w, 1, mix(mix(0x3a4846, env.skyBottom, 0.22), 0x8a9a94, i < h / 3 && night < 0.5 ? 0.25 : 0));
            }
        } else if (!this.lit && !this.visible) {
            windowGlass(g, x, y, w, h, env.skyBottom, night > 0.5);
            if (this.blinds) {
                for (let i = 0; i < h - 2; i += 2)
                    g.rect(x, y + i, w, 1, 0xd8d0c0);
                g.rect(x, y + h - 2, w, 1, 0xb8b0a0);
            }
        } else {
            const lit = this.lit;
            const lamp = lit ? this._lampColor(env) : 0;
            const strong = lit && night > 0.3;
            const wall = lit ? mix(hh.wall, lamp, 0.45) : shadow(hh.wall, 0.25);
            const wallC = strong ? wall : lit ? mix(wall, 0x5a5060, 0.25) : wall;
            const R = strong ? (a, b, c, d, col) => g.rectE(a, b, c, d, col) : (a, b, c, d, col) => g.rect(a, b, c, d, col);
            R(x, y, w, h, wallC);
            R(x, y, w, 2, shadow(wallC, 0.15));
            R(x, y + h - 4, w, 4, shadow(wallC, 0.35)); // floor
            // furniture: picture frame or shelf, plant or lamp
            if (hh.picture)
                R(x + 2, y + 4, 4, 3, hh.picture);
            if (hh.shelf)
                R(x + w - 7, y + 5, 5, 1, shadow(wallC, 0.4));
            if (lit && this.kind === 'medieval') {
                // a candle on the sill
                R(x + w - 5, y + h - 7, 2, 3, 0xf4ecd8);
                g.pxE(x + w - 5, y + h - 8 - (Math.floor(this.t * 7) % 2), 0xffe090);
            } else if (lit && this.act !== 'party' && this.act !== 'tv') {
                R(x + w - 4, y + h - 9, 1, 5, shadow(wallC, 0.5));
                R(x + w - 6, y + h - 11, 5, 2, highlight(lamp, 0.5));
            }
            const sil = mix(wallC, 0x2a1830, 0.75);
            const S = (sx, sy, sw, shh) => R(sx, sy, sw, shh, sil);
            this._activity(g, env, S, R, sil);
            if (this.catHere && hh.cat) {
                const cf = catFigure(hh.cat, this.catHere === 'sit' ? 'sit' : (Math.floor(this.t * 3) % 2 ? 'walk1' : 'walk2'));
                const cx = this.catHere === 'sit' ? x + w - cf.w + 2 : x + this.px - 4;
                drawFigure(g, cf, cx, y + h + 1, this.pdir < 0);
            }
        }
        // curtains with folds
        const cur = hh.curtain;
        const curtain = (cx, cw) => {
            g.rect(cx, y, cw, h, cur);
            for (let i = 0; i < cw; i += 2)
                g.rect(cx + i, y, 1, h, shadow(cur, 0.2));
            g.rect(cx, y, cw, 1, shadow(cur, 0.35));
        };
        if (this.curtains === 'half' || this.curtains === 'open') {
            const cw = this.curtains === 'half' ? 5 : 3;
            curtain(x, cw);
            curtain(x + w - cw, cw);
            g.px(x + cw - 1, y + Math.floor(h * 0.6), shadow(cur, 0.4));
            g.px(x + w - cw, y + Math.floor(h * 0.6), shadow(cur, 0.4));
        } else if (this.curtains === 'closed') {
            if (this.lit) {
                g.blend(x, y, w, h, cur, 0.55, true);
                for (let i = 1; i < w; i += 3)
                    g.blend(x + i, y, 1, h, shadow(cur, 0.3), 0.4, true);
            } else {
                curtain(x, w);
            }
        }
        if (medieval) {
            if (this.leaded && !(this.blinds && !this.lit && !this.visible)) {
                // diamond lattice of lead cames
                for (let yy = 0; yy < h; yy++)
                    for (let xx = 0; xx < w; xx++)
                        if ((xx + yy) % 5 === 0 || (xx - yy + 600) % 5 === 0)
                            g.px(x + xx, y + yy, 0x2a2a30);
            } else if (!this.blinds || this.lit || this.visible) {
                g.rect(x + Math.floor(w / 2), y, 1, h, fr[1]);
            }
        } else {
            windowMullions(g, x, y, w, h, fr);
        }
        if (this.lit && night > 0.3) {
            const lamp = this._lampColor(env);
            // glow cost grows with the area; kept at the size it had for
            // the small windows, it reads the same on the big ones
            g.glow(x + w / 2, y + h / 2, Math.min(w * 1.3, 21), lamp, 0.12 * night);
            g.glow(x + w / 2, y + h + 4, Math.min(w, 16), lamp, 0.15 * night, 0.4);
        }
        if (this.plant) {
            g.rect(x + 2, y + h - 3, 4, 3, 0xb85a38);
            g.rect(x + 2, y + h - 3, 4, 1, 0xd87a48);
            g.rect(x + 2, y + h - 7, 4, 4, 0x4a9a3a);
            g.px(x + 3, y + h - 8, this.plant);
            g.px(x + 5, y + h - 6, 0x6ab84a);
        }
        if (this.pumpkin) {
            const px = x + w - 7, py = y + h - 5;
            g.rect(px - 1, py - 1, 7, 6, INK);
            g.rect(px, py, 5, 4, 0xf08a20);
            g.rect(px + 1, py, 1, 4, 0xd86a10);
            g.rect(px + 2, py - 2, 1, 2, 0x4a7a2a);
            if (night > 0.4) {
                g.pxE(px + 1, py + 1, 0xffe060);
                g.pxE(px + 3, py + 1, 0xffe060);
                g.rectE(px + 1, py + 3, 3, 1, 0xffe060);
                g.glow(px + 2, py + 2, 7, 0xffa020, 0.25);
            }
        }
        if (env.holidays.christmas && this.xmas && night > 0.3 && hh.state(env) !== 'away') {
            if (this.xmas === 'star') {
                g.rectE(x + w / 2 - 1, y + 3, 3, 3, 0xfff0a0);
                g.glow(x + w / 2, y + 4, 7, 0xffe080, 0.3);
            } else if (this.xmas === 'candles') {
                for (let i = 2; i < w - 2; i += 3) {
                    g.rect(x + i, y + h - 4, 1, 3, 0xf4f0e0);
                    g.pxE(x + i, y + h - 5, 0xffe0a0);
                }
            } else {
                const cols = [0xff4040, 0x40ff60, 0x4080ff, 0xffd040];
                for (let i = 0; i < w + 4; i += 2)
                    g.pxE(x - 2 + i, y - 3, cols[(i / 2 + Math.floor(this.t * 2)) % 4]);
            }
        }
    }

    _lampColor(env) {
        if (this.act === 'party')
            return [0xff60c0, 0x60c0ff, 0xc0ff60, 0xffc040][Math.floor(this.t * 3) % 4];
        if (this.act === 'tv')
            return mix(this.hh.lamp, 0x7090ff, 0.45 + 0.25 * Math.sin(this.t * 7) * Math.sin(this.t * 3.1));
        if (this.act === 'game')
            return mix(this.hh.lamp, [0xff50a0, 0x50a0ff, 0x60ffa0][Math.floor(this.t / 2) % 3], 0.45);
        if (this.kind === 'office')
            return 0xf0f4ff;
        if (this.kind === 'medieval')
            // candle and hearth light flickers
            return mix(this.hh.lamp, 0xff9040, 0.12 + 0.12 * Math.sin(this.t * 9 + this.x) * Math.sin(this.t * 2.3));
        return this.hh.lamp;
    }

    _activity(g, env, S, drawBack, sil) {
        const {x, y, w, h} = this;
        const bottom = y + h - 2;
        const px = Math.floor(x + this.px);
        // a person: head 4x4, shoulders and body
        const person = (hx, top, bob = 0) => {
            S(hx + 1, top + bob, 4, 4);
            S(hx, top + 4 + bob, 6, 2);
            S(hx, top + 6 + bob, 6, bottom - top - 6);
        };
        switch (this.act) {
        case 'walker':
        case 'cleaner':
            person(px - 3, bottom - 12);
            if (this.act === 'cleaner')
                S(px + (this.pdir > 0 ? 3 : -4), bottom - 6, 1, 6);
            break;
        case 'cook':
            person(px - 3, bottom - 12);
            if (Math.floor(this.t * 2) % 2)
                g.blend(x + 3, y + 3 + (this.t * 3 % 3), 2, 1, 0xffffff, 0.6, this.lit);
            break;
        case 'tv':
            person(x + 2, bottom - 7);
            S(x + 1, bottom - 3, w - 2, 3);
            break;
        case 'read':
            person(x + w - 8, bottom - 9);
            drawBack(x + w - 9, bottom - 5, 3, 2, 0xf8f0e0);
            break;
        case 'window': {
            const hx = x + Math.floor(w / 2) - 3;
            person(hx, y + 4);
            break;
        }
        case 'couple': {
            const close = Math.sin(this.t * 0.5) > 0.6;
            person(x + 1 + (close ? 2 : 0), bottom - 12);
            person(x + w - 7 - (close ? 2 : 0), bottom - 11);
            if (close && Math.floor(this.t) % 4 === 0) {
                drawBack(x + Math.floor(w / 2) - 1, y + 2, 1, 1, 0xff6080);
                drawBack(x + Math.floor(w / 2) + 1, y + 2, 1, 1, 0xff6080);
                drawBack(x + Math.floor(w / 2) - 1, y + 3, 3, 1, 0xff6080);
                drawBack(x + Math.floor(w / 2), y + 4, 1, 1, 0xff6080);
            }
            break;
        }
        case 'wave': {
            const hx = x + Math.floor(w / 2) - 3;
            person(hx, bottom - 12);
            S(hx + 6, bottom - 14 + (Math.floor(this.t * 4) % 2) * 2, 2, 4);
            break;
        }
        case 'dance':
            person(px - 3, bottom - 12, Math.floor(this.t * 4) % 2 ? -1 : 0);
            break;
        case 'party':
            for (let i = 0; i < 3; i++)
                person(x + i * 5 - 1, bottom - 12, Math.floor(this.t * 5 + i) % 2 ? -1 : 0);
            break;
        case 'game':
        case 'pc':
            person(x + 2, bottom - 9);
            if (this.lit)
                g.rectE(x + w - 7, bottom - 8, 5, 4, this.act === 'pc' ? 0xb0d8ff : 0x80ffc0);
            break;
        case 'plantcare':
            person(x + w - 8, bottom - 12);
            break;
        case 'spin': {
            // sitting at the spinning wheel
            person(x + 1, bottom - 8);
            const cx = x + w - 6, cy = bottom - 6, a = this.t * 3;
            for (let i = 0; i < 4; i++)
                drawBack(Math.round(cx + Math.cos(a + i * 1.57) * 3), Math.round(cy + Math.sin(a + i * 1.57) * 3), 1, 1, sil);
            break;
        }
        }
    }
}
