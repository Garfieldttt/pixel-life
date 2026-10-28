// Medieval market town in side view: a castle on the hill behind the town
// wall, a street of half-timbered houses with shops, a church, a tavern
// and a smithy, a cobbled road with carts and riders and the market square
// in front. The day follows the church bells: the morning bell opens the
// gate, shops and market, the curfew bell at nine sends everybody home and
// leaves the streets to the night watchman. Feast days follow the calendar.
import {rand, randi, chance, pick, weighted, clamp, steppedLevel} from './util.js';
import {mix, shadow, highlight} from './gfx.js';
import * as A from './art.js';
import {Household, Win} from './windows.js';
import {makeMedieval, drawPerson, personFigure, makeDog, dogFigure, makeCat, catFigure} from './people.js';
import {Cells, drawFigure} from './figure.js';
import {animalFigure} from './farm.js';
import {Timers} from './timers.js';

const INK = A.INK;
const GH = 52, FH = 42;
const hash = (x, y, s = 0) => ((((x + s * 131) * 73856093) ^ ((y - s * 71) * 19349663)) >>> 0) % 1000;

const PLASTER = [0xf0e6cc, 0xe8d8b0, 0xf4ecdc, 0xe8cfb0, 0xdcd4bc, 0xf0dcc8, 0xe4dcc4];
const TIMBER = [0x4a2e1c, 0x3a2418, 0x5a3a22, 0x2e221c];
const ROOF = [0x9a4a2a, 0x8a3a24, 0x6a5a4a, 0x7a4430, 0x4a4a54, 0xa0582e];
const STONE = [0xa89878, 0x9a8c74, 0xb0a48a, 0x8a8478];
const DOORS = [0x6a4428, 0x5a3a20, 0x7a4a2a, 0x4a3a2a, 0x6a3a24];

// shops and their guild signs (pictures, since few could read)
const SHOPS = [
    {kind: 'baker', open: [5.5, 13], goods: 'bread'},
    {kind: 'cobbler', open: [7, 18], goods: 'shoes'},
    {kind: 'apothecary', open: [8, 18], goods: 'jars'},
    {kind: 'tailor', open: [7, 18], goods: 'cloth'},
    {kind: 'chandler', open: [7, 18], goods: 'candles'},
    {kind: 'potter', open: [7, 17], goods: 'pots'},
    {kind: 'butcher', open: [6, 13], goods: 'meat'},
];
const STALLS = [
    {goods: 'cabbage', c: [0x6ab84a, 0x9ad070]}, {goods: 'apples', c: [0xd84040, 0x8ac040]},
    {goods: 'fish', c: [0xa8b8c8, 0x7a8a9a]}, {goods: 'cheese', c: [0xf0c850, 0xe0a830]},
    {goods: 'cloth', c: [0x3a5a9a, 0x9a3a2a]}, {goods: 'pots', c: [0xb86a3a, 0x9a5a30]},
    {goods: 'eggs', c: [0xf4ecdc, 0xe8d8b8]}, {goods: 'herbs', c: [0x5a8a3a, 0x8a6aa8]},
    {goods: 'bread', c: [0xd8983a, 0xb87a2a]}, {goods: 'pumpkins', c: [0xf08a20, 0xd86a10]},
];
const AWNINGS = [[0xd84848, 0xf4ecdc], [0x3a6aa8, 0xf4ecdc], [0x4a8a3a, 0xf0dca0], [0xd89a30, 0x7a3a2a], [0x7a4a8a, 0xf0dca0]];
const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

// ---------------- beasts and carts ----------------

const sh = (c, t = 0.3) => mix(c, 0x2a1040, t);
const hi = (c, t = 0.25) => mix(c, 0xfff4d0, t);
const FIG = new Map();
const cached = (key, build) => {
    let f = FIG.get(key);
    if (!f)
        FIG.set(key, f = build());
    return f;
};

// facing right; frame 0..3 walk cycle
function buildHorse(c0, frame, cloth) {
    const c = new Cells(36, 30), a = c0, aS = sh(a, 0.28), aH = hi(a, 0.22), mane = sh(a, 0.6);
    // legs: near pair darker in front, far pair behind
    const sw = [[0, 0, 0, 0], [3, -2, -2, 3], [0, 0, 0, 0], [-2, 3, 3, -2]][frame % 4];
    [[6, sw[0], aS], [9, sw[1], a], [22, sw[2], aS], [25, sw[3], a]].forEach(([lx, o, col]) => {
        for (let i = 0; i < 11; i++)
            c.rect(lx + Math.round(o * i / 10), 18 + i, 3, 1, col);
        c.rect(lx + o, 29, 3, 1, 0x2a2420);
    });
    // body, neck and head
    c.rect(4, 9, 25, 10, a);
    c.rect(5, 8, 22, 1, a);
    c.rect(5, 9, 22, 1, aH);
    c.rect(5, 17, 23, 2, aS);
    c.rect(25, 3, 6, 9, a);
    c.rect(27, 0, 6, 5, a);
    c.rect(30, 3, 5, 3, a);
    c.rect(33, 4, 2, 2, sh(a, 0.4));
    c.set(30, 2, INK);
    c.set(28, -1, a);
    c.rect(24, 1, 3, 8, mane);
    c.rect(26, -1, 2, 2, mane);
    // tail
    c.rect(2, 9, 3, 3, mane);
    c.rect(1, 11, 2, 7, mane);
    if (cloth) {
        // caparison: a cloth over the horse down to the knees
        c.rect(3, 8, 26, 16, cloth);
        c.rect(3, 8, 26, 1, hi(cloth, 0.3));
        c.rect(3, 23, 26, 1, sh(cloth, 0.3));
        for (let i = 5; i < 28; i += 6)
            c.rect(i, 12, 2, 3, 0xf0c030);
        c.rect(26, 2, 4, 7, cloth);
    } else {
        // saddle cloth and reins
        c.rect(12, 7, 9, 3, 0x6a3a24);
        c.rect(12, 10, 9, 2, 0x9a2a2a);
    }
    return c.finish(INK);
}

function buildOx(c0, frame) {
    const c = new Cells(37, 24), a = c0, aS = sh(a, 0.28), aH = hi(a, 0.22);
    const sw = [[0, 0, 0, 0], [2, -1, -1, 2], [0, 0, 0, 0], [-1, 2, 2, -1]][frame % 4];
    [[5, sw[0], aS], [9, sw[1], a], [23, sw[2], aS], [27, sw[3], a]].forEach(([lx, o, col]) => {
        c.rect(lx + o, 16, 4, 7, col);
        c.rect(lx + o, 23, 4, 1, 0x2a2420);
    });
    c.rect(3, 6, 27, 11, a);
    c.rect(20, 3, 9, 4, a);
    c.rect(21, 3, 6, 1, aH);
    c.rect(4, 5, 17, 1, aH);
    c.rect(4, 15, 26, 2, aS);
    // head held low with a broad muzzle, horns curving up
    c.rect(28, 7, 6, 9, a);
    c.rect(31, 12, 5, 5, hi(a, 0.35));
    c.set(34, 13, INK);
    c.set(31, 9, INK);
    c.rect(26, 15, 4, 3, aS);
    c.rect(27, 5, 2, 2, 0xf0e8d0);
    c.rect(26, 2, 2, 3, 0xf0e8d0);
    c.rect(33, 5, 2, 2, 0xf0e8d0);
    c.rect(34, 2, 2, 3, 0xf0e8d0);
    c.rect(1, 7, 2, 8, aS);
    c.rect(0, 14, 2, 2, sh(a, 0.5));
    // the yoke across the neck
    c.rect(25, 3, 3, 8, 0x6a4a2a);
    return c.finish(INK);
}

function buildDonkey(c0, frame, packs) {
    const c = new Cells(26, 24), a = c0, aS = sh(a, 0.25), belly = hi(a, 0.5);
    const sw = [[0, 0, 0, 0], [2, -2, -2, 2], [0, 0, 0, 0], [-2, 2, 2, -2]][frame % 4];
    [[4, sw[0], aS], [7, sw[1], a], [16, sw[2], aS], [19, sw[3], a]].forEach(([lx, o, col]) => {
        for (let i = 0; i < 8; i++)
            c.rect(lx + Math.round(o * i / 7), 15 + i, 2, 1, col);
    });
    c.rect(3, 8, 19, 8, a);
    c.rect(4, 14, 17, 2, belly);
    c.rect(19, 3, 5, 7, a);
    c.rect(21, 1, 5, 5, a);
    c.rect(24, 4, 2, 2, belly);
    c.set(23, 2, INK);
    c.rect(19, -3, 2, 5, a);
    c.rect(21, -2, 1, 4, aS);
    c.rect(1, 9, 2, 6, aS);
    if (packs) {
        c.rect(6, 6, 6, 9, 0xc8b088);
        c.rect(13, 6, 6, 9, 0xb89a70);
        c.rect(6, 6, 13, 1, 0x8a6a40);
    }
    return c.finish(INK);
}

function buildPig(c0, frame) {
    const c = new Cells(18, 12), a = c0, aS = sh(a, 0.25), aH = hi(a, 0.25);
    const st = frame % 2;
    c.rect(1, 2, 14, 7, a);
    c.rect(2, 2, 12, 1, aH);
    c.rect(2, 8, 12, 1, aS);
    c.rect(14, 3, 3, 4, a);
    c.rect(16, 4, 2, 2, sh(a, 0.15));
    c.set(17, 5, sh(a, 0.5));
    c.set(14, 3, INK);
    c.rect(12, 1, 2, 2, aS);
    c.set(0, 3, a);
    c.set(0, 2, aS);
    for (const [lx, o] of [[2, st], [5, -st], [10, -st], [13, st]])
        c.rect(lx + o, 9, 2, 3, aS);
    return c.finish(INK);
}

function buildGoose(frame) {
    const c = new Cells(14, 16), w = 0xf4f0e8, wS = 0xc8c4bc;
    const st = frame % 2;
    c.rect(1, 7, 10, 5, w);
    c.rect(2, 11, 8, 1, wS);
    c.rect(3, 8, 5, 2, wS);
    c.rect(9, 1, 2, 7, w);
    c.rect(10, 0, 3, 3, w);
    c.rect(13, 1, 1, 1, 0xf08a20);
    c.rect(12, 1, 2, 2, 0xf08a20);
    c.set(11, 1, INK);
    c.set(0, 7, w);
    c.rect(4 + st, 12, 1, 3, 0xf08a20);
    c.rect(7 - st, 12, 1, 3, 0xf08a20);
    return c.finish(INK);
}

const BEAST = {
    horse: (b, fr) => cached(`h:${b.c}:${fr % 4}:${b.cloth || 0}`, () => buildHorse(b.c, fr, b.cloth)),
    ox: (b, fr) => cached(`o:${b.c}:${fr % 4}`, () => buildOx(b.c, fr)),
    donkey: (b, fr) => cached(`d:${b.c}:${fr % 4}:${b.packs ? 1 : 0}`, () => buildDonkey(b.c, fr, b.packs)),
    pig: (b, fr) => cached(`p:${b.c}:${fr % 2}`, () => buildPig(b.c, fr)),
    goose: (b, fr) => cached(`g:${fr % 2}`, () => buildGoose(fr)),
    sheep: (b, fr) => animalFigure('sheep', 0xf0ece0, 0x3a3434, fr % 2 ? 'walk1' : 'walk2'),
    chicken: (b, fr) => animalFigure('chicken', b.c, 0, fr === 'peck' ? 'graze' : 'walk1'),
};
const HORSES = [0x8a4a2a, 0xa85a2a, 0x2a2420, 0xe0dcd4, 0xc8a868, 0x6a3a22];

// two-wheeled cart, the wheel turns with the distance travelled
function drawCart(g, x, y, len, load, dist, flip) {
    const X = v => (flip ? x + len - v : x + v);
    const bedY = y - 14;
    // shafts towards the beast
    g.line(Math.round(X(len - 2)), bedY + 2, Math.round(X(len + 10)), bedY - 2, 0x5a3a20);
    g.rect(Math.round(Math.min(X(0), X(len))), bedY - 1, len, 6, INK);
    g.rect(Math.round(Math.min(X(1), X(len - 1))), bedY, len - 2, 4, 0x8a5a32);
    g.rect(Math.round(Math.min(X(1), X(len - 1))), bedY, len - 2, 1, 0xa8703e);
    for (let i = 4; i < len - 2; i += 6)
        g.px(Math.round(X(i)), bedY + 2, 0x5a3a20);
    // load
    const lx = Math.round(Math.min(X(2), X(len - 2))), lw = len - 4;
    switch (load) {
    case 'hay':
        for (let i = 0; i < 10; i++) {
            const half = Math.round(lw / 2 * Math.sqrt(1 - ((i - 10) / 11) ** 2));
            g.rect(lx + lw / 2 - half, bedY - 1 - (10 - i), half * 2, 1, i < 3 ? 0xf0dc80 : 0xd8b850);
        }
        break;
    case 'barrels':
        for (let i = 0; i < lw - 9; i += 11) {
            g.rect(lx + i, bedY - 11, 10, 11, INK);
            g.rect(lx + i + 1, bedY - 10, 8, 10, 0x8a5a32);
            g.rect(lx + i + 1, bedY - 8, 8, 1, 0x4a4a52);
            g.rect(lx + i + 1, bedY - 3, 8, 1, 0x4a4a52);
        }
        break;
    case 'sacks':
        for (let i = 0; i < lw - 7; i += 8) {
            g.rect(lx + i, bedY - 7, 9, 7, INK);
            g.rect(lx + i + 1, bedY - 6, 7, 6, 0xd8c098);
            g.px(lx + i + 2, bedY - 6, 0xf0dcb8);
        }
        break;
    case 'cabbages':
        for (let i = 0; i < lw - 4; i += 5)
            for (let k = 0; k < 2; k++) {
                g.disc(lx + i + 3, bedY - 3 - k * 4, 3, INK);
                g.disc(lx + i + 3, bedY - 3 - k * 4, 2, k ? 0x9ad070 : 0x6ab84a);
            }
        break;
    case 'logs':
        for (let k = 0; k < 3; k++) {
            g.rect(lx, bedY - 4 - k * 4, lw, 4, INK);
            g.rect(lx + 1, bedY - 3 - k * 4, lw - 2, 2, 0x8a5a32);
            g.rect(Math.round(flip ? lx + 1 : lx + lw - 4), bedY - 3 - k * 4, 3, 2, 0xd8b078);
        }
        break;
    }
    // wheel with spokes
    const wx = Math.round(X(len * 0.42)), wy = y - 8, a = dist / 8 * (flip ? -1 : 1);
    g.disc(wx, wy, 8, INK);
    g.disc(wx, wy, 7, 0x8a5a32);
    g.disc(wx, wy, 5, 0x3a2a1e);
    for (let i = 0; i < 4; i++) {
        const ang = a + i * Math.PI / 4;
        g.line(Math.round(wx - Math.cos(ang) * 5), Math.round(wy - Math.sin(ang) * 5), Math.round(wx + Math.cos(ang) * 5), Math.round(wy + Math.sin(ang) * 5), 0x8a5a32);
    }
    g.rect(wx - 1, wy - 1, 3, 3, 0x4a4a52);
}

// guild signs on a board, about 14 x 13
function buildSign(kind) {
    const c = new Cells(14, 13);
    c.rect(0, 0, 14, 13, 0x7a5232);
    c.rect(1, 1, 12, 11, 0x9a6a3e);
    const k = kind;
    if (k === 'tavern') {
        // a tankard with foam
        c.rect(4, 4, 6, 7, 0xd8a840);
        c.rect(4, 3, 6, 2, 0xf8f4ec);
        c.rect(10, 5, 2, 4, 0xd8a840);
        c.rect(5, 6, 1, 4, 0xf0c860);
    } else if (k === 'baker') {
        // a pretzel
        c.rect(3, 4, 8, 2, 0xc8802a);
        c.rect(3, 4, 2, 6, 0xc8802a);
        c.rect(9, 4, 2, 6, 0xc8802a);
        c.rect(4, 9, 6, 2, 0xc8802a);
        c.rect(6, 6, 2, 3, 0xc8802a);
    } else if (k === 'cobbler') {
        c.rect(5, 3, 3, 7, 0x4a2a1a);
        c.rect(5, 8, 7, 3, 0x4a2a1a);
        c.rect(6, 4, 1, 4, 0x6a4a2a);
    } else if (k === 'apothecary') {
        // mortar and pestle
        c.rect(3, 6, 8, 4, 0xe8e0d0);
        c.rect(4, 10, 6, 1, 0xc8c0b0);
        c.rect(8, 2, 2, 5, 0xc8a878);
    } else if (k === 'tailor') {
        // scissors
        c.rect(3, 3, 2, 7, 0x8a8a92);
        c.rect(9, 3, 2, 7, 0x8a8a92);
        c.rect(5, 5, 4, 2, 0x8a8a92);
        c.rect(2, 9, 3, 3, 0x3a3a42);
        c.rect(9, 9, 3, 3, 0x3a3a42);
    } else if (k === 'chandler') {
        c.rect(4, 4, 2, 7, 0xf4ecd8);
        c.rect(8, 3, 2, 8, 0xf4ecd8);
        c.set(4, 3, 0xffc040);
        c.set(8, 2, 0xffc040);
    } else if (k === 'potter') {
        c.rect(4, 4, 6, 6, 0xb86a3a);
        c.rect(5, 3, 4, 1, 0xb86a3a);
        c.rect(5, 10, 4, 1, 0x9a5a30);
    } else if (k === 'butcher') {
        // a ham
        c.rect(4, 4, 6, 6, 0xc8584a);
        c.rect(5, 3, 4, 1, 0xc8584a);
        c.rect(6, 9, 2, 3, 0xf0e8d8);
    }
    return c.finish(INK);
}

export class Medieval {
    constructor(w, h, env) {
        this.name = 'medieval';
        this.era = 'medieval';
        this.w = w;
        this.h = h;
        this.timers = new Timers();
        this.layout(env);
    }

    // ---------- layout ----------

    layout(env) {
        const W = this.w, H = this.h;
        this.base = Math.round(H * 0.63);
        this.horizon = this.base - 60;
        this.roadTop = this.base + 14;
        this.frontTop = this.roadTop + 44;
        this.stallY = this.frontTop + 40;
        this.squareBot = H - 18;
        this.backY = [this.base + 5, this.base + 11];
        this.frontY = [this.frontTop + 5, this.frontTop + 12];
        this.lanes = [
            {y: this.roadTop + 20, dir: -1, items: []},
            {y: this.roadTop + 40, dir: 1, items: []},
        ];
        this.people = [];
        this.square = [];
        this.animals = [];
        this.floaters = [];
        this.sparks = [];
        this.smoke = [];
        this.splats = [];
        this.realT = 0;
        this.eventTimer = rand(20, 60);
        this.bell = {swing: 0, strokes: 0, peal: 0, t: 0, lastHour: -1};
        this._buildFar();
        this._buildRow(env);
        this._buildSquare(env);
        this.layerA = null;
        this.sprites = [];
        for (let i = 0; i < 40; i++)
            this._populate(env, true);
    }

    _buildFar() {
        const W = this.w, B = this.base;
        // two lines of hills and a castle on the higher one
        this.hillsFar = [];
        this.hillsNear = [];
        const p1 = rand(6.28), p2 = rand(6.28);
        for (let x = 0; x <= W; x++) {
            this.hillsFar.push(B - 120 + Math.sin(x * 0.006 + p1) * 26 + Math.sin(x * 0.017 + p2) * 10);
            this.hillsNear.push(B - 70 + Math.sin(x * 0.011 + p2) * 16 + Math.sin(x * 0.031) * 5);
        }
        this.castleX = randi(Math.floor(W * 0.15), Math.floor(W * 0.85));
        this.mill = chance(0.8) ? {x: (this.castleX + randi(Math.floor(W * 0.3), Math.floor(W * 0.6))) % W, a: rand(6.28)} : null;
    }

    // The street front: one church, a tavern, a smithy, the town gate with a
    // stretch of wall (the castle shows above it) and houses in between.
    _buildRow(env) {
        const W = this.w, B = this.base;
        this.buildings = [];
        this.windows = [];
        this.doors = [];
        this.torches = [];
        this.signs = [];
        this.chimneys = [];
        const specials = ['church', 'tavern', 'smithy'];
        if (W >= 640)
            specials.push('gate');
        // the gate goes where the castle is, so the castle shows above the wall
        const plan = [];
        let x = -randi(10, 40);
        const slots = {};
        const gateAt = this.castleX;
        while (x < W + 10) {
            let kind = 'house';
            if (specials.includes('gate') && !slots.gate && x + 200 > gateAt - 40) {
                kind = 'gate';
            } else {
                const left = specials.filter(k => !slots[k] && k !== 'gate');
                const remaining = W - x;
                if (left.length && (chance(0.35) || remaining < left.length * 150))
                    kind = pick(left);
            }
            slots[kind] = true;
            const b = this._makeBuilding(kind, x, env);
            plan.push(b);
            x += b.w + (kind === 'gate' ? 0 : randi(0, 3));
        }
        this.buildings = plan;
        this.church = plan.find(b => b.kind === 'church');
        this.gate = plan.find(b => b.kind === 'gate');
        this.tavern = plan.find(b => b.kind === 'tavern');
        this.smithy = plan.find(b => b.kind === 'smithy');
        // laundry on lines between neighbouring upper windows
        this.laundry = [];
        for (let i = 0; i < plan.length - 1; i++) {
            const a = plan[i], b = plan[i + 1];
            if (a.kind === 'house' && b.kind === 'house' && a.floors && b.floors && chance(0.4)) {
                const y = B - GH - FH + 10;
                this.laundry.push({x1: a.x + a.w - 10, x2: b.x + 10, y, items: Array.from({length: randi(2, 4)}, () => ({c: pick([0xf4ecdc, 0xd8c8a8, 0x9a3a2a, 0x3a5a9a, 0xe8d8b0]), w: randi(5, 9), h: randi(6, 11)}))});
            }
        }
    }

    _makeBuilding(kind, x, env) {
        const B = this.base, seed = randi(0, 1e6);
        const b = {kind, x, seed, wins: []};
        if (kind === 'gate') {
            // wall left and right of a gate tower
            b.w = 200;
            b.towerX = x + 70;
            b.towerW = 60;
            b.wallH = 92;
            b.towerH = 150;
            b.archW = 30;
            b.archH = 44;
            b.open = 1;
            this.doors.push({x: b.towerX + b.towerW / 2 - 8, y: B - b.archH, w: 16, h: b.archH, open: 0, gate: true});
            this.torches.push({x: b.towerX + 8, y: B - b.archH - 12}, {x: b.towerX + b.towerW - 10, y: B - b.archH - 12});
            return b;
        }
        if (kind === 'church') {
            b.w = 150;
            b.naveW = 100;
            b.towerW = 40;
            b.towerLeft = chance(0.5);
            b.naveX = b.towerLeft ? x + b.towerW + 4 : x + 2;
            b.towerX = b.towerLeft ? x + 2 : x + b.naveW + 6;
            b.naveH = 110;
            b.towerH = 200;
            b.stone = A.ramp(pick([0xc8b898, 0xb8a888, 0xd0c4a4]));
            b.roof = A.ramp(0x4a4e5a);
            b.door = {x: b.naveX + b.naveW / 2 - 12, y: B - 44, w: 24, h: 44, open: 0, church: true};
            this.doors.push(b.door);
            b.stork = chance(0.6);
            return b;
        }
        b.wall = A.ramp(pick(PLASTER));
        b.timber = A.ramp(pick(TIMBER));
        b.roof = A.ramp(pick(ROOF));
        b.ground = chance(0.5) ? 'stone' : 'timber';
        b.stone = A.ramp(pick(STONE));
        b.doorR = A.ramp(pick(DOORS));
        if (kind === 'tavern') {
            b.w = randi(118, 136);
            b.floors = 1;
            b.gable = false;
        } else if (kind === 'smithy') {
            b.w = randi(100, 112);
            b.floors = 1;
            b.gable = chance(0.5);
        } else {
            b.w = randi(72, 100);
            b.floors = chance(0.65) ? 2 : 1;
            b.gable = chance(0.6);
            if (chance(0.55))
                b.shop = {...pick(SHOPS)};
        }
        b.roofH = b.gable ? Math.round(b.w * 0.78) : 34;
        b.top = B - GH - b.floors * FH;
        b.pattern = pick(['braces', 'cross', 'grid', 'braces']);
        // windows on the upper floors
        const hh = [new Household('medieval')];
        const cols = Math.max(1, Math.floor((b.w - 12) / 32));
        const span = b.w / cols;
        for (let f = 0; f < b.floors; f++) {
            const fy = B - GH - (f + 1) * FH + 11;
            for (let c = 0; c < cols; c++) {
                if (c > 0 && chance(0.3))
                    hh.push(new Household('medieval'));
                const wx = Math.floor(x + span * c + (span - 16) / 2);
                const win = new Win(wx, fy, 16, 20, hh[hh.length - 1], kind === 'tavern' && f === 0 ? 'tavern' : pick(['living', 'kitchen', 'bed']), 'medieval');
                win.frameR = b.timber;
                win.box = chance(0.3);
                b.wins.push(win);
                this.windows.push(win);
            }
        }
        if (b.gable) {
            const at = new Win(Math.floor(x + b.w / 2 - 7), b.top - Math.round(b.roofH * 0.5), 14, 14, hh[0], 'bed', 'medieval');
            at.frameR = b.timber;
            b.attic = at;
            b.wins.push(at);
            this.windows.push(at);
            b.hoist = chance(0.5);
        }
        // ground floor: door, shop opening or workshop
        const dw = 20, dh = 38;
        if (kind === 'smithy') {
            b.forge = {x: x + 10, y: B - 40, w: b.w - 46, h: 40};
            b.door = {x: x + b.w - 30, y: B - dh, w: dw, h: dh, open: 0};
        } else if (kind === 'tavern') {
            b.door = {x: x + Math.floor(b.w / 2) - 11, y: B - dh - 2, w: 22, h: dh + 2, open: 0, tavern: true};
            for (const wx of [x + 10, x + b.w - 38]) {
                const win = new Win(wx, B - GH + 12, 28, 22, hh[0], 'tavern', 'medieval');
                win.frameR = b.timber;
                win.leaded = true;
                win.tavern = true;
                b.wins.push(win);
                this.windows.push(win);
            }
            b.sign = {x: b.door.x - 10, y: B - GH - 4, kind: 'tavern', dir: -1};
            this.signs.push(b.sign);
        } else {
            const doorLeft = chance(0.5);
            b.door = {x: doorLeft ? x + 8 : x + b.w - dw - 8, y: B - dh, w: dw, h: dh, open: 0};
            if (b.shop) {
                const sw = Math.min(40, b.w - dw - 24);
                b.shop.x = doorLeft ? x + dw + 16 : x + 8;
                b.shop.w = sw;
                b.shop.y = B - 34;
                b.shop.h = 22;
                b.sign = {x: doorLeft ? b.shop.x + sw + 4 : b.shop.x - 4, y: B - GH - 4, kind: b.shop.kind, dir: doorLeft ? 1 : -1};
                this.signs.push(b.sign);
            } else {
                const win = new Win(doorLeft ? x + b.w - 34 : x + 16, B - GH + 14, 18, 20, hh[0], 'kitchen', 'medieval');
                win.frameR = b.timber;
                b.wins.push(win);
                this.windows.push(win);
            }
        }
        this.doors.push(b.door);
        if (chance(0.35) || kind === 'tavern')
            this.torches.push({x: b.door.x + b.door.w + 6, y: B - 44});
        const chX = x + randi(12, b.w - 22);
        b.chimney = {x: chX, y: b.gable ? b.top - Math.round(b.roofH * (1 - Math.abs(chX + 5 - x - b.w / 2) / (b.w / 2 + 4))) + 6 : b.top - b.roofH - 2};
        this.chimneys.push({x: chX + 5, y: b.chimney.y - 14, b});
        return b;
    }

    // things standing on the market square
    _buildSquare(env) {
        const W = this.w, y0 = this.stallY + 26;
        this.props = [];
        // room enough between them for people to walk around
        const free = (x, w) => !this.props.some(p => x < p.x + p.w + 34 && x + w > p.x - 34);
        const place = (kind, w, extra = {}) => {
            w = w || {barrels: 26, crates: 24, hay: 28, cart: 52}[kind];
            for (let i = 0; i < 40; i++) {
                const x = randi(20, W - w - 20);
                if (free(x, w)) {
                    const p = {kind, x, w, y: y0 + randi(10, Math.max(12, this.squareBot - y0 - 6)), ...extra};
                    this.props.push(p);
                    return p;
                }
            }
            return null;
        };
        this.well = place('well', 36);
        this.limes = [];
        for (let i = 0; i < Math.max(1, Math.round(W / 700)); i++) {
            const t = place('tree', 60, {size: randi(30, 38), seed: randi(0, 1e6)});
            if (t)
                this.limes.push(t);
        }
        this.pillory = W >= 640 ? place('pillory', 22) : null;
        this.trough = chance(0.6) ? place('trough', 30) : null;
        // odds and ends left about the square
        for (let i = 0; i < Math.max(2, Math.round(W / 300)); i++)
            place(pick(['barrels', 'crates', 'hay', 'cart']), 0, {seed: randi(0, 1e6)});
        for (const p of this.props)
            if (!p.w)
                p.w = {barrels: 26, crates: 24, hay: 28, cart: 52}[p.kind];
        // stall pitches along the back of the square; how many are used
        // depends on the day
        this.pitches = [];
        for (let x = randi(20, 60); x < W - 60; x += randi(92, 130))
            this.pitches.push({x, w: 52, goods: pick(STALLS), awning: pick(AWNINGS), vendor: null});
        // a stretch of grass along the bottom
        const spots = [];
        for (let i = 0; i < W / 4; i++)
            spots.push([randi(4, W - 4), this.squareBot + randi(8, 16)]);
        this.tufts = A.makeTufts(spots, randi(0, 1e6));
        // small weeds at the foot of the walls and along the kerbs
        const weeds = [];
        for (let i = 0; i < W / 30; i++)
            weeds.push([randi(4, W - 4), chance(0.5) ? this.base + 1 : chance(0.5) ? this.roadTop - 3 : this.frontTop + 16]);
        this.weeds = A.makeTufts(weeds, randi(0, 1e6), true);
    }

    // ---------- calendar ----------

    // what the town is up to today, from the date and the bells
    _calendar(env) {
        const m = env.month, d = env.date.getDate(), h = env.hour, wd = env.weekday;
        const day = Math.floor(env.date.getTime() / 86400000);
        return {
            day,
            sunday: wd === 0,
            market: wd === 0 ? null : wd === 3 || wd === 6 ? 'big' : 'small',
            marketOpen: h >= 7 && h < 16.5,
            may: m === 4 && d <= 14,
            midsummer: m === 5 && d >= 20 && d <= 25,
            fair: (m === 8 && d >= 20) || (m === 9 && d <= 12),
            advent: m === 11 && d <= 27,
            gateOpen: h >= 5.5 && h < 21,
            curfew: h >= 21 || h < 4.8,
        };
    }

    _shopOpen(shop, env, cal) {
        return !cal.sunday && env.hour >= shop.open[0] && env.hour < shop.open[1];
    }

    // pitches with a stall today
    _stalls(env, cal) {
        if (!cal.market || !cal.marketOpen)
            return [];
        const share = cal.market === 'big' || cal.fair ? 1 : 0.35;
        return this.pitches.filter((p, i) => hash(cal.day, i, 7) / 1000 < share);
    }

    staticKey(env) {
        this.darkLevel = steppedLevel(env.dark, this.darkLevel, 4);
        this.wetLevel = steppedLevel(env.weather.wet, this.wetLevel, 1);
        const cal = this._calendar(env);
        const shops = this.buildings.map(b => b.shop && this._shopOpen(b.shop, env, cal) ? 1 : 0).join('');
        const stalls = this._stalls(env, cal).map(p => p.x).join(',');
        const fest = [cal.may, cal.midsummer, cal.fair, cal.advent, env.holidays.halloween].map(v => (v ? 1 : 0)).join('');
        const sh = A.sunShadow(env);
        return [this.darkLevel, env.lampsOn ? 1 : 0, Math.round(env.weather.snowCover * 4), this.wetLevel, env.season, shops, stalls, fest, sh ? [sh.depth, sh.skew, sh.a] : 0].join(':');
    }

    // ---------- static layer ----------

    renderStatic(g, env) {
        if (!this.layerA) {
            this.layerA = g.layer();
            this.scratch = g.layer();
        }
        const cal = this._calendar(env);
        this.cal = cal;
        this.layerA.fill(0);
        g.into(this.layerA, () => {
            this._drawFar(g, env);
            // what the far land looks like before the town covers it: the
            // mill sails and castle flags only show where it is still seen
            this.farSnap = Uint32Array.from(this.layerA);
            this._drawTownWall(g, env);
            for (const b of this.buildings)
                this._drawBuilding(g, b, env, cal);
            this._drawGround(g, env);
            // the houses throw their shadow onto the walk
            const sh = A.sunShadow(env);
            if (sh)
                for (const b of this.buildings)
                    A.castShadow(g, b.x, b.w, this.base + 1, sh);
            if (cal.fair)
                this._drawBunting(g);
        });
        // things on the square are sprites, drawn in depth order with the
        // people there; the trees lean in the wind
        this.scratch.fill(0);
        const S = this.scratch, snow = env.weather.snowCover > 0.3;
        const season = snow ? 'winter' : env.season;
        this.sprites = [];
        const add = (y, hint, draw, extra = {}) => {
            const sp = g.masked(null, S, hint, draw);
            if (sp)
                this.sprites.push({y, sp, ...extra});
        };
        for (const p of this.props) {
            if (p.kind === 'well')
                add(p.y, [p.x - 4, p.y - 60, p.w + 8, 64], () => this._well(g, p, env));
            else if (p.kind === 'tree')
                add(p.y, [p.x + 30 - p.size * 2, p.y - p.size * 3.3, p.size * 4, p.size * 3.3 + 6], () => A.bigTree(g, p.x + 30, p.y, p.size, season, p.seed, env.weather.snowCover), {tree: p});
            else if (p.kind === 'pillory')
                add(p.y, [p.x - 6, p.y - 46, p.w + 14, 50], () => this._pillory(g, p));
            else if (p.kind === 'trough')
                add(p.y, [p.x - 2, p.y - 14, p.w + 4, 16], () => this._trough(g, p, env));
            else if (['barrels', 'crates', 'hay', 'cart'].includes(p.kind))
                add(p.y, [p.x - 8, p.y - 34, p.w + 24, 38], () => this._clutter(g, p, env));
        }
        for (const st of this._stalls(env, cal))
            add(this.stallY, [st.x - 8, this.stallY - 56, st.w + 16, 60], () => this._stall(g, st, env), {stall: st});
        this.maypole = null;
        this.bonfire = null;
        if (cal.may) {
            const x = this._openSpot(40);
            this.maypole = {x, y: this.stallY + 40};
            add(this.maypole.y, [x - 20, this.maypole.y - 130, 40, 134], () => this._maypole(g, this.maypole, env));
        }
        if (cal.midsummer) {
            const x = this._openSpot(50);
            this.bonfire = {x, y: this.stallY + 46};
            add(this.bonfire.y, [x - 24, this.bonfire.y - 30, 48, 34], () => this._bonfirePile(g, this.bonfire));
        }
        this.sprites.sort((a, b) => a.y - b.y);
        this._evict();
    }

    // Stalls go up at the market bell, the maypole or the fire on their
    // day: whoever stands where one appears steps out in front of it.
    _evict() {
        const ob = this._obstacles();
        const inside = (x, y) => ob.find(o => x > o[0] - 5 && x < o[2] + 5 && y > o[1] && y < o[3]);
        const out = (x, y) => {
            const o = inside(x, y);
            if (!o)
                return null;
            const ny = Math.min(this.squareBot - 2, o[3] + 4);
            return inside(x, ny) ? this._freePoint() : [x - 8, ny];
        };
        for (const p of this.people) {
            if (p.lane !== 'square')
                continue;
            const to = out(p.x + 8, p.y);
            if (to) {
                [p.x, p.y] = to;
                if (p.state === 'go' && p.route.length)
                    p.route = this._route([p.x, p.y], p.route[p.route.length - 1]);
            }
        }
        for (const a of this.animals) {
            if (a.kind === 'cat')
                continue;
            const to = out(a.x, a.y);
            if (to) {
                a.x = to[0] + 8;
                a.y = to[1];
                a.tx = a.x;
                a.ty = a.y;
            }
        }
    }

    // middle of the widest free stretch on the square
    _openSpot(w) {
        const xs = [0, ...this.props.flatMap(p => [p.x - 10, p.x + p.w + 10]), this.w].sort((a, b) => a - b);
        let best = this.w / 2, gap = 0;
        for (let i = 0; i < xs.length - 1; i += 1) {
            const g = xs[i + 1] - xs[i];
            if (g > gap && g > w) {
                gap = g;
                best = (xs[i] + xs[i + 1]) / 2;
            }
        }
        return Math.round(best);
    }

    _hills(env) {
        const snow = env.weather.snowCover > 0.3;
        const green = snow ? 0xe0e8f4 : {spring: 0x6aa850, summer: 0x5a9a44, autumn: 0x8a9a48, winter: 0x8a9a7a}[env.season];
        return {far: mix(mix(green, 0x5a7a9a, 0.4), env.skyBottom, 0.5), near: mix(green, env.skyBottom, 0.3), snow};
    }

    _drawFar(g, env) {
        const W = this.w, B = this.base, {far, near, snow} = this._hills(env);
        // far hills
        for (let x = 0; x < W; x++) {
            const y = Math.round(this.hillsFar[x]);
            g.rect(x, y, 1, B - y, far);
            g.px(x, y, highlight(far, 0.12));
        }
        // the castle on the far hill
        this._castle(g, env);
        // near hills: a patchwork of fields with hedges and little trees
        const fields = snow ? [0xe8eef8, 0xdce4f0, 0xe4ecf6] : {
            spring: [0x7ab858, 0x9ac868, 0x8a7a50, 0x6aa848],
            summer: [0xd8c058, 0x88b050, 0xc8a848, 0x6a9a40],
            autumn: [0xa87848, 0xc89a50, 0x7a8a40, 0x9a6a3a],
            winter: [0x8a8a6a, 0x7a7a60, 0x9a9474, 0x6a7a5a],
        }[env.season];
        const edges = [];
        for (let x = 0, e = 0; x < W; x += randi(40, 90))
            edges.push(x), e++;
        for (let x = 0; x < W; x++) {
            const y = Math.round(this.hillsNear[x]);
            let band = 0;
            while (band < edges.length - 1 && edges[band + 1] <= x)
                band++;
            const c = mix(fields[band % fields.length], env.skyBottom, 0.28);
            g.rect(x, y, 1, B - y, c);
            // furrows
            for (let yy = y + 3; yy < B; yy += 4)
                if ((band % 2 === 0) && (x + yy) % 2 === 0)
                    g.px(x, yy, shadow(c, 0.08));
            g.px(x, y, highlight(near, 0.15));
            if (edges.includes(x))
                g.rect(x, y, 1, B - y, mix(0x3a5a2a, env.skyBottom, 0.35));
        }
        // little trees along the hill line
        for (let x = randi(0, 20); x < W; x += randi(14, 40)) {
            const y = Math.round(this.hillsNear[clamp(x, 0, W)]);
            const c = mix(snow ? 0x8aa0a0 : 0x3a6a3a, env.skyBottom, 0.3);
            g.disc(x, y - 4, 4, c);
            g.disc(x + 2, y - 6, 3, highlight(c, 0.1));
            g.rect(x, y - 1, 1, 2, mix(0x4a3a2a, env.skyBottom, 0.3));
        }
        // a windmill on the near hill, sails turn in renderDynamic
        if (this.mill) {
            const m = this.mill, y = Math.round(this.hillsNear[clamp(m.x, 0, W)]);
            const c = mix(0xd8ccb0, env.skyBottom, 0.3);
            g.rect(m.x - 4, y - 18, 9, 18, c);
            g.rect(m.x - 5, y - 21, 11, 4, mix(0x7a4a3a, env.skyBottom, 0.3));
            g.rect(m.x - 1, y - 6, 3, 6, mix(0x4a3a2a, env.skyBottom, 0.3));
            m.hub = [m.x, y - 17];
        }
    }

    _castle(g, env) {
        const cx = this.castleX, gy = Math.round(this.hillsFar[clamp(cx, 0, this.w)]) + 4;
        const st = A.ramp(mix(0xa8a090, env.skyBottom, 0.45)), rf = mix(0x5a4a6a, env.skyBottom, 0.4);
        const crenel = (x, y, w) => {
            for (let i = 0; i < w; i += 5)
                g.rect(x + i, y - 3, 3, 3, st[2]);
        };
        // curtain wall
        g.rect(cx - 60, gy - 30, 120, 30, st[2]);
        g.rect(cx - 60, gy - 30, 120, 2, st[3]);
        crenel(cx - 60, gy - 30, 120);
        for (let yy = gy - 26; yy < gy; yy += 5)
            g.rect(cx - 60, yy, 120, 1, st[1]);
        // keep
        g.rect(cx - 16, gy - 74, 32, 44, st[2]);
        g.rect(cx - 16, gy - 74, 2, 44, st[3]);
        g.rect(cx + 12, gy - 74, 4, 44, st[1]);
        crenel(cx - 16, gy - 74, 32);
        // towers with pointed roofs
        this.castleFlags = [];
        for (const [tx, th] of [[cx - 66, 52], [cx + 52, 52], [cx - 34, 40], [cx + 22, 40]]) {
            g.rect(tx, gy - th, 14, th, st[2]);
            g.rect(tx, gy - th, 2, th, st[3]);
            g.rect(tx + 11, gy - th, 3, th, st[1]);
            for (let i = 0; i < 12; i++)
                g.rect(tx + 7 - Math.round(i * 0.75), gy - th - 12 + i, Math.round(i * 1.5) + 1, 1, i < 3 ? highlight(rf, 0.15) : rf);
            g.rect(tx + 7, gy - th - 18, 1, 6, mix(0x3a3a3a, env.skyBottom, 0.3));
            this.castleFlags.push([tx + 7, gy - th - 18]);
            g.rect(tx + 5, gy - th + 10, 3, 4, mix(0x2a2030, env.skyBottom, 0.3));
        }
        // windows: dark by day, a few lit at night
        const lit = env.dark > 0.4;
        for (let i = 0; i < 6; i++) {
            const wx = cx - 12 + (i % 3) * 10, wy = gy - 66 + Math.floor(i / 3) * 14;
            if (lit && hash(i, 3, cx) < 600)
                g.rectE(wx, wy, 2, 4, 0xffc070);
            else
                g.rect(wx, wy, 2, 4, mix(0x2a2030, env.skyBottom, 0.3));
        }
        // gate
        g.rect(cx - 6, gy - 14, 12, 14, mix(0x2a2030, env.skyBottom, 0.35));
        g.rect(cx - 5, gy - 16, 10, 2, mix(0x2a2030, env.skyBottom, 0.35));
        this.castleFlags.push([cx, gy - 92]);
        g.rect(cx, gy - 92, 1, 18, mix(0x3a3a3a, env.skyBottom, 0.3));
    }

    // a continuous wall behind the houses, seen in the gaps
    _drawTownWall(g, env) {
        const B = this.base, top = B - 66, R = A.ramp(mix(0xb0a488, env.skyBottom, 0.15));
        A.wallStone(g, 0, top, this.w, B - top, R, 7);
        g.rect(0, top - 1, this.w, 1, INK);
        for (let x = 0; x < this.w; x += 12) {
            g.rect(x, top - 7, 7, 7, INK);
            g.rect(x + 1, top - 6, 5, 6, R[2]);
            g.rect(x + 1, top - 6, 5, 1, R[4]);
        }
        g.blend(0, top, this.w, B - top, 0x1a1028, 0.18);
    }

    _drawBuilding(g, b, env, cal) {
        if (b.kind === 'gate')
            return this._drawGate(g, b, env);
        if (b.kind === 'church')
            return this._drawChurch(g, b, env, cal);
        const B = this.base, {x, w} = b, snow = env.weather.snowCover > 0.2;
        const roofR = snow ? A.ramp(0xe0e8f8) : b.roof;
        // chimney behind the roof
        A.chimney(g, b.chimney.x, b.chimney.y - 12, 10, 24, A.ramp(0x9a8a7a));
        // roof
        if (b.gable) {
            const cx = x + w / 2, top = b.top - b.roofH;
            A.shingles(g, top, b.top, yy => {
                const half = (w / 2 + 5) * (yy - top + 1) / b.roofH;
                return [Math.round(cx - half), Math.round(cx + half)];
            }, roofR, b.seed);
            // timber-framed gable wall inside the roof edge
            const inset = 8;
            for (let yy = top + 12; yy < b.top; yy++) {
                const half = (w / 2 + 5) * (yy - top + 1) / b.roofH - inset;
                if (half > 0) {
                    g.rect(Math.round(cx - half), yy, Math.round(half * 2), 1, b.wall[2]);
                    g.px(Math.round(cx - half), yy, b.timber[1]);
                    g.px(Math.round(cx + half) - 1, yy, b.timber[1]);
                }
            }
            g.rect(Math.round(cx) - 1, top + 14, 2, b.roofH - 14, b.timber[1]);
            const collar = b.top - Math.round(b.roofH * 0.3);
            const ch = (w / 2 + 5) * (collar - top + 1) / b.roofH - inset;
            g.rect(Math.round(cx - ch), collar, Math.round(ch * 2), 2, b.timber[1]);
            if (b.hoist) {
                // hoist beam with a pulley under the ridge
                g.rect(Math.round(cx) - 1, top + 9, 3, 6, b.timber[0]);
                g.rect(Math.round(cx) - 1, top + 15, 3, 2, 0x6a6a72);
                g.rect(Math.round(cx), top + 17, 1, 10, 0xc8b088);
            }
            g.rect(x - 6, b.top - 1, w + 12, 2, INK);
        } else {
            A.slopeRoof(g, x, b.top - b.roofH, w, b.roofH, roofR, b.seed, 6);
        }
        // upper floors: half-timbering over jetties
        for (let f = 0; f < b.floors; f++) {
            const fy = b.top + f * FH;
            this._halfTimber(g, x, fy, w, FH, b, f);
        }
        // jetty beams with brackets and the shadow under the overhang
        for (let f = 0; f < b.floors; f++) {
            const jy = b.top + (f + 1) * FH;
            g.rect(x - 3, jy - 3, w + 6, 4, INK);
            g.rect(x - 2, jy - 2, w + 4, 2, b.timber[2]);
            g.rect(x - 2, jy - 2, w + 4, 1, b.timber[3]);
            for (let bx = x + 4; bx < x + w - 4; bx += Math.max(16, Math.floor(w / 4))) {
                g.rect(bx, jy + 1, 3, 2, b.timber[1]);
                g.px(bx + 1, jy + 3, b.timber[1]);
            }
        }
        // ground floor
        const gy = B - GH;
        if (b.ground === 'stone' || b.kind === 'smithy')
            A.wallStone(g, x, gy, w, GH, b.stone, b.seed);
        else
            this._halfTimber(g, x, gy, w, GH, b, -1);
        g.blend(x, gy, w, 4, 0x1a1028, 0.35);
        g.blend(x, gy + 4, w, 3, 0x1a1028, 0.15);
        g.rect(x - 1, b.top, 1, B - b.top, INK);
        g.rect(x + w, b.top, 1, B - b.top, INK);
        // windows (glass is dynamic)
        for (const win of b.wins) {
            A.windowFrame(g, win.x, win.y, win.w, win.h, b.timber);
            if (win.box)
                A.flowerBox(g, win.x - 1, win.y + win.h + 4, win.w + 2, env.season, win.x);
            if (snow)
                g.rect(win.x - 3, win.y + win.h + 1, win.w + 6, 2, 0xf4f8ff);
        }
        if (b.kind === 'smithy')
            this._smithyFront(g, b, env);
        if (b.shop)
            this._shopFront(g, b, env, this._shopOpen(b.shop, env, cal));
        this._door(g, b.door, b.doorR, env, cal);
        if (b.kind === 'tavern')
            this._tavernFront(g, b, env);
        // plinth
        g.rect(x, B - 3, w, 3, shadow(b.stone[1], 0.2));
        g.rect(x, B - 3, w, 1, b.stone[2]);
    }

    // plaster panels in a timber frame; f = floor (-1 ground floor)
    _halfTimber(g, x, y, w, h, b, f) {
        A.wallPlaster(g, x, y, w, h, b.wall, b.seed + f);
        const T = b.timber, tc = T[1];
        g.rect(x, y, w, 2, tc);
        g.rect(x, y + h - 2, w, 2, tc);
        const n = Math.max(2, Math.round(w / 18));
        const posts = [];
        for (let i = 0; i <= n; i++)
            posts.push(Math.round(x + i * (w - 3) / n));
        for (const px of posts) {
            g.rect(px, y, 3, h, tc);
            g.rect(px, y, 1, h, T[2]);
        }
        const mid = y + Math.round(h * 0.62);
        g.rect(x, mid, w, 2, tc);
        // diagonal braces in the end panels, crosses under some windows
        const brace = (x0, y0, x1, y1) => {
            const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
            for (let i = 0; i <= steps; i++)
                g.rect(Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps), 2, 2, tc);
        };
        if (f >= 0 || b.ground !== 'stone') {
            if (b.pattern === 'braces' || b.pattern === 'cross') {
                brace(posts[0] + 2, mid, posts[1], y + 2);
                brace(posts[n] , mid, posts[n - 1] + 2, y + 2);
            }
            if (b.pattern === 'cross' || b.pattern === 'grid')
                for (let i = 1; i < n - 1; i += 2) {
                    brace(posts[i] + 2, mid + 2, posts[i + 1], y + h - 3);
                    brace(posts[i + 1], mid + 2, posts[i] + 2, y + h - 3);
                }
        }
    }

    _door(g, d, R, env, cal) {
        const {x, y, w, h} = d;
        g.rect(x - 3, y - 4, w + 6, h + 4, INK);
        g.rect(x - 2, y - 3, w + 4, h + 3, 0x8a7a68);
        // rounded top, planks, iron straps and a ring
        g.rect(x, y + 2, w, h - 2, R[2]);
        g.rect(x + 2, y, w - 4, 2, R[2]);
        g.px(x + 1, y + 1, R[2]);
        g.px(x + w - 2, y + 1, R[2]);
        for (let i = 4; i < w; i += 5)
            g.rect(x + i, y + 1, 1, h - 1, R[1]);
        g.rect(x, y + 2, 1, h - 2, R[3]);
        for (const sy of [y + 7, y + h - 9])
            g.rect(x + 1, sy, w - 6, 2, 0x3a3436);
        g.rect(x + w - 5, y + Math.floor(h / 2), 3, 3, 0x5a5458);
        if (cal.advent) {
            // a wreath of greenery
            g.disc(x + w / 2, y + 10, 5, 0x2a5a2a);
            g.disc(x + w / 2, y + 10, 2, R[2]);
            g.px(x + w / 2 - 3, y + 8, 0xd83030);
            g.px(x + w / 2 + 3, y + 12, 0xd83030);
        }
        g.rect(x - 4, y + h, w + 8, 2, 0x9a9080);
    }

    _shopFront(g, b, env, open) {
        const s = b.shop, {x, y, w, h} = s;
        if (!open) {
            // shutters up and barred
            g.rect(x - 2, y - 2, w + 4, h + 4, INK);
            g.rect(x, y, w, h, 0x7a5232);
            for (let i = 3; i < w; i += 4)
                g.rect(x + i, y, 1, h, 0x5a3a20);
            g.rect(x - 1, y + Math.floor(h / 2), w + 2, 2, 0x3a3436);
            return;
        }
        // upper shutter propped up as a hood, lower one down as the counter
        g.rect(x - 2, y - 2, w + 4, h + 2, INK);
        g.rect(x, y, w, h, 0x3a2a1e);
        g.rect(x, y, w, 3, 0x2a1e16);
        g.rect(x - 4, y - 8, w + 8, 6, INK);
        g.rect(x - 3, y - 7, w + 6, 4, 0x8a5a32);
        g.rect(x - 3, y - 7, w + 6, 1, 0xa8703e);
        g.rect(x - 4, y + h, w + 8, 5, INK);
        g.rect(x - 3, y + h, w + 6, 3, 0x8a5a32);
        g.rect(x - 3, y + h, w + 6, 1, 0xb07a44);
        g.rect(x - 1, y + h + 4, 2, 6, INK);
        g.rect(x + w - 1, y + h + 4, 2, 6, INK);
        this._goods(g, s.goods, x, y + h, w, y);
    }

    // goods on a counter (top of the counter at cy), some hanging from top
    _goods(g, kind, x, cy, w, top) {
        for (let i = 2; i < w - 4; i += 7) {
            const gx = x + i, k = (i * 7 + x) % 3;
            switch (kind) {
            case 'bread':
                g.rect(gx, cy - 4, 6, 4, INK);
                g.rect(gx + 1, cy - 3, 4, 3, 0xd8983a);
                g.px(gx + 1, cy - 3, 0xf0c060);
                if (k === 0) {
                    // pretzel hanging up
                    g.rect(gx + 1, top + 4, 5, 4, 0xb87a2a);
                    g.rect(gx + 2, top + 5, 3, 2, 0x3a2a1e);
                }
                break;
            case 'shoes':
                g.rect(gx, cy - 5, 3, 5, 0x4a2a1a);
                g.rect(gx, cy - 2, 6, 2, 0x5a3a24);
                break;
            case 'jars':
                g.rect(gx, cy - 6, 5, 6, INK);
                g.rect(gx + 1, cy - 5, 3, 5, [0x3a6a8a, 0x8a3a3a, 0x6a8a3a][k]);
                g.rect(gx + 1, cy - 7, 3, 1, 0xd8c8a8);
                g.rect(gx + 1, top + 4, 1, 6, 0x6a8a3a);
                break;
            case 'cloth':
                g.rect(gx, cy - 5, 6, 5, INK);
                g.rect(gx + 1, cy - 4, 4, 4, [0x3a5a9a, 0x9a3a2a, 0xd8b040][k]);
                g.rect(gx + 1, top + 3, 4, 9, [0x9a3a2a, 0x5a7a3a, 0x3a5a9a][k]);
                break;
            case 'candles':
                g.rect(gx + 1, cy - 6, 1, 6, 0xf4ecd8);
                g.rect(gx + 3, cy - 5, 1, 5, 0xf4ecd8);
                g.rect(gx + 1, top + 3, 1, 8, 0xf0e4c0);
                g.rect(gx + 3, top + 3, 1, 7, 0xf0e4c0);
                break;
            case 'pots':
                g.rect(gx, cy - 6, 6, 6, INK);
                g.rect(gx + 1, cy - 5, 4, 5, 0xb86a3a);
                g.rect(gx + 1, cy - 5, 4, 1, 0xd8884a);
                break;
            case 'meat':
                g.rect(gx + 1, top + 3, 1, 3, 0x6a6a72);
                g.rect(gx, top + 6, 4, 6, INK);
                g.rect(gx + 1, top + 7, 2, 4, 0xb8584a);
                g.rect(gx, cy - 3, 6, 3, 0xa8483a);
                break;
            }
        }
    }

    _tavernFront(g, b, env) {
        const B = this.base;
        // benches and barrels by the door
        for (const bx of [b.x + 6, b.x + b.w - 30]) {
            g.rect(bx - 1, B - 9, 26, 3, INK);
            g.rect(bx, B - 8, 24, 1, 0x9a6a3a);
            g.rect(bx + 1, B - 6, 2, 6, INK);
            g.rect(bx + 21, B - 6, 2, 6, INK);
        }
        for (const bx of [b.door.x - 14, b.door.x + b.door.w + 4]) {
            g.rect(bx - 1, B - 15, 12, 15, INK);
            g.rect(bx, B - 14, 10, 14, 0x8a5a32);
            g.rect(bx, B - 11, 10, 1, 0x4a4a52);
            g.rect(bx, B - 4, 10, 1, 0x4a4a52);
            g.rect(bx + 1, B - 14, 2, 14, 0xa8703e);
        }
    }

    _smithyFront(g, b, env) {
        const f = b.forge;
        // open workshop: dark inside, the hearth with its hood, an anvil
        g.rect(f.x - 3, f.y - 3, f.w + 6, f.h + 3, INK);
        g.rect(f.x - 2, f.y - 2, f.w + 4, 3, b.timber[2]);
        g.rect(f.x, f.y + 1, f.w, f.h - 1, 0x2a2220);
        g.rect(f.x, f.y + 1, f.w, 6, 0x1e1816);
        const hx = f.x + 4;
        g.rect(hx, f.y + 6, 18, 10, 0x4a4448);
        g.rect(hx + 2, f.y + 16, 14, 12, 0x5a5050);
        g.rect(hx, f.y + 28, 18, 12, 0x6a5e5a);
        g.rect(hx + 2, f.y + 28, 14, 3, 0x2a1a14);
        // anvil on a block
        const ax = f.x + f.w - 26;
        g.rect(ax + 3, f.y + f.h - 8, 6, 8, 0x5a3a24);
        g.rect(ax, f.y + f.h - 13, 14, 4, 0x3a3a40);
        g.rect(ax + 4, f.y + f.h - 10, 6, 2, 0x3a3a40);
        g.rect(ax - 2, f.y + f.h - 13, 3, 2, 0x3a3a40);
        g.rect(ax, f.y + f.h - 13, 14, 1, 0x6a6a74);
        // tools on the wall
        for (let i = 0; i < 4; i++)
            g.rect(f.x + f.w - 14 + i * 3, f.y + 8, 1, 8, 0x6a6a72);
        b.anvil = [ax + 7, f.y + f.h - 13];
        b.hearth = [hx + 9, f.y + 29];
        // horseshoe sign and a water barrel
        const sx = b.door.x - 12;
        g.rect(sx, b.door.y - 2, 9, 9, INK);
        g.rect(sx + 1, b.door.y - 1, 7, 7, 0x8a8a92);
        g.rect(sx + 3, b.door.y - 1, 3, 5, INK);
    }

    _drawChurch(g, b, env, cal) {
        const B = this.base, st = b.stone, snow = env.weather.snowCover > 0.2;
        const roofR = snow ? A.ramp(0xe0e8f8) : b.roof;
        const nx = b.naveX, nw = b.naveW, top = B - b.naveH;
        // tower with belfry and spire
        const tx = b.towerX, tw = b.towerW, ttop = B - b.towerH;
        g.rect(tx - 1, ttop - 1, tw + 2, b.towerH + 1, INK);
        A.wallStone(g, tx, ttop, tw, b.towerH, st, b.seed + 1);
        g.rect(tx, ttop, 2, b.towerH, st[3]);
        g.rect(tx + tw - 3, ttop, 3, b.towerH, st[1]);
        const sh = 64;
        A.shingles(g, ttop - sh, ttop, yy => {
            const half = (tw / 2 + 3) * (yy - ttop + sh + 1) / sh;
            return [Math.round(tx + tw / 2 - half), Math.round(tx + tw / 2 + half)];
        }, roofR, b.seed);
        g.rect(tx - 4, ttop - 1, tw + 8, 2, INK);
        b.vane = [tx + tw / 2, ttop - sh - 2];
        g.rect(tx + tw / 2, ttop - sh - 8, 1, 8, 0x3a3436);
        // belfry with the bell in it (bell is dynamic)
        const bx = tx + tw / 2 - 9, by = ttop + 10;
        g.rect(bx - 1, by - 1, 20, 26, INK);
        g.rect(bx, by + 4, 18, 21, 0x1e1820);
        g.rect(bx + 2, by, 14, 4, 0x1e1820);
        g.rect(bx + 4, by - 1, 10, 1, 0x1e1820);
        g.rect(bx - 2, by + 25, 22, 2, st[3]);
        b.bellAt = [bx + 9, by + 6];
        // clock face with one hand (dynamic hand)
        const cy = by + 44;
        g.disc(tx + tw / 2, cy, 9, INK);
        g.disc(tx + tw / 2, cy, 8, 0x2a3a6a);
        for (let i = 0; i < 12; i++)
            g.px(Math.round(tx + tw / 2 + Math.sin(i / 6 * Math.PI) * 6), Math.round(cy - Math.cos(i / 6 * Math.PI) * 6), 0xf0c040);
        b.clock = [tx + tw / 2, cy];
        g.rect(tx + 12, B - 60, 4, 10, 0x2a2030);
        // nave front with its gable
        const gh = 44;
        g.rect(nx - 1, top - 1, nw + 2, b.naveH + 1, INK);
        A.wallStone(g, nx, top, nw, b.naveH, st, b.seed);
        // stone gable: masonry cut to the triangle, slate along the slopes
        const cxn = nx + nw / 2, span = yy => (nw / 2 + 5) * (yy - top + gh + 1) / (gh + 4);
        A.wallStone(g, nx - 5, top - gh, nw + 10, gh + 4, st, b.seed + 9);
        for (let yy = top - gh; yy < top + 4; yy++) {
            const half = span(yy);
            for (let xx = Math.max(0, nx - 5); xx < Math.min(this.w, nx + nw + 5); xx++)
                if (Math.abs(xx + 0.5 - cxn) > half)
                    g.t[yy * this.w + xx] = 0;
        }
        A.shingles(g, top - gh, top + 4, yy => [Math.round(cxn - span(yy)), Math.round(cxn - span(yy)) + 8], roofR, b.seed + 3);
        A.shingles(g, top - gh, top + 4, yy => [Math.round(cxn + span(yy)) - 8, Math.round(cxn + span(yy))], roofR, b.seed + 4);
        g.rect(Math.round(cxn) - 4, top - gh, 8, 3, roofR[1]);
        b.gableTop = [nx + nw / 2, top - gh];
        g.rect(nx + nw / 2, top - gh - 9, 1, 9, 0x3a3436);
        g.rect(nx + nw / 2 - 3, top - gh - 6, 7, 1, 0x3a3436);
        // rose window and lancets (glass glows during services, dynamic)
        b.rose = [nx + nw / 2, top + 22];
        g.disc(b.rose[0], b.rose[1], 13, INK);
        g.disc(b.rose[0], b.rose[1], 12, st[3]);
        b.lancets = [[nx + 14, top + 44], [nx + nw - 22, top + 44]];
        for (const [lx, ly] of b.lancets) {
            g.rect(lx - 2, ly - 2, 12, 34, INK);
            g.rect(lx - 1, ly - 1, 10, 33, st[3]);
        }
        // portal: pointed arch with a stone surround and steps
        const d = b.door;
        for (let i = 0; i < 10; i++) {
            const half = Math.round(Math.sqrt(Math.max(0, 100 - (10 - i) * (10 - i))) * 1.6) + 2;
            g.rect(d.x + d.w / 2 - half - 3, d.y - 10 + i, half * 2 + 6, 1, INK);
            g.rect(d.x + d.w / 2 - half - 2, d.y - 10 + i, half * 2 + 4, 1, st[3]);
        }
        g.rect(d.x - 5, d.y, d.w + 10, d.h, INK);
        g.rect(d.x - 4, d.y, d.w + 8, d.h, st[3]);
        this._door(g, d, A.ramp(0x5a3a22), env, cal);
        g.rect(d.x - 8, B - 3, d.w + 16, 3, st[2]);
        g.rect(d.x - 8, B - 3, d.w + 16, 1, st[4]);
        g.blend(nx, top, nw, 4, 0x1a1028, 0.2);
        if (b.stork && (env.season === 'spring' || env.season === 'summer')) {
            // stork nest on the gable
            const [sx, sy] = b.gableTop;
            g.rect(sx - 8, sy - 3, 16, 4, INK);
            g.rect(sx - 7, sy - 2, 14, 2, 0x8a6a40);
            g.rect(sx - 6, sy - 3, 12, 1, 0xa8884a);
        }
    }

    _drawGate(g, b, env) {
        const B = this.base, R = A.ramp(0xb0a488), snow = env.weather.snowCover > 0.2;
        // wall on both sides with a walkway behind the battlements
        const wt = B - b.wallH;
        g.rect(b.x - 1, wt - 1, b.w + 2, b.wallH + 1, INK);
        A.wallStone(g, b.x, wt, b.w, b.wallH, R, b.seed);
        for (let x = b.x; x < b.x + b.w; x += 12) {
            g.rect(x, wt - 9, 8, 9, INK);
            g.rect(x + 1, wt - 8, 6, 8, R[2]);
            g.rect(x + 1, wt - 8, 6, 1, snow ? 0xf4f8ff : R[4]);
        }
        b.walkY = wt - 1;
        g.blend(b.x, wt, b.w, 4, 0x1a1028, 0.25);
        // tower
        const tx = b.towerX, tw = b.towerW, tt = B - b.towerH;
        g.rect(tx - 1, tt - 1, tw + 2, b.towerH + 1, INK);
        A.wallStone(g, tx, tt, tw, b.towerH, R, b.seed + 5);
        g.rect(tx, tt, 2, b.towerH, R[3]);
        g.rect(tx + tw - 3, tt, 3, b.towerH, R[1]);
        const roofR = snow ? A.ramp(0xe0e8f8) : A.ramp(0x8a3a2a);
        const rh = 40;
        A.shingles(g, tt - rh, tt, yy => {
            const t = (yy - tt + rh + 1) / rh, half = (tw / 2 + 4) * t;
            return [Math.round(tx + tw / 2 - half), Math.round(tx + tw / 2 + half)];
        }, roofR, b.seed);
        g.rect(tx - 5, tt - 1, tw + 10, 2, INK);
        b.flag = [tx + tw / 2, tt - rh - 14];
        g.rect(tx + tw / 2, tt - rh - 14, 1, 14, 0x3a3436);
        // arrow slits and a coat of arms over the gate
        for (const sx of [tx + 12, tx + tw - 15])
            g.rect(sx, tt + 22, 3, 12, 0x1e1820);
        const cx = tx + tw / 2;
        g.rect(cx - 7, B - b.archH - 26, 14, 16, INK);
        g.rect(cx - 6, B - b.archH - 25, 12, 10, 0x9a2a2a);
        g.rect(cx - 5, B - b.archH - 15, 10, 3, 0x9a2a2a);
        g.rect(cx - 3, B - b.archH - 12, 6, 2, 0x9a2a2a);
        g.rect(cx - 2, B - b.archH - 23, 4, 7, 0xf0c030);
        // the gateway: through the arch the fields outside
        const ax = cx - b.archW / 2, ay = B - b.archH;
        const {near} = this._hills(env);
        for (let i = 0; i < b.archH; i++) {
            const k = i < 10 ? Math.round(Math.sqrt(100 - (10 - i) * (10 - i)) * 1.5) : b.archW / 2;
            const x1 = Math.round(cx - k), x2 = Math.round(cx + k);
            g.rect(x1 - 2, ay + i, x2 - x1 + 4, 1, INK);
            const c = i < b.archH * 0.45 ? mix(env.skyBottom, env.skyTop, 0.2) : i < b.archH * 0.55 ? near : mix(near, 0x8a7a5a, 0.4);
            g.rect(x1, ay + i, x2 - x1, 1, c);
        }
        g.blend(ax, ay, b.archW, b.archH, 0x1a1028, 0.25);
        b.arch = [ax, ay, b.archW, b.archH];
    }

    _drawGround(g, env) {
        const W = this.w, B = this.base, H = this.h, snow = env.weather.snowCover;
        const season = snow > 0.3 ? 'winter' : env.season;
        const walkR = A.ramp(0xb2a68c), sqR = A.ramp(0xbcae92);
        // a kerb of long stones
        const kerb = y => {
            g.rect(0, y, W, 3, 0x6a6052);
            for (let x = -hash(y, 1, 4) % 20; x < W; x += 20 + hash(x, y, 4) % 8) {
                g.rect(x + 1, y, 18 + hash(x, y, 4) % 8, 2, 0x9a907c);
                g.rect(x + 1, y, 18 + hash(x, y, 4) % 8, 1, 0xb8ae98);
            }
        };
        // flagstone walk along the houses, worn at the doors
        A.flagstones(g, 0, B, W, this.roadTop - B, walkR, 3, {mossRate: 220});
        g.rect(0, B, W, 1, 0x7a7060);
        g.blend(0, B + 1, W, 2, 0x1a1028, 0.18);
        for (const d of this.doors)
            g.blend(d.x - 4, B + 1, d.w + 8, 8, 0xd8ccb0, 0.25);
        kerb(this.roadTop - 3);
        // the road: rounded setts, wheel ruts and a stone gutter in the middle
        const R = A.ramp(0x8e826c), top = this.roadTop, bot = this.frontTop;
        g.rect(0, top, W, bot - top, R[0]);
        let row = 0;
        for (let py = top; py < bot; py += 5, row++) {
            for (let px = -(row % 2) * 4, k = 0; px < W; k++) {
                const sw = 5 + hash(k, row, 12) % 4, x2 = Math.min(W, px + sw), hh = Math.min(4, bot - py - 1);
                if (hh > 1 && x2 - px > 2) {
                    const t = hash(k, row, 13) % 12;
                    const c = t === 0 ? mix(R[2], 0x9a6a5a, 0.35) : t < 3 ? R[1] : t > 9 ? R[3] : R[2];
                    g.rect(px + 1, py + 1, x2 - px - 1, hh, c);
                    g.rect(px + 2, py + 1, x2 - px - 3, 1, mix(c, R[4], 0.5));
                    g.rect(px + 1, py + hh, x2 - px - 1, 1, mix(c, R[0], 0.35));
                    g.px(px + 1, py + 1, R[0]);
                    g.px(x2 - 1, py + 1, R[0]);
                }
                px += sw;
            }
        }
        // ruts where the wheels run, worn smooth and darker
        for (const l of this.lanes)
            for (const dy of [-3, 3]) {
                g.blend(0, l.y + dy - 1, W, 3, 0x3a3028, 0.18);
                g.blend(0, l.y + dy - 1, W, 1, 0xfff0d0, 0.08);
            }
        const gut = top + 29;
        g.rect(0, gut - 1, W, 5, 0x6a6050);
        g.rect(0, gut, W, 3, 0x4e463a);
        g.rect(0, gut - 1, W, 1, 0x9a907c);
        g.rect(0, gut + 1, W, 1, this.wetLevel ? mix(0x6a8aa8, env.skyBottom, 0.4) : 0x3e382e);
        for (let x = hash(1, 2, 3) % 40; x < W; x += 30 + hash(x, 1, 3) % 50)
            g.px(x, gut + 2, 0x5a8a34);
        // straw and hay blown about, a few bits of dung
        for (let i = 0; i < W / 18; i++) {
            const x = hash(i, 1, 5) * W / 1000, y = top + 3 + hash(i, 2, 5) * (bot - top - 6) / 1000;
            if (i % 5)
                g.rect(x, y, 3, 1, i % 2 ? 0xd8c070 : 0xc8a858);
            else
                g.rect(x, y, 2, 1, 0x5a4428);
        }
        kerb(this.frontTop);
        A.flagstones(g, 0, this.frontTop + 3, W, 13, walkR, 5, {mossRate: 180});
        // the market square: bigger, paler slabs inside a border of dark stones
        const sq = this.frontTop + 16;
        A.flagstones(g, 0, sq + 3, W, this.squareBot - sq - 3, sqR, 9, {mossRate: 90});
        g.rect(0, sq, W, 3, 0x7a705e);
        for (let x = 0; x < W; x += 7) {
            g.rect(x + 1, sq, 5, 2, 0x948a76);
            g.px(x + 1, sq, 0xaaa08a);
        }
        // trodden paler in front of the stall pitches
        g.blend(0, this.stallY + 2, W, 10, 0xe8dcc0, 0.16);
        // a ring of setts round the well and an iron drain grate
        if (this.well) {
            const cx = this.well.x + this.well.w / 2, cy = this.well.y - 2;
            for (let a = 0; a < Math.PI * 2; a += 0.12) {
                const rx = this.well.w * 0.85, ry = 9;
                const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
                g.rect(x - 1, y - 1, 3, 2, 0x8a806c);
                g.px(x - 1, y - 1, 0xa89e88);
            }
        }
        const [dx] = this._freePoint();
        const dy = this.squareBot - 10;
        g.rect(dx, dy, 10, 5, 0x3a3436);
        for (let i = 1; i < 10; i += 2)
            g.rect(dx + i, dy + 1, 1, 3, 0x1e1a1c);
        g.rect(dx, dy, 10, 1, 0x6a6466);
        if (this.wetLevel)
            for (let i = 0; i < W / 60; i++) {
                const x = hash(i, 4, 6) * W / 1000, y = (i % 2 ? this.lanes[i % 2].y - 3 : sq + 12 + hash(i, 5, 6) % 50);
                A.puddle(g, x, y, 16 + hash(i, 7, 6) % 14, env.skyBottom, i);
            }
        if (snow > 0.15) {
            g.blend(0, B, W, H - B, 0xf4f8ff, Math.min(0.85, snow));
            g.blend(0, gut - 6, W, 14, 0x8a8478, 0.25 * snow);
            for (const l of this.lanes)
                g.blend(0, l.y - 5, W, 8, 0x8a8478, 0.3 * snow);
        }
        // a stone kerb and a strip of grass along the bottom
        g.rect(0, this.squareBot, W, 3, INK);
        g.rect(0, this.squareBot + 1, W, 2, 0xb0a690);
        A.grass(g, 0, this.squareBot + 3, W, H - this.squareBot - 3, season, 41);
    }

    // pennant strings across the street for the autumn fair
    _drawBunting(g) {
        const B = this.base, cols = [0xd84848, 0xf0c030, 0x3a6aa8, 0x4a9a3a];
        for (let x0 = 20; x0 < this.w; x0 += 180) {
            const x1 = Math.min(this.w - 10, x0 + 150);
            for (let x = x0; x < x1; x++) {
                const t = (x - x0) / (x1 - x0), y = Math.round(B - GH - 14 + Math.sin(t * Math.PI) * 16);
                g.px(x, y, 0x5a4a3a);
                if ((x - x0) % 8 === 0)
                    for (let i = 0; i < 5; i++)
                        g.rect(x + Math.floor(i / 2), y + 1 + i, 5 - i, 1, cols[((x - x0) / 8) % 4]);
            }
        }
    }

    _well(g, p, env) {
        const x = p.x, y = p.y, R = A.ramp(0xa89c84);
        g.footShadow(x + 18, y, 40, 0.3);
        // round stone shaft
        g.rect(x - 1, y - 16, p.w + 2, 16, INK);
        A.wallStone(g, x, y - 15, p.w, 15, R, x);
        g.rect(x, y - 15, p.w, 2, R[4]);
        // posts, roof and winch
        g.rect(x + 3, y - 46, 3, 31, INK);
        g.rect(x + p.w - 6, y - 46, 3, 31, INK);
        g.rect(x + 4, y - 46, 1, 31, 0x8a5a32);
        g.rect(x + p.w - 5, y - 46, 1, 31, 0x8a5a32);
        const rr = env.weather.snowCover > 0.2 ? A.ramp(0xe0e8f8) : A.ramp(0x8a4a2a);
        A.shingles(g, y - 58, y - 44, yy => {
            const half = 4 + (yy - y + 58) * 1.6;
            return [Math.round(x + p.w / 2 - half), Math.round(x + p.w / 2 + half)];
        }, rr, x);
        g.rect(x + 5, y - 34, p.w - 10, 3, 0x6a4a2a);
        g.rect(x + 10, y - 31, 1, 8, 0xc8b088);
        g.rect(x + 8, y - 23, 5, 5, INK);
        g.rect(x + 9, y - 22, 3, 3, 0x8a6a40);
        g.rect(x + p.w - 3, y - 36, 4, 1, 0x6a4a2a);
        g.rect(x + p.w, y - 36, 1, 4, 0x6a4a2a);
    }

    // the pillory: a post with two hinged boards, holes for head and hands,
    // on a little wooden platform
    _pillory(g, p) {
        const x = p.x, y = p.y;
        g.footShadow(x + 11, y, 30, 0.3);
        g.rect(x - 4, y - 5, 30, 5, INK);
        g.rect(x - 3, y - 4, 28, 3, 0x8a5a32);
        g.rect(x - 3, y - 4, 28, 1, 0xa8703e);
        g.rect(x + 8, y - 40, 6, 36, INK);
        g.rect(x + 9, y - 40, 4, 36, 0x7a5232);
        g.rect(x + 9, y - 40, 1, 36, 0x9a6a3e);
        this._pilloryBoards(g, p, false);
        g.rect(x + 9, y - 42, 4, 2, 0x5a3a24);
    }

    // the two boards; with someone in it the holes stay open
    _pilloryBoards(g, p, open) {
        const x = p.x, y = p.y;
        const holes = [[x - 1, 3], [x + 6, 10], [x + 20, 3]];
        for (let yy = y - 31; yy < y - 20; yy++)
            for (let xx = x - 3; xx < x + 25; xx++) {
                const edge = yy === y - 31 || yy === y - 21 || xx === x - 3 || xx === x + 24 || yy === y - 26;
                const hole = yy >= y - 28 && yy < y - 23 && holes.some(([hx, hw]) => xx >= hx && xx < hx + hw);
                if (hole && open)
                    continue;
                g.px(xx, yy, hole ? 0x2a1e16 : edge ? INK : yy === y - 30 ? 0xa8703e : yy < y - 26 ? 0x8a5a32 : 0x7a4a2a);
            }
    }

    // barrels, a stack of crates, a hay bale or a cart left standing
    _clutter(g, p, env) {
        const x = p.x, y = p.y, snow = env.weather.snowCover > 0.3;
        g.footShadow(x + p.w / 2, y, p.w + 4, 0.3);
        if (p.kind === 'barrels') {
            for (const [bx, by] of [[x, y], [x + 13, y], [x + 6, y - 12]]) {
                g.rect(bx - 1, by - 13, 13, 13, INK);
                g.rect(bx, by - 12, 11, 12, 0x8a5a32);
                g.rect(bx + 1, by - 12, 3, 12, 0xa8703e);
                g.rect(bx, by - 10, 11, 1, 0x4a4a52);
                g.rect(bx, by - 3, 11, 1, 0x4a4a52);
                g.rect(bx + 1, by - 12, 9, 1, 0xb88a50);
            }
        } else if (p.kind === 'crates') {
            for (const [bx, by, s] of [[x, y, 13], [x + 12, y, 11], [x + 4, y - 12, 11]]) {
                g.rect(bx - 1, by - s - 1, s + 2, s + 1, INK);
                g.rect(bx, by - s, s, s, 0xa8784a);
                g.rect(bx, by - s, s, 1, 0xc8985a);
                g.line(bx + 1, by - 1, bx + s - 2, by - s + 1, 0x7a5232);
                g.rect(bx, by - Math.ceil(s / 2), s, 1, 0x7a5232);
            }
            if (!snow)
                for (let i = 0; i < 3; i++)
                    g.disc(x + 6 + i * 3, y - 25, 2, [0xd84040, 0x6ab84a, 0xf0c040][i]);
        } else if (p.kind === 'hay') {
            g.rect(x - 1, y - 14, p.w + 2, 14, INK);
            g.rect(x, y - 13, p.w, 13, 0xd8b850);
            for (let i = 0; i < p.w; i += 2)
                g.rect(x + i, y - 13 + (i * 7) % 5, 1, 4, 0xf0dc80);
            g.rect(x, y - 9, p.w, 1, 0x8a6a30);
            g.rect(x, y - 4, p.w, 1, 0x8a6a30);
            g.rect(x, y - 13, p.w, 1, snow ? 0xf4f8ff : 0xf4e090);
            for (let i = 0; i < 6; i++)
                g.rect(x - 3 + i * 6, y, 2, 1, 0xd8c070);
        } else {
            // a hand cart resting on its shafts
            drawCart(g, x, y, 40, pick(['sacks', 'cabbages', 'barrels', 'logs']), p.seed, false);
            g.line(x + 38, y - 12, x + 52, y - 1, 0x5a3a20);
            g.line(x + 38, y - 10, x + 52, y, 0x5a3a20);
        }
    }

    _trough(g, p, env) {
        const x = p.x, y = p.y;
        g.footShadow(x + 15, y, 30, 0.3);
        g.rect(x - 1, y - 10, p.w + 2, 10, INK);
        g.rect(x, y - 9, p.w, 9, 0x8a6a40);
        g.rect(x, y - 9, p.w, 1, 0xa8884a);
        g.rect(x + 2, y - 8, p.w - 4, 2, env.weather.snowCover > 0.3 ? 0xe8f0f8 : 0x5a8ab0);
        g.rect(x + 3, y - 3, 1, 3, INK);
        g.rect(x + p.w - 4, y - 3, 1, 3, INK);
    }

    _stall(g, st, env) {
        const x = st.x, y = this.stallY, w = st.w, [a, b] = st.awning;
        g.footShadow(x + w / 2, y, w + 6, 0.3);
        // trestle table with goods, posts and a striped cloth roof
        g.rect(x + 2, y - 44, 2, 44, INK);
        g.rect(x + w - 4, y - 44, 2, 44, INK);
        g.rect(x - 1, y - 18, w + 2, 6, INK);
        g.rect(x, y - 17, w, 4, 0x9a6a3a);
        g.rect(x, y - 17, w, 1, 0xb88a4a);
        g.rect(x + 1, y - 13, w - 2, 9, 0x7a5232);
        g.rect(x + 4, y - 4, 2, 4, INK);
        g.rect(x + w - 6, y - 4, 2, 4, INK);
        for (let i = 0; i < w + 8; i++) {
            const c = Math.floor(i / 6) % 2 ? a : b;
            g.rect(x - 4 + i, y - 52, 1, 8, c);
            g.px(x - 4 + i, y - 52, highlight(c, 0.3));
        }
        g.rect(x - 5, y - 53, w + 10, 1, INK);
        for (let i = 0; i < w + 8; i += 6)
            for (let k = 0; k < 3; k++)
                g.rect(x - 4 + i + k, y - 44 + k, 6 - k * 2, 1, Math.floor(i / 6) % 2 ? a : b);
        // goods on the table
        const [c1, c2] = st.goods.c;
        for (let i = 3; i < w - 6; i += 7) {
            const c = (i / 7) % 2 ? c1 : c2;
            switch (st.goods.goods) {
            case 'cabbage': case 'apples': case 'pumpkins': case 'eggs':
                for (let k = 0; k < 3; k++) {
                    const s = st.goods.goods === 'pumpkins' ? 3 : 2;
                    g.disc(x + i + k * 2, y - 19 - (k === 1 ? 2 : 0), s, INK);
                    g.disc(x + i + k * 2, y - 19 - (k === 1 ? 2 : 0), s - 1, c);
                }
                break;
            case 'fish':
                g.rect(x + i, y - 20, 6, 2, c);
                g.px(x + i + 6, y - 21, c);
                g.px(x + i + 6, y - 19, c);
                break;
            case 'cheese':
                g.rect(x + i, y - 22, 6, 4, INK);
                g.rect(x + i + 1, y - 21, 4, 3, c);
                break;
            case 'cloth':
                g.rect(x + i, y - 22, 6, 4, INK);
                g.rect(x + i + 1, y - 21, 4, 3, c);
                g.rect(x + i + 1, y - 43, 4, 12, c);
                break;
            case 'pots':
                g.rect(x + i, y - 24, 5, 6, INK);
                g.rect(x + i + 1, y - 23, 3, 5, c);
                break;
            case 'herbs':
                g.rect(x + i + 1, y - 43, 1, 10, c);
                g.rect(x + i + 3, y - 43, 1, 8, c);
                g.rect(x + i, y - 21, 5, 3, c);
                break;
            case 'bread':
                g.rect(x + i, y - 22, 6, 4, INK);
                g.rect(x + i + 1, y - 21, 4, 3, c);
                break;
            }
        }
    }

    _maypole(g, m, env) {
        const x = m.x, y = m.y;
        g.footShadow(x, y, 16, 0.3);
        g.rect(x - 2, y - 124, 5, 124, INK);
        g.rect(x - 1, y - 124, 3, 124, 0xe8dcc0);
        for (let i = 0; i < 124; i += 8)
            g.rect(x - 1, y - 124 + i, 3, 3, i % 16 ? 0xd84848 : 0x3a6aa8);
        // wreath at the top
        g.rect(x - 9, y - 112, 19, 4, INK);
        g.rect(x - 8, y - 111, 17, 2, 0x4a8a3a);
        for (let i = -7; i <= 7; i += 4)
            g.px(x + i, y - 112, [0xf0d040, 0xe84860, 0xf0f0f0][(i + 7) / 4 % 3]);
        m.top = [x, y - 110];
    }

    _bonfirePile(g, f) {
        const x = f.x, y = f.y;
        g.footShadow(x, y, 44, 0.35);
        for (let i = 0; i < 9; i++) {
            const a = -0.9 + i * 0.22;
            g.line(x + Math.round(Math.sin(a) * 20), y, x + Math.round(Math.sin(a) * 4), y - 22, i % 2 ? 0x6a4a2a : 0x5a3a20);
        }
        g.rect(x - 16, y - 4, 32, 4, 0x4a3420);
    }


    // ---------- life ----------

    _density(env) {
        const h = env.hour, cal = this.cal || this._calendar(env);
        let d = cal.curfew ? 0 : h < 6 ? 0.25 : h < 8 ? 0.7 : h < 17 ? 1 : h < 20 ? 0.75 : 0.45;
        if (cal.market === 'big' && cal.marketOpen)
            d *= 1.35;
        if (cal.fair)
            d *= 1.25;
        return d * (1 - Math.min(0.7, env.weather.v.rain * 0.45 + env.weather.v.snow * 0.2));
    }

    _walker(env, lane, opts = {}) {
        const p = makeMedieval(env, opts);
        p.lane = lane;
        const band = lane === 'back' ? this.backY : this.frontY;
        p.y = rand(band[0], band[1]);
        p.dir = chance(0.5) ? 1 : -1;
        p.state = 'walk';
        p.face = 'side';
        return p;
    }

    _populate(env, anywhere = false) {
        const cal = this.cal || this._calendar(env), d = this._density(env), W = this.w;
        const onLanes = this.people.filter(p => p.lane !== 'square').length;
        const want = Math.round((W / 48 * d + (cal.curfew ? 0 : 1)) * env.people);
        if (onLanes < want) {
            const p = this._walker(env, weighted([['back', 5], ['front', 4]]));
            const r = Math.random();
            if (anywhere) {
                p.x = rand(0, W);
            } else if (p.lane === 'back' && r < 0.3) {
                const door = pick(this.doors.filter(dd => !dd.church || cal.sunday));
                p.x = door.x + door.w / 2 - 8;
                door.open = 1.2;
            } else if (p.lane === 'back' && r < 0.42 && this.gate && cal.gateOpen) {
                // in through the town gate
                p.x = this.gate.towerX + this.gate.towerW / 2 - 8;
                p.target = p.y;
                p.y = this.base + 1;
                p.state = 'out';
                p.face = 'down';
            } else {
                p.x = p.dir > 0 ? -20 : W + 20;
            }
            this.people.push(p);
        }
        // folk on the market square
        const stalls = this.sprites.filter(s => s.stall).length;
        const sq = this.people.filter(p => p.lane === 'square').length;
        const wantSq = Math.round(((stalls ? stalls * 1.3 + 2 : 2.5) * d) * env.people);
        if (sq < wantSq && this.layerA)
            this._toSquare(this._walker(env, 'front'), env, anywhere);
        // carts and riders come and go while the gate is open
        const items = this.lanes.reduce((n, l) => n + l.items.length, 0);
        if (cal.gateOpen && items < Math.round(W / 320 * Math.max(0.3, d) * env.traffic) && chance(anywhere ? 0.6 : 0.25))
            this._spawnTraffic(pick(this.lanes), env, pick(['cart', 'cart', 'cart', 'rider', 'donkey']), anywhere);
        // hens by day, a cat by night
        const hens = this.animals.filter(a => a.kind === 'chicken').length;
        if (!env.night && hens < 4 && chance(anywhere ? 1 : 0.02))
            this.animals.push(this._animal('chicken', anywhere));
        if (env.night && !this.animals.some(a => a.kind === 'cat') && chance(0.01))
            this.animals.push({kind: 'cat', cat: makeCat(), x: chance(0.5) ? -10 : W + 10, y: rand(this.backY[0], this.backY[1]), dir: 0, t: 0, speed: rand(18, 26)});
    }

    _animal(kind, anywhere) {
        const [fx, fy] = this._freePoint();
        const a = {kind, c: pick([0xf4f0e8, 0xc88a40, 0x8a5a3a, 0x3a3030]), x: fx + 8, y: fy, t: rand(5), state: 'peck', timer: rand(1, 4), dir: chance(0.5) ? 1 : -1};
        if (!anywhere)
            a.x = chance(0.5) ? -10 : this.w + 10;
        a.tx = a.x;
        a.ty = a.y;
        return a;
    }

    // send a person from the front walk onto the square with something to do
    // fresh = a new arrival (pushed to the list), else someone already
    // walking on the front walk turns onto the square where they are
    _toSquare(p, env, anywhere = false, fresh = true) {
        p.lane = 'square';
        if (anywhere) {
            [p.x, p.y] = this._freePoint();
        } else if (fresh) {
            p.x = chance(0.5) ? -16 : this.w + 16;
            p.y = rand(this.frontY[0], this.frontY[1]);
        }
        p.goals = randi(1, 3);
        this._nextSquareGoal(p, env);
        if (fresh)
            this.people.push(p);
    }

    _nextSquareGoal(p, env) {
        const stalls = this.sprites.filter(s => s.stall);
        const opts = [['idle', 1]];
        if (stalls.length)
            opts.push(['shop', 4]);
        if (this.well)
            opts.push(['well', p.carry === 'yoke' ? 20 : 0.8]);
        if (this.show)
            opts.push(['watch', 4]);
        if (this.limes.length && env.season !== 'winter' && !env.night)
            opts.push(['shade', env.season === 'summer' ? 1.5 : 0.4]);
        if (p.goals <= 0)
            opts.length = 0, opts.push(['leave', 1]);
        const kind = weighted(opts);
        p.goals--;
        let tx, ty;
        if (kind === 'shop') {
            const st = pick(stalls).stall;
            tx = st.x + rand(4, st.w - 20);
            ty = this.stallY + rand(5, 9);
            p.faceAt = 'up';
        } else if (kind === 'well') {
            tx = this.well.x + 10 + rand(-6, 6);
            ty = this.well.y + 6;
            p.faceAt = 'up';
        } else if (kind === 'watch') {
            // a ring of onlookers to both sides, the front left open
            const side = chance(0.5) ? 1 : -1;
            tx = this.show.x + side * rand(24, 46) - 8;
            ty = clamp(this.show.y + rand(-9, 5), this.stallY + 6, this.squareBot - 2);
            p.faceAt = side < 0 ? 'right' : 'left';
        } else if (kind === 'shade') {
            const t = pick(this.limes);
            tx = t.x + 30 + rand(-26, 12);
            ty = t.y + rand(4, 10);
            p.faceAt = 'sit';
        } else if (kind === 'idle') {
            [tx, ty] = this._freePoint();
            p.faceAt = 'down';
        } else {
            tx = p.x < this.w / 2 ? -20 : this.w + 20;
            ty = rand(this.frontY[0], this.frontY[1]);
        }
        p.goal = kind;
        ty = clamp(ty, this.frontY[0], this.squareBot - 2);
        tx = clamp(tx, -30, this.w + 30);
        if (kind !== 'leave' && this._inside(tx, ty, this._obstacles()))
            [tx, ty] = this._freePoint();
        p.route = this._squareRoute([p.x, p.y], [tx, ty]);
        p.state = 'go';
        p.waitT = kind === 'shop' ? rand(8, 25) : kind === 'well' ? rand(6, 14) : kind === 'watch' ? rand(25, 70) : kind === 'shade' ? rand(30, 120) : rand(5, 15);
    }

    // ground the people on the square must walk around: the feet zone of
    // every prop and stall (x1, y1, x2, y2)
    _obstacles() {
        const ob = [];
        for (const p of this.props) {
            if (p.kind === 'tree')
                ob.push([p.x + 30 - p.size * 0.2 - 2, p.y - 6, p.x + 30 + p.size * 0.2 + 2, p.y + 3]);
            else
                ob.push([p.x - 4, p.y - 8, p.x + p.w + 4, p.y + 3]);
        }
        for (const s of this.sprites)
            if (s.stall)
                ob.push([s.stall.x - 6, this.stallY - 14, s.stall.x + s.stall.w + 6, this.stallY + 3]);
        if (this.maypole)
            ob.push([this.maypole.x - 5, this.maypole.y - 5, this.maypole.x + 5, this.maypole.y + 3]);
        if (this.bonfire)
            ob.push([this.bonfire.x - 20, this.bonfire.y - 8, this.bonfire.x + 20, this.bonfire.y + 4]);
        return ob;
    }

    // is a spot (figure left edge, feet) on or right next to an obstacle?
    _inside(x, y, ob) {
        return ob.some(o => x + 8 > o[0] - 5 && x + 8 < o[2] + 5 && y > o[1] - 1 && y < o[3] + 1);
    }

    // first obstacle the walk a -> b (feet, figure 16 wide) runs into
    _blocking(a, b, ob) {
        const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
        for (let i = 1; i <= n; i++) {
            const x = a[0] + 8 + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n;
            const hit = ob.find(o => x > o[0] - 5 && x < o[2] + 5 && y > o[1] - 1 && y < o[3] + 1);
            if (hit)
                return hit;
        }
        return null;
    }

    // A route over the front walk and the square from a to b (figure left
    // edge, feet) that keeps clear of every prop and stall: a search on a
    // 4px grid, then straightened to as few legs as possible.
    _route(a, b) {
        const ob = this._obstacles();
        const C = 4, x0 = -32, y0 = this.frontY[0] - 2;
        const cols = Math.ceil((this.w + 64) / C), rows = Math.ceil((this.squareBot - y0) / C);
        const cell = ([x, y]) => [clamp(Math.round((x - x0) / C), 0, cols - 1), clamp(Math.round((y - y0) / C), 0, rows - 1)];
        const pt = (cx, cy) => [x0 + cx * C, y0 + cy * C];
        const free = (cx, cy) => {
            const [x, y] = pt(cx, cy);
            return !ob.some(o => x + 8 > o[0] - 5 && x + 8 < o[2] + 5 && y > o[1] - 1 && y < o[3] + 1);
        };
        const near = ([cx, cy]) => {
            for (let r = 0; r < 12; r++)
                for (let dy = -r; dy <= r; dy++)
                    for (let dx = -r; dx <= r; dx++)
                        if (cx + dx >= 0 && cx + dx < cols && cy + dy >= 0 && cy + dy < rows && free(cx + dx, cy + dy))
                            return [cx + dx, cy + dy];
            return [cx, cy];
        };
        const s0 = near(cell(a)), g0 = near(cell(b)), N = cols * rows;
        // a goal inside a stall or prop ends at the nearest free spot
        if (this._inside(b[0], b[1], ob))
            b = pt(g0[0], g0[1]);
        if (!this._blocking(a, b, ob))
            return [b];
        const prev = new Int32Array(N).fill(-1), start = s0[1] * cols + s0[0], goal = g0[1] * cols + g0[0];
        prev[start] = start;
        const queue = [start];
        for (let qi = 0; qi < queue.length && prev[goal] < 0; qi++) {
            const c = queue[qi], cx = c % cols, cy = (c / cols) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
                const nx = cx + dx, ny = cy + dy, n = ny * cols + nx;
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || prev[n] >= 0 || !free(nx, ny))
                    continue;
                prev[n] = c;
                queue.push(n);
            }
        }
        if (prev[goal] < 0)
            return [b];
        const path = [];
        for (let c = goal; c !== start; c = prev[c])
            path.push(pt(c % cols, (c / cols) | 0));
        path.reverse();
        path.push(b);
        // straighten: from each point on to the farthest one in plain view
        const out = [];
        let at = a, i = 0;
        while (i < path.length) {
            let j = path.length - 1;
            while (j > i && this._blocking(at, path[j], ob))
                j--;
            out.push(path[j]);
            at = path[j];
            i = j + 1;
        }
        return out;
    }

    _squareRoute(a, b) {
        return this._route(a, b);
    }

    // a spot on the square away from the props
    _freePoint() {
        for (let i = 0; i < 40; i++) {
            const x = rand(10, this.w - 30), y = rand(this.stallY + 14, this.squareBot - 4);
            if (!this.props.some(p => x + 16 > p.x - 6 && x < p.x + p.w + 6 && Math.abs(y - p.y) < 14) && !this._inside(x, y, this._obstacles()))
                return [x, y];
        }
        return [this.w / 2, this.squareBot - 6];
    }

    _spawnTraffic(lane, env, kind, anywhere = false, extra = {}) {
        const it = {kind, dir: lane.dir, dist: rand(100), t: 0, ...extra};
        if (kind === 'cart') {
            const beast = chance(0.65) ? 'horse' : chance(0.6) ? 'ox' : 'donkey';
            it.beast = {k: beast, c: beast === 'horse' ? pick(HORSES) : beast === 'ox' ? pick([0xc8a878, 0x8a5a3a, 0xe8e0d0]) : 0x8a8480};
            it.load = env.season === 'autumn' && chance(0.3) ? 'cabbages' : pick(['hay', 'barrels', 'sacks', 'cabbages', 'logs']);
            it.cartLen = beast === 'donkey' ? 32 : 42;
            it.speed = beast === 'ox' ? rand(8, 10) : beast === 'donkey' ? rand(10, 13) : rand(14, 20);
            it.driver = makeMedieval(env, {role: 'peasant'});
            it.driver.carry = 'none';
            it.driver.state = 'sit';
        } else if (kind === 'rider') {
            it.beast = {k: 'horse', c: pick(HORSES), cloth: extra.cloth};
            it.rider = extra.rider || makeMedieval(env, {role: pick(['merchant', 'noble', 'guard', 'townsman'])});
            it.rider.carry = extra.rider ? it.rider.carry : 'none';
            it.rider.lantern = false;
            it.speed = extra.speed ?? rand(18, 28);
        } else if (kind === 'donkey') {
            it.beast = {k: 'donkey', c: pick([0x8a8480, 0x6a625e, 0x9a8a78]), packs: true};
            it.walker = makeMedieval(env, {role: pick(['peasant', 'merchant', 'monk'])});
            it.walker.state = 'walk';
            it.speed = rand(9, 12);
        }
        it.cur = it.speed;
        it.len = this._trafficLen(it);
        it.x = anywhere ? rand(0, this.w) : lane.dir > 0 ? -it.len - 6 : this.w + 6;
        if (lane.items.some(o => Math.abs(o.x - it.x) < it.len + 24))
            return null;
        lane.items.push(it);
        return it;
    }

    _trafficLen(it) {
        const bw = BEAST[it.beast.k](it.beast, 0).w;
        return it.kind === 'cart' ? it.cartLen + 8 + bw : it.kind === 'donkey' ? bw + 20 : bw;
    }

    trigger(name, env, ctx, inView = false) {
        const cal = this.cal || this._calendar(env), W = this.w;
        const lane = pick(this.lanes);
        switch (name) {
        case 'knight': {
            // a knight in full colours, his squire walking behind
            const k = makeMedieval(env, {role: 'knight'});
            k.carry = 'banner';
            k.flag = k.tabard;
            const it = this._spawnTraffic(lane, env, 'rider', false, {rider: k, cloth: k.tabard, speed: 14});
            if (it) {
                const sq = makeMedieval(env, {role: 'kid'});
                sq.carry = 'spear';
                it.follower = sq;
                it.len += 26;
            }
            break;
        }
        case 'messenger':
            this._spawnTraffic(lane, env, 'rider', false, {speed: 46, rider: Object.assign(makeMedieval(env, {role: 'townsman'}), {carry: 'none', style: 'feather', cap: 0x9a2a2a, feather: 0xf0d040, frames: []})});
            break;
        case 'caravan':
            for (let i = 0; i < randi(2, 4); i++)
                this.timers.add(i * 3.2, () => this._spawnTraffic(lane, env, 'donkey'));
            break;
        case 'royal': {
            // herald, guards, the lord on a white horse, more guards
            const tab = pick([0x1a3a7a, 0x8a1a2a, 0x2a5a3a]);
            const herald = this._walker(env, 'front', {role: 'crier'});
            herald.carry = 'banner';
            herald.flag = tab;
            const lord = makeMedieval(env, {role: 'noble'});
            lord.style = 'crown';
            lord.frames = [];
            const queue = [() => this._procession([herald], 'front', 1), () => this._procession([0, 1].map(() => Object.assign(this._walker(env, 'front', {role: 'guard', tabard: tab}), {})), 'front', 1),
                () => this._spawnTraffic(this.lanes[1], env, 'rider', false, {rider: lord, cloth: tab, speed: 11}),
                () => this._procession([0, 1].map(() => this._walker(env, 'front', {role: 'guard', tabard: tab})), 'front', 1)];
            queue.forEach((f, i) => this.timers.add(i * 2.6, f));
            break;
        }
        case 'procession': {
            // monks with a cross banner, torches when it is dark
            const monks = [];
            for (let i = 0; i < randi(4, 7); i++) {
                const m = this._walker(env, 'back', {role: 'monk'});
                m.speed = 8;
                m.carry = i === 0 ? 'banner' : env.dark > 0.4 ? 'torch' : 'none';
                m.flag = 0xf0ece0;
                m.chant = true;
                monks.push(m);
            }
            this._procession(monks, 'back', chance(0.5) ? 1 : -1);
            break;
        }
        case 'pilgrims':
            this._procession([0, 1, 2].slice(0, randi(2, 3)).map(() => this._walker(env, 'front', {role: 'pilgrim'})), 'front', chance(0.5) ? 1 : -1);
            break;
        case 'herd': {
            // a shepherd drives sheep along the road
            const dir = lane.dir, it = {kind: 'herd', dir, t: 0, dist: 0, speed: 9, cur: 9, flock: [], beast: {k: 'sheep'}};
            for (let i = 0; i < randi(5, 9); i++)
                it.flock.push({dx: i * 9 + rand(-3, 3), dy: rand(-4, 4), ph: rand(6)});
            it.shepherd = makeMedieval(env, {role: 'peasant'});
            it.shepherd.carry = 'staff';
            it.shepherd.state = 'walk';
            it.dog = makeDog();
            it.len = it.flock.length * 9 + 50;
            it.x = dir > 0 ? -it.len : W + 4;
            lane.items.push(it);
            break;
        }
        case 'geese': {
            const dir = lane.dir, it = {kind: 'geese', dir, t: 0, dist: 0, speed: 8, cur: 8, flock: [], beast: {k: 'goose'}};
            for (let i = 0; i < randi(4, 7); i++)
                it.flock.push({dx: i * 10 + rand(-2, 2), dy: rand(-3, 3), ph: rand(6)});
            it.shepherd = makeMedieval(env, {role: 'kid'});
            it.shepherd.carry = 'staff';
            it.shepherd.state = 'walk';
            it.len = it.flock.length * 10 + 26;
            it.x = dir > 0 ? -it.len : W + 4;
            lane.items.push(it);
            break;
        }
        case 'pigs': {
            // pigs got loose and run about the square, the farmer after them
            for (let i = 0; i < randi(2, 3); i++)
                this.animals.push({kind: 'pig', c: pick([0xf0b0a8, 0x5a4a44, 0xe8a098]), x: chance(0.5) ? -16 : W + 16, y: rand(this.stallY + 10, this.squareBot - 4), t: 0, state: 'run', dir: 1, life: rand(70, 140)});
            const f = this._walker(env, 'front', {role: 'peasant'});
            f.chaser = true;
            f.carry = 'staff';
            this.timers.add(4, () => this._toSquare(f, env));
            break;
        }
        case 'crier': {
            const c = this._walker(env, 'front', {role: 'crier'});
            this._toSquare(c, env);
            const [x, y] = this.well ? [this.well.x - 24, this.well.y + 4] : this._freePoint();
            c.route = this._squareRoute([c.x, c.y], this._inside(x, y, this._obstacles()) ? this._freePoint() : [x, y]);
            c.goal = 'cry';
            c.waitT = rand(18, 30);
            c.goals = 0;
            break;
        }
        case 'minstrel':
        case 'juggler': {
            const m = this._walker(env, 'front', {role: name});
            this._toSquare(m, env);
            const [x, y] = this._freePoint();
            m.route = this._squareRoute([m.x, m.y], [x, y]);
            m.goal = 'perform';
            m.waitT = rand(90, 200);
            m.goals = 0;
            this.show = {x: x + 8, y, p: m};
            break;
        }
        case 'pillory': {
            if (!this.pillory || this.pilloried)
                break;
            const t = makeMedieval(env, {role: 'townsman'});
            t.carry = 'none';
            t.state = 'idle';
            this.pilloried = {p: t, t: rand(150, 300), throwT: 2};
            break;
        }
        case 'drunk': {
            if (!this.tavern)
                break;
            const p = this._walker(env, 'back', {role: 'townsman'});
            p.x = this.tavern.door.x;
            this.tavern.door.open = 1.2;
            p.drunk = true;
            p.speed = 7;
            p.lantern = false;
            this.people.push(p);
            break;
        }
        case 'wedding': {
            if (!this.church)
                break;
            const d = this.church.door;
            const pair = [makeMedieval(env, {role: 'noble'}), makeMedieval(env, {role: 'noble'})];
            pair[0].woman = true;
            pair[0].robe = true;
            pair[0].style = 'long';
            pair[0].shirt = 0x3a6ab8;
            pair[0].wreath = true;
            pair[1].woman = false;
            pair[1].robe = false;
            pair[1].tunic = true;
            pair[1].style = 'feather';
            pair.forEach((p, i) => {
                p.frames = [];
                p.lane = 'back';
                p.x = d.x + i * 14 - 4;
                p.y = this.backY[1];
                p.dir = 1;
                p.state = 'idle';
                p.face = 'down';
                p.waitT = 40;
                p.wed = true;
                this.people.push(p);
            });
            d.open = 4;
            this.petals = {x: d.x + 10, y: this.backY[1] - 30, t: 40};
            break;
        }
        }
    }

    // people walking one behind the other
    _procession(list, lane, dir) {
        list.forEach((p, i) => {
            p.lane = lane;
            p.dir = dir;
            p.x = dir > 0 ? -20 - i * 22 : this.w + 20 + i * 22;
            p.y = (lane === 'back' ? this.backY : this.frontY)[1] - (i % 2) * 3;
            p.state = 'walk';
            p.procession = true;
            this.people.push(p);
        });
    }

    _pickEvent(env) {
        const cal = this.cal || this._calendar(env), h = env.hour, dry = env.weather.v.rain < 0.2;
        if (cal.curfew)
            return weighted([['drunk', h < 23.5 && h > 21 ? 2 : 0.2], ['none', 2]]);
        const P = env.people, V = env.traffic, day = !env.night;
        return weighted([
            ['knight', 0.8 * V], ['messenger', 0.5 * V], ['caravan', cal.gateOpen ? 0.7 * V : 0], ['royal', cal.fair || cal.may ? 0.5 : 0.12],
            ['procession', cal.sunday || env.dark > 0.4 ? 1.2 : 0.4], ['pilgrims', 0.5 * P], ['herd', day ? 0.8 : 0], ['geese', day ? 0.7 : 0],
            ['pigs', day ? 0.6 : 0], ['crier', day ? 1.2 * P : 0], ['minstrel', dry && !this.show ? (cal.fair ? 3 : 1.2) * P : 0],
            ['juggler', dry && !this.show && day ? (cal.fair ? 3 : 0.6) * P : 0], ['pillory', day ? 0.3 : 0],
            ['wedding', env.weekday === 6 && h > 10 && h < 15 && dry ? 1.5 : 0], ['drunk', h > 19 ? 0.8 : 0],
        ]);
    }

    // ---------- update ----------

    update(dt, real, env, ctx) {
        this.realT += real;
        this.timers.run(real);
        const cal = this.cal = this._calendar(env);
        if (Math.floor(this.realT) !== Math.floor(this.realT - real))
            this._populate(env);
        for (const w of this.windows)
            w.update(dt, real, env);
        for (const d of this.doors)
            d.open = Math.max(0, d.open - real);
        this._updateBells(real, env, cal);
        // the gate: portcullis down from curfew until the morning bell
        if (this.gate)
            this.gate.open = clamp(this.gate.open + (cal.gateOpen ? 1 : -1) * real / 5, 0, 1);
        this._updatePeople(real, env, cal);
        this._updateTraffic(real, env);
        this._updateAnimals(real, env);
        this._updateWork(real, env, cal);
        this._updateFx(real, env, cal);
        this.eventTimer -= real;
        if (this.eventTimer <= 0) {
            this.eventTimer = rand(40, 130);
            this.trigger(this._pickEvent(env), env, ctx);
        }
    }

    _updateBells(real, env, cal) {
        const B = this.bell, h = env.hour, hr = Math.floor(h), min = Math.floor(h * 60);
        if (B.lastHour < 0) {
            B.lastHour = hr;
            B.lastMin = min;
        }
        if (hr !== B.lastHour) {
            B.lastHour = hr;
            if (hr >= 6 && hr <= 21) {
                B.strokes = hr % 12 || 12;
                // morning, noon and evening prayer, the curfew at nine
                if (hr === 6 || hr === 12 || hr === 18)
                    B.peal = 35;
                if (hr === 21)
                    B.peal = 60;
            }
            if (cal.curfew && this.watch)
                this.watch.call = 6;
        }
        const crossed = m => B.lastMin < m && min >= m;
        if (cal.sunday && crossed(9 * 60 + 30))
            B.peal = 60;
        if (env.holidays.christmasEve && crossed(23 * 60 + 15))
            B.peal = 90;
        B.lastMin = min;
        const ringing = B.peal > 0 || B.strokes > 0;
        if (ringing || Math.abs(B.swing) > 0.02) {
            const prev = Math.sin(B.t);
            B.t += real * 2.6;
            const now = Math.sin(B.t);
            const amp = ringing ? 1 : 0;
            B.amp = (B.amp ?? 0) + (amp - (B.amp ?? 0)) * Math.min(1, real * 1.5);
            B.swing = now * B.amp;
            if (prev * now < 0 && ringing) {
                // one stroke each time the bell swings through
                if (B.strokes > 0)
                    B.strokes--;
                if (this.church) {
                    const [bx, by] = this.church.bellAt;
                    this.floaters.push({kind: 'note', x: bx + rand(-8, 8), y: by, vx: rand(-6, 6), vy: -14, t: 0, life: 2.2, c: 0xf0e0a0});
                }
            }
            B.peal = Math.max(0, B.peal - real);
        }
    }

    _laneY(lane) {
        return lane === 'back' ? this.backY : this.frontY;
    }

    _trafficNear(x, w = 50) {
        return this.lanes.some(l => l.items.some(it => it.x < x + w && it.x + it.len > x - w + 16));
    }

    _updatePeople(real, env, cal) {
        const W = this.w;
        for (const p of this.people) {
            p.t += real;
            if (p.chatCool > 0)
                p.chatCool -= real;
            switch (p.state) {
            case 'walk': {
                p.face = 'side';
                if (p.drunk) {
                    p.x += p.speed * p.dir * real * (0.6 + Math.sin(p.t * 2.3) * 0.5);
                    p.y = clamp(p.y + Math.sin(p.t * 1.7) * 4 * real, this.backY[0], this.backY[1]);
                    if (Math.random() < real / 6)
                        p.dir = -p.dir;
                    if (Math.random() < real / 4)
                        this.floaters.push({kind: 'hic', x: p.x + 8, y: p.y - 34, vx: 0, vy: -6, t: 0, life: 1.5});
                } else {
                    p.x += p.speed * p.dir * real;
                }
                if (p.chant && Math.random() < real * 0.8)
                    this.floaters.push({kind: 'note', x: p.x + 8, y: p.y - 34, vx: rand(-3, 3), vy: -8, t: 0, life: 1.8, c: 0xe8e0d0});
                // processions, drunks and the watch keep to their way
                if (p.procession || p.drunk || p.watchman)
                    break;
                const poi = (key, near, fn) => {
                    if (near && p.poi !== key) {
                        p.poi = key;
                        fn();
                    }
                };
                if (p.lane === 'back') {
                    for (const [i, d] of this.doors.entries()) {
                        poi('d' + i, Math.abs(p.x + 8 - d.x - d.w / 2) < 2, () => {
                            const want = d.gate ? (cal.gateOpen && this.gate.open > 0.9 ? 0.3 : 0)
                                : d.church ? (cal.sunday && env.hour > 9 && env.hour < 10.2 ? 0.8 : 0.05)
                                    : d.tavern ? (env.hour > 17 ? 0.45 : 0.12)
                                        : cal.curfew || env.hour > 20.5 ? 0.9 : 0.12;
                            if (chance(want)) {
                                p.state = 'enter';
                                p.x = d.x + d.w / 2 - 8;
                                p.target = d.gate ? this.base - 2 : this.base + 1;
                                d.open = 2;
                            }
                        });
                    }
                    for (const b of this.buildings) {
                        if (!b.shop || !this._shopOpen(b.shop, env, cal))
                            continue;
                        poi('s' + b.x, Math.abs(p.x + 8 - b.shop.x - b.shop.w / 2) < 2, () => {
                            if (chance(0.3)) {
                                p.state = 'stand';
                                p.face = 'up';
                                p.waitT = rand(6, 18);
                                p.y = this.backY[0];
                            }
                        });
                    }
                } else if (p.lane === 'front' && !cal.curfew && p.role !== 'guard' && Math.random() < real * 0.02) {
                    // off onto the square
                    this._toSquare(p, env, false, false);
                    break;
                }
                // now and then someone crosses the road
                if (!cal.curfew && Math.random() < real * 0.01 && !this._trafficNear(p.x)) {
                    p.state = 'cross';
                    p.target = p.lane === 'back' ? rand(this.frontY[0], this.frontY[1]) : rand(this.backY[0], this.backY[1]);
                }
                // two who meet stop for a word
                if (!p.chatCool && !cal.curfew) {
                    const o = this.people.find(q => q !== p && q.state === 'walk' && q.lane === p.lane && q.dir !== p.dir && !q.chatCool && Math.abs(q.x - p.x) < 16 && Math.abs(q.y - p.y) < 6);
                    if (o && chance(0.35)) {
                        for (const q of [p, o]) {
                            q.state = 'chat';
                            q.waitT = rand(6, 14);
                            q.chatCool = 40;
                        }
                        p.dir = o.x > p.x ? 1 : -1;
                        o.dir = -p.dir;
                        p.icon = pick(['coin', 'heart', 'bread', 'rain', 'sun', 'news']);
                        o.icon = pick(['coin', 'news', 'note']);
                    } else if (o) {
                        p.chatCool = 20;
                    }
                }
                break;
            }
            case 'stand':
            case 'chat':
                p.waitT -= real;
                if (p.waitT <= 0) {
                    p.state = 'walk';
                    p.face = 'side';
                }
                break;
            case 'idle':
                if (p.wed) {
                    p.waitT -= real;
                    if (p.waitT <= 0) {
                        p.state = 'walk';
                        p.wed = false;
                    }
                }
                break;
            case 'enter': {
                p.face = 'up';
                p.y -= 9 * real;
                if (p.y <= p.target)
                    p.gone = true;
                break;
            }
            case 'out':
                p.face = 'down';
                p.y += 9 * real;
                if (p.y >= p.target) {
                    p.state = 'walk';
                    p.face = 'side';
                }
                break;
            case 'cross': {
                const dy = p.target - p.y;
                p.face = dy > 0 ? 'down' : 'up';
                p.y += Math.sign(dy) * Math.min(Math.abs(dy), 16 * real);
                if (Math.abs(p.target - p.y) < 0.5) {
                    p.lane = p.lane === 'back' ? 'front' : 'back';
                    p.state = 'walk';
                    p.face = 'side';
                }
                break;
            }
            case 'go': {
                const [tx, ty] = p.route[0];
                const dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy);
                const step = (p.chaser ? 30 : p.speed * 0.8) * real;
                p.face = Math.abs(dy) > Math.abs(dx) * 1.5 ? (dy > 0 ? 'down' : 'up') : 'side';
                if (Math.abs(dx) > 1)
                    p.dir = dx > 0 ? 1 : -1;
                if (dist <= step) {
                    p.x = tx;
                    p.y = ty;
                    p.route.shift();
                    if (!p.route.length)
                        this._arrive(p, env);
                } else {
                    p.x += dx / dist * step;
                    p.y += dy / dist * step;
                }
                break;
            }
            case 'busy':
                p.waitT -= real;
                if (p.goal === 'cry' && Math.random() < real * 0.4)
                    p.icon = 'news';
                if (p.goal === 'perform' && p.role === 'minstrel' && Math.random() < real * 1.5)
                    this.floaters.push({kind: 'note', x: p.x + 8 + rand(-4, 4), y: p.y - 30, vx: rand(-4, 4), vy: -10, t: 0, life: 2, c: pick([0xf0d040, 0xf4ecdc, 0xd84848])});
                if (p.goal === 'watch' && this.show && Math.random() < real * 0.05)
                    p.icon = pick(['heart', 'coin', 'note']), p.iconT = 2;
                if (p.waitT <= 0 || (p.goal === 'watch' && !this.show)) {
                    if (p.goal === 'perform')
                        this.show = null;
                    p.icon = null;
                    this._nextSquareGoal(p, env);
                }
                break;
            }
            if (p.iconT > 0) {
                p.iconT -= real;
                if (p.iconT <= 0)
                    p.icon = null;
            }
            if (p.x < -60 || p.x > W + 60)
                p.gone = true;
        }
        this.people = this.people.filter(p => !p.gone);
    }

    _arrive(p, env) {
        if (p.goal === 'leave') {
            p.gone = true;
            return;
        }
        p.state = 'busy';
        if (p.faceAt === 'up') {
            p.face = 'up';
        } else if (p.faceAt === 'left' || p.faceAt === 'right') {
            p.face = 'side';
            p.dir = p.faceAt === 'right' ? 1 : -1;
        } else if (p.faceAt === 'sit') {
            p.face = 'side';
            p.sitting = true;
        } else {
            p.face = 'down';
        }
        if (p.goal === 'cry')
            p.icon = 'news';
        if (p.goal === 'perform')
            p.face = 'down';
    }

    _updateTraffic(real, env) {
        for (const lane of this.lanes) {
            lane.items.sort((a, b) => (b.x - a.x) * lane.dir);
            for (let i = 0; i < lane.items.length; i++) {
                const it = lane.items[i];
                it.t += real;
                let target = it.speed;
                const front = lane.dir > 0 ? it.x + it.len : it.x;
                const ahead = lane.items[i - 1];
                if (ahead) {
                    const gap = lane.dir > 0 ? ahead.x - front : front - (ahead.x + ahead.len);
                    if (gap < 10)
                        target = 0;
                    else if (gap < 40)
                        target = Math.min(target, ahead.cur * gap / 40 + 2);
                }
                // stop for anybody crossing in front
                if (this.people.some(p => p.state === 'cross' && Math.abs(p.y - lane.y) < 14 && (p.x + 8 - front) * lane.dir > -4 && (p.x + 8 - front) * lane.dir < 34))
                    target = 0;
                it.cur += clamp(target - it.cur, -60 * real, 20 * real);
                it.x += it.cur * lane.dir * real;
                it.dist += it.cur * real;
            }
            lane.items = lane.items.filter(it => it.x > -it.len - 40 && it.x < this.w + 40);
        }
    }

    _updateAnimals(real, env) {
        for (const a of this.animals) {
            a.t += real;
            if (a.kind === 'chicken') {
                // peck about; run off when somebody comes close
                const near = this.people.find(p => Math.abs(p.x + 8 - a.x) < 14 && Math.abs(p.y - a.y) < 8);
                if (near && a.state !== 'flee') {
                    const ob = this._obstacles();
                    for (let i = 0; i < 10; i++) {
                        const tx = clamp(a.x + (a.x > near.x + 8 ? 1 : -1) * rand(20, 40) * (i > 5 ? -1 : 1), 4, this.w - 4);
                        const ty = clamp(a.y + rand(-10, 10), this.stallY + 6, this.squareBot - 2);
                        if (!this._blocking([a.x - 8, a.y], [tx - 8, ty], ob)) {
                            a.state = 'flee';
                            a.tx = tx;
                            a.ty = ty;
                            a.flap = 0.6;
                            break;
                        }
                    }
                }
                a.timer -= real;
                if (a.state === 'peck' && a.timer <= 0) {
                    a.state = 'walk';
                    const ob = this._obstacles();
                    for (let i = 0; i < 10; i++) {
                        a.tx = clamp(a.x + rand(-40, 40), 4, this.w - 4);
                        a.ty = clamp(a.y + rand(-10, 10), this.stallY + 6, this.squareBot - 2);
                        if (!this._blocking([a.x - 8, a.y], [a.tx - 8, a.ty], ob))
                            break;
                        a.tx = a.x;
                        a.ty = a.y;
                    }
                }
                if (a.state !== 'peck') {
                    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), sp = (a.state === 'flee' ? 40 : 10) * real;
                    if (Math.abs(dx) > 0.5)
                        a.dir = dx > 0 ? 1 : -1;
                    if (d <= sp) {
                        a.state = 'peck';
                        a.timer = rand(1, 5);
                    } else {
                        a.x += dx / d * sp;
                        a.y += dy / d * sp;
                    }
                }
                if (a.flap > 0)
                    a.flap -= real;
                if (env.night)
                    a.gone = a.x < -8 || a.x > this.w + 8 || chance(real / 20);
            } else if (a.kind === 'pig') {
                // running about the square, round the stalls and props
                a.life -= real;
                if (!a.route || !a.route.length) {
                    const tx = a.life > 0 ? rand(20, this.w - 20) : (a.x < this.w / 2 ? -30 : this.w + 30);
                    a.route = this._route([a.x - 8, a.y], [tx - 8, rand(this.stallY + 8, this.squareBot - 4)]).map(([x, y]) => [x + 8, y]);
                }
                const [tx, ty] = a.route[0];
                const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), sp = 26 * real;
                if (Math.abs(dx) > 0.5)
                    a.dir = dx > 0 ? 1 : -1;
                if (d <= sp) {
                    a.x = tx;
                    a.y = ty;
                    a.route.shift();
                } else {
                    a.x += dx / d * sp;
                    a.y += dy / d * sp;
                }
                if (a.life < -30 || a.x < -40 || a.x > this.w + 40)
                    a.gone = a.life < 0 || a.gone;
            } else if (a.kind === 'cat') {
                if (!a.dir)
                    a.dir = a.x < 0 ? 1 : -1;
                a.x += a.dir * a.speed * real;
                if (a.x < -20 || a.x > this.w + 20)
                    a.gone = true;
            }
        }
        this.animals = this.animals.filter(a => !a.gone);
        // the farmer gives up once his pigs are gone
        if (!this.animals.some(a => a.kind === 'pig'))
            for (const p of this.people)
                if (p.chaser && p.state === 'go' && p.goal !== 'leave')
                    p.goals = 0, this._nextSquareGoal(p, env);
        for (const p of this.people)
            if (p.chaser && p.state !== 'go') {
                const pig = this.animals.find(a => a.kind === 'pig');
                if (pig) {
                    p.state = 'go';
                    p.goal = 'chase';
                    p.route = this._squareRoute([p.x, p.y], [pig.x - 8, pig.y]);
                }
            } else if (p.chaser && p.goal === 'chase' && Math.random() < real * 2) {
                const pig = this.animals.find(a => a.kind === 'pig');
                if (pig)
                    p.route = this._squareRoute([p.x, p.y], [clamp(pig.x - 8, -20, this.w + 20), pig.y]);
            }
    }

    // the smith at his anvil, the watch at night, guards at the gate
    _updateWork(real, env, cal) {
        const h = env.hour;
        if (this.smithy) {
            const s = this.smithy;
            s.working = !cal.sunday && ((h > 6.5 && h < 12) || (h > 13 && h < 18.5));
            if (s.working) {
                if (!s.smith) {
                    s.smith = makeMedieval(env, {role: 'townsman'});
                    s.smith.carry = 'none';
                    s.smith.lantern = false;
                    s.smith.apron = 0x5a3a24;
                    s.smith.style = 'bald';
                    s.smith.frames = [];
                    s.smith.state = 'idle';
                }
                s.hammerT = (s.hammerT ?? 0) + real;
                const beat = Math.floor(s.hammerT / 0.55);
                if (beat !== s.beat) {
                    s.beat = beat;
                    // a rest every few blows to turn the iron
                    if (beat % 8 < 6 && s.anvil)
                        for (let i = 0; i < 5; i++)
                            this.sparks.push({x: s.anvil[0] + rand(-2, 2), y: s.anvil[1] - 1, vx: rand(-30, 30), vy: rand(-40, -15), life: rand(0.3, 0.6)});
                }
            }
        }
        if (cal.curfew) {
            if (!this.watch) {
                const p = makeMedieval(env, {role: 'watchman'});
                p.lane = 'back';
                p.x = -16;
                p.y = this.backY[1];
                p.dir = 1;
                p.state = 'walk';
                p.speed = 7;
                p.watchman = true;
                this.watch = p;
                this.people.push(p);
            }
            const w = this.watch;
            if (w.call > 0) {
                w.call -= real;
                w.state = 'stand';
                w.face = 'down';
                w.waitT = 0.2;
                w.icon = 'hour';
            } else if (w.icon === 'hour') {
                w.icon = null;
            }
            // back and forth along the street, keeping the lanes
            if (w.x > this.w + 10 || w.x < -30) {
                w.dir = -w.dir;
                w.lane = w.lane === 'back' ? 'front' : 'back';
                w.y = this._laneY(w.lane)[1];
                w.gone = false;
            }
            if (!this.people.includes(w)) {
                w.gone = false;
                this.people.push(w);
            }
        } else if (this.watch) {
            this.watch = null;
        }
        if (this.gate && !this.gate.guards) {
            this.gate.guards = [0, 1].map(() => {
                const g = makeMedieval(env, {role: 'guard'});
                g.state = 'idle';
                return g;
            });
            this.gate.walker = makeMedieval(env, {role: 'guard'});
            this.gate.walker.state = 'walk';
            this.gate.walker.dir = 1;
            this.gate.walker.wx = this.gate.x + 10;
        }
        if (this.gate) {
            const wk = this.gate.walker, G = this.gate;
            wk.t += real;
            wk.wx += wk.dir * 6 * real;
            const left = [G.x + 4, G.towerX - 18], right = [G.towerX + G.towerW + 2, G.x + G.w - 18];
            const span = wk.wx < G.towerX ? left : right;
            if (wk.wx < span[0] || wk.wx > span[1]) {
                wk.dir = -wk.dir;
                wk.wx = clamp(wk.wx, span[0], span[1]);
                if (chance(0.3))
                    wk.wx = wk.wx < G.towerX ? right[0] : left[1];
            }
        }
    }

    _updateFx(real, env, cal) {
        for (const f of this.floaters) {
            f.t += real;
            f.x += (f.vx + env.weather.wind * 4) * real;
            f.y += f.vy * real;
        }
        this.floaters = this.floaters.filter(f => f.t < f.life);
        for (const s of this.sparks) {
            s.x += s.vx * real;
            s.y += s.vy * real;
            s.vy += 90 * real;
            s.life -= real;
        }
        this.sparks = this.sparks.filter(s => s.life > 0);
        // smoke from the chimneys: morning, evening and all winter
        const h = env.hour, fire = env.season === 'winter' || (h > 5 && h < 9.5) || (h > 16.5 && h < 22.5);
        for (const c of this.chimneys) {
            const bake = c.b.shop && c.b.shop.kind === 'baker' && h > 3.5 && h < 11;
            if ((fire || bake || c.b === this.smithy && this.smithy.working) && Math.random() < real * 0.5)
                this.smoke.push({x: c.x + rand(-1, 1), y: c.y, t: 0, life: rand(4, 7)});
        }
        for (const s of this.smoke) {
            s.t += real;
            s.y -= 6 * real;
            s.x += (env.weather.wind * 9 + 1.5) * real;
        }
        this.smoke = this.smoke.filter(s => s.t < s.life);
        if (this.pilloried) {
            const P = this.pilloried;
            P.t -= real;
            P.throwT -= real;
            if (P.throwT <= 0 && P.t > 10) {
                // the crowd throws rotten cabbage and eggs
                P.throwT = rand(1.5, 5);
                const tx = this.pillory.x + 11, ty = this.pillory.y - 30;
                const from = chance(0.5) ? -1 : 1;
                this.floaters.push({kind: 'throw', x: tx + from * rand(40, 70), y: ty + 20, x0: tx + from * rand(40, 70), y0: ty + 24, tx, ty, t: 0, life: 0.9, c: pick([0x7ab048, 0xf0e8d0, 0xd84040])});
            }
            if (P.t <= 0)
                this.pilloried = null;
        }
        for (const f of this.floaters)
            if (f.kind === 'throw' && f.t + real >= f.life)
                this.splats.push({x: f.tx + rand(-6, 6), y: f.ty + rand(-3, 3), c: f.c, life: 6});
        for (const sp of this.splats)
            sp.life -= real;
        this.splats = this.splats.filter(sp => sp.life > 0);
        if (this.petals) {
            this.petals.t -= real;
            if (Math.random() < real * 6)
                this.floaters.push({kind: 'petal', x: this.petals.x + rand(-20, 20), y: this.petals.y - rand(0, 10), vx: rand(-6, 6), vy: rand(6, 12), t: 0, life: 3, c: pick([0xf8a0c0, 0xf8f0f0, 0xf0d050])});
            if (this.petals.t <= 0)
                this.petals = null;
        }
        // maypole dance and the midsummer fire bring their own crowd
        const h2 = env.hour;
        this.dancing = (cal.may && h2 > 10 && h2 < 18 && env.weather.v.rain < 0.3 && this.maypole) ? 'maypole'
            : (this.bonfire && (h2 > 20.5 || h2 < 0.5)) ? 'bonfire' : null;
        if (this.dancing && !this.dancers) {
            this.dancers = [];
            const n = this.dancing === 'maypole' ? 6 : 8;
            for (let i = 0; i < n; i++) {
                const p = makeMedieval(env, {role: this.dancing === 'maypole' ? pick(['kid', 'townswoman', 'kid']) : pick(['townsman', 'townswoman', 'peasant'])});
                p.carry = 'none';
                p.lantern = false;
                p.state = 'walk';
                p.a = i / n * Math.PI * 2;
                p.ribbon = [0xd84848, 0x3a6aa8, 0xf0d040, 0x4a9a3a, 0xf4ecdc, 0xd88ab0][i % 6];
                this.dancers.push(p);
            }
        } else if (!this.dancing) {
            this.dancers = null;
        }
        if (this.dancers) {
            const c = this.dancing === 'maypole' ? this.maypole : this.bonfire;
            for (const p of this.dancers) {
                p.t += real;
                p.a += real * (this.dancing === 'maypole' ? 0.5 : 0.35);
                p.x = c.x + Math.cos(p.a) * (this.dancing === 'maypole' ? 30 : 38) - 8;
                p.y = c.y + Math.sin(p.a) * 9;
                p.dir = Math.sin(p.a) > 0 ? -1 : 1;
            }
            if (this.dancing === 'bonfire' && Math.random() < real * 8)
                this.sparks.push({x: c.x + rand(-6, 6), y: c.y - 24, vx: rand(-10, 10) + env.weather.wind * 8, vy: rand(-50, -25), life: rand(0.8, 1.6), fire: true});
        }
    }

    // ---------- rendering ----------

    renderDynamic(g, env) {
        const t = this.realT;
        this._renderFar(g, env);
        if (this.gate)
            this._renderGate(g, env);
        for (const w of this.windows)
            w.render(g, env);
        A.drawTufts(g, this.weeds, env.weather.snowCover > 0.3 ? 'winter' : env.season === 'summer' ? 'autumn' : env.season, env.weather);
        if (this.church)
            this._renderChurch(g, env);
        if (this.smithy)
            this._renderSmithy(g, env);
        for (const s of this.smoke) {
            const a = 0.42 * (1 - s.t / s.life), rr = 2 + Math.floor(s.t * 1.3);
            g.blend(s.x - rr / 2, s.y - rr / 2, rr, rr, 0xd8d4d0, a);
        }
        this._renderLaundry(g, env);
        for (const sg of this.signs)
            this._renderSign(g, sg, env);
        for (const d of this.doors) {
            if (d.open > 0 && !d.gate)
                g.rectE(d.x + 1, d.y + 2, d.w - 2, d.h - 2, env.dark > 0.4 ? 0xffc870 : 0x2a1e18);
        }
        this._renderTorches(g, env);
        // street: walks and road in depth order
        const street = [];
        for (const p of this.people)
            if (p.lane !== 'square')
                street.push([p.y, 0, p]);
        this.lanes.forEach(l => l.items.forEach(it => street.push([l.y, 1, it])));
        for (const a of this.animals)
            if (a.kind === 'cat')
                street.push([a.y, 2, a]);
        if (this.gate) {
            const G = this.gate, cal = this.cal;
            if (cal.gateOpen)
                G.guards.forEach((gd, i) => {
                    gd.x = i ? G.towerX + G.towerW - 4 : G.towerX - 12;
                    gd.y = this.base + 6;
                    gd.face = 'down';
                    gd.lantern = env.dark > 0.5;
                    street.push([gd.y, 0, gd]);
                });
        }
        street.sort((a, b) => a[0] - b[0]);
        for (const [y, kind, o] of street) {
            if (kind === 0)
                this._renderPerson(g, o, env);
            else if (kind === 1)
                this._renderTraffic(g, o, y, env);
            else
                drawFigure(g, catFigure(o.cat, Math.floor(o.t * 8) % 2 ? 'walk1' : 'walk2'), o.x, o.y, o.dir < 0);
        }
        // the market square
        const sq = [];
        for (const s of this.sprites) {
            sq.push([s.y, 'sprite', s]);
            if (s.stall) {
                const st = s.stall;
                if (!st.vendor) {
                    st.vendor = makeMedieval(env, {role: pick(['peasant', 'townswoman', 'merchant', 'townswoman'])});
                    st.vendor.carry = 'none';
                    st.vendor.lantern = false;
                    st.vendor.state = 'idle';
                    st.vendor.face = 'down';
                }
                st.vendor.x = st.x + st.w / 2 - 8;
                st.vendor.y = this.stallY - 9;
                sq.push([st.vendor.y, 'person', st.vendor]);
            }
        }
        for (const p of this.people)
            if (p.lane === 'square')
                sq.push([p.y, 'person', p]);
        for (const a of this.animals)
            if (a.kind !== 'cat')
                sq.push([a.y, 'animal', a]);
        if (this.dancers)
            for (const p of this.dancers)
                sq.push([p.y, 'person', p]);
        if (this.maypole && this.dancers && this.dancing === 'maypole')
            sq.push([this.maypole.y + 0.1, 'ribbons', null]);
        if (this.bonfire && this.dancing === 'bonfire')
            sq.push([this.bonfire.y + 0.1, 'fire', null]);
        if (this.pilloried)
            sq.push([this.pillory.y + 0.5, 'pilloried', this.pilloried.p]);
        sq.sort((a, b) => a[0] - b[0]);
        for (const [, kind, o] of sq) {
            if (kind === 'sprite') {
                const lean = o.tree ? A.leanOffsets(o.sp, env.weather.lean(o.tree.x)) : null;
                g.drawSprite(o.sp, lean);
            } else if (kind === 'person') {
                this._renderPerson(g, o, env);
            } else if (kind === 'animal') {
                this._renderAnimal(g, o);
            } else if (kind === 'ribbons') {
                const [mx, my] = this.maypole.top;
                for (const p of this.dancers)
                    g.line(mx, my, Math.round(p.x + 8), Math.round(p.y - 18), p.ribbon);
            } else if (kind === 'fire') {
                this._renderFire(g, this.bonfire, env);
            } else if (kind === 'pilloried') {
                o.face = 'down';
                o.state = 'idle';
                // head and hands through the boards
                const P = this.pillory;
                drawPerson(g, o, P.x + 4, P.y - 1, 1, env, 'down');
                this._pilloryBoards(g, P, true);
                g.rect(P.x - 1, P.y - 27, 3, 3, o.skin);
                g.rect(P.x + 20, P.y - 27, 3, 3, o.skin);
            }
        }
        for (const sp of this.splats)
            g.rect(sp.x - 1, sp.y - 1, 3, 2, sp.c);
        for (const f of this.floaters)
            this._renderFloater(g, f);
        for (const s of this.sparks) {
            g.pxE(s.x, s.y, s.fire ? 0xffc050 : 0xfff0a0);
            if (s.fire)
                g.glow(s.x, s.y, 3, 0xff9030, 0.3);
        }
        A.drawTufts(g, this.tufts, env.weather.snowCover > 0.3 ? 'winter' : env.season, env.weather);
    }

    _renderPerson(g, p, env) {
        const st = p.state;
        // standing about shows the standing frame
        if (st === 'busy' || st === 'stand' || st === 'chat')
            p.state = p.sitting ? 'sit' : 'idle';
        drawPerson(g, p, p.x, p.y, p.dir, env, p.face || 'side');
        p.state = st;
        if (p.wreath) {
            for (let i = 0; i < 9; i += 2)
                g.px(p.x + 3 + i, p.y - 33, [0xf0d050, 0xf8a0c0, 0xf8f0f0][i % 3]);
        }
        if (p.role === 'juggler' && st === 'busy') {
            // three balls in a cascade over the hands
            for (let i = 0; i < 3; i++) {
                const a = this.realT * 4.5 + i * 2.1;
                const bx = Math.round(p.x + 8 + Math.cos(a) * 8), by = Math.round(p.y - 34 - Math.abs(Math.sin(a)) * 18);
                g.rect(bx - 2, by - 2, 5, 5, INK);
                g.rect(bx - 1, by - 1, 3, 3, [0xd84848, 0xf0d040, 0x3a6ac8][i]);
                g.px(bx - 1, by - 1, 0xffffff);
            }
        }
        const icon = p.chat && st === 'chat' ? p.icon : p.icon;
        if (icon && (st === 'chat' || st === 'busy' || st === 'stand' || icon === 'hour') && Math.floor(p.t * 1.2) % 3 !== 0)
            this._bubble(g, p.x + 6, p.y - 44, icon, env);
    }

    _bubble(g, x, y, icon, env) {
        x = Math.floor(x);
        y = Math.floor(y);
        let w = 11;
        let txt = null;
        if (icon === 'hour') {
            txt = ROMAN[Math.floor(env.hour) % 12];
            w = txt.length * 4 + 5;
        }
        g.rect(x - 1, y - 1, w + 2, 11, INK);
        g.rect(x, y, w, 9, 0xf8f4ec);
        g.rect(x + 2, y + 10, 2, 2, INK);
        g.px(x + 2, y + 9, 0xf8f4ec);
        const cx = x + 5;
        switch (icon) {
        case 'hour':
            g.text(txt, x + 3, y + 2, 0x3a2a4a);
            break;
        case 'coin':
            g.disc(cx, y + 4, 3, 0xc89a20);
            g.disc(cx, y + 4, 2, 0xf0c840);
            break;
        case 'heart':
            g.rect(cx - 3, y + 2, 2, 2, 0xe04060);
            g.rect(cx + 1, y + 2, 2, 2, 0xe04060);
            g.rect(cx - 3, y + 3, 6, 2, 0xe04060);
            g.rect(cx - 2, y + 5, 4, 1, 0xe04060);
            g.px(cx - 1, y + 6, 0xe04060);
            break;
        case 'bread':
            g.rect(cx - 3, y + 3, 7, 3, 0xd8983a);
            g.rect(cx - 2, y + 3, 5, 1, 0xf0c060);
            break;
        case 'rain':
            for (let i = 0; i < 3; i++)
                g.rect(cx - 3 + i * 3, y + 2 + (i % 2) * 2, 1, 2, 0x4a8ad0);
            break;
        case 'sun':
            g.disc(cx, y + 4, 2, 0xf0c030);
            break;
        case 'news':
            g.rect(cx - 3, y + 2, 7, 5, 0xf0e4c0);
            g.rect(cx - 2, y + 3, 5, 1, 0x8a7a6a);
            g.rect(cx - 2, y + 5, 4, 1, 0x8a7a6a);
            break;
        case 'note':
            g.rect(cx, y + 1, 1, 5, 0x3a2a4a);
            g.rect(cx - 2, y + 5, 3, 2, 0x3a2a4a);
            g.rect(cx + 1, y + 1, 2, 1, 0x3a2a4a);
            break;
        }
    }

    _renderAnimal(g, a) {
        if (a.kind === 'chicken') {
            const f = animalFigure('chicken', a.c, 0, a.state === 'peck' && Math.floor(a.t * 3) % 2 ? 'graze' : 'walk1');
            g.footShadow(a.x, a.y, f.w - 2, 0.25);
            drawFigure(g, f, a.x - f.w / 2, a.y - (a.flap > 0 ? 3 : 0), a.dir < 0);
            return;
        }
        if (a.kind === 'pig') {
            const f = BEAST.pig(a, Math.floor(a.t * 8));
            g.footShadow(a.x, a.y, f.w - 2, 0.25);
            drawFigure(g, f, a.x - f.w / 2, a.y, a.dir < 0);
        }
    }

    _renderTraffic(g, it, y, env) {
        const flip = it.dir < 0, fr = Math.floor(it.dist / 5);
        if (it.kind === 'cart') {
            const bf = BEAST[it.beast.k](it.beast, fr), bw = bf.w;
            const cartX = flip ? it.x + bw + 8 : it.x, beastX = flip ? it.x : it.x + it.cartLen + 8;
            g.footShadow(beastX + bw / 2, y, bw - 4, 0.3);
            g.footShadow(cartX + it.cartLen / 2, y, it.cartLen, 0.3);
            drawFigure(g, bf, beastX, y, flip);
            // the driver on the front of the cart
            const pf = personFigure(it.driver, 'sit');
            const dx = flip ? cartX + 2 : cartX + it.cartLen - pf.w - 2;
            drawFigure(g, pf, dx, y - 13, flip);
            drawCart(g, cartX, y, it.cartLen, it.load, it.dist, flip);
        } else if (it.kind === 'rider') {
            const bf = BEAST.horse(it.beast, fr), bw = bf.w;
            if (it.follower) {
                const f = it.follower;
                f.t = it.t;
                f.state = it.cur > 1 ? 'walk' : 'idle';
                drawPerson(g, f, flip ? it.x + bw + 6 : it.x - 22, y + 2, it.dir, env);
            }
            g.footShadow(it.x + bw / 2, y, bw - 4, 0.3);
            drawFigure(g, bf, it.x, y, flip);
            const r = it.rider;
            r.state = 'idle';
            r.t = it.t;
            const pf = personFigure(r, 0);
            const rx = flip ? it.x + bw - 13 - pf.w : it.x + 11;
            drawPerson(g, r, rx, y - 12, it.dir, env);
        } else if (it.kind === 'donkey') {
            const bf = BEAST.donkey(it.beast, fr), bw = bf.w;
            const dX = flip ? it.x + 20 : it.x;
            const w = it.walker;
            w.t = it.t;
            w.state = it.cur > 1 ? 'walk' : 'idle';
            drawPerson(g, w, flip ? it.x : it.x + bw + 2, y + 2, it.dir, env);
            g.footShadow(dX + bw / 2, y, bw - 4, 0.3);
            drawFigure(g, bf, dX, y, flip);
            g.line(flip ? dX + 2 : dX + bw - 3, y - 18, flip ? it.x + 12 : it.x + bw + 6, y - 14, 0x6a4a2a);
        } else if (it.kind === 'herd' || it.kind === 'geese') {
            const lead = it.dir > 0 ? it.x + it.len : it.x;
            const flock = [...it.flock].sort((a, b) => a.dy - b.dy);
            for (const f of flock) {
                const fx = lead - it.dir * (f.dx + 12), fy = y + f.dy;
                const fig = BEAST[it.beast.k](it.beast, Math.floor(it.dist / 4 + f.ph));
                g.footShadow(fx, fy, fig.w - 4, 0.25);
                drawFigure(g, fig, fx - fig.w / 2, fy, flip);
            }
            const s = it.shepherd;
            s.t = it.t;
            drawPerson(g, s, it.dir > 0 ? it.x : it.x + it.len - 16, y + 3, it.dir, env);
            if (it.dog)
                drawFigure(g, dogFigure(it.dog, Math.floor(it.t * 6)), it.dir > 0 ? it.x + 14 : it.x + it.len - 30, y + 5, flip);
        }
    }

    _renderFar(g, env) {
        const dim = mix(0x6a5a4a, env.skyBottom, 0.3), sail = mix(0xe8dcc0, env.skyBottom, 0.3);
        const L = this.layerA, F = this.farSnap, W = this.w;
        const far = (x, y) => {
            x = Math.round(x);
            y = Math.round(y);
            return x >= 0 && y >= 0 && x < W && y < this.h && L[y * W + x] === F[y * W + x];
        };
        if (this.mill && this.mill.hub) {
            const [hx, hy] = this.mill.hub;
            this.mill.a += 0.004 * (0.4 + Math.abs(env.weather.lean(hx)));
            for (let k = 0; k < 4; k++) {
                const a = this.mill.a + k * Math.PI / 2;
                for (let i = 2; i < 12; i++) {
                    const x = hx + Math.cos(a) * i, y = hy + Math.sin(a) * i;
                    if (far(x, y))
                        g.px(Math.round(x), Math.round(y), i > 4 ? sail : dim);
                }
            }
        }
        // pennants on the castle towers
        const flag = mix(0xc83030, env.skyBottom, 0.35);
        for (const [fx, fy] of this.castleFlags || []) {
            const lean = env.weather.lean(fx), dir = lean < 0 ? -1 : 1, len = 4 + Math.min(3, Math.round(Math.abs(lean) * 2));
            for (let i = 1; i <= len; i++) {
                const x = fx + dir * i, y = fy + Math.round(Math.sin(this.realT * 5 + i) * 0.6);
                if (far(x, y))
                    g.rect(x, y, 1, i > len - 2 ? 1 : 2, flag);
            }
        }
    }

    _renderGate(g, env) {
        const G = this.gate, [ax, ay, aw, ah] = G.arch;
        // portcullis: bars come down from the top of the arch
        const bottom = ay + Math.round(ah * (1 - G.open));
        if (bottom > ay + 2) {
            for (let x = ax + 2; x < ax + aw - 1; x += 4)
                g.rect(x, ay, 1, bottom - ay, 0x2a2428);
            for (let yy = ay + 3; yy < bottom; yy += 5)
                g.rect(ax, yy, aw, 1, 0x2a2428);
            for (let x = ax + 2; x < ax + aw - 1; x += 4)
                g.px(x, bottom, 0x8a8a92);
        }
        // the town banner on the gate tower
        const [fx, fy] = G.flag, lean = env.weather.lean(fx), dir = lean < 0 ? -1 : 1;
        for (let i = 1; i <= 12; i++) {
            const wave = Math.round(Math.sin(this.realT * 4 + i * 0.7) * Math.min(2, Math.abs(lean) + 0.4));
            g.rect(fx + dir * i, fy + 1 + wave, 1, 7, i === 12 ? INK : i % 4 < 2 ? 0x9a2a2a : 0xf0c030);
        }
        // a guard paces the wall walk behind the battlements
        const wk = G.walker;
        wk.state = 'walk';
        drawPerson(g, wk, wk.wx, G.walkY + 10, wk.dir, env);
        // the wall face hides him up to the walk, the merlons above it;
        // in the gaps between them he stays in view
        const wt = G.walkY + 1;
        this._restore(g, wk.wx - 4, wt - 1, 26, 13);
        for (let x = Math.floor(wk.wx) - 4; x < wk.wx + 22; x++)
            if (x >= G.x && (x - G.x) % 12 < 8)
                this._restore(g, x, wt - 9, 1, 8);
        if (env.dark > 0.5 && !this.cal.gateOpen) {
            // a guard with a lantern at the shut gate
            const gd = G.guards[0];
            gd.lantern = true;
            gd.face = 'down';
            gd.state = 'idle';
            drawPerson(g, gd, G.towerX - 12, this.base + 6, 1, env, 'down');
        }
    }

    // copy the static scene back over a box (where it is opaque)
    _restore(g, x, y, w, h) {
        const lit = g.litBuffer(this.layerA), W = this.w, t = g.t;
        for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(this.h, y + h); yy++)
            for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(W, x + w); xx++) {
                const v = lit[yy * W + xx];
                if (v)
                    t[yy * W + xx] = v;
            }
    }

    _churchService(env) {
        const h = env.hour, cal = this.cal;
        return (cal.sunday && h > 9.4 && h < 11) || (env.holidays.christmasEve && h > 23) || (env.dark > 0.5 && h > 17.5 && h < 19 && cal.day % 3 === 0);
    }

    _renderChurch(g, env) {
        const c = this.church, lit = this._churchService(env);
        const glass = [0xd83838, 0x3a5ad8, 0xf0c030, 0x3a9a4a, 0xa040c0];
        const pane = (x, y, k) => {
            const col = glass[k % glass.length];
            if (lit)
                g.rectE(x, y, 2, 2, highlight(col, 0.25));
            else
                g.rect(x, y, 2, 2, shadow(col, 0.45));
        };
        for (const [lx, ly] of c.lancets) {
            for (let yy = 0; yy < 30; yy += 3)
                for (let xx = 0; xx < 8; xx += 3)
                    pane(lx + xx, ly + yy, xx + yy + (yy > 12 ? 1 : 0));
            if (lit)
                g.glow(lx + 4, ly + 15, 16, 0xffd090, 0.25, 1.6);
        }
        const [rx, ry] = c.rose;
        for (let yy = -10; yy <= 10; yy += 3)
            for (let xx = -10; xx <= 10; xx += 3)
                if (xx * xx + yy * yy <= 100)
                    pane(rx + xx - 1, ry + yy - 1, Math.round(Math.atan2(yy, xx) * 2 + 7));
        if (lit)
            g.glow(rx, ry, 18, 0xffd8a0, 0.3);
        // the bell swinging in the belfry
        const [bx, by] = c.bellAt, sw = this.bell.swing || 0;
        g.rect(bx - 8, by - 2, 17, 2, 0x4a3426);
        const off = Math.round(sw * 3);
        for (let i = 0; i < 9; i++) {
            const half = 2 + Math.round(i * 0.45), o = Math.round(off * i / 8);
            g.rect(bx - half + o, by + i, half * 2 + 1, 1, i === 0 ? 0xa87a2a : i > 6 ? 0x9a6a20 : 0xd8a840);
            g.px(bx - half + o, by + i, 0x6a4a1a);
        }
        g.rect(bx - 1 + off, by + 9, 3, 2, 0x6a4a1a);
        // one-handed clock, the hand points at the hour
        const [cx, cy] = c.clock, a = (env.hour % 12) / 12 * Math.PI * 2;
        g.line(cx, cy, Math.round(cx + Math.sin(a) * 6), Math.round(cy - Math.cos(a) * 6), 0xf0c040);
        g.px(cx, cy, 0xf0c040);
        // weathercock turns its tail to the wind
        const [vx, vy] = c.vane, dir = env.weather.wind < 0 ? -1 : 1;
        g.rect(vx - 5, vy - 3, 11, 1, 0x3a3436);
        const X = i => vx + dir * i;
        g.rect(Math.min(X(-1), X(3)), vy - 8, 5, 4, 0x2a2428);
        g.px(X(4), vy - 9, 0x2a2428);
        g.px(X(4), vy - 7, 0xd04030);
        g.rect(Math.min(X(-3), X(-2)), vy - 10, 2, 5, 0x2a2428);
        // a stork in its nest in spring and summer
        if (c.stork && (env.season === 'spring' || env.season === 'summer') && env.dark < 0.7) {
            const [sx, sy] = c.gableTop, clatter = Math.floor(this.realT / 7) % 5 === 0;
            g.rect(sx - 4, sy - 13, 8, 7, INK);
            g.rect(sx - 3, sy - 12, 6, 5, 0xf4f0e8);
            g.rect(sx - 3, sy - 9, 3, 2, 0x2a2428);
            g.rect(sx + 2, sy - 18, 2, 6, 0xf4f0e8);
            g.px(sx + 2, sy - 17, INK);
            if (clatter)
                g.rect(sx + 3, sy - 23, 1, 5, 0xe04a2a);
            else
                g.rect(sx + 4, sy - 17, 5, 1, 0xe04a2a);
        }
    }

    _renderSmithy(g, env) {
        const s = this.smithy;
        if (!s.hearth)
            return;
        const [hx, hy] = s.hearth;
        const fire = s.working || (env.hour > 6 && env.hour < 20 && !this.cal.sunday);
        if (fire) {
            const fl = Math.sin(this.realT * 9) * Math.sin(this.realT * 3.3);
            g.rectE(hx - 6, hy - 2, 12, 3, 0xff7020);
            g.rectE(hx - 4, hy - 3 - Math.round(fl), 8, 2, 0xffb040);
            g.rectE(hx - 1, hy - 5 - Math.round(fl * 1.5), 3, 2, 0xffe080);
            g.glow(hx, hy - 2, 22, 0xff8030, 0.35 + fl * 0.05);
        }
        if (s.working && s.smith && s.anvil) {
            const [ax, ay] = s.anvil, sm = s.smith;
            sm.state = 'idle';
            const px = ax - 22;
            drawPerson(g, sm, px, this.base - 1, 1, env);
            // the hammer goes up and comes down on the anvil
            const ph = (s.hammerT % 0.55) / 0.55, up = s.beat % 8 >= 6 ? 0.2 : ph < 0.6 ? ph / 0.6 : 1 - (ph - 0.6) / 0.4;
            const sx = px + 11, sy = this.base - 21;
            const hxx = Math.round(sx + 6 - up * 2), hyy = Math.round(ay - 2 - up * 12);
            g.line(sx, sy, hxx, hyy, 0x6a4a2a);
            g.rect(hxx - 1, hyy - 2, 4, 3, 0x4a4a52);
            if (s.beat % 8 < 6)
                g.rectE(ax - 3, ay - 2, 6, 1, up < 0.15 ? 0xffe0a0 : 0xff8a30);
        }
    }

    _renderSign(g, sg, env) {
        // an iron arm with the guild sign hanging from it, swinging in the wind
        const arm = 14, ax = sg.x, ay = sg.y, ex = ax + sg.dir * arm;
        g.rect(Math.min(ax, ex), ay, arm, 1, 0x2a2428);
        g.line(ax, ay + 6, Math.round(ax + sg.dir * arm * 0.6), ay, 0x2a2428);
        const lean = env.weather.lean(ax);
        const ang = clamp(-lean * 0.25 + Math.sin(this.realT * 1.6 + ax) * 0.06 * (0.3 + Math.abs(lean)), -0.45, 0.45);
        const f = cached('sign:' + sg.kind, () => buildSign(sg.kind));
        const bx = ex - Math.floor(f.w / 2);
        g.px(ex, ay + 1, 0x2a2428);
        g.px(ex, ay + 2, 0x2a2428);
        const pts = f.pts;
        for (let i = 0; i < pts.length; i += 3) {
            const yy = pts[i + 1];
            g.px(bx + pts[i] + Math.round(Math.sin(ang) * yy), ay + 3 + yy, pts[i + 2]);
        }
    }

    _renderLaundry(g, env) {
        for (const L of this.laundry) {
            const sag = 6, n = L.x2 - L.x1;
            for (let i = 0; i <= n; i++)
                g.px(L.x1 + i, Math.round(L.y + Math.sin(i / n * Math.PI) * sag), 0x5a4a3a);
            L.items.forEach((it, k) => {
                const t = (k + 1) / (L.items.length + 1), x = Math.round(L.x1 + n * t - it.w / 2);
                const y = Math.round(L.y + Math.sin(t * Math.PI) * sag);
                const lean = env.weather.lean(x);
                for (let r = 0; r < it.h; r++) {
                    const o = Math.round(lean * r * 0.35 + Math.sin(this.realT * 4 + k + r * 0.4) * 0.4 * Math.abs(lean) * r / it.h);
                    g.rect(x + o, y + r, it.w, 1, r === 0 ? shadow(it.c, 0.2) : it.c);
                    g.px(x + o - 1, y + r, INK);
                    g.px(x + o + it.w, y + r, INK);
                }
                g.rect(x + Math.round(lean * it.h * 0.35), y + it.h, it.w, 1, INK);
            });
        }
    }

    _renderTorches(g, env) {
        const on = env.lampsOn && env.weather.v.rain < 1.2;
        for (const tc of this.torches) {
            g.rect(tc.x, tc.y, 2, 8, 0x4a3426);
            g.rect(tc.x - 1, tc.y + 6, 4, 1, 0x2a2428);
            if (!on)
                continue;
            const fl = Math.floor(this.realT * 10 + tc.x) % 3;
            g.rectE(tc.x - 1, tc.y - 3, 4, 3, 0xff8a30);
            g.rectE(tc.x, tc.y - 5 - (fl === 2 ? 1 : 0), 2, 2, 0xffd060);
            g.glow(tc.x + 1, tc.y - 2, 20, 0xff9a40, 0.3 + fl * 0.02);
        }
    }

    _renderFire(g, f, env) {
        const t = this.realT, x = f.x, y = f.y - 4;
        for (let i = 0; i < 7; i++) {
            const h = 14 + Math.round(Math.sin(t * 7 + i * 1.7) * 5) + (i > 1 && i < 5 ? 8 : 0);
            const fx = x - 12 + i * 4;
            g.rectE(fx, y - h, 4, h, 0xff6a20);
            g.rectE(fx + 1, y - h + 3, 2, h - 3, 0xffb040);
            if (i > 1 && i < 5)
                g.rectE(fx + 1, y - h + 7, 2, h - 9, 0xffe8a0);
        }
        g.glow(x, y - 12, 60, 0xff8a30, 0.35);
    }

    _renderFloater(g, f) {
        const a = 1 - f.t / f.life;
        switch (f.kind) {
        case 'note': {
            const x = Math.round(f.x), y = Math.round(f.y);
            g.blend(x, y, 1, 4, f.c, a);
            g.blend(x - 2, y + 3, 2, 2, f.c, a);
            g.blend(x + 1, y, 2, 1, f.c, a);
            break;
        }
        case 'hic':
            g.text('HIC', Math.round(f.x), Math.round(f.y), 0xf0e0c0);
            break;
        case 'petal':
            g.px(f.x, f.y, f.c);
            break;
        case 'throw': {
            const k = f.t / f.life, x = f.x0 + (f.tx - f.x0) * k, y = f.y0 + (f.ty - f.y0) * k - Math.sin(k * Math.PI) * 18;
            g.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 3, INK);
            g.px(Math.round(x), Math.round(y), f.c);
            break;
        }
        }
    }
}
