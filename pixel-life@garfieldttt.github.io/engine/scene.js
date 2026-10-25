// Engine: owns the clock, environment, weather, sky and the active motif,
// and renders everything into one RGBA pixel buffer.
import {clamp, rand, pick} from './util.js';
import {Gfx, mix, seloutBuffer} from './gfx.js';
import {solar, moonPhase, skyAt, season, holidays} from './env.js';
import {Weather} from './weather.js';
import {Sky} from './sky.js';
import {Town} from './town.js';
import {Farm} from './farm.js';
import {Village} from './village.js';
import {Space} from './space.js';
import {Deep} from './deep.js';
import {Medieval} from './medieval.js';
import {drawClock} from './clock.js';

export const MOTIFS = {village: Village, city: Town, country: Farm, medieval: Medieval, space: Space, underwater: Deep};

export class Engine {
    constructor(width, height, opts = {}) {
        this.opts = {motif: 'auto', speed: 1, lat: 48, clock: 'none', clockPos: 'top-right', rotateMinutes: 60,
            season: 'auto', timeOfDay: 'auto', weather: 'auto', people: 1, traffic: 1, ...opts};
        this.g = new Gfx(width, height);
        this.w = width;
        this.h = height;
        this.simTime = Date.now();
        this.env = {horizon: height * 0.6};
        this._updateEnv();
        this.weather = new Weather(this.env.season);
        this.weather.setFixed(this.opts.weather);
        this.env.weather = this.weather;
        this._updateEnv();
        this.sky = new Sky(width, height);
        this.skyLayer = this.g.layer();
        this.skyKey = '';
        this.worldKey = '';
        this.fade = 0;
        this.motifAge = 0;
        this.setMotif(this.opts.motif);
    }

    setMotif(name) {
        this.opts.motif = name;
        const pickName = name === 'auto' || !MOTIFS[name]
            ? pick(Object.keys(MOTIFS).filter(k => !this.motif || k !== this.motif.name))
            : name;
        this.motif = new MOTIFS[pickName](this.w, this.h, this.env);
        // the sky keeps to the era of the scene (no planes over the castle)
        this.env.era = this.motif.era || 'modern';
        this.env.horizon = this.motif.horizon;
        this._updateEnv();
        this.worldKey = '';
        this.skyKey = '';
        this.motifAge = 0;
    }

    setOption(key, value) {
        this.opts[key] = value;
        if (key === 'motif')
            this.setMotif(value);
        else if (key === 'weather')
            this.weather.setFixed(value);
    }

    // Jump the simulated clock (preview only).
    setTime(ms) {
        this.simTime = ms;
    }

    now() {
        return this.simTime;
    }

    // The scene follows the computer clock and calendar unless a season
    // or a time of day is fixed in the settings; the clock overlay always
    // shows the real time.
    _sceneDate(real) {
        const {season, timeOfDay} = this.opts;
        let month = {spring: 3, summer: 6, autumn: 9, winter: 0}[season];
        if (month !== undefined && this.opts.lat < 0)
            month = (month + 6) % 12;
        const hour = {morning: 8.5, day: 13, night: 23.5}[timeOfDay];
        if (month === undefined && hour === undefined && timeOfDay !== 'evening')
            return real;
        const d = new Date(real);
        if (month !== undefined)
            d.setMonth(month, 15);
        if (timeOfDay === 'evening')
            d.setHours(0, this._duskMinutes(d), 0, 0);
        else if (hour !== undefined)
            d.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
        return d;
    }

    // minutes after midnight when the sun is just about to set
    _duskMinutes(d) {
        const key = `${d.toDateString()}:${this.opts.lat}`;
        if (this._dusk?.key !== key) {
            let m = 12 * 60;
            const t = new Date(d);
            for (; m < 23 * 60; m += 10) {
                t.setHours(0, m, 0, 0);
                if (solar(t, this.opts.lat).elev < 4)
                    break;
            }
            this._dusk = {key, m};
        }
        return this._dusk.m;
    }

    _updateEnv() {
        const env = this.env;
        env.clockDate = new Date(this.simTime);
        // crowd sliders: 0 = empty, 1 = normal, 2 = twice as busy
        env.people = this.opts.people;
        env.traffic = this.opts.traffic;
        const date = this._sceneDate(env.clockDate);
        env.date = date;
        env.hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
        env.weekday = date.getDay();
        env.month = date.getMonth();
        // the seasons are turned around south of the equator
        env.seasonMonth = this.opts.lat < 0 ? (env.month + 6) % 12 : env.month;
        env.season = season(env.seasonMonth);
        env.sun = solar(date, this.opts.lat);
        env.moonPhase = moonPhase(date);
        env.holidays = holidays(date);
        const sk = skyAt(env.sun.elev);
        let dark = clamp((2 - env.sun.elev) / 12, 0, 1);
        if (!env.weather) {
            env.dark = dark;
            return;
        }
        const v = env.weather.v;
        dark = clamp(dark + v.dim * 0.6 * (1 - dark), 0, 1);
        env.dark = dark;
        env.night = dark > 0.6;
        env.lampsOn = dark > 0.4;
        // overcast and fog wash the sky out to grey
        const bright = 1 - clamp((2 - env.sun.elev) / 14, 0, 0.85);
        const grey = mix(0x30343c, 0xa8b0bc, bright);
        const g = Math.min(0.85, v.clouds > 0.6 ? (v.clouds - 0.6) * 2.2 : 0) + v.rain * 0.1;
        env.skyTop = mix(sk.top, grey, Math.min(0.9, g));
        env.skyBottom = mix(mix(sk.bottom, grey, Math.min(0.9, g)), mix(0x50545c, 0xd8dce0, bright), v.fog * 0.6);
        const dim = 1 - v.dim * 0.5;
        const desat = v.dim * 0.6;
        let [r, gg, b] = sk.amb;
        const avg = (r + gg + b) / 3;
        r = (r + (avg - r) * desat) * dim;
        gg = (gg + (avg - gg) * desat) * dim;
        b = (b + (avg - b) * desat) * dim;
        const f = env.weather.flash;
        if (f > 0) {
            r += f * 0.8;
            gg += f * 0.8;
            b += f;
            env.skyTop = mix(env.skyTop, 0xd8e0ff, f * 0.6);
            env.skyBottom = mix(env.skyBottom, 0xd8e0ff, f * 0.6);
        }
        // quantize so cached static layers rebuild rarely
        const q = x => Math.round(x * 48) / 48;
        env.amb = [q(r), q(gg), q(b)];
        // scenes without a sky bring their own light
        if (this.motif?.ambient)
            env.amb = this.motif.ambient(env).map(q);
    }

    tick(real) {
        real = Math.min(real, 0.25);
        const speed = this.opts.speed;
        const dt = real * speed;
        if (speed === 1 && !this.timeOffset)
            this.simTime = Date.now();
        else
            this.simTime += dt * 1000;
        if (this.leader)
            this.weather.follow(this.leader.weather);
        else
            this.weather.update(dt, real, this.env);
        this._updateEnv();
        this.weather.updateParticles(real, this.w, this.h);
        this.sky.update(dt, real, this.env);
        this.motif.update(dt, real, this.env, this);
        this.motifAge += real;
        if (this.opts.motif === 'auto' && this.motifAge > this.opts.rotateMinutes * 60 && this.fade === 0)
            this.fade = 0.001;
        if (this.fade > 0) {
            this.fade += real / 1.5;
            if (this.fade >= 1 && this.fade - real / 1.5 < 1)
                this.setMotif('auto');
            if (this.fade >= 2)
                this.fade = 0;
        }
    }

    render() {
        const g = this.g, env = this.env;
        g.setAmbient(...env.amb);
        const top = this.motif.topDown, own = this.motif.ownSky;
        if (!top && !own) {
            const skyKey = `${env.skyTop}:${env.skyBottom}:${env.horizon}`;
            if (skyKey !== this.skyKey) {
                this.skyKey = skyKey;
                g.into(this.skyLayer, () => this.sky.renderStatic(g, env));
            }
            g.buf.set(this.skyLayer);
            this.sky.render(g, env);
        }
        // static layers are drawn unlit and only rebuilt when their
        // content changes; the light is applied while composing
        const worldKey = this.motif.staticKey(env);
        if (worldKey !== this.worldKey) {
            this.worldKey = worldKey;
            g.unlit(() => this.motif.renderStatic(g, env));
            // sel-out for everything drawn straight into the static layers
            for (const v of Object.values(this.motif))
                if (v instanceof Uint32Array && v.length === this.w * this.h)
                    seloutBuffer(v, this.w, this.h);
            g.layerVersion++;
        }
        g.compose(this.motif.layerA, 0, this.h, true);
        this.motif.renderDynamic(g, env);
        if (top)
            this.sky.renderOverhead(g, env);
        if (own)
            return this._finish(g, env);
        this.weather.render(g);
        if (!top)
            this.weather.renderBolt(g, this.motif.horizon);
        const fog = env.weather.v.fog;
        if (fog > 0.05) {
            // one pass, denser towards the ground
            const fc = mix(0x50545c, 0xd8dce0, 1 - env.dark * 0.8);
            const y0 = Math.max(0, this.motif.horizon - 50);
            for (let y = y0; y < this.h; y += 2)
                g.blend(0, y, this.w, 2, fc, fog * 0.09 * Math.min(6, Math.floor((y - y0) / 12) + 1), true);
        }
        if (env.weather.flash > 0.5)
            g.add(0, 0, this.w, this.h, 0xc0c8ff, (env.weather.flash - 0.5) * 0.3);
        return this._finish(g, env);
    }

    _finish(g, env) {
        if (this.fade > 0)
            g.blend(0, 0, this.w, this.h, 0x0a0812, this.fade < 1 ? this.fade : 2 - this.fade, true);
        drawClock(g, env, this.opts.clock, this.opts.clockPos);
        return g.bytes;
    }
}

export {rand};
