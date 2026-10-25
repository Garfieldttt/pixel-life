// Big city motif in the cozy pixel look: a street of cottages, town houses
// with shops, apartment blocks and towers; traffic, people, pets, a park
// in the foreground and plenty of random events.
import {rand, randi, chance, pick, weighted, clamp, steppedLevel} from './util.js';
import {mix, shadow, highlight} from './gfx.js';
import * as A from './art.js';
import {Household, Win} from './windows.js';
import {makePerson, drawPerson, makeCat, catFigure, personFigure} from './people.js';
import {makeVehicle, drawVehicle, vehicleLength, CITY_TRAFFIC, randomTraffic} from './vehicles.js';
import {drawFigure} from './figure.js';
import {Timers} from './timers.js';

// storeys and doors sized for people about 31px tall
const FH = 44, GH = 52;
const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000;
const INK = A.INK;

const WALLS = {
    planks: [0x4a7ac0, 0x5aa070, 0xc85a4a, 0xe8c070, 0x8a6ab0, 0x60a8b0, 0xd88a50],
    siding: [0xf0e0b8, 0xb8d0e8, 0xe8b8a8, 0xc8e0b0, 0xf0f0e0],
    stone: [0x9a8a6a, 0x8a8a8a, 0xa89878],
    brick: [0xb0583e, 0x984a38, 0xc07050],
    plaster: [0xf0d8b0, 0xe8c8a0, 0xd8e0c8, 0xf0e0d0, 0xe0c8d8, 0xc8d8e8, 0xf4e8c0],
};
const ROOFS = [0x8a3a6a, 0x7a4a2a, 0x3a6a8a, 0xa84838, 0x4a7a4a, 0x6a4a8a];
const FRAMES = [0x9a5a30, 0xf0ece0, 0x5a6a7a, 0x3a5a4a, 0x7a3a3a];
const SHOPS = [
    {name: 'CAFE', open: [7, 21], c: 0x8a5a3a, goods: 'cups', tables: true},
    {name: 'BAKERY', open: [6, 18], c: 0xe8a640, goods: 'bread'},
    {name: 'PIZZA', open: [11, 23], c: 0xd84848, goods: 'oven', tables: true},
    {name: 'BOOKS', open: [9, 19], c: 0x3a6a5a, goods: 'books'},
    {name: 'FLOWERS', open: [8, 18], c: 0xe876a0, goods: 'flowers'},
    {name: 'BAR', open: [17, 26], c: 0x5a3a6a, goods: 'bottles', tables: true},
    {name: 'KIOSK', open: [6, 23], c: 0x4870c8, goods: 'mags'},
    {name: 'TOYS', open: [9, 19], c: 0xf0c030, goods: 'toys'},
    {name: 'GELATO', open: [10, 22], c: 0x60b0c8, goods: 'ice'},
    {name: 'MARKET', open: [7, 20], c: 0x5a9a4a, goods: 'fruit'},
    {name: 'HOTEL', open: [0, 24], c: 0x6a2a3a, goods: 'none'},
];

export class Town {
    constructor(w, h, env) {
        this.name = 'city';
        this.w = w;
        this.h = h;
        this.timers = new Timers();
        this.layout(env);
    }

    layout(env) {
        const W = this.w, H = this.h;
        this.base = Math.round(H * 0.56);
        this.horizon = this.base - 10;
        this.backTop = this.base;
        this.roadTop = this.base + 16;
        this.frontTop = this.roadTop + 50;
        this.parkTop = this.frontTop + 16;
        this.backY = [this.base + 8, this.base + 14];
        this.frontY = [this.frontTop + 8, this.frontTop + 15];
        this.parkY = H - 5;
        this.lanes = [
            {y: this.roadTop + 22, dir: -1, cars: []},
            {y: this.roadTop + 46, dir: 1, cars: []},
        ];
        this.crossX = Math.floor(W * rand(0.35, 0.65));
        this.light = {state: 'green', t: rand(0, 15)};
        this.busX = clamp(this.crossX + (chance(0.5) ? 1 : -1) * Math.floor(W * rand(0.2, 0.3)), 60, W - 80);
        this.people = [];
        this.pigeons = [];
        this.critters = [];
        this.smoke = [];
        this.leaves = [];
        this.floaters = [];
        this.ducks = [];
        this.eventTimer = rand(30, 90);
        this.realT = 0;
        this.buildBuildings(env);
        this.buildSkyline();
        this.buildProps();
        this.layerA = this.layerB = this.layerC = null;
        for (let i = 0; i < 40; i++)
            this._populate(env, true);
    }

    // ---------- layout ----------

    buildBuildings(env) {
        const W = this.w;
        const maxFloors = Math.max(2, Math.floor((this.base - 40 - GH) / FH));
        this.buildings = [];
        this.windows = [];
        this.doors = [];
        let x = -randi(0, 30);
        let parks = 0;
        while (x < W) {
            const kind = weighted([['cottage', 3], ['townhouse', 4], ['apartment', 4], ['tower', maxFloors > 5 ? 1.5 : 0], ['gap', parks < 1 ? 1 : 0.2]]);
            if (kind === 'gap') {
                parks++;
                const w = randi(40, 60);
                this.buildings.push({kind, x, w, top: this.base, seed: randi(0, 1e6)});
                x += w;
                continue;
            }
            const b = {kind, x, wins: [], balconies: [], roofItems: [], seed: randi(0, 1e6)};
            const frame = A.ramp(pick(FRAMES));
            b.frameR = frame;
            if (kind === 'cottage') {
                b.w = randi(112, 136);
                b.floors = 1;
                b.wallH = 72;
                b.mat = pick(['planks', 'planks', 'siding', 'stone']);
                b.roofH = Math.floor(b.w * 0.5);
                b.top = this.base - b.wallH;
            } else if (kind === 'townhouse') {
                b.w = randi(104, 140);
                b.floors = randi(1, 2);
                b.mat = pick(['stone', 'brick', 'plaster', 'siding']);
                b.wallH = GH + b.floors * FH;
                b.roofH = 34;
                b.top = this.base - b.wallH;
            } else if (kind === 'apartment') {
                b.w = randi(128, 164);
                b.floors = Math.min(maxFloors, randi(3, 6));
                b.mat = pick(['brick', 'plaster', 'brick', 'stone']);
                b.wallH = GH + b.floors * FH;
                b.top = this.base - b.wallH;
            } else {
                b.w = randi(112, 140);
                b.floors = Math.min(maxFloors, randi(6, 10));
                b.mat = 'glass';
                b.wallH = GH + b.floors * FH;
                b.top = this.base - b.wallH;
            }
            const w = b.w;
            b.color = b.mat === 'glass' ? pick([0x7a90a8, 0x8a98b0, 0x6a7a8a]) : pick(WALLS[b.mat]);
            b.wallR = A.ramp(b.color);
            b.roofR = A.ramp(pick(ROOFS));
            b.shop = kind !== 'cottage' && kind !== 'tower' && chance(kind === 'townhouse' ? 0.7 : 0.45) ? {...pick(SHOPS)} : null;
            if (b.shop) {
                b.shop.awning = [pick([0xd84848, 0x4c7cd0, 0x5cae5c, 0xe8a640, 0x9a5cba]), 0xf4f0e4];
                b.shop.broken = chance(0.3) ? randi(0, b.shop.name.length - 1) : -1;
                b.shop.guests = [];
            }
            // windows per floor
            const cols = Math.max(1, Math.floor((w - 8) / 34));
            const span = w / cols;
            const winW = b.mat === 'glass' ? 24 : 20, winH = 26;
            const floorsY = [];
            if (kind === 'cottage')
                floorsY.push(this.base - b.wallH + 14);
            else
                for (let f = 0; f < b.floors; f++)
                    floorsY.push(b.top + 8 + f * FH);
            floorsY.forEach((fy, f) => {
                let hh = new Household();
                for (let c = 0; c < cols; c++) {
                    if (kind === 'cottage' && cols > 2 && c === Math.floor(cols / 2))
                        continue;
                    if (b.mat !== 'glass' && c > 0 && chance(0.4))
                        hh = new Household();
                    const wx = Math.floor(x + span * c + (span - winW) / 2);
                    const win = new Win(wx, fy, winW, winH, hh, b.mat === 'glass' ? 'office' : pick(['living', 'living', 'kitchen', 'bed']), b.mat === 'glass' ? 'office' : 'home');
                    win.frameR = frame;
                    win.box = b.mat !== 'glass' && chance(0.35);
                    b.wins.push(win);
                    this.windows.push(win);
                    if (kind === 'apartment' && f > 0 && chance(0.2))
                        b.balconies.push({x: wx - 4, y: fy + winH + 4, w: winW + 8, win, flowers: chance(0.6), laundry: chance(0.3), smoker: chance(0.25)});
                }
            });
            if (kind === 'cottage') {
                // cottage windows sit left and right of the door
                b.wins.forEach((win, i) => {
                    win.x = i === 0 ? x + 14 : x + w - 34;
                });
                if (b.wins.length > 2)
                    b.wins.length = 2;
                b.attic = new Win(Math.floor(x + w / 2) - 9, this.base - b.wallH - Math.floor(b.roofH * 0.55), 18, 16, b.wins[0].hh, 'bed');
                b.attic.frameR = frame;
            }
            // ground floor
            const doorW = 20, doorH = 38;
            const doorX = b.shop ? x + w - doorW - 8 : Math.floor(x + w / 2 - doorW / 2);
            b.door = {x: doorX, y: this.base - doorH, w: doorW, h: doorH, open: 0, color: A.ramp(pick([0x8a4a30, 0x9a3a30, 0x3a6a5a, 0x4a5a8a, 0x6a4a30]))};
            this.doors.push(b.door);
            if (!b.shop && kind !== 'cottage') {
                const hh = new Household();
                for (let c = 0; c < cols; c++) {
                    const wx = Math.floor(x + span * c + (span - winW) / 2);
                    if (Math.abs(wx + winW / 2 - (doorX + doorW / 2)) > 28) {
                        const win = new Win(wx, this.base - GH + 12, winW, winH, hh, b.mat === 'glass' ? 'office' : 'living', b.mat === 'glass' ? 'office' : 'home');
                        win.frameR = frame;
                        b.wins.push(win);
                        this.windows.push(win);
                    }
                }
            }
            if (b.attic)
                this.windows.push(b.attic);
            // roof furniture
            if (kind === 'apartment' || kind === 'tower') {
                for (let i = 0; i < randi(1, 3); i++)
                    b.roofItems.push({kind: pick(['antenna', 'dish', 'tank', 'chimney', 'garden', 'solar']), x: x + randi(6, w - 24)});
                if (kind === 'tower')
                    b.roofItems.push({kind: 'mast', x: x + Math.floor(w / 2)});
            } else {
                b.roofItems.push({kind: 'chimney', x: x + randi(10, w - 22)});
            }
            this.buildings.push(b);
            x += w + (chance(0.2) ? randi(4, 10) : 2);
        }
    }

    buildSkyline() {
        this.skyline = [];
        let x = -10;
        while (x < this.w) {
            const w = randi(24, 56), h = randi(50, Math.max(60, this.base * 0.85));
            this.skyline.push({x, w, h, kind: chance(0.08) ? 'spire' : chance(0.1) ? 'dome' : 'block'});
            x += w - randi(0, 8);
        }
        this.tower = {x: randi(30, this.w - 30), h: Math.min(this.base - 12, randi(150, 210))};
        this.cranes = chance(0.7) ? [{x: randi(40, this.w - 90), h: randi(110, 160), arm: randi(50, 80)}] : [];
    }

    buildProps() {
        const W = this.w;
        this.lamps = [];
        for (let x = randi(20, 60); x < W; x += randi(90, 130)) {
            if (Math.abs(x - this.crossX - 12) > 24 && Math.abs(x - this.busX) > 30)
                this.lamps.push({x, flicker: chance(0.08)});
        }
        this.curbTrees = [];
        for (let x = randi(40, 80); x < W; x += randi(110, 170)) {
            if (!this.lamps.some(l => Math.abs(l.x - x) < 26) && Math.abs(x - this.crossX - 12) > 30 && Math.abs(x - this.busX) > 36)
                this.curbTrees.push({x, size: randi(14, 18), seed: randi(0, 1e6)});
        }
        // park in the foreground
        this.parkTrees = [];
        for (let x = randi(10, 40); x < W; x += randi(70, 120))
            this.parkTrees.push({x, y: this.h - randi(2, 10), size: randi(20, 28), seed: randi(0, 1e6)});
        this.parkBits = [];
        for (let x = randi(20, 60); x < W; x += randi(40, 80)) {
            if (!this.parkTrees.some(t => Math.abs(t.x - x) < 24))
                this.parkBits.push({x, kind: pick(['bench', 'flowers', 'flowers', 'fountain', 'bin', 'bushes', 'sandbox']), seed: randi(0, 1e6)});
        }
        if (!this.parkBits.some(b => b.kind === 'fountain') && this.parkBits.length)
            this.parkBits[Math.floor(this.parkBits.length / 2)].kind = 'fountain';
        this.benches = this.parkBits.filter(b => b.kind === 'bench');
        this.hydrants = [randi(20, W - 20)];
        this._buildMeadow();
    }

    // The open lawn between the front sidewalk and the park path: a pond
    // with ducks, a few trees and spots where people come for a picnic.
    _buildMeadow() {
        const W = this.w, top = this.parkTop + 12, bottom = this.h - 64, H = bottom - top;
        this.pond = null;
        this.pondDucks = [];
        this.meadowTrees = [];
        this.meadowFlowers = [];
        this.picnics = [];
        this.strollers = [];
        if (H < 40)
            return;
        const taken = [];
        const free = (x, y, w, h) => !taken.some(r => x < r[0] + r[2] && x + w > r[0] && y < r[1] + r[3] && y + h > r[1]);
        const pw = Math.round(clamp(W * 0.17, 110, 300)), ph = Math.round(clamp(H * 0.42, 22, 80));
        const px = randi(40, W - pw - 40), py = top + randi(Math.floor(H * 0.25), H - ph);
        this.pond = {x: px, y: py, w: pw, h: ph, seed: randi(0, 1e6)};
        taken.push([px - 24, py - 34, pw + 48, ph + 44]);
        for (let i = randi(2, 4); i > 0; i--)
            this.pondDucks.push({u: rand(-0.6, 0.6) * (i % 2 ? 1 : -1), v: rand(-0.4, 0.5), dir: chance(0.5) ? 1 : -1, t: rand(10), turn: rand(5, 20), drake: chance(0.5)});
        for (let tries = 0; tries < 60 && this.meadowTrees.length < Math.floor(W / 200); tries++) {
            const size = randi(18, 26), x = randi(20, W - 20), y = top + randi(Math.floor(size * 1.6), H);
            if (free(x - size, y - size * 2.4, size * 2, size * 2.4 + 4)) {
                taken.push([x - size - 10, y - size * 2.4, size * 2 + 20, size * 2.4 + 8]);
                this.meadowTrees.push({x, y, size, seed: randi(0, 1e6)});
            }
        }
        for (let tries = 0; tries < 80 && this.picnics.length < Math.max(2, Math.floor(W / 260)); tries++) {
            const x = randi(30, W - 80), y = top + randi(16, H);
            if (free(x - 10, y - 34, 70, 40)) {
                taken.push([x - 16, y - 40, 82, 48]);
                this.picnics.push({x, y, people: [], timer: chance(0.7) ? 0 : rand(60, 900), first: true,
                    blanket: pick([0xd84848, 0x4c7cd0, 0x5cae5c, 0xf0b030, 0xb860d8])});
            }
        }
        for (let i = Math.floor(W * H / 900); i > 0; i--) {
            const x = randi(0, W - 6), y = top + randi(0, H);
            if (free(x, y - 4, 6, 6))
                this.meadowFlowers.push({x, y, seed: randi(0, 1e6)});
        }
    }

    staticKey(env) {
        // each rebuild stalls a frame, so light and wetness only count once
        // they really changed
        this.darkLevel = steppedLevel(env.dark, this.darkLevel, 4);
        this.wetLevel = steppedLevel(env.weather.wet, this.wetLevel, 1);
        return [this.darkLevel, env.lampsOn ? 1 : 0, Math.round(env.weather.snowCover * 4), this.wetLevel, env.season].join(':');
    }

    // ---------- static layers ----------

    renderStatic(g, env) {
        if (!this.layerA) {
            this.layerA = g.layer();
            this.layerB = g.layer();
            this.layerC = g.layer();
        }
        this.layerA.fill(0);
        this.layerB.fill(0);
        this.layerC.fill(0);
        g.into(this.layerA, () => {
            this._drawSkyline(g, env);
            for (const b of this.buildings)
                this._drawBuilding(g, b, env);
            this._drawStreet(g, env);
        });
        g.into(this.layerB, () => this._drawCurb(g, env));
        g.into(this.layerC, () => this._drawPark(g, env));
    }

    _snowLine(g, x, y, w, env) {
        const s = env.weather.snowCover;
        if (s < 0.15)
            return;
        g.rect(x, y - 2, w, 2, 0xf4f8ff);
        g.rect(x, y, w, 1, 0xc8d4ec);
        if (s > 0.5)
            for (let i = 0; i < w; i += 5)
                g.rect(x + i, y - 3, 3, 1, 0xf4f8ff);
    }

    _drawSkyline(g, env) {
        const far = mix(0x5a6a90, env.skyBottom, 0.5), near = mix(0x4a5a80, env.skyBottom, 0.35);
        const tw = this.tower, B = this.base;
        g.rect(tw.x - 2, B - tw.h, 5, tw.h, far);
        g.rect(tw.x - 8, B - tw.h * 0.72, 17, 9, far);
        g.rect(tw.x - 6, B - tw.h * 0.72 - 4, 13, 4, far);
        g.rect(tw.x, B - tw.h - 22, 1, 22, far);
        for (const c of this.cranes) {
            g.rect(c.x, B - c.h, 3, c.h, mix(0xd8a030, env.skyBottom, 0.3));
            g.rect(c.x - 14, B - c.h, c.arm + 14, 3, mix(0xd8a030, env.skyBottom, 0.3));
            g.line(c.x + c.arm - 6, B - c.h + 3, c.x + c.arm - 6, B - c.h + 34, 0x4a4a5a);
            g.rect(c.x + c.arm - 10, B - c.h + 34, 9, 5, mix(0x6a6a7a, env.skyBottom, 0.3));
        }
        const lit = env.dark > 0.4;
        for (const s of this.skyline) {
            const top = B - s.h, col = s.h > B * 0.6 ? far : near;
            g.rect(s.x, top, s.w, s.h, col);
            g.rect(s.x, top, s.w, 2, highlight(col, 0.08));
            if (s.kind === 'spire') {
                g.rect(s.x + s.w / 2 - 2, top - 16, 4, 16, col);
                g.rect(s.x + s.w / 2 - 6, top - 6, 12, 6, col);
            } else if (s.kind === 'dome') {
                g.disc(s.x + s.w / 2, top, Math.floor(s.w / 3), col);
            }
            for (let y = top + 5; y < B - 6; y += 7) {
                for (let x = s.x + 3; x < s.x + s.w - 4; x += 5) {
                    if (lit && chance(0.25))
                        g.rectE(x, y, 2, 3, chance(0.85) ? mix(0xffd890, col, 0.35) : mix(0xd8e8ff, col, 0.4));
                    else if (!lit)
                        g.rect(x, y, 2, 3, highlight(col, 0.07));
                }
            }
        }
    }

    _wall(g, b, x, y, w, h) {
        const R = b.wallR;
        g.rect(x - 1, y, w + 2, h, INK);
        switch (b.mat) {
        case 'planks': A.wallPlanks(g, x, y, w, h, R, b.seed); break;
        case 'siding': A.wallSiding(g, x, y, w, h, R, b.seed); break;
        case 'stone': A.wallStone(g, x, y, w, h, R, b.seed); break;
        case 'brick': A.wallBrick(g, x, y, w, h, R, b.seed); break;
        case 'glass': {
            g.rect(x, y, w, h, R[2]);
            for (let yy = y; yy < y + h; yy += FH)
                g.rect(x, yy + FH - 3, w, 3, R[3]);
            for (let xx = x + 4; xx < x + w; xx += 24)
                g.rect(xx, y, 2, h, R[1]);
            break;
        }
        default: A.wallPlaster(g, x, y, w, h, R, b.seed);
        }
        g.rect(x, y, 2, h, mix(R[3], R[2], 0.4));
        g.rect(x + w - 3, y, 3, h, R[1]);
    }

    _drawBuilding(g, b, env) {
        if (b.kind === 'gap') {
            this._drawGap(g, b, env);
            return;
        }
        const {x, w} = b;
        const snow = env.weather.snowCover > 0.2;
        const roofR = snow ? A.ramp(0xe0e8f8) : b.roofR;
        if (b.kind === 'cottage') {
            const top = this.base - b.wallH;
            for (const r of b.roofItems)
                if (r.kind === 'chimney')
                    A.chimney(g, r.x, top - b.roofH + 10, 10, b.roofH * 0.55, A.ramp(0x9a9aa4));
            A.gableRoof(g, x, top - b.roofH + 4, w, b.roofH, roofR, b.seed);
            this._wall(g, b, x, top + 4, w, b.wallH - 4);
            // gable trim under the roof edge
            g.rect(x, top + 4, w, 2, b.wallR[1]);
            const at = b.attic;
            A.windowFrame(g, at.x, at.y, at.w, at.h, b.frameR);
        } else {
            this._wall(g, b, x, b.top, w, b.wallH);
            if (b.kind === 'townhouse') {
                for (const r of b.roofItems)
                    if (r.kind === 'chimney')
                        A.chimney(g, r.x, b.top - b.roofH - 8, 10, 16, A.ramp(0x9a9aa4));
                A.slopeRoof(g, x, b.top - b.roofH, w, b.roofH, roofR, b.seed);
            } else {
                // cornice
                const cr = A.ramp(b.mat === 'glass' ? 0x5a6a7a : 0xe8e0cc);
                g.rect(x - 4, b.top - 6, w + 8, 7, INK);
                g.rect(x - 3, b.top - 5, w + 6, 5, cr[2]);
                g.rect(x - 3, b.top - 5, w + 6, 1, cr[4]);
                g.rect(x - 3, b.top - 1, w + 6, 1, cr[1]);
                if (b.mat !== 'glass')
                    for (let i = x - 2; i < x + w + 2; i += 6)
                        g.rect(i, b.top - 1, 3, 2, cr[1]);
                this._snowLine(g, x - 4, b.top - 6, w + 8, env);
                for (const r of b.roofItems)
                    this._roofItem(g, r, b.top - 6, env);
                // floor bands
                if (b.mat !== 'glass')
                    for (let f = 1; f <= b.floors; f++)
                        g.rect(x, b.top + f * FH - 2, w, 2, b.wallR[1]);
            }
        }
        for (const win of b.wins) {
            A.windowFrame(g, win.x, win.y, win.w, win.h, b.frameR);
            if (b.kind === 'cottage' || b.kind === 'townhouse') {
                // shutters
                const sr = A.ramp(mix(b.roofR[2], 0x3a6a5a, 0.4));
                for (const sx of [win.x - 8, win.x + win.w + 3]) {
                    g.rect(sx - 1, win.y - 2, 7, win.h + 4, INK);
                    g.rect(sx, win.y - 1, 5, win.h + 2, sr[2]);
                    for (let i = 1; i < win.h; i += 3)
                        g.rect(sx + 1, win.y + i, 3, 1, sr[1]);
                }
            }
            if (win.box)
                A.flowerBox(g, win.x - 1, win.y + win.h + 4, win.w + 2, env.season, win.x);
            this._snowLine(g, win.x - 3, win.y + win.h + 1, win.w + 6, env);
        }
        // ground floor details
        const d = b.door;
        if (b.shop)
            this._drawShopFront(g, b, env);
        A.door(g, d.x, d.y, d.w, d.h, d.color, b.mat === 'glass' ? 1 : (b.seed % 2));
        if (b.mat === 'glass') {
            g.rect(d.x - 10, d.y - 4, d.w + 20, 3, INK);
            g.rect(d.x - 9, d.y - 3, d.w + 18, 1, 0xd8d8e0);
        }
        // little house number plate and lamp
        if (!b.shop && b.mat !== 'glass') {
            g.rect(d.x + d.w + 4, d.y + 4, 7, 5, INK);
            g.rect(d.x + d.w + 5, d.y + 5, 5, 3, 0x3a5a9a);
            g.px(d.x + d.w + 7, d.y + 6, 0xf4f4f4);
        }
        g.rect(d.x + d.w / 2 - 2, d.y - 8, 5, 5, INK);
        g.rect(d.x + d.w / 2 - 1, d.y - 7, 3, 3, env.lampsOn ? 0xffe8a0 : 0xd8d0b0);
        // plinth
        g.rect(x, this.base - 3, w, 3, shadow(b.wallR[1], 0.2));
        g.rect(x, this.base - 3, w, 1, b.wallR[1]);
    }

    _roofItem(g, r, y, env) {
        switch (r.kind) {
        case 'antenna':
            g.rect(r.x, y - 18, 1, 18, 0x5a5a64);
            g.rect(r.x - 6, y - 15, 13, 1, 0x5a5a64);
            g.rect(r.x - 4, y - 10, 9, 1, 0x5a5a64);
            break;
        case 'dish':
            g.rect(r.x + 4, y - 5, 2, 5, 0x7a7a84);
            g.disc(r.x + 3, y - 9, 4, INK);
            g.disc(r.x + 3, y - 9, 3, 0xd8d8e0);
            g.rect(r.x + 1, y - 11, 2, 2, 0xf4f4f8);
            break;
        case 'tank': {
            const R = A.ramp(0x9a6a40);
            g.rect(r.x, y - 6, 2, 6, R[0]);
            g.rect(r.x + 14, y - 6, 2, 6, R[0]);
            g.rect(r.x - 1, y - 21, 18, 16, INK);
            g.rect(r.x, y - 20, 16, 14, R[2]);
            for (let i = 0; i < 16; i += 3)
                g.rect(r.x + i, y - 20, 1, 14, R[1]);
            g.rect(r.x, y - 16, 16, 1, 0x5a5a64);
            g.rect(r.x, y - 10, 16, 1, 0x5a5a64);
            g.rect(r.x - 2, y - 24, 20, 4, INK);
            g.rect(r.x - 1, y - 23, 18, 2, A.ramp(0x6a5a5a)[2]);
            this._snowLine(g, r.x - 2, y - 24, 20, env);
            break;
        }
        case 'chimney':
            A.chimney(g, r.x, y - 14, 10, 14, A.ramp(0xa04a38));
            r.top = y - 16;
            break;
        case 'garden':
            g.rect(r.x - 1, y - 6, 22, 6, INK);
            g.rect(r.x, y - 5, 20, 5, 0x9a5a30);
            for (let i = 0; i < 20; i += 2)
                g.rect(r.x + i, y - 8 - (i % 4 === 0 ? 2 : 0), 2, 3, env.season === 'winter' ? 0x8a7a5a : [0x5cae5c, 0x4a9a4a, 0xe85050, 0xf0d050][(i / 2) % 4]);
            break;
        case 'solar':
            for (let i = 0; i < 2; i++) {
                g.rect(r.x + i * 12 - 1, y - 8, 12, 7, INK);
                g.rect(r.x + i * 12, y - 7, 10, 5, 0x2a3a6a);
                g.rect(r.x + i * 12, y - 7, 10, 1, 0x6a8ac0);
                g.rect(r.x + i * 12 + 5, y - 7, 1, 5, 0x4a5a8a);
            }
            break;
        case 'mast':
            g.rect(r.x, y - 28, 2, 28, 0x6a6a74);
            g.rect(r.x - 3, y - 20, 8, 1, 0x6a6a74);
            r.top = y - 28;
            break;
        }
    }

    _drawShopFront(g, b, env) {
        const s = b.shop;
        const x = b.x + 6, w = b.w - 40, y = this.base - GH + 2;
        s.win = {x: x + 2, y: y + 10, w: w - 4, h: GH - 18};
        const fr = A.ramp(s.c);
        g.rect(x - 1, y + 5, w + 2, GH - 7, INK);
        g.rect(x, y + 6, w, GH - 9, fr[2]);
        g.rect(x, y + 6, w, 1, fr[3]);
        g.rect(x, this.base - 6, w, 3, fr[1]);
        // awning: stripes with scalloped edge
        const [a1, a2] = s.awning;
        const ar1 = A.ramp(a1);
        g.rect(x - 4, y - 2, w + 8, 9, INK);
        for (let i = 0; i < w + 6; i++) {
            const c = Math.floor(i / 5) % 2 ? a2 : ar1[2];
            g.rect(x - 3 + i, y - 1, 1, 6, c);
            g.px(x - 3 + i, y - 1, highlight(c, 0.3));
        }
        for (let i = 0; i < w + 6; i += 5) {
            const c = Math.floor(i / 5) % 2 ? a2 : ar1[2];
            g.rect(x - 3 + i, y + 5, 4, 2, c);
            g.rect(x - 3 + i, y + 7, 4, 1, INK);
            g.rect(x - 2 + i, y + 6, 2, 1, shadow(c, 0.15));
        }
        if (env.weather.snowCover > 0.2)
            g.rect(x - 4, y - 4, w + 8, 3, 0xf4f8ff);
        // hanging sign board above the awning
        const tw = s.name.length * 4 - 1;
        s.sign = {x: Math.floor(b.x + b.w / 2 - tw / 2), y: y - 13};
        g.rect(s.sign.x - 4, s.sign.y - 3, tw + 8, 11, INK);
        g.rect(s.sign.x - 3, s.sign.y - 2, tw + 6, 9, 0x7a4a2a);
        g.rect(s.sign.x - 3, s.sign.y - 2, tw + 6, 1, 0xa86a3a);
        g.rect(s.sign.x - 2, s.sign.y - 1, tw + 4, 7, 0x4a2a1a);
        s.tableXs = s.tables && env.season !== 'winter' ? [] : [];
        if (s.tables && env.season !== 'winter')
            for (let tx = b.x + 8; tx < b.x + b.w - 20; tx += 30)
                s.tableXs.push(tx);
    }

    _drawGap(g, b, env) {
        // little garden between houses with a hedge and a tree
        A.grass(g, b.x, this.base - 20, b.w, 20, env.season, b.seed);
        A.fence(g, b.x, this.base, b.w, A.ramp(0xf0ece0));
        A.bigTree(g, b.x + b.w / 2, this.base - 6, 18, env.season, b.seed, env.weather.snowCover);
    }

    _drawStreet(g, env) {
        const W = this.w;
        const snow = env.weather.snowCover;
        const walkR = A.ramp(0xb0a8a0);
        A.cobble(g, 0, this.backTop, W, this.roadTop - this.backTop - 2, walkR, 3);
        g.rect(0, this.roadTop - 3, W, 3, 0x8a8478);
        g.rect(0, this.roadTop - 3, W, 1, 0xc8c0b0);
        // asphalt with patches
        const road = mix(0x4a4a5a, 0x34344a, this.wetLevel * 0.5);
        g.rect(0, this.roadTop, W, this.frontTop - this.roadTop, road);
        for (let y = this.roadTop; y < this.frontTop; y++)
            for (let x = 0; x < W; x++) {
                const v = hash(x, y);
                if (v < 25)
                    g.px(x, y, shadow(road, 0.2));
                else if (v > 985)
                    g.px(x, y, highlight(road, 0.12));
            }
        for (let i = 0; i < W / 120; i++) {
            const px = hash(i, 41) * W / 1000, py = this.roadTop + 4 + hash(i, 43) % 40;
            g.rect(px, py, 10 + hash(i, 3) % 12, 4, shadow(road, 0.12));
        }
        const mid = this.roadTop + 25;
        for (let x = 0; x < W; x += 24)
            g.rect(x, mid, 12, 2, 0xf0e8c8);
        // crosswalk
        for (let y = this.roadTop + 2; y < this.frontTop - 2; y += 5)
            g.rect(this.crossX, y, 26, 3, 0xece8e0);
        // manhole
        const mx = Math.floor(W * 0.7);
        g.disc(mx, this.roadTop + 36, 4, 0x3a3a48);
        g.rect(mx - 2, this.roadTop + 35, 5, 1, 0x5a5a68);
        if (this.wetLevel)
            for (let i = 0; i < W / 50; i++) {
                const px = hash(i, 7) * W / 1000, py = this.roadTop + 4 + (hash(i, 9) % 40);
                g.blend(px, py, 10 + hash(i, 3) % 14, 2, env.skyBottom, 0.36, true);
            }
        // front sidewalk
        g.rect(0, this.frontTop, W, 3, 0x8a8478);
        g.rect(0, this.frontTop + 2, W, 1, 0xc8c0b0);
        A.cobble(g, 0, this.frontTop + 3, W, this.parkTop - this.frontTop - 3, walkR, 5);
        if (snow > 0.2) {
            g.blend(0, this.backTop, W, this.roadTop - this.backTop - 3, 0xf4f8ff, snow * 0.8);
            g.blend(0, this.frontTop + 3, W, this.parkTop - this.frontTop - 3, 0xf4f8ff, snow * 0.8);
            g.blend(0, this.roadTop, W, this.frontTop - this.roadTop, 0xe0e4ec, snow * 0.25);
        }
        // bus shelter
        const bx = this.busX, top = this.backTop - 24;
        g.rect(bx - 22, top - 2, 44, 4, INK);
        g.rect(bx - 21, top - 1, 42, 2, 0x4a6a8a);
        g.rect(bx - 22, top, 2, 26, INK);
        g.rect(bx + 20, top, 2, 26, INK);
        g.blend(bx - 20, top + 2, 40, 18, 0xa8d0e8, 0.35);
        g.rect(bx - 14, this.backTop + 2, 28, 2, INK);
        g.rect(bx - 13, this.backTop + 1, 26, 1, 0x9a6a40);
    }

    _drawCurb(g, env) {
        const curb = this.roadTop - 3;
        for (const t of this.curbTrees) {
            g.rect(t.x - 8, curb - 3, 17, 3, INK);
            g.rect(t.x - 7, curb - 3, 15, 2, 0x6a5a4a);
            A.bigTree(g, t.x, curb - 3, t.size, env.season, t.seed, env.weather.snowCover);
        }
        for (const l of this.lamps)
            this._lampPost(g, l.x, curb, env);
        // traffic light poles (heads are dynamic)
        for (const px of [this.crossX - 6, this.crossX + 30]) {
            g.rect(px - 1, curb - 46, 3, 46, INK);
            g.rect(px, curb - 46, 1, 46, 0x5a5a68);
            g.rect(px - 3, curb - 60, 7, 15, INK);
            g.rect(px - 2, curb - 59, 5, 13, 0x2a2a34);
        }
        // bus stop sign
        const sx = this.busX + 26;
        g.rect(sx, curb - 40, 2, 40, 0x6a6a74);
        g.rect(sx - 5, curb - 50, 12, 11, INK);
        g.rect(sx - 4, curb - 49, 10, 9, 0xf0d040);
        g.text('H', sx - 1, curb - 47, 0x3a7a3a);
        for (const hx of this.hydrants) {
            g.rect(hx - 1, curb - 11, 8, 11, INK);
            g.rect(hx, curb - 10, 6, 10, 0xd84848);
            g.rect(hx, curb - 10, 2, 10, 0xf07070);
            g.rect(hx - 2, curb - 7, 10, 2, 0xb83838);
        }
    }

    _lampPost(g, x, ground) {
        g.rect(x - 1, ground - 48, 4, 48, INK);
        g.rect(x, ground - 48, 2, 48, 0x4a4a5a);
        g.rect(x, ground - 48, 1, 48, 0x6a6a7a);
        g.rect(x - 3, ground - 4, 8, 4, INK);
        g.rect(x - 2, ground - 3, 6, 3, 0x4a4a5a);
        g.rect(x - 5, ground - 58, 12, 11, INK);
        g.rect(x - 4, ground - 57, 10, 9, 0x3a3a48);
        g.rect(x - 3, ground - 55, 8, 6, 0xd8d8c8);
        g.rect(x - 6, ground - 60, 14, 3, INK);
        g.rect(x - 5, ground - 59, 12, 1, 0x5a5a6a);
    }

    _drawPark(g, env) {
        const W = this.w, top = this.parkTop;
        A.grass(g, 0, top, W, this.h - top, env.season, 77);
        if (env.weather.snowCover > 0.2)
            g.blend(0, top, W, this.h - top, 0xf4f8ff, env.weather.snowCover * 0.85);
        // gravel path along the bottom
        A.dirtPath(g, 0, this.h - 10, W, 10, env.season, 9);
        g.rect(0, this.h - 11, W, 1, A.GRASS[env.season][1]);
        for (const b of this.parkBits)
            this._parkBit(g, b, env);
        this._drawMeadow(g, env);
        const trees = [...this.parkTrees, ...this.meadowTrees].sort((a, b) => a.y - b.y);
        for (const t of trees)
            A.bigTree(g, t.x, t.y, t.size, env.season, t.seed, env.weather.snowCover);
    }

    _drawMeadow(g, env) {
        const flowers = env.season === 'autumn' ? [0xe08a30, 0xf0c040] : [0xe84860, 0xf8d048, 0xf0f0f0, 0xb860d8];
        if (env.season !== 'winter' && env.weather.snowCover < 0.2) {
            for (const f of this.meadowFlowers) {
                for (let i = 0; i < 3; i++) {
                    const fx = f.x + (f.seed >> i * 3) % 6, fy = f.y - (f.seed >> i * 2) % 3;
                    g.px(fx, fy + 1, 0x3a7a2a);
                    g.px(fx, fy, flowers[(f.seed + i) % flowers.length]);
                }
            }
        }
        const p = this.pond;
        if (!p)
            return;
        const rx = Math.floor(p.w / 2), ry = Math.floor(p.h / 2), cx = p.x + rx, cy = p.y + ry;
        const ice = env.season === 'winter' && env.seasonMonth !== 2;
        const oval = (ex, ey, c, dy = 0) => {
            for (let y = -ey; y <= ey; y++) {
                const hw = Math.round(ex * Math.sqrt(Math.max(0, 1 - (y / ey) ** 2)));
                g.rect(cx - hw, cy + y + dy, hw * 2 + 1, 1, c);
            }
        };
        oval(rx + 2, ry + 2, A.INK, 1);
        oval(rx + 1, ry + 1, 0xc8b078, 1);
        oval(rx - 2, ry - 1, ice ? 0xc0d8ec : 0x3e80c0);
        oval(rx - 6, ry - 4, ice ? 0xd4e6f4 : 0x4a92d4, 1);
        // the far bank throws a dark band onto the water
        for (let x = -rx + 4; x <= rx - 4; x++) {
            const y = cy - Math.round((ry - 1) * Math.sqrt(1 - (x / (rx - 2)) ** 2));
            g.rect(cx + x, y, 1, 2, ice ? 0xa8c4dc : 0x2e6298);
        }
        if (ice) {
            if (env.weather.snowCover > 0.3)
                oval(rx - 8, ry - 5, 0xeef4fc, 2);
        } else {
            for (let i = 0; i < 3; i++) {
                const lx = cx + ((p.seed >> i * 4) % (rx - 12)) * (i % 2 ? 1 : -1), ly = cy + ((p.seed >> i * 3) % Math.max(2, ry - 6));
                g.rect(lx - 2, ly, 5, 2, 0x3a8a3a);
                g.rect(lx - 1, ly - 1, 3, 1, 0x5aaa4a);
                g.px(lx + 1, ly, 0x2a6a2a);
                if (i === 0 && env.season === 'summer')
                    g.rect(lx - 1, ly - 2, 2, 2, 0xf8a0c0);
            }
        }
        // reeds and cattails at both ends
        const reed = env.season === 'winter' ? 0xa89868 : env.season === 'autumn' ? 0x9a9a4a : 0x4a8a3a;
        for (const side of [-1, 1]) {
            for (let i = 0; i < 7; i++) {
                const x = cx + side * (rx - 6 + (i % 3) * 3), h = 6 + ((p.seed >> i) % 6), y = cy + ry - 4 - (i >> 1);
                g.rect(x, y - h, 1, h, reed);
                if (i % 3 === 0)
                    g.rect(x, y - h - 2, 2, 3, 0x6a4028);
            }
        }
    }

    _parkBit(g, b, env) {
        const x = b.x, y = this.h - 12;
        switch (b.kind) {
        case 'bench': {
            const R = A.ramp(0x9a6a40);
            g.rect(x - 1, y - 14, 26, 6, INK);
            g.rect(x, y - 13, 24, 4, R[2]);
            g.rect(x, y - 13, 24, 1, R[3]);
            g.rect(x - 1, y - 8, 26, 4, INK);
            g.rect(x, y - 7, 24, 2, R[2]);
            g.rect(x + 2, y - 4, 2, 4, INK);
            g.rect(x + 20, y - 4, 2, 4, INK);
            b.seatY = y - 5;
            break;
        }
        case 'flowers': {
            if (env.season === 'winter')
                break;
            g.rect(x - 1, y - 6, 30, 7, INK);
            g.rect(x, y - 5, 28, 5, 0x7a4a2a);
            const cols = env.season === 'autumn' ? [0xe08a30, 0xc85a20, 0xf0c040] : [0xe84860, 0xf8d048, 0xf0f0f0, 0xb860d8, 0xf890b0];
            for (let i = 1; i < 27; i += 2) {
                g.rect(x + i, y - 9, 2, 4, 0x4a9a3a);
                g.rect(x + i, y - 10 - (i % 3), 2, 2, cols[(b.seed + i) % cols.length]);
            }
            break;
        }
        case 'fountain': {
            const R = A.ramp(0xb8b0a8);
            g.rect(x - 1, y - 9, 40, 10, INK);
            g.rect(x, y - 8, 38, 8, R[2]);
            g.rect(x, y - 8, 38, 2, R[3]);
            g.rect(x + 3, y - 6, 32, 3, env.weather.snowCover > 0.3 ? 0xe8eef8 : 0x5a9ad8);
            g.rect(x + 3, y - 6, 32, 1, 0x8ac0f0);
            g.rect(x + 16, y - 22, 6, 14, INK);
            g.rect(x + 17, y - 21, 4, 13, R[3]);
            g.rect(x + 13, y - 24, 12, 3, INK);
            g.rect(x + 14, y - 23, 10, 1, R[3]);
            b.fx = x + 19;
            b.fy = y - 24;
            break;
        }
        case 'bin':
            g.rect(x - 1, y - 12, 10, 12, INK);
            g.rect(x, y - 11, 8, 11, 0x4a7a4a);
            g.rect(x, y - 11, 8, 2, 0x6a9a6a);
            break;
        case 'bushes':
            for (let i = 0; i < 3; i++) {
                const bx = x + i * 9, R = A.leafRamp(env.season === 'autumn' ? 'summer' : env.season);
                g.disc(bx + 5, y - 6, 7, INK);
                g.disc(bx + 5, y - 6, 6, R[2]);
                g.disc(bx + 3, y - 8, 3, R[3]);
                g.px(bx + 2, y - 9, R[4]);
            }
            break;
        case 'sandbox': {
            const R = A.ramp(0x9a6a40);
            g.rect(x - 1, y - 7, 34, 8, INK);
            g.rect(x, y - 6, 32, 6, R[2]);
            g.rect(x + 2, y - 5, 28, 4, 0xe8d090);
            g.rect(x + 8, y - 7, 5, 3, 0xd84848);
            g.rect(x + 20, y - 6, 3, 2, 0x4c7cd0);
            break;
        }
        }
    }

    // ---------- simulation ----------

    _density(env) {
        const h = env.hour;
        let d = h < 5 ? 0.12 : h < 7 ? 0.4 : h < 9 ? 1 : h < 16 ? 0.75 : h < 19 ? 1 : h < 22 ? 0.6 : 0.3;
        d *= 1 - Math.min(0.7, env.weather.v.rain * 0.45 + env.weather.v.snow * 0.2);
        return d;
    }

    _newPerson(env, lane, opts) {
        const p = makePerson(env, opts);
        p.lane = lane;
        const band = lane === 'back' ? this.backY : lane === 'front' ? this.frontY : [this.parkY, this.parkY];
        p.y = rand(band[0], band[1]);
        p.dir = chance(0.5) ? 1 : -1;
        p.state = 'walk';
        return p;
    }

    _populate(env, anywhere = false) {
        const d = this._density(env);
        const want = Math.round((this.w / 40 * d + 2) * env.people);
        if (this.people.length < want) {
            const lane = weighted([['back', 4], ['front', 3], ['park', env.dark < 0.5 ? 2 : 0.3]]);
            const p = this._newPerson(env, lane);
            if (anywhere) {
                p.x = rand(0, this.w);
            } else if (lane === 'back' && chance(0.35)) {
                const door = pick(this.doors);
                p.x = door.x;
                door.open = 1.2;
            } else {
                p.x = p.dir > 0 ? -20 : this.w + 20;
            }
            this.people.push(p);
        }
        const wantCars = Math.round((this.w / 140 * d * 1.6 + 1) * env.traffic);
        for (const lane of this.lanes) {
            if (lane.cars.length < wantCars / 2 && chance(anywhere ? 0.5 : 0.3)) {
                const type = env.hour > 5 && env.hour < 23 && chance(0.07) ? 'bus' : randomTraffic(CITY_TRAFFIC);
                this._spawnCar(lane, type, env, anywhere);
            }
        }
        if (this.pigeons.length < 2 && !env.night && chance(anywhere ? 0.3 : 0.004)) {
            const x = rand(30, this.w - 30), lane = chance(0.5) ? this.backY : this.frontY;
            const flock = [];
            for (let i = 0; i < randi(3, 6); i++)
                flock.push({x: x + rand(-16, 16), y: rand(lane[0], lane[1]), t: rand(5), fly: 0, c: pick([0x8a8a9a, 0x7a7a8a, 0xa8a8b0, 0x6a6a78])});
            this.pigeons.push(flock);
        }
    }

    _spawnCar(lane, type, env, anywhere = false) {
        const v = makeVehicle(type, env);
        v.dir = lane.dir;
        const len = vehicleLength(v);
        v.x = anywhere ? rand(0, this.w) : lane.dir > 0 ? -len - 4 : this.w + 4;
        if (lane.cars.some(o => Math.abs(o.x - v.x) < len + 30))
            return null;
        v.cur = v.speed;
        v.len = len;
        v.siren = ['police', 'ambulance', 'fire'].includes(type);
        lane.cars.push(v);
        return v;
    }

    trigger(name, env, ctx) {
        const lane = pick(this.lanes);
        switch (name) {
        case 'chase':
            this._spawnCar(lane, 'speeder', env);
            this.timers.add(1.8, () => this._spawnCar(lane, 'police', env));
            break;
        case 'ambulance':
        case 'fire':
        case 'icecream':
        case 'garbage':
        case 'mail':
        case 'camper':
            this._spawnCar(lane, name, env);
            break;
        case 'fireworks':
            for (let i = 0; i < randi(6, 14); i++)
                this.timers.add(i * rand(0.6, 1.6), () => ctx.sky.firework());
            break;
        case 'outage': {
            const b = pick(this.buildings.filter(bb => bb.wins && bb.wins.length));
            if (b) {
                for (const w of b.wins) {
                    w.hh.outage = rand(15, 30);
                    w.lit = false;
                }
                this.timers.add(25, () => b.wins.forEach(w => w.decide(env)));
            }
            break;
        }
        case 'marathon':
            for (let i = 0; i < randi(5, 9); i++) {
                const p = this._newPerson(env, 'front', {jogger: true, kid: false});
                p.shirt = 0xf4f4f4;
                p.frames = [];
                p.dir = 1;
                p.x = -20 - i * rand(14, 24);
                p.bib = true;
                this.people.push(p);
            }
            break;
        case 'ducks': {
            const x = rand(60, this.w - 80);
            for (let i = 0; i < randi(3, 6); i++)
                this.ducks.push({x: x + i * 9, y: this.backY[1] - i * 3, big: i === 0, t: rand(5)});
            break;
        }
        case 'balloon':
            this.floaters.push({kind: 'balloon', x: rand(30, this.w - 30), y: this.frontY[0] - 30, c: pick([0xf04848, 0xf0d040, 0x4890f0, 0xf080c0]), t: 0});
            break;
        case 'musician': {
            const p = this._newPerson(env, 'front', {kid: false});
            p.dog = p.umbrella = p.balloon = null;
            p.state = 'sit';
            p.musician = 90 + rand(120);
            p.x = rand(40, this.w - 40);
            this.people.push(p);
            break;
        }
        case 'catcross':
            this.critters.push({kind: 'cat', cat: makeCat(), x: rand(40, this.w - 40), y: this.backY[1], t: 0});
            break;
        case 'tourists': {
            const dir = chance(0.5) ? 1 : -1;
            const flag = pick([0xf04848, 0xf0d040, 0x4890f0]);
            for (let i = 0; i < randi(5, 8); i++) {
                const p = this._newPerson(env, 'back');
                p.dir = dir;
                p.speed = 8;
                p.x = dir > 0 ? -20 - i * 14 : this.w + 20 + i * 14;
                p.camera = i > 0 && chance(0.5);
                p.flag = i === 0 ? flag : 0;
                this.people.push(p);
            }
            break;
        }
        case 'wedding': {
            const v = this._spawnCar(lane, 'convertible', env);
            if (v) {
                v.color = 0xf8f8f4;
                v.frames = [];
                v.wedding = true;
            }
            break;
        }
        case 'kids': {
            for (let i = 0; i < randi(2, 4); i++) {
                const p = this._newPerson(env, 'park', {kid: true});
                p.x = rand(0, this.w);
                p.play = true;
                p.speed = rand(20, 28);
                this.people.push(p);
            }
            break;
        }
        }
    }

    _pickEvent(env) {
        const h = env.hour, night = env.dark > 0.6, dry = env.weather.v.rain < 0.2;
        const P = env.people, V = env.traffic;
        return weighted([
            ['chase', V], ['ambulance', V], ['fire', 0.6 * V],
            ['icecream', env.season === 'summer' && h > 11 && h < 20 ? 2 * V : 0],
            ['garbage', h > 5.5 && h < 9 ? 2 * V : 0], ['mail', h > 8 && h < 16 ? V : 0],
            ['fireworks', night && (h > 20 || h < 1) ? (env.weekday === 6 ? 0.8 : 0.25) : 0],
            ['outage', env.dark > 0.4 ? 0.5 : 0], ['marathon', !night && dry && env.weekday === 0 ? 1.5 * P : 0.2 * P],
            ['ducks', !night && env.season === 'spring' ? 1.2 : 0.25], ['balloon', !night && dry ? 0.8 : 0],
            ['musician', h > 10 && h < 22 && dry ? P : 0], ['catcross', night ? 1.2 : 0.1],
            ['tourists', !night && h > 9 && h < 18 ? P : 0], ['wedding', !night && env.weekday >= 5 ? 0.6 * Math.min(P, V) : 0.1 * Math.min(P, V)],
            ['camper', env.season === 'summer' ? 0.6 * V : 0.1 * V], ['kids', !night && dry && h > 9 && h < 19 ? 1.2 * P : 0],
        ]);
    }

    update(dt, real, env, ctx) {
        this.realT += real;
        this.timers.run(real);
        if (Math.floor(this.realT) !== Math.floor(this.realT - real))
            this._populate(env);
        for (const w of this.windows)
            w.update(dt, real, env);
        for (const b of this.buildings)
            for (const w of b.wins || [])
                if (w.hh.outage > 0)
                    w.hh.outage -= real;
        for (const d of this.doors)
            d.open = Math.max(0, d.open - real);
        const L = this.light;
        L.t += real;
        const dur = {green: 20, yellow: 3, red: 12};
        if (L.t > dur[L.state]) {
            L.t = 0;
            L.state = L.state === 'green' ? 'yellow' : L.state === 'yellow' ? 'red' : 'green';
        }
        this._updateCars(real, env);
        this._updatePeople(real, env);
        this._updateBits(real, env);
        this._updateMeadow(real, env);
        this.eventTimer -= real;
        if (this.eventTimer <= 0) {
            this.eventTimer = rand(40, 140);
            this.trigger(this._pickEvent(env), env, ctx);
        }
        if (env.holidays.newYear && env.dark > 0.5 && Math.random() < real * 1.5)
            ctx.sky.firework();
    }

    // What people do on the lawn depends on the season: picnics in spring
    // and summer, snowmen when there is snow, walks the rest of the time.
    _meadowActivity(env) {
        const w = env.weather, day = env.hour > 9.5 && env.hour < 18.5 && env.dark < 0.3;
        if (!day || w.v.rain > 0.15)
            return null;
        if (w.snowCover > 0.35)
            return 'snowman';
        if ((env.season === 'summer' || env.season === 'spring') && w.v.snow < 0.1 && w.snowCover < 0.1)
            return 'picnic';
        return 'walk';
    }

    _meadowPerson(env, kid) {
        const q = makePerson(env, {kid, jogger: false});
        q.balloon = q.umbrella = q.bag = null;
        q.coffee = q.phone = false;
        return q;
    }

    _meadowPoint() {
        const top = this.parkTop + 20, bottom = this.h - 16, p = this.pond;
        for (;;) {
            const x = rand(10, this.w - 30), y = rand(top, bottom);
            if (!p || x < p.x - 20 || x > p.x + p.w + 4 || y < p.y - 4 || y > p.y + p.h + 14)
                return [x, y];
        }
    }

    _updateMeadow(real, env) {
        const p = this.pond;
        for (const d of this.pondDucks) {
            d.t += real;
            d.turn -= real;
            if (d.turn <= 0 || Math.abs(d.u) > 0.7) {
                d.dir = d.u > 0.6 ? -1 : d.u < -0.6 ? 1 : -d.dir;
                d.turn = rand(6, 25);
            }
            d.u = clamp(d.u + d.dir * real * 3 / p.w, -0.75, 0.75);
            d.v = clamp(d.v + Math.sin(d.t * 0.3) * real * 0.02, -0.4, 0.5);
        }
        const act = this._meadowActivity(env);
        for (const s of this.picnics) {
            s.timer -= real;
            if (s.snowman && env.weather.snowCover < 0.2)
                s.snowman = null;
            const kind = act === 'picnic' || (act === 'snowman' && !s.snowman) ? act : null;
            if (!s.people.length && kind && s.timer <= 0) {
                // a couple or a family walks up from the park path
                const n = kind === 'snowman' ? 2 : chance(0.4) ? 3 : 2;
                const seats = kind === 'picnic'
                    ? [[s.x + 2, s.y - 3], [s.x + 34, s.y - 3], [s.x + 18, s.y - 8]]
                    : [[s.x + 4, s.y], [s.x + 38, s.y + 1]];
                for (let i = 0; i < n; i++) {
                    const q = this._meadowPerson(env, kind === 'snowman' ? i === 0 : i === 2);
                    q.dog = null;
                    q.seat = seats[i];
                    q.rest = kind === 'picnic' ? 'sit' : 'idle';
                    q.dir = q.sitDir = i % 2 ? -1 : 1;
                    if (s.first) {
                        [q.x, q.y] = q.seat;
                        q.state = q.rest;
                    } else {
                        q.x = s.x + rand(-60, 60);
                        q.y = this.parkY;
                        q.state = 'walk';
                    }
                    s.people.push(q);
                }
                s.kind = kind;
                if (kind === 'snowman')
                    s.snowman = {size: s.first ? 1 : 0, hat: pick([0x2a2a34, 0xd84848, 0x4c7cd0]), scarf: pick([0xd84848, 0xf0d050, 0x5cae5c])};
                s.timer = kind === 'snowman' ? rand(600, 1200) : rand(900, 3000);
            } else if (s.people.length && s.people.every(q => q.state === q.rest) &&
                (s.timer <= 0 || act !== s.kind || (s.kind === 'snowman' && s.snowman.size >= 1 && s.timer < 500))) {
                for (const q of s.people)
                    q.state = 'leave';
            }
            s.first = false;
            if (s.kind === 'snowman' && s.snowman && s.people.some(q => q.state === 'idle'))
                s.snowman.size = Math.min(1, s.snowman.size + real / 240);
            this._walkMeadow(s.people, real);
            if (!s.people.length && s.timer <= 0)
                s.timer = rand(300, 1800);
        }
        // walkers stroll across the lawn, more often in autumn
        this.strollT = (this.strollT ?? rand(5, 30)) - real;
        if (act && act !== 'picnic' && this.strollT <= 0 && this.strollers.length < Math.ceil(this.w / 500)) {
            const q = this._meadowPerson(env, chance(0.15));
            q.x = rand(10, this.w - 30);
            q.y = this.parkY;
            q.state = 'walk';
            q.dir = 1;
            q.route = [];
            let at = [q.x, q.y];
            for (let i = randi(2, 4); i >= 0; i--) {
                let next;
                for (let tries = 0; tries < 20; tries++) {
                    next = i ? this._meadowPoint() : [at[0] + rand(-80, 80), this.parkY];
                    if (!this._crossesPond(at, next))
                        break;
                }
                q.route.push(next);
                at = next;
            }
            q.speed *= 0.6;
            this.strollers.push(q);
        }
        if (this.strollT <= 0)
            this.strollT = env.season === 'autumn' ? rand(20, 60) : rand(90, 240);
        for (const q of this.strollers) {
            q.t += real;
            const [tx, ty] = q.route[0];
            if (this._step(q, tx, ty, real)) {
                q.route.shift();
                if (!q.route.length)
                    q.gone = true;
            }
        }
        this.strollers = this.strollers.filter(q => !q.gone);
    }

    _crossesPond(a, b) {
        const p = this.pond;
        if (!p)
            return false;
        for (let i = 0; i <= 20; i++) {
            const x = a[0] + (b[0] - a[0]) * i / 20, y = a[1] + (b[1] - a[1]) * i / 20;
            if (x > p.x - 20 && x < p.x + p.w + 4 && y > p.y - 4 && y < p.y + p.h + 14)
                return true;
        }
        return false;
    }

    // move a person towards (tx, ty); true once there
    _step(q, tx, ty, real) {
        const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy), step = q.speed * 0.8 * real;
        if (Math.abs(dx) > 1)
            q.dir = dx > 0 ? 1 : -1;
        if (d <= step) {
            q.x = tx;
            q.y = ty;
            return true;
        }
        q.x += dx / d * step;
        q.y += dy / d * step;
        return false;
    }

    _walkMeadow(people, real) {
        for (const q of people) {
            q.t += real;
            if (q.state === 'walk' && this._step(q, q.seat[0], q.seat[1], real)) {
                q.state = q.rest;
                q.dir = q.sitDir;
            } else if (q.state === 'leave' && this._step(q, q.seat[0] + (q.dir > 0 ? 50 : -50), this.parkY, real)) {
                q.gone = true;
            }
        }
        for (let i = people.length - 1; i >= 0; i--)
            if (people[i].gone)
                people.splice(i, 1);
    }

    _renderMeadow(g, env) {
        const p = this.pond, t = this.realT;
        if (p && !(env.season === 'winter' && env.seasonMonth !== 2)) {
            const rx = p.w / 2 - 8, ry = p.h / 2 - 5, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
            for (let i = 0; i < 6; i++) {
                const ph = (t * 0.15 + i * 0.37) % 1, u = Math.sin(i * 2.3) * 0.7, v = Math.cos(i * 1.7) * 0.6;
                g.blend(cx + u * rx + ph * 6, cy + v * ry, 4 - Math.floor(ph * 3), 1, 0xd8f0ff, 0.6 * Math.sin(ph * Math.PI));
            }
            for (const d of this.pondDucks)
                this._renderPondDuck(g, cx + d.u * (p.w / 2 - 10), cy + 2 + d.v * (p.h / 2 - 6), d);
        }
        const all = [];
        for (const s of this.picnics) {
            if (s.kind === 'picnic' && s.people.some(q => q.state === 'sit')) {
                all.push([s.y - 20, 0, s]);
                all.push([s.y - 2, 2, s]);
            }
            if (s.snowman)
                all.push([s.y - 1, 3, s]);
            for (const q of s.people)
                all.push([q.y, 1, q]);
        }
        for (const q of this.strollers)
            all.push([q.y, 1, q]);
        all.sort((a, b) => a[0] - b[0]);
        for (const [, kind, o] of all) {
            if (kind === 0)
                this._renderPicnic(g, o);
            else if (kind === 2)
                this._renderBasket(g, o.x + 21, o.y - 4);
            else if (kind === 3)
                this._renderSnowman(g, o.x + 22, o.y - 1, o.snowman);
            else
                drawPerson(g, o, o.x, o.y, o.dir, env);
        }
    }

    // grows from a snowball into a snowman with hat, scarf and carrot
    _renderSnowman(g, x, y, m) {
        const S = 0xf4f8ff, SH = 0xc8d4ec, k = m.size;
        const ball = (cy, r) => {
            g.disc(x, cy, r + 1, A.INK);
            g.disc(x, cy, r, S);
            g.rect(x - r + 1, cy + Math.floor(r / 2), r * 2 - 1, 1, SH);
        };
        const r1 = Math.max(2, Math.round(7 * Math.min(1, k * 2.5)));
        ball(y - r1, r1);
        if (k > 0.45)
            ball(y - 2 * r1 - 3, 5);
        if (k > 0.75) {
            const hy = y - 2 * r1 - 13;
            ball(hy, 4);
            g.px(x - 2, hy - 1, A.INK);
            g.px(x + 1, hy - 1, A.INK);
            g.rect(x, hy + 1, 3, 1, 0xf08a20);
            if (k >= 1) {
                g.rect(x - 4, hy + 4, 9, 2, m.scarf);
                g.rect(x + 3, hy + 5, 2, 4, m.scarf);
                g.rect(x - 4, hy - 4, 9, 1, m.hat);
                g.rect(x - 3, hy - 8, 7, 4, m.hat);
                g.px(x - 1, y - 2 * r1 - 4, A.INK);
                g.px(x - 1, y - 2 * r1 - 1, A.INK);
                g.line(x - 5, y - 2 * r1 - 3, x - 10, y - 2 * r1 - 7, 0x6a4028);
                g.line(x + 5, y - 2 * r1 - 3, x + 10, y - 2 * r1 - 8, 0x6a4028);
            }
        }
    }

    _renderPicnic(g, s) {
        const x = s.x - 2, y = s.y - 14;
        g.rect(x - 1, y - 1, 54, 17, A.INK);
        for (let i = 0; i < 52; i += 4)
            for (let j = 0; j < 15; j += 3)
                g.rect(x + i, y + j, 4, 3, (i / 4 + j / 3) % 2 ? s.blanket : 0xf4eee0);
        g.blend(x, y + 15, 52, 2, 0x1a1028, 0.25);
    }

    // basket with a cloth and an apple beside it
    _renderBasket(g, bx, by) {
        g.rect(bx - 1, by - 1, 11, 7, A.INK);
        g.rect(bx, by, 9, 5, 0xb07840);
        g.rect(bx, by + 2, 9, 1, 0x8a5a30);
        g.rect(bx + 1, by - 1, 4, 1, 0xf4eee0);
        g.rect(bx + 2, by - 4, 5, 1, 0x8a5a30);
        g.px(bx + 2, by - 3, 0x8a5a30);
        g.px(bx + 6, by - 3, 0x8a5a30);
        g.rect(bx + 11, by + 3, 2, 2, 0xd84040);
    }

    _renderPondDuck(g, x, y, d) {
        x = Math.floor(x);
        y = Math.floor(y + Math.sin(d.t * 2) * 0.6);
        const flip = d.dir < 0, X = i => (flip ? x + 9 - i : x + i);
        const body = d.drake ? 0xb8a890 : 0x9a7048;
        g.rect(x - 1, y - 5, 12, 6, A.INK);
        g.rect(x, y - 4, 10, 4, body);
        g.rect(Math.min(X(7), X(10)), y - 9, 4, 6, A.INK);
        g.rect(Math.min(X(8), X(9)), y - 8, 2, 4, d.drake ? 0x2e8a4a : 0x8a6040);
        g.px(X(10), y - 6, 0xf0a020);
        g.px(X(11), y - 6, 0xf0a020);
        g.rect(x, y + 1, 10, 1, 0x8ac0f0);
    }

    _updateCars(real, env) {
        const stop = this.light.state !== 'green';
        for (const lane of this.lanes) {
            lane.cars.sort((a, b) => (b.x - a.x) * lane.dir);
            for (let i = 0; i < lane.cars.length; i++) {
                const v = lane.cars[i];
                v.t += real;
                let target = v.speed;
                const front = lane.dir > 0 ? v.x + v.len : v.x;
                const ahead = lane.cars[i - 1];
                if (ahead) {
                    const gap = lane.dir > 0 ? ahead.x - front : front - (ahead.x + ahead.len);
                    if (gap < 8)
                        target = 0;
                    else if (gap < 34)
                        target = Math.min(target, ahead.cur * (gap / 34) + 4);
                }
                const line = lane.dir > 0 ? this.crossX - 4 : this.crossX + 30;
                const dist = (line - front) * lane.dir;
                if (stop && !v.siren && v.type !== 'speeder' && dist > -2 && dist < 50 && !(this.light.state === 'yellow' && dist < 10))
                    target = Math.min(target, Math.max(0, dist - 1) * 2);
                if (!v.siren && dist > -1 && dist < 40 && this.people.some(p => p.state === 'cross' && Math.abs(p.y - lane.y) < 16))
                    target = 0;
                for (const d of this.ducks)
                    if (Math.abs(d.y - lane.y) < 14 && (d.x - front) * lane.dir > -6 && (d.x - front) * lane.dir < 46)
                        target = 0;
                if (v.type === 'bus') {
                    const door = v.x + v.len / 2;
                    if (!v.stopped && lane.dir < 0 && Math.abs(door - this.busX) < 3) {
                        v.stopped = 7;
                        this._busArrives(env);
                    }
                    if (v.stopped > 0) {
                        v.stopped -= real;
                        target = 0;
                        if (v.stopped <= 0)
                            v.stopped = -1;
                    }
                }
                v.braking = target < v.cur - 2;
                v.cur += clamp(target - v.cur, -70 * real, 28 * real);
                v.x += v.cur * real * lane.dir;
            }
            lane.cars = lane.cars.filter(v => v.x > -v.len - 40 && v.x < this.w + 40);
        }
    }

    _busArrives(env) {
        for (const p of this.people)
            if (p.state === 'wait' && p.waitFor === 'bus')
                p.state = 'board';
        for (let i = 0; i < randi(0, 3); i++) {
            const p = this._newPerson(env, 'back');
            p.x = this.busX + rand(-6, 6);
            this.people.push(p);
        }
    }

    _updatePeople(real, env) {
        const pedGreen = this.light.state === 'red' && this.light.t < 10;
        for (const p of this.people) {
            p.t += real;
            switch (p.state) {
            case 'walk': {
                if (p.dog && p.dog.sniff > 0) {
                    p.dog.sniff -= real;
                    break;
                }
                p.x += p.speed * p.dir * real;
                if (p.play && Math.random() < real / 3)
                    p.dir = -p.dir;
                if (p.dog && Math.random() < real / 12)
                    p.dog.sniff = rand(1, 3);
                if (p.chatCool > 0)
                    p.chatCool -= real;
                const poi = (key, near, fn) => {
                    if (near && p.poi !== key) {
                        p.poi = key;
                        fn();
                    }
                };
                if (p.lane === 'back' && !p.jogger && !p.flag) {
                    poi('bus', Math.abs(p.x - this.busX) < 3, () => {
                        if (chance(0.3)) {
                            p.state = 'wait';
                            p.waitFor = 'bus';
                            p.waitT = rand(30, 120);
                            p.x = this.busX + rand(-16, 10);
                        }
                    });
                    this.doors.forEach((d, i) => poi('d' + i, Math.abs(p.x - d.x - 1) < 2, () => {
                        if (chance(0.25)) {
                            p.gone = true;
                            d.open = 1.2;
                        }
                    }));
                }
                if (p.lane !== 'park' && !p.jogger && !p.flag)
                    poi('cross', Math.abs(p.x - this.crossX - 8) < 2, () => {
                        if (chance(0.4)) {
                            p.state = 'crosswait';
                            p.x = this.crossX + rand(2, 14);
                        }
                    });
                if (p.lane === 'park' && !p.play && !p.dog)
                    this.benches.forEach((bn, i) => poi('b' + i, Math.abs(p.x - bn.x - 4) < 2, () => {
                        if (chance(0.35)) {
                            p.state = 'sit';
                            p.sitT = rand(20, 80);
                            p.x = bn.x + 4;
                            p.y = bn.seatY + 7;
                        }
                    }));
                if (!p.jogger && !p.play && !(p.chatCool > 0) && Math.random() < real * 0.6) {
                    const o = this.people.find(q => q !== p && q.state === 'walk' && q.lane === p.lane && q.dir !== p.dir &&
                        Math.abs(q.x - p.x) < 12 && Math.abs(q.y - p.y) < 6 && !q.jogger);
                    if (o && chance(0.35)) {
                        const icon = pick(['heart', 'note', 'excl', 'dots', 'smile', 'zzz']);
                        for (const q of [p, o]) {
                            q.state = 'chat';
                            q.chatT = rand(4, 9);
                            q.icon = q === p ? icon : pick(['heart', 'note', 'smile', 'dots']);
                        }
                        o.dir = Math.sign(p.x - o.x) || 1;
                        p.dir = -o.dir;
                    }
                }
                break;
            }
            case 'chat':
                p.chatT -= real;
                if (p.chatT <= 0) {
                    p.state = 'walk';
                    p.chatCool = 20;
                }
                break;
            case 'wait':
                p.waitT -= real;
                if (p.waitT <= 0)
                    p.state = 'walk';
                break;
            case 'board':
                p.x += (this.busX - p.x) * real * 2;
                if (Math.abs(p.x - this.busX) < 3)
                    p.gone = true;
                break;
            case 'sit':
                if (p.musician !== undefined) {
                    p.musician -= real;
                    if (p.musician <= 0) {
                        p.state = 'walk';
                        p.musician = undefined;
                    } else if (Math.random() < real * 1.5) {
                        this.floaters.push({kind: 'note', x: p.x + 10, y: p.y - 30, t: 0, c: pick([0xffffff, 0xf0d050, 0xf080c0])});
                    }
                    break;
                }
                p.sitT -= real;
                if (p.sitT <= 0) {
                    p.state = 'walk';
                    p.y = this.parkY;
                }
                break;
            case 'crosswait':
                if (pedGreen) {
                    p.state = 'cross';
                    p.target = p.lane === 'back' ? rand(this.frontY[0], this.frontY[1]) : rand(this.backY[0], this.backY[1]);
                }
                break;
            case 'cross': {
                const dy = p.target - p.y;
                p.y += Math.sign(dy) * Math.min(Math.abs(dy), 18 * real);
                if (Math.abs(p.target - p.y) < 0.5) {
                    p.lane = p.lane === 'back' ? 'front' : 'back';
                    p.state = 'walk';
                    p.x += 12 * p.dir;
                }
                break;
            }
            }
            if (p.x < -60 || p.x > this.w + 60)
                p.gone = true;
        }
        this.people = this.people.filter(p => !p.gone);
    }

    _updateBits(real, env) {
        for (const flock of this.pigeons) {
            for (const b of flock) {
                b.t += real;
                if (!b.fly) {
                    if (this.people.some(p => Math.abs(p.y - b.y) < 8 && Math.abs(p.x + 7 - b.x) < 16)) {
                        b.fly = 1;
                        b.vx = rand(-40, 40);
                        b.vy = rand(-55, -35);
                    } else if (Math.random() < real * 0.5) {
                        b.x += rand(-3, 3);
                    }
                } else {
                    b.x += b.vx * real;
                    b.y += b.vy * real;
                }
            }
        }
        this.pigeons = this.pigeons.map(f => f.filter(b => b.y > -10)).filter(f => f.length);
        if (env.season === 'winter' || env.season === 'autumn' || env.dark > 0.5) {
            for (const b of this.buildings)
                for (const r of b.roofItems || [])
                    if (r.kind === 'chimney' && r.top && Math.random() < real * 1.2)
                        this.smoke.push({x: r.x + 5, y: r.top, t: 0, life: rand(3, 6)});
        }
        for (const s of this.smoke) {
            s.t += real;
            s.y -= 6 * real;
            s.x += (env.weather.wind * 7 + 2) * real;
        }
        this.smoke = this.smoke.filter(s => s.t < s.life);
        if (env.season === 'autumn' && Math.random() < real * 1.2) {
            const t = pick([...this.curbTrees, ...this.parkTrees]);
            if (t)
                this.leaves.push({x: t.x + rand(-14, 14), y: (t.y || this.roadTop) - 40, ground: (t.y || this.roadTop - 3) + rand(0, 10), t: 0, c: pick([0xe08a30, 0xd05a28, 0xf0c040])});
        }
        for (const l of this.leaves) {
            l.t += real;
            l.y += 10 * real;
            l.x += (Math.sin(l.t * 3) * 12 + env.weather.wind * 8) * real;
        }
        this.leaves = this.leaves.filter(l => l.y < l.ground);
        for (const f of this.floaters) {
            f.t += real;
            f.y -= (f.kind === 'note' ? 7 : 10) * real;
            f.x += (f.kind === 'note' ? Math.sin(f.t * 3) * 8 : env.weather.wind * 5 + Math.sin(f.t) * 4) * real;
        }
        this.floaters = this.floaters.filter(f => (f.kind === 'note' ? f.t < 3 : f.y > -20));
        for (const d of this.ducks) {
            d.t += real;
            d.y += 6 * real;
        }
        this.ducks = this.ducks.filter(d => d.y < this.frontY[1] + 6);
        for (const c of this.critters) {
            c.t += real;
            c.y += 26 * real;
        }
        this.critters = this.critters.filter(c => c.y < this.frontY[1] + 10);
    }

    // ---------- dynamic rendering ----------

    renderDynamic(g, env) {
        const t = this.realT;
        for (const w of this.windows)
            w.render(g, env);
        for (const b of this.buildings) {
            if (b.shop)
                this._renderShop(g, b, env);
            for (const bal of b.balconies || [])
                this._renderBalcony(g, bal, env);
            if (b.door && b.door.open > 0)
                g.rectE(b.door.x + 1, b.door.y + 1, b.door.w - 2, b.door.h - 1, env.dark > 0.4 ? 0xffd890 : 0x3a2a24);
            if (b.door && env.lampsOn) {
                g.rectE(b.door.x + b.door.w / 2 - 1, b.door.y - 7, 3, 3, 0xffe8a0);
                g.glow(b.door.x + b.door.w / 2, b.door.y - 5, 10, 0xffd080, 0.3);
            }
        }
        if (Math.floor(t * 0.8) % 2) {
            g.rectE(this.tower.x, this.base - this.tower.h - 22, 1, 2, 0xff3030);
            g.glow(this.tower.x, this.base - this.tower.h - 21, 6, 0xff3030, 0.4);
            for (const c of this.cranes) {
                g.rectE(c.x + c.arm, this.base - c.h - 2, 2, 2, 0xff3030);
                g.glow(c.x + c.arm, this.base - c.h - 1, 5, 0xff3030, 0.4);
            }
            for (const b of this.buildings)
                for (const r of b.roofItems || [])
                    if (r.kind === 'mast' && r.top) {
                        g.rectE(r.x, r.top - 1, 2, 2, 0xff3030);
                        g.glow(r.x + 1, r.top, 5, 0xff3030, 0.4);
                    }
        }
        for (const s of this.smoke) {
            const a = 0.45 * (1 - s.t / s.life), r = 2 + Math.floor(s.t * 1.2);
            g.blend(s.x - r / 2, s.y - r / 2, r, r, 0xd8d8e0, a);
        }
        for (const f of this.floaters)
            this._renderFloater(g, f);

        // back sidewalk people, then curb props in front of them
        const back = this.people.filter(p => p.lane === 'back' && p.state !== 'cross').sort((a, b) => a.y - b.y);
        for (const p of back)
            this._renderPerson(g, p, env);
        for (const flock of this.pigeons)
            for (const b of flock)
                if (b.y < this.roadTop || b.fly)
                    this._renderPigeon(g, b);
        g.compose(this.layerB, this.roadTop - 80, this.roadTop + 1, true);
        this._renderTrafficLights(g, env);
        if (env.lampsOn) {
            const curb = this.roadTop - 3;
            for (const l of this.lamps) {
                if (l.flicker && (Math.sin(t * 17) > 0.6 || Math.sin(t * 1.3) > 0.85))
                    continue;
                g.rectE(l.x - 3, curb - 55, 8, 6, 0xfff0c0);
                g.glow(l.x + 1, curb - 52, 14, 0xffe0a0, 0.35);
                g.glow(l.x + 1, curb - 2, 26, 0xffd890, 0.25, 0.35);
                if (env.weather.wet > 0.3)
                    g.blend(l.x - 3, this.roadTop + 3, 8, 30, 0xffe0a0, 0.12 * env.weather.wet, true);
            }
        }
        // road and front sidewalk, sorted by depth
        const items = [];
        for (const lane of this.lanes)
            for (const v of lane.cars)
                items.push([lane.y, 1, v]);
        for (const p of this.people)
            if (p.lane === 'front' || p.state === 'cross')
                items.push([p.y, 0, p]);
        for (const d of this.ducks)
            items.push([d.y, 2, d]);
        for (const c of this.critters)
            items.push([c.y, 3, c]);
        for (const flock of this.pigeons)
            for (const b of flock)
                if (b.y > this.roadTop && !b.fly)
                    items.push([b.y, 4, b]);
        items.sort((a, b) => a[0] - b[0]);
        for (const [y, kind, o] of items) {
            if (kind === 0)
                this._renderPerson(g, o, env);
            else if (kind === 1)
                this._renderCar(g, o, y, env);
            else if (kind === 2)
                this._renderDuck(g, o);
            else if (kind === 3)
                drawFigure(g, catFigure(o.cat, Math.floor(o.t * 8) % 2 ? 'walk1' : 'walk2'), o.x, o.y, false);
            else
                this._renderPigeon(g, o);
        }
        // park in front
        g.compose(this.layerC, this.parkTop - 80, this.h, true);
        for (const b of this.parkBits) {
            if (b.fx !== undefined && env.weather.snowCover < 0.3) {
                for (let i = 0; i < 10; i++) {
                    const ph = (t * 1.2 + i / 10) % 1;
                    const side = i % 2 ? 1 : -1;
                    g.blend(b.fx + side * ph * 12, b.fy - Math.sin(ph * Math.PI) * 10, 1, 2, 0xc8e8ff, 0.8);
                }
            }
        }
        this._renderMeadow(g, env);
        const park = this.people.filter(p => p.lane === 'park').sort((a, b) => a.y - b.y);
        for (const p of park)
            this._renderPerson(g, p, env);
        for (const l of this.leaves) {
            g.rect(l.x, l.y, 2, 1, l.c);
            g.px(l.x + 1, l.y + 1, shadow(l.c, 0.3));
        }
    }

    _renderFloater(g, f) {
        if (f.kind === 'note') {
            g.rect(f.x - 1, f.y - 1, 5, 7, A.INK);
            g.rect(f.x + 2, f.y, 1, 5, f.c);
            g.rect(f.x, f.y + 3, 3, 2, f.c);
            g.rect(f.x + 2, f.y, 2, 1, f.c);
        } else {
            g.line(f.x, f.y + 4, f.x + Math.sin(f.t * 2) * 2, f.y + 14, 0xd0d0d0);
            g.disc(f.x, f.y, 5, A.INK);
            g.disc(f.x, f.y, 4, f.c);
            g.rect(f.x - 2, f.y - 2, 2, 2, highlight(f.c, 0.6));
        }
    }

    _renderCar(g, v, y, env) {
        drawVehicle(g, v, y, env, env.lampsOn || env.weather.v.rain > 0.5);
        if (v.wedding) {
            const bx = v.dir > 0 ? v.x - 10 : v.x + v.len + 4;
            for (let i = 0; i < 3; i++)
                g.rect(bx + (v.dir > 0 ? -i * 5 : i * 5), y - 4 + (Math.floor(v.t * 8 + i) % 2), 3, 3, 0xb8b8c0);
            if (Math.floor(v.t * 2) % 2)
                this._icon(g, v.x + v.len / 2, y - 30, 'heart');
        }
    }

    _renderPerson(g, p, env) {
        drawPerson(g, p, p.x, p.y, p.dir, env);
        const f = personFigure(p, 0);
        if (p.state === 'chat' && p.chatT > 1.5 && Math.floor(p.chatT * 1.5) % 3 !== 0)
            this._icon(g, p.x + 4, p.y - f.h - 12, p.icon);
        if (p.flag) {
            g.rect(p.x + 12, p.y - f.h - 10, 1, 22, 0x5a4030);
            g.rect(p.x + 13, p.y - f.h - 10, 8, 6, p.flag);
        }
        if (p.camera && Math.floor(p.t * 0.7) % 5 === 0 && env.dark > 0.3)
            g.glow(p.x + 10, p.y - f.h + 8, 10, 0xffffff, 0.6);
        if (p.musician !== undefined) {
            const R = A.ramp(0xc88838);
            g.rect(p.x + 6, p.y - 16, 10, 7, A.INK);
            g.rect(p.x + 7, p.y - 15, 8, 5, R[2]);
            g.disc(p.x + 10, p.y - 13, 1, A.INK);
            g.rect(p.x + 14, p.y - 22, 2, 8, R[0]);
            g.rect(p.x - 12, p.y - 4, 10, 4, A.INK);
            g.rect(p.x - 11, p.y - 3, 8, 2, 0x8a3a3a);
        }
        if (p.bib)
            g.rect(p.x + 5, p.y - 18, 5, 4, 0xf04848);
    }

    _icon(g, x, y, kind) {
        x = Math.floor(x);
        y = Math.floor(y);
        g.rect(x - 2, y - 2, 13, 11, A.INK);
        g.rect(x - 1, y - 1, 11, 9, 0xffffff);
        g.rect(x + 2, y + 9, 3, 1, A.INK);
        g.rect(x + 3, y + 8, 2, 1, 0xffffff);
        const c = {heart: 0xe83860, note: 0x3a3a60, excl: 0xd84848, smile: 0x3a3a60, zzz: 0x4870c8, dots: 0x3a3a60}[kind] || 0x3a3a60;
        switch (kind) {
        case 'heart':
            g.rect(x + 1, y + 1, 3, 2, c);
            g.rect(x + 5, y + 1, 3, 2, c);
            g.rect(x, y + 2, 9, 2, c);
            g.rect(x + 1, y + 4, 7, 1, c);
            g.rect(x + 2, y + 5, 5, 1, c);
            g.rect(x + 3, y + 6, 3, 1, c);
            g.px(x + 2, y + 1, 0xffa0b0);
            break;
        case 'note':
            g.rect(x + 5, y, 1, 6, c);
            g.rect(x + 2, y + 4, 3, 3, c);
            g.rect(x + 6, y, 2, 2, c);
            break;
        case 'excl':
            g.rect(x + 4, y, 2, 4, c);
            g.rect(x + 4, y + 5, 2, 2, c);
            break;
        case 'smile':
            g.rect(x + 2, y + 1, 1, 2, c);
            g.rect(x + 6, y + 1, 1, 2, c);
            g.rect(x + 2, y + 5, 5, 1, c);
            g.px(x + 1, y + 4, c);
            g.px(x + 7, y + 4, c);
            break;
        case 'zzz':
            g.text('Z', x + 3, y + 1, c);
            break;
        default:
            for (let i = 0; i < 3; i++)
                g.rect(x + 1 + i * 3, y + 3, 2, 2, c);
        }
    }

    _renderPigeon(g, b) {
        const x = Math.floor(b.x), y = Math.floor(b.y);
        if (b.fly) {
            const up = Math.floor(b.t * 10) % 2;
            g.rect(x - 1, y - 4, 7, 4, A.INK);
            g.rect(x, y - 3, 5, 2, b.c);
            g.rect(x - 4, y - (up ? 7 : 3), 4, 2, b.c);
            g.rect(x + 5, y - (up ? 7 : 3), 4, 2, b.c);
            return;
        }
        const peck = Math.floor(b.t * 2 + b.x) % 3 === 0;
        g.rect(x - 1, y - 6, 9, 6, A.INK);
        g.rect(x, y - 5, 7, 4, b.c);
        g.rect(x + 1, y - 5, 4, 1, highlight(b.c, 0.3));
        g.rect(x + 2, y - 3, 2, 1, 0x5a9a8a);
        g.rect(x + 5, peck ? y - 3 : y - 8, 4, 4, A.INK);
        g.rect(x + 6, peck ? y - 2 : y - 7, 2, 2, b.c);
        g.px(x + 8, peck ? y - 1 : y - 6, 0xe8a040);
        g.rect(x + 2, y - 1, 1, 1, 0xd87050);
        g.rect(x + 4, y - 1, 1, 1, 0xd87050);
    }

    _renderDuck(g, d) {
        const x = Math.floor(d.x), y = Math.floor(d.y), step = Math.floor(d.t * 6) % 2;
        if (d.big) {
            g.rect(x - 1, y - 9, 12, 8, A.INK);
            g.rect(x, y - 7, 9, 5, 0xa87848);
            g.rect(x + 6, y - 11, 5, 5, A.INK);
            g.rect(x + 7, y - 10, 3, 3, 0x3a8a4a);
            g.rect(x + 10, y - 8, 2, 1, 0xf08a20);
        } else {
            g.rect(x - 1, y - 6, 8, 5, A.INK);
            g.rect(x, y - 5, 6, 3, 0xf0d850);
            g.rect(x + 4, y - 8, 4, 4, A.INK);
            g.rect(x + 5, y - 7, 2, 2, 0xf0d850);
            g.px(x + 7, y - 6, 0xf08a20);
        }
        g.px(x + 2 + step, y - 1, 0xf08a20);
        g.px(x + 5 - step, y - 1, 0xf08a20);
    }

    _renderTrafficLights(g, env) {
        const curb = this.roadTop - 3, st = this.light.state;
        for (const px of [this.crossX - 6, this.crossX + 30]) {
            [[0xff3030, 'red'], [0xffc020, 'yellow'], [0x30e060, 'green']].forEach(([c, s], i) => {
                const ly = curb - 58 + i * 4;
                if (st === s) {
                    g.rectE(px - 1, ly, 3, 3, c);
                    g.glow(px, ly + 1, 7, c, 0.35);
                } else {
                    g.rect(px - 1, ly, 3, 3, shadow(c, 0.75));
                }
            });
        }
        const px = this.crossX + 12, py = this.frontTop + 2;
        const walk = st === 'red' && this.light.t < 10;
        // pedestrian signal on its own post at the front curb
        const hy = py - 26;
        g.rect(px, hy, 3, py - hy + 2, A.INK);
        g.rect(px + 1, hy, 1, py - hy + 1, 0x5a5a68);
        g.rect(px - 3, hy - 10, 9, 12, A.INK);
        g.rect(px - 2, hy - 9, 7, 10, 0x2a2a34);
        g.rectE(px - 1, walk ? hy - 4 : hy - 8, 5, 3, walk ? 0x30e060 : 0xff3030);
        g.glow(px + 1, walk ? hy - 3 : hy - 7, 5, walk ? 0x30e060 : 0xff3030, 0.25);
    }

    _renderBalcony(g, bal, env) {
        const {x, y, w} = bal;
        g.rect(x - 1, y - 8, w + 2, 9, A.INK);
        g.rect(x, y - 7, w, 1, 0x4a4a5a);
        for (let i = 1; i < w - 1; i += 3)
            g.rect(x + i, y - 6, 1, 6, 0x4a4a5a);
        g.rect(x - 2, y, w + 4, 3, A.INK);
        g.rect(x - 1, y, w + 2, 2, 0xb8b0a0);
        if (bal.flowers && env.season !== 'winter')
            for (let i = 1; i < w - 1; i += 3) {
                g.rect(x + i, y - 10, 2, 3, 0x4a9a3a);
                g.rect(x + i, y - 11, 2, 1, [0xe84860, 0xf8d048, 0xf890b0][i % 3]);
            }
        if (bal.laundry && env.weather.v.rain < 0.2 && !env.night) {
            g.line(x, y - 22, x + w, y - 22, 0xd0d0d0);
            g.rect(x + 2, y - 21, 4, 6, 0xf4f4f4);
            g.rect(x + 8, y - 21, 5, 8, 0x4c7cd0);
            g.rect(x + 15, y - 21, 3, 4, 0xe876a0);
        }
        if (bal.smoker && env.dark > 0.5 && bal.win.hh.state(env) === 'home' && Math.sin(this.realT * 0.3 + x) > 0.5) {
            g.rect(x + w - 8, y - 18, 5, 5, 0x2a2a38);
            g.rect(x + w - 9, y - 13, 7, 6, 0x3a3a4a);
            g.pxE(x + w - 10, y - 12, Math.sin(this.realT * 2 + x) > 0.3 ? 0xff6020 : 0xa04020);
        }
        this._snowLine(g, x - 1, y - 8, w + 2, env);
    }

    _renderShop(g, b, env) {
        const s = b.shop;
        if (!s.win)
            return;
        let h = env.hour;
        if (s.open[1] > 24 && h < s.open[1] - 24)
            h += 24;
        const open = h >= s.open[0] && h < s.open[1] &&
            !(env.weekday === 0 && !['CAFE', 'BAR', 'KIOSK', 'HOTEL', 'GELATO', 'PIZZA'].includes(s.name));
        const {x, y, w, h: wh} = s.win;
        const night = env.dark > 0.35;
        const inside = open ? 0xfff0c8 : night ? 0x2a2840 : 0x8ab8d8;
        if (open && night)
            g.rectE(x, y, w, wh, inside);
        else
            g.rect(x, y, w, wh, open ? 0xf0e0c0 : inside);
        // shelves with goods
        const shelf = A.ramp(0x9a6a40);
        for (const sy of [y + 9, y + Math.round(wh / 2) + 3, y + wh - 4]) {
            g.rect(x, sy, w, 2, shelf[1]);
            for (let i = 2; i < w - 2; i += 4) {
                const gx = x + i, gy = sy;
                switch (s.goods) {
                case 'bread': g.rect(gx, gy - 3, 3, 3, 0xc88a40); g.px(gx + 1, gy - 3, 0xe8b060); break;
                case 'cups': g.rect(gx, gy - 3, 2, 3, 0xf4f4f4); g.px(gx + 2, gy - 2, 0xf4f4f4); break;
                case 'books': g.rect(gx, gy - 5, 3, 5, [0xd84848, 0x4870c8, 0x5cae5c, 0xe8a640][(i / 4) % 4]); break;
                case 'flowers': g.rect(gx, gy - 2, 1, 2, 0x5cae5c); g.rect(gx - 1, gy - 4, 3, 2, [0xe85050, 0xf0d050, 0xf080c0, 0xc070e0][(i / 4) % 4]); break;
                case 'bottles': g.rect(gx, gy - 6, 2, 6, [0x5a9a4a, 0x8a4a2a, 0x4a6ac0][(i / 4) % 3]); g.px(gx, gy - 7, 0x3a3a3a); break;
                case 'mags': g.rect(gx, gy - 4, 3, 4, [0xf0d050, 0xe876a0, 0x60b0c8][(i / 4) % 3]); break;
                case 'toys': g.rect(gx, gy - 3, 3, 3, [0xd84848, 0xf0d050, 0x4870c8, 0x5cae5c][(i / 4) % 4]); break;
                case 'ice': g.rect(gx, gy - 3, 3, 3, [0xf8d8e8, 0xf8f0c0, 0x8a5a3a, 0xa8e0a8][(i / 4) % 4]); break;
                case 'fruit': g.rect(gx, gy - 3, 3, 3, [0xd83030, 0xf0a030, 0x7ac040, 0xf0e050][(i / 4) % 4]); break;
                case 'oven':
                    if (i === 2) {
                        g.rect(x + 2, y + 1, 10, 8, 0x6a4a3a);
                        g.rectE(x + 4, y + 4, 6, 3, Math.floor(this.realT * 5) % 2 ? 0xff8030 : 0xffa040);
                    }
                    break;
                }
            }
        }
        if (open) {
            const sx = x + 4 + Math.floor((Math.sin(this.realT * 0.4) * 0.5 + 0.5) * (w - 14));
            const sil = night ? mix(inside, 0x2a1830, 0.75) : 0x6a5a5a;
            const R = night ? (a, b2, c, d) => g.rectE(a, b2, c, d, sil) : (a, b2, c, d) => g.rect(a, b2, c, d, sil);
            R(sx + 1, y + 4, 6, 6);
            R(sx, y + 10, 8, wh - 12);
        }
        // window bars and glare
        g.rect(x + Math.floor(w / 2), y, 2, wh, A.INK);
        g.blend(x + 2, y + 1, 3, wh - 2, 0xffffff, 0.15);
        // sign letters: neon at night
        const neon = night, t = this.realT;
        for (let i = 0; i < s.name.length; i++) {
            const broken = i === s.broken && neon && (Math.sin(t * 13) > 0.3 || Math.sin(t * 2.3) > 0.7);
            const col = neon ? (broken ? 0x4a3040 : highlight(s.awning[0], 0.5)) : 0xf4e0b0;
            g.text(s.name[i], s.sign.x + i * 4, s.sign.y, col, neon && !broken);
        }
        if (neon)
            g.glow(s.sign.x + s.name.length * 2, s.sign.y + 2, s.name.length * 3 + 6, highlight(s.awning[0], 0.4), 0.22);
        // café tables
        if (s.tableXs.length) {
            const dry = env.weather.v.rain < 0.15 && env.weather.v.snow < 0.1;
            const want = open && dry && env.hour > 8 && env.hour < 23 ? s.tableXs.length : 0;
            while (s.guests.length < want)
                s.guests.push(chance(0.6) ? {p: makePerson(env, {kid: false}), side: chance(0.5) ? 1 : -1} : null);
            if (s.guests.length > want)
                s.guests.length = want;
            s.tableXs.forEach((tx, i) => {
                const gst = s.guests[i], by = this.backY[0];
                if (gst) {
                    gst.p.state = 'sit';
                    drawPerson(g, gst.p, tx + (gst.side > 0 ? -12 : 10), by + 1, gst.side, env);
                }
                g.rect(tx - 1, by - 11, 14, 4, A.INK);
                g.rect(tx, by - 10, 12, 2, 0xf4f0e4);
                g.rect(tx + 5, by - 7, 2, 7, A.INK);
                g.rect(tx + 2, by - 1, 8, 1, A.INK);
                if (gst && Math.floor(this.realT / 3 + i) % 4 === 0) {
                    g.rect(tx + 3, by - 14, 3, 3, 0xf4f4f4);
                    g.blend(tx + 4, by - 18 - (this.realT * 3 % 3), 1, 2, 0xffffff, 0.5);
                }
            });
        }
    }
}
