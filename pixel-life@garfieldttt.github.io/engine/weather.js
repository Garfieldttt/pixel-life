// Weather state machine with smooth transitions, rain/snow particles,
// lightning, rainbows, snow cover and wet ground.
import {rand, chance, weighted, approach, clamp} from './util.js';

const TYPES = {
    clear: {clouds: 0.08, rain: 0, snow: 0, fog: 0, dim: 0, breeze: 0.3},
    partly: {clouds: 0.45, rain: 0, snow: 0, fog: 0, dim: 0.05, breeze: 0.45},
    overcast: {clouds: 0.95, rain: 0, snow: 0, fog: 0, dim: 0.22, breeze: 0.55},
    drizzle: {clouds: 0.9, rain: 0.35, snow: 0, fog: 0.1, dim: 0.22, breeze: 0.5},
    rain: {clouds: 1, rain: 1, snow: 0, fog: 0.1, dim: 0.32, breeze: 0.8},
    storm: {clouds: 1, rain: 1.6, snow: 0, fog: 0, dim: 0.45, breeze: 1.6},
    snow: {clouds: 1, rain: 0, snow: 1, fog: 0.1, dim: 0.2, breeze: 0.5},
    fog: {clouds: 0.5, rain: 0, snow: 0, fog: 1, dim: 0.15, breeze: 0.1},
};

const WEIGHTS = {
    spring: {clear: 4, partly: 5, overcast: 2, drizzle: 2, rain: 2, storm: 0.5, fog: 0.5},
    summer: {clear: 7, partly: 5, overcast: 1, drizzle: 1, rain: 1, storm: 1.2, fog: 0.2},
    autumn: {clear: 3, partly: 4, overcast: 3, drizzle: 2, rain: 2, storm: 0.3, fog: 2},
    winter: {clear: 3, partly: 3, overcast: 3, drizzle: 0.5, rain: 0.5, snow: 4, fog: 1.5},
};

export const WEATHER_TYPES = Object.keys(TYPES);

export class Weather {
    constructor(seasonName) {
        this.type = this._next(seasonName);
        this.v = {...TYPES[this.type]};
        this.timer = rand(900, 3000);
        this.wind = rand(-1, 1);
        this.snowCover = seasonName === 'winter' && chance(0.4) ? rand(0.3, 1) : 0;
        this.wet = this.v.rain > 0 ? 1 : 0;
        this.flash = 0;
        this.bolt = null;
        this.rainbow = 0;
        this.drops = [];
        this.flakes = [];
        this.fixed = null;
        this.t = 0;
        this.gusts = [];
        this.gustTimer = rand(2, 8);
    }

    // How far grass and trees at x lean right now, signed with the wind
    // direction: a steady push plus gusts that roll across the screen and
    // a little flutter. About 0.1 on a calm day, up to 2.5 in a storm.
    lean(x) {
        const dir = this.wind < 0 ? -1 : 1, s = this.v.breeze * (0.6 + Math.min(1.5, Math.abs(this.wind)) * 0.4);
        const gust = 0.5 + 0.5 * Math.sin(x * 0.011 - dir * this.t * 1.3) * Math.sin(this.t * 0.37 + x * 0.003);
        return dir * s * (0.3 + 0.9 * gust) + s * 0.2 * Math.sin(this.t * 2.6 + x * 0.23);
    }

    // Grass moves more than trees: a gentle rocking even on a calm day,
    // and now and then a gust rolls across the meadow as a visible wave.
    grassLean(x) {
        let l = this.lean(x) + 0.3 * (0.6 + this.v.breeze) * Math.sin(this.t * 1.6 + x * 0.045);
        for (const g of this.gusts) {
            const d = (x - g.x) / g.wd;
            if (d > -2.5 && d < 2.5)
                l += g.dir * g.a * Math.exp(-d * d) * (1 + 0.25 * Math.sin(this.t * 9 + x * 0.3));
        }
        return l;
    }

    // gust fronts: more often and stronger the windier the weather
    _updateGusts(real, w) {
        this.gustTimer -= real;
        if (this.gustTimer <= 0) {
            const b = this.v.breeze, dir = this.wind < 0 ? -1 : 1;
            this.gustTimer = rand(5, 16) / (0.4 + b);
            this.gusts.push({x: dir > 0 ? -150 : w + 150, dir, v: rand(70, 130) * (0.7 + b * 0.5), a: rand(0.7, 1.3) * (0.5 + b * 0.6), wd: rand(50, 110)});
        }
        for (const g of this.gusts)
            g.x += g.dir * g.v * real;
        this.gusts = this.gusts.filter(g => g.x > -200 && g.x < w + 200);
    }

    // a weather type chosen in the settings, or null to follow the season
    setFixed(type) {
        this.fixed = TYPES[type] ? type : null;
        if (this.fixed)
            this.force(this.fixed);
    }

    _next(seasonName) {
        const w = WEIGHTS[seasonName];
        return weighted(Object.entries(w));
    }

    force(type) {
        this.type = type;
        this.v = {...TYPES[type]};
        this.timer = rand(900, 3000);
    }

    // dt = simulated seconds; real = real seconds (particles, flashes)
    update(dt, real, env) {
        this.timer -= dt;
        if (this.timer <= 0) {
            const wasRain = this.v.rain > 0.3;
            this.type = this.fixed ?? this._next(env.season);
            this.timer = rand(900, 3600);
            this.wind = clamp(this.wind + rand(-0.8, 0.8), -1.5, 1.5);
            if (wasRain && (this.type === 'clear' || this.type === 'partly') && env.sun.elev > 3 && chance(0.6))
                this.rainbow = 1;
        }
        const target = TYPES[this.type];
        for (const k in target)
            this.v[k] = approach(this.v[k], target[k], 1 / 150, dt);

        if (this.v.snow > 0.3)
            this.snowCover = Math.min(1, this.snowCover + dt / 1500 * this.v.snow);
        else if (this.snowCover > 0)
            this.snowCover = Math.max(0, this.snowCover - dt / (env.season === 'winter' ? 20000 : 4000) * (env.sun.elev > 0 ? 2 : 0.5));
        if (this.v.rain > 0.2)
            this.wet = Math.min(1, this.wet + dt / 300);
        else
            this.wet = Math.max(0, this.wet - dt / 2400);
        if (this.rainbow > 0)
            this.rainbow = Math.max(0, this.rainbow - dt / 900);

        this.t += real;
        this.flash = Math.max(0, this.flash - real * 3);
        if (this.type === 'storm' && this.v.rain > 1 && chance(real / 12)) {
            this.flash = 1;
            this.bolt = {x: rand(0.1, 0.9), seed: Math.random(), life: 0.35};
        }
        if (this.bolt) {
            this.bolt.life -= real;
            if (this.bolt.life <= 0)
                this.bolt = null;
        }
    }

    // copy the state of another monitor's weather, keep own particles
    follow(other) {
        for (const k of ['fixed', 'type', 'timer', 'wind', 'snowCover', 'wet', 'flash', 'bolt', 'rainbow', 't'])
            this[k] = other[k];
        Object.assign(this.v, other.v);
    }

    updateParticles(real, w, h) {
        this._updateGusts(real, w);
        const want = Math.floor(this.v.rain * w * 0.35);
        while (this.drops.length < want)
            this.drops.push({x: rand(w), y: rand(-h, h), s: rand(180, 260)});
        if (this.drops.length > want)
            this.drops.length = want;
        for (const d of this.drops) {
            d.y += d.s * real;
            d.x += this.wind * 40 * real;
            if (d.y > h) {
                d.y = rand(-20, 0);
                d.x = rand(-20, w + 20);
            }
        }
        const wantF = Math.floor(this.v.snow * w * 0.3);
        while (this.flakes.length < wantF)
            this.flakes.push({x: rand(w), y: rand(-h, h), s: rand(12, 28), p: rand(6.28), big: chance(0.2)});
        if (this.flakes.length > wantF)
            this.flakes.length = wantF;
        for (const f of this.flakes) {
            f.y += f.s * real;
            f.p += real * 1.5;
            f.x += (Math.sin(f.p) * 8 + this.wind * 14) * real;
            if (f.y > h) {
                f.y = rand(-10, 0);
                f.x = rand(-10, w + 10);
            }
        }
    }

    render(g) {
        for (const d of this.drops) {
            const x = Math.floor(d.x), y = Math.floor(d.y);
            g.blend(x, y, 1, 3, 0xa8c8f0, 0.55);
        }
        for (const f of this.flakes) {
            if (f.big)
                g.rect(f.x - 1, f.y, 2, 2, 0xf4f8ff);
            else
                g.px(f.x, f.y, 0xffffff);
        }
    }

    renderBolt(g, groundY) {
        if (!this.bolt)
            return;
        let x = this.bolt.x * g.w, y = 0;
        let s = this.bolt.seed * 1000;
        const rnd = () => {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
        while (y < groundY) {
            const nx = x + (rnd() - 0.5) * 14, ny = y + 4 + rnd() * 8;
            g.line(x, y, nx, ny, 0xffffff, true);
            g.line(x + 1, y, nx + 1, ny, 0xc8d8ff, true);
            if (rnd() < 0.12)
                g.line(nx, ny, nx + (rnd() - 0.5) * 30, ny + 12, 0xd0e0ff, true);
            x = nx;
            y = ny;
        }
    }
}
