// Sky: dithered gradient, stars, sun, moon, clouds and everything that flies.
import {rand, randi, chance, pick, clamp} from './util.js';
import {mix, sprite, shadow, highlight, OUTLINE} from './gfx.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const BANDS = 14;

const BIRD = [sprite(['oo...oo', '..o.o..', '...o...']), sprite(['.......', 'ooooooo', '...o...'])];
const BAT = [sprite(['o..o..o', '.ooooo.', '...o...']), sprite(['..ooo..', '.ooooo.', 'o..o..o'])];
const BALLOON = sprite([
    '..oooo..',
    '.oabbao.',
    'oaabbaao',
    'oaabbaao',
    'oaabbaao',
    '.oaabao.',
    '..oaao..',
    '...oo...',
    '...ll...',
    '..cccc..',
    '..cccc..',
]);
const UFO = sprite([
    '....ooo....',
    '...odddo...',
    '.ooooooooo.',
    'ommmmmmmmmo',
    '.ooooooooo.',
]);
const SLEIGH = sprite([
    'r.r....r.r.......h',
    '.rrr....rrr.....rrr',
    'bbbb...bbbb..ssssss',
    'l..l...l..l..oooooo',
]);

function makeCloud(big) {
    const w = big ? randi(60, 110) : randi(30, 56);
    const h = big ? randi(20, 30) : randi(12, 18);
    const m = new Uint8Array(w * h);
    const blobs = randi(3, 6);
    for (let n = 0; n < blobs; n++) {
        const r = rand(h * 0.35, h * 0.6);
        const cx = rand(r, w - r), cy = h - r - rand(0, h * 0.25);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if ((x - cx) ** 2 + ((y - cy) * 1.3) ** 2 < r * r)
                    m[y * w + x] = 1;
            }
        }
    }
    // flat bottom, top highlight, bottom shade
    for (let x = 0; x < w; x++) {
        let top = -1, bot = -1;
        for (let y = 0; y < h; y++) {
            if (m[y * w + x]) {
                if (top < 0)
                    top = y;
                bot = y;
            }
        }
        if (top < 0)
            continue;
        m[top * w + x] = 2;
        if (top + 1 < bot)
            m[(top + 1) * w + x] = (x % 3) ? 2 : 1;
        for (let y = Math.max(top + 2, bot - 1); y <= bot; y++)
            m[y * w + x] = 3;
    }
    return {w, h, m};
}

export class Sky {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.stars = [];
        for (let i = 0; i < w * h / 260; i++)
            this.stars.push({x: rand(), y: rand(), b: rand(0.3, 1), tw: chance(0.3) ? rand(1, 4) : 0, p: rand(6), big: chance(0.06)});
        this.clouds = [];
        this.flyers = [];
        this.rockets = [];
        this.sparks = [];
        this.flyTimer = rand(20, 90);
        this.t = 0;
    }

    renderStatic(g, env) {
        const top = env.skyTop, bottom = env.skyBottom;
        const cols = [];
        for (let i = 0; i <= BANDS; i++)
            cols.push(g.em(mix(top, bottom, Math.pow(i / BANDS, 1.4))));
        const H = env.horizon, W = g.w, t = g.t;
        for (let y = 0; y < g.h; y++) {
            const f = clamp(y / H, 0, 1) * BANDS;
            const band = Math.min(BANDS - 1, Math.floor(f)), frac = f - band;
            const a = cols[band], b = cols[band + 1];
            const row = (y & 3) * 4;
            for (let x = 0, i = y * W; x < W; x++, i++)
                t[i] = frac > BAYER[row + (x & 3)] ? b : a;
        }
    }

    _spawnCloud(env, anywhere) {
        const big = chance(0.4 + env.weather.v.clouds * 0.4);
        const c = makeCloud(big);
        const dir = env.weather.wind >= 0 ? 1 : -1;
        c.x = anywhere ? rand(-c.w, this.w) : (dir > 0 ? -c.w : this.w);
        c.y = rand(4, env.horizon * 0.6);
        c.speed = (big ? rand(1.5, 3) : rand(3, 6)) * (0.5 + Math.abs(env.weather.wind));
        c.dir = dir;
        this.clouds.push(c);
    }

    update(dt, real, env) {
        this.t += real;
        const want = Math.round(2 + env.weather.v.clouds * this.w / 30);
        if (this.clouds.length === 0)
            for (let i = 0; i < want; i++)
                this._spawnCloud(env, true);
        else if (this.clouds.length < want && chance(real / 4))
            this._spawnCloud(env, false);
        for (const c of this.clouds)
            c.x += c.speed * c.dir * real;
        this.clouds = this.clouds.filter(c => c.x > -c.w - 2 && c.x < this.w + 2 &&
            !(this.clouds.length > want + 2 && chance(real / 30)));

        this.flyTimer -= real;
        if (this.flyTimer <= 0) {
            this.flyTimer = rand(25, 120);
            this._spawnFlyer(env);
        }
        for (const f of this.flyers) {
            if (f.kind === 'ufo' && f.age > f.hover && f.age < f.hover + 14) {
                f.age += real;
                continue;
            }
            if (f.kind === 'ufo' && f.age > f.hover + 14)
                f.vx *= 1 + real * 2;
            f.x += f.vx * real;
            f.y += (f.vy || 0) * real;
            f.age += real;
        }
        this.flyers = this.flyers.filter(f => f.x > -80 && f.x < this.w + 80 && f.age < (f.maxAge || 600));

        for (const r of this.rockets) {
            r.y += r.vy * real;
            r.vy += 25 * real;
            r.x += r.vx * real;
            if (r.vy > -15) {
                r.dead = true;
                const n = randi(18, 34), sp = rand(20, 38), cA = r.c, cB = pick([0xffffff, r.c, 0xffe080]);
                const ring = chance(0.3);
                for (let i = 0; i < n; i++) {
                    const a = i / n * Math.PI * 2 + rand(0.2), s = ring ? sp : sp * rand(0.3, 1);
                    this.sparks.push({x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(1, 1.8), c: chance(0.5) ? cA : cB});
                }
            }
        }
        this.rockets = this.rockets.filter(r => !r.dead);
        for (const s of this.sparks) {
            s.x += s.vx * real;
            s.y += s.vy * real;
            s.vy += 14 * real;
            s.vx *= 1 - real;
            s.life -= real;
        }
        this.sparks = this.sparks.filter(s => s.life > 0);
    }

    firework(x) {
        this.rockets.push({x: x ?? rand(this.w * 0.1, this.w * 0.9), y: this.h * 0.75, vx: rand(-6, 6), vy: rand(-95, -70),
            c: pick([0xff5050, 0x50ff80, 0x60a0ff, 0xffd040, 0xff60e0, 0x60ffff])});
    }

    _spawnFlyer(env) {
        const dir = chance(0.5) ? 1 : -1;
        const x = dir > 0 ? -30 : this.w + 30;
        const night = env.dark > 0.6;
        const kind = night
            ? pick(['plane', 'plane', 'bats', 'heli', ...(chance(0.08) ? ['ufo'] : []), ...(env.holidays.christmasEve ? ['sleigh', 'sleigh'] : [])])
            : pick(['plane', 'birds', 'birds', 'birds', ...(env.weather.v.rain < 0.2 ? ['balloon'] : []), 'plane']);
        const y = rand(8, env.horizon * 0.55);
        if (kind === 'birds' || kind === 'bats')
            this.flyers.push({kind, x, y, vx: dir * rand(14, 22), age: 0, n: randi(3, 8), p: rand(6), bat: kind === 'bats'});
        else if (kind === 'plane')
            this.flyers.push({kind, x, y: rand(6, env.horizon * 0.35), vx: dir * rand(18, 26), age: 0, trail: []});
        else if (kind === 'balloon')
            this.flyers.push({kind, x, y: rand(15, env.horizon * 0.5), vx: dir * rand(2, 4), vy: rand(-0.3, 0.3), age: 0, maxAge: 2000,
                a: pick([0xe04848, 0xf0a030, 0x4890e0, 0x60c060]), b: pick([0xf8e070, 0xffffff, 0xf080c0])});
        else if (kind === 'heli')
            this.flyers.push({kind, x, y, vx: dir * rand(14, 20), age: 0});
        else if (kind === 'ufo')
            this.flyers.push({kind, x, y: rand(15, env.horizon * 0.5), vx: dir * 12, age: 0, maxAge: 240, hover: (30 + rand(this.w * 0.2, this.w * 0.8)) / 12});
        else if (kind === 'sleigh')
            this.flyers.push({kind, x, y: rand(10, env.horizon * 0.35), vx: dir * 16, age: 0});
    }

    render(g, env) {
        const dark = env.dark;
        const cloudiness = env.weather.v.clouds;
        // stars
        if (dark > 0.05) {
            const vis = dark * (1 - cloudiness * 0.85);
            for (const s of this.stars) {
                const y = s.y * env.horizon * 0.95;
                let b = s.b * vis;
                if (s.tw)
                    b *= 0.6 + 0.4 * Math.sin(this.t * s.tw + s.p);
                if (b < 0.08)
                    continue;
                const c = mix(env.skyTop, s.big ? 0xfff4d0 : 0xe8ecff, Math.min(1, b));
                g.pxE(s.x * g.w, y, c);
                if (s.big && b > 0.5) {
                    const cc = mix(env.skyTop, 0xfff4d0, b * 0.4);
                    g.pxE(s.x * g.w - 1, y, cc);
                    g.pxE(s.x * g.w + 1, y, cc);
                    g.pxE(s.x * g.w, y - 1, cc);
                    g.pxE(s.x * g.w, y + 1, cc);
                }
            }
        }
        this._renderMoon(g, env);
        this._renderSun(g, env);
        if (env.weather.rainbow > 0)
            this._renderRainbow(g, env);
        this._renderClouds(g, env);
        for (const f of this.flyers)
            this._renderFlyer(g, f, env);
        for (const r of this.rockets) {
            g.pxE(r.x, r.y, 0xfff0c0);
            g.pxE(r.x, r.y + 1, 0xffa040);
            g.blend(r.x, r.y + 2, 1, 3, 0xff8030, 0.4, true);
        }
        for (const s of this.sparks) {
            const a = Math.min(1, s.life);
            g.blend(s.x, s.y, 1, 1, s.c, a, true);
            if (s.life > 1)
                g.glow(s.x, s.y, 3, s.c, 0.15);
        }
    }

    // Top-down scenes have no sky; only things above the ground are drawn.
    renderOverhead(g, env) {
        for (const f of this.flyers)
            this._renderFlyer(g, f, env);
        for (const r of this.rockets) {
            g.pxE(r.x, r.y, 0xfff0c0);
            g.pxE(r.x, r.y + 1, 0xffa040);
            g.blend(r.x, r.y + 2, 1, 3, 0xff8030, 0.4, true);
        }
        for (const s of this.sparks) {
            g.blend(s.x, s.y, 1, 1, s.c, Math.min(1, s.life), true);
            if (s.life > 1)
                g.glow(s.x, s.y, 3, s.c, 0.15);
        }
    }

    _skyPos(env, t, elev) {
        const span = env.sun.set - env.sun.rise;
        const x = this.w * (0.08 + 0.84 * ((t - env.sun.rise) / span));
        const y = env.horizon - 6 - (elev / Math.max(15, env.sun.noon)) * env.horizon * 0.8;
        return [x, y];
    }

    _renderSun(g, env) {
        const elev = env.sun.elev;
        if (elev < -3)
            return;
        const [x, y] = this._skyPos(env, env.sun.t, elev);
        const low = clamp(1 - elev / 12, 0, 1);
        const core = mix(0xfff6c8, 0xff9c50, low);
        const vis = 1 - env.weather.v.clouds * 0.8;
        g.glow(x, y, 40, mix(0xfff0a0, 0xff8040, low), 0.25 * vis);
        if (vis > 0.3) {
            g.disc(x, y, 11, mix(core, 0xffd890, 0.4), true);
            g.disc(x, y, 10, core, true);
            g.disc(x - 3, y - 3, 4, 0xfffff0, true);
        }
    }

    _renderMoon(g, env) {
        const phase = env.moonPhase;
        let mt = (env.sun.t - phase * 24 + 48) % 24;
        const elev = env.sun.elevAt(mt);
        if (elev < -2)
            return;
        // map moon time through the same arc as the sun
        if (mt < env.sun.rise - 2)
            mt += 24;
        const [x, y] = this._skyPos(env, mt, elev);
        const r = 9, vis = (1 - env.weather.v.clouds * 0.8);
        if (vis < 0.2)
            return;
        const tx = Math.cos(phase * Math.PI * 2);
        // pale by day, bright at night; the dark side only shows at night
        const lit = mix(env.skyTop, 0xf4f0d8, 0.35 + 0.65 * env.dark);
        const crat = mix(env.skyTop, 0xd0c8b0, 0.35 + 0.65 * env.dark);
        const darkC = mix(env.skyTop, 0x3a3a60, 0.3);
        let any = false;
        for (let dy = -r; dy <= r; dy++) {
            const hw = Math.sqrt(r * r - dy * dy);
            for (let dx = -Math.floor(hw); dx <= Math.floor(hw); dx++) {
                const on = phase < 0.5 ? dx > hw * tx - 0.5 : dx < -hw * tx + 0.5;
                if (on) {
                    any = true;
                    const crater = ((dx * 7 + dy * 13) & 15) === 3 || (dx === -2 && dy === 1) || (dx === 1 && dy === -2);
                    g.pxE(x + dx, y + dy, crater ? crat : lit);
                } else if (env.dark > 0.5) {
                    g.pxE(x + dx, y + dy, darkC);
                }
            }
        }
        if (any && env.dark > 0.3)
            g.glow(x, y, 30, 0x8090c0, 0.18 * vis * (0.3 + 0.7 * Math.sin(phase * Math.PI)));
    }

    _renderRainbow(g, env) {
        const cols = [0xe05050, 0xf0a040, 0xf0e050, 0x60c060, 0x5090e0, 0x8060c0];
        const cx = this.w * 0.6, cy = env.horizon + 10, R = env.horizon * 0.75;
        const a = env.weather.rainbow * 0.35;
        for (let i = 0; i < cols.length; i++) {
            const r = R - i * 2;
            for (let ang = 0; ang < Math.PI; ang += 0.5 / r) {
                const x = cx + Math.cos(ang) * r, y = cy - Math.sin(ang) * r;
                if (y < env.horizon)
                    g.blend(x, y, 1, 2, cols[i], a);
            }
        }
    }

    _renderClouds(g, env) {
        const v = env.weather.v;
        const grey = mix(0xffffff, 0x8890a0, Math.max(0, v.clouds - 0.5) * 1.6 + v.rain * 0.3);
        const body = mix(grey, env.skyBottom, 0.22);
        const hi = highlight(mix(grey, env.skyBottom, 0.08), 0.3);
        const lo = shadow(mix(body, env.skyTop, 0.25), 0.25);
        const cols = [0, g.sh(body), g.sh(hi), g.sh(lo)];
        const t = g.t, W = g.w;
        for (const c of this.clouds) {
            const ox = Math.floor(c.x), oy = Math.floor(c.y);
            for (let y = 0; y < c.h; y++) {
                const yy = oy + y;
                if (yy < 0 || yy >= g.h)
                    continue;
                for (let x = 0; x < c.w; x++) {
                    const k = c.m[y * c.w + x];
                    const xx = ox + x;
                    if (k && xx >= 0 && xx < W)
                        t[yy * W + xx] = cols[k];
                }
            }
        }
    }

    _renderFlyer(g, f, env) {
        const flip = f.vx < 0;
        if (f.kind === 'birds' || f.kind === 'bats') {
            for (let i = 0; i < f.n; i++) {
                const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
                const x = f.x - (flip ? -1 : 1) * row * 9, y = f.y + side * row * 5 + Math.sin(f.age * 2 + i) * 1.5;
                const fr = Math.floor(f.age * 6 + i) % 2;
                g.sprite((f.bat ? BAT : BIRD)[fr], x, y, {o: f.bat ? 0x201828 : 0x3a3040}, flip);
            }
        } else if (f.kind === 'plane') {
            const x = Math.floor(f.x), y = Math.floor(f.y);
            if (env.dark > 0.5) {
                const blink = Math.floor(f.age * 1.5) % 2 === 0;
                g.pxE(x, y, 0xffffff);
                if (blink) {
                    g.pxE(x - 3, y, 0xff3030);
                    g.pxE(x + 3, y, 0x30ff60);
                    g.glow(x - 3, y, 3, 0xff3030, 0.3);
                }
            } else {
                const dir = flip ? 1 : -1;
                for (let i = 6; i < 60; i++)
                    g.blend(x + dir * i, y, 1, 1, 0xffffff, 0.5 * (1 - i / 60));
                g.rect(x - 4, y, 9, 1, 0xd8dce4);
                g.rect(x - 1, y - 1, 2, 3, 0xc0c4cc);
                g.px(x + (flip ? 4 : -4), y - 1, 0xc0c4cc);
            }
        } else if (f.kind === 'balloon') {
            g.sprite(BALLOON, f.x, f.y, {o: OUTLINE, a: f.a, b: f.b, l: 0x5a4030, c: 0x9a6a3a});
        } else if (f.kind === 'heli') {
            const x = Math.floor(f.x), y = Math.floor(f.y);
            g.rect(x - 3, y, 7, 3, 0x303848);
            g.rect(x + (flip ? 3 : -8), y + 1, 5, 1, 0x303848);
            const r = Math.floor(f.age * 20) % 2;
            g.rect(x - (r ? 6 : 3), y - 1, r ? 13 : 7, 1, 0x505868);
            if (Math.floor(f.age * 2) % 2)
                g.pxE(x, y + 3, 0xff3030);
            // searchlight
            if (env.dark > 0.5) {
                for (let i = 1; i < 40; i++)
                    g.add(x - i * 0.3, y + 3 + i, 1 + i * 0.4, 1, 0xfff0c0, 0.12 * (1 - i / 40));
            }
        } else if (f.kind === 'ufo') {
            const hovering = f.age > f.hover && f.age < f.hover + 14;
            const x = Math.floor(f.x), y = Math.floor(f.y + Math.sin(f.age * 3) * 2);
            if (hovering) {
                for (let i = 0; i < 60; i++)
                    g.add(x + 5 - i * 0.25, y + 5 + i, 1 + i * 0.5, 1, 0x80ffa0, 0.12);
            }
            g.sprite(UFO, x, y, {o: 0x303040, d: 0x90e0ff, m: 0x8890a0});
            const k = Math.floor(f.age * 8) % 3;
            g.pxE(x + 2 + k * 3, y + 3, [0xff5050, 0xffff60, 0x60ff60][k]);
            g.glow(x + 5, y + 3, 10, 0x80ffa0, 0.15);
        } else if (f.kind === 'sleigh') {
            g.sprite(SLEIGH, f.x, f.y + Math.sin(f.age * 2) * 2, {r: 0x6a4830, b: 0x7a5838, l: 0x4a3828, h: 0xe03030, s: 0xc02828, o: 0x8a5a30}, flip);
            const nose = flip ? f.x + 17 : f.x;
            g.pxE(nose, f.y + 1 + Math.sin(f.age * 2) * 2, 0xff3030);
            g.glow(nose, f.y + 1, 4, 0xff3030, 0.4);
        }
    }
}
