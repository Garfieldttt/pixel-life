// Village motif, top-down like a cozy farm game: a cliff with forest at the top,
// houses below it, a main road, a plaza with fountain and market, gardens,
// and a lake with a pier at the bottom. Villagers follow small routines.
import {rand, randi, chance, pick, weighted, clamp, treeSize} from './util.js';
import {mix} from './gfx.js';
import * as A from './art.js';
import * as O from './objects.js';
import {World, TILE, T} from './world.js';
import {bushClump, WATER} from './terrain.js';
import {Household, Win} from './windows.js';
import {makePerson, drawPerson, personFigure, makeCat, catFigure, makeDog, dogFigure} from './people.js';
import {drawFigure} from './figure.js';

const INK = A.INK;
const WALLS = {planks: [0x4a7ac0, 0x5aa070, 0xc85a4a, 0xe8c070, 0x8a6ab0, 0x60a8b0], stone: [0x9a8a6a, 0x8a8a8a, 0xa89878], brick: [0xb0583e, 0x984a38], siding: [0xf0e0b8, 0xb8d0e8, 0xe8b8a8, 0xc8e0b0]};
const ROOFS = [0x8a3a6a, 0x7a4a2a, 0x3a6a8a, 0xa84838, 0x4a7a4a, 0x6a4a8a, 0x5a3a2a];
const STALL_GOODS = [
    {c: 0xd84848, goods: [0xe83030, 0xf0a020, 0x7ac040, 0xf0e050]},
    {c: 0x4c7cd0, goods: [0xc8a060, 0xe8c070, 0xb07040]},
    {c: 0x5cae5c, goods: [0xe84860, 0xf8d048, 0xf0f0f0, 0xb860d8]},
    {c: 0xe8a640, goods: [0x8ab8d8, 0xd8d0c8, 0xb8a080]},
];

export class Village extends World {
    constructor(w, h, env) {
        super(w, h);
        this.name = 'village';
        this.walkers = [];
        this.critters = [];
        this.fx = [];
        this.smoke = [];
        this.wins = [];
        this.lamps = [];
        this.fires = [];
        this.doors = [];
        this.benches = [];
        this.stalls = [];
        this.eventTimer = rand(30, 90);
        this.generate(env);
    }

    staticKey(env) {
        return [Math.round(env.weather.snowCover * 3), env.season].join(':');
    }

    // ---------- map ----------

    generate(env) {
        const C = this.cols, R = this.rows, ter = this.terrain;
        const ch = R >= 26 ? 3 : 2;
        this.ch = ch;
        ter.rect(0, 0, C, ch, T.HIGH);
        ter.rect(0, ch, C, 2, T.CLIFF);
        const stairs = [randi(3, Math.floor(C / 3)), randi(Math.floor(C * 0.66), C - 5)];
        for (const sx of stairs) {
            ter.rect(sx, ch, 2, 2, T.STAIRS);
            ter.rect(sx, 0, 2, ch, T.PATH);
        }
        this.stairs = stairs;
        const houseTop = ch + 2, houseBase = ch + 9;
        const mainY = ch + 11;
        this.mainY = mainY;
        ter.rect(0, mainY, C, 2, T.PATH);
        // lake along the bottom with an organic shoreline (per pixel)
        const waterRows = R >= 26 ? 6 : 4;
        const ph1 = rand(6.28), ph2 = rand(6.28);
        const base = (R - waterRows) * TILE + 6;
        this.shore = new Float32Array(this.w + 1);
        for (let x = 0; x <= this.w; x++)
            this.shore[x] = base + Math.sin(x * 0.018 + ph1) * 12 + Math.sin(x * 0.061 + ph2) * 5 + Math.sin(x * 0.17) * 1.5;
        this.waterTop = [];
        for (let x = 0; x < C; x++) {
            const sy = this.shore[Math.min(this.w, x * TILE + 8)];
            const top = Math.ceil((sy + 2) / TILE);
            this.waterTop[x] = top;
            ter.rect(x, top, 1, R - top, T.WATER);
            if (Math.floor(sy / TILE) < top)
                ter.rect(x, Math.floor(sy / TILE), 1, 1, T.SAND);
        }
        // wavy cliff edges
        this.cliffTop = new Float32Array(this.w + 1);
        this.cliffBot = new Float32Array(this.w + 1);
        const c1 = rand(6.28);
        for (let x = 0; x <= this.w; x++) {
            this.cliffTop[x] = ch * TILE + 2 + Math.sin(x * 0.05 + c1) * 2.5 + Math.sin(x * 0.13) * 1.2;
            this.cliffBot[x] = (ch + 2) * TILE - 3 + Math.sin(x * 0.04 + c1 * 2) * 3;
        }
        // plaza
        const pw = 10, ph = Math.min(5, R - waterRows - mainY - 4);
        const px = clamp(Math.round(C / 2 - pw / 2 + rand(-4, 4)), 2, C - pw - 2), py = mainY + 2;
        ter.rect(px, py, pw, ph, T.PLAZA);
        this.plaza = {x: px, y: py, w: pw, h: ph};
        // pier with a path from the plaza
        const pierX = clamp(randi(Math.floor(C * 0.55), Math.floor(C * 0.8)), px + pw + 2, C - 4);
        const wt = Math.max(this.waterTop[pierX], this.waterTop[pierX + 1]);
        // the bend runs along the beach, above the wavy water line everywhere
        const bx1 = Math.min(px + pw - 2, pierX), bx2 = Math.max(px + pw - 2, pierX) + 2;
        let dry = Infinity;
        for (let x = bx1 * TILE - 4; x <= bx2 * TILE + 4; x++)
            dry = Math.min(dry, this.shore[clamp(x, 0, this.w)]);
        const bendY = Math.min(wt - 2, Math.floor((dry - 16) / TILE) - 1);
        for (let y = py + ph; y < bendY; y++)
            ter.rect(px + pw - 2, y, 2, 1, T.PATH);
        ter.rect(bx1, bendY, bx2 - bx1, 2, T.PATH);
        ter.rect(pierX, bendY, 2, wt - bendY, T.PATH);
        const pierLen = Math.min(waterRows - 1, 4);
        ter.rect(pierX, wt, 2, pierLen, T.DECK);
        this.pier = {x: pierX, y: wt, len: pierLen};
        // where the way down meets the water the pier reaches up the beach
        let pierWet = Infinity;
        for (let x = pierX * TILE - 4; x <= (pierX + 2) * TILE + 4; x++)
            pierWet = Math.min(pierWet, this.shore[clamp(x, 0, this.w)]);
        for (let y = bendY + 2; y < wt; y++)
            if (y * TILE + 15 >= pierWet)
                ter.rect(pierX, y, 2, 1, T.DECK);
        // the shoreline is wavy per pixel: no walking on tiles where the
        // feet (y + 12) or the way to the next tile would be in the water
        for (let x = 0; x < C; x++) {
            let wet = Infinity;
            for (let px = Math.max(0, x * TILE - 4); px <= Math.min(this.w, x * TILE + 20); px++)
                wet = Math.min(wet, this.shore[px]);
            for (let y = Math.floor((wet - 16) / TILE); y < this.waterTop[x]; y++)
                if (y >= 0 && y * TILE + 15 >= wet && ter.get(x, y) !== T.DECK)
                    this.blocked[y * C + x] = 1;
        }
        // ---- objects ----
        const used = this._used = new Uint8Array(C * R);
        const mark = (x, y, w, h) => {
            for (let yy = y; yy < y + h; yy++)
                for (let xx = x; xx < x + w; xx++)
                    if (xx >= 0 && yy >= 0 && xx < C && yy < R)
                        used[yy * C + xx] = 1;
        };
        const isFree = (x, y, w = 1, h = 1, kinds = [T.GRASS]) => {
            for (let yy = y; yy < y + h; yy++)
                for (let xx = x; xx < x + w; xx++)
                    if (xx < 0 || yy < 0 || xx >= C || yy >= R || used[yy * C + xx] || !kinds.includes(ter.get(xx, yy)))
                        return false;
            return true;
        };
        mark(0, mainY, C, 2);
        mark(px, py, pw, ph);
        // houses under the cliff
        let hx = randi(1, 3);
        while (hx < C - 6) {
            const wT = randi(7, 9);
            if (stairs.some(s => s + 2 > hx - 1 && s < hx + wT + 1)) {
                hx += 2;
                continue;
            }
            if (hx + wT > C - 1)
                break;
            this._house(hx, houseTop, wT, houseBase, mainY, env);
            mark(hx - 1, houseTop, wT + 2, mainY - houseTop);
            hx += wT + randi(2, 4);
        }
        for (const sx of stairs)
            mark(sx - 1, 0, 4, mainY);
        // forest on the high ground
        // forest on the high ground, sized like the trees in the country
        for (let i = 0; i < C * ch * 0.45; i++) {
            const x = randi(-1, C), ty = randi(0, ch - 1);
            if (stairs.some(s => x >= s - 2 && x <= s + 3))
                continue;
            const size = treeSize(26, 34), bx = x * TILE + randi(0, 10), by = (ty + 1) * TILE - randi(0, 8);
            const pine = chance(0.4), seed = randi(0, 1e6);
            this.add(by, (g, e) => (pine ? A.fir(g, bx, by, size, this._season(e), seed, e.weather.snowCover) : A.bigTree(g, bx, by, size, this._season(e), seed, e.weather.snowCover)),
                [bx - size * 2, by - size * 3.4, size * 4, size * 3.4], null, true, true);
        }
        // plaza centerpiece and furniture
        const cx = (px + pw / 2) * TILE, cy = (py + Math.ceil(ph / 2)) * TILE + 6;
        const piece = pick(['fountain', 'well']);
        this.add(cy, (g, e) => (piece === 'fountain' ? (this.spout = O.fountain(g, cx, cy, this._season(e))) : O.well(g, cx, cy, this._season(e))),
            [cx - 24, cy - 50, 48, 54], [px + pw / 2 - 1, py + Math.ceil(ph / 2) - 1, 3, 1]);
        this.centerpiece = {x: cx, y: cy, kind: piece};
        this._lampsAt = [];
        for (const [lx, ly] of [[px, py], [px + pw - 1, py], [px, py + ph - 1], [px + pw - 1, py + ph - 1]]) {
            const x = lx * TILE + 8, y = ly * TILE + 14;
            this.add(y, g => O.lampPost(g, x, y), [x - 8, y - 62, 16, 64], [lx, ly, 1, 1]);
            this._lampsAt.push([x, y]);
        }
        // benches on the plaza
        for (const [bx, by] of [[px + 1, py + ph - 1], [px + pw - 3, py + ph - 1]]) {
            const x = bx * TILE + 2, y = by * TILE + 14;
            this.add(y, g => O.bench(g, x, y), [x - 2, y - 16, 28, 18], [bx, by, 2, 1]);
            this.benches.push({x: x + 4, y: y - 2, tx: bx, ty: by - 1});
        }
        // market stalls on the plaza
        const nStalls = randi(1, 2);
        for (let i = 0; i < nStalls; i++) {
            const sx = px + 1 + i * 6, sy = py + 1;
            const kind = pick(STALL_GOODS);
            const x = sx * TILE, y = sy * TILE + 14;
            this.add(y, (g, e) => O.stall(g, x, y, kind.c, kind.goods, this._season(e)), [x - 6, y - 50, 52, 54], [sx, sy, 3, 1]);
            this.stalls.push({x: x + 18, y: y - 16, tx: sx + 1, ty: sy + 1, vendor: makePerson(env, {kid: false})});
        }
        // lamps along the main road
        for (let x = randi(2, 5); x < C; x += randi(6, 9)) {
            if (!isFree(x, mainY - 1, 1, 1, [T.GRASS, T.SAND]))
                continue;
            mark(x, mainY - 1, 1, 1);
            const lx = x * TILE + 8, ly = (mainY - 1) * TILE + 14;
            this.add(ly, g => O.lampPost(g, lx, ly), [lx - 8, ly - 62, 16, 64], [x, mainY - 1, 1, 1]);
            this._lampsAt.push([lx, ly]);
        }
        // braziers on the beach either side of the pier, feet above the
        // wavy water line
        for (const dx of [-1, 2]) {
            const tx = pierX + dx, x = tx * TILE + 8;
            let sy = Infinity;
            for (let px = x - 7; px <= x + 7; px++)
                sy = Math.min(sy, this.shore[clamp(px, 0, this.w)]);
            const y = Math.floor(sy) - 4, ty = Math.floor(y / TILE);
            if (![T.GRASS, T.SAND].includes(ter.get(tx, ty)))
                continue;
            this.add(y, g => O.brazier(g, x, y), [x - 8, y - 14, 16, 16], [tx, ty, 1, 1]);
            this.fires.push([x, y - 11]);
            mark(tx, ty, 1, 1);
        }
        this.boat = {x: (pierX + 2) * TILE + 6, y: (wt + 1) * TILE + 10};
        // gardens, trees and bushes on the free grass
        const place = (w, h, fn, tries = 80, maxY = R - 2) => {
            for (let i = 0; i < tries; i++) {
                const x = randi(0, C - w), y = randi(mainY + 3, maxY);
                if (isFree(x - 1, y - h, w + 2, h + 2)) {
                    mark(x, y - h + 1, w, h);
                    fn(x, y);
                    return true;
                }
            }
            return false;
        };
        // grown trees about three people tall; the lower crown stays clear
        // of other things, the top may reach over a path, and only the trunk
        // blocks walkers
        const nTrees = Math.round(C * R / 90);
        for (let i = 0; i < nTrees; i++) {
            const size = treeSize(26, 34), tw = Math.ceil(size * 2 / TILE), th = Math.ceil(size * 1.6 / TILE);
            place(tw, th, (x, y) => {
                const mx = x + (tw >> 1), bx = mx * TILE + 8, by = y * TILE + 14, seed = randi(0, 1e6);
                const kind = weighted([['oak', 4], ['maple', 2], ['fruit', 2], ['pine', 1.5]]);
                this.add(by, (g, e) => (kind === 'pine' ? A.fir(g, bx, by, size, this._season(e), seed, e.weather.snowCover) : A.bigTree(g, bx, by, size, this._season(e), kind === 'fruit' ? seed - (seed % 4) + 1 : seed, e.weather.snowCover)),
                    [bx - size * 2, by - size * 3.4, size * 4, size * 3.4 + 4], [mx, y, 1, 1], true, true);
            });
        }
        // a bush fills two by two tiles, so walkers go around all of it
        for (let i = 0; i < C * R / 110; i++) {
            place(2, 2, (x, y) => {
                const bx = x * TILE + 4, by = y * TILE + 2, s = randi(0, 1e6), w = randi(18, 24);
                this.add(by + 12, (g, e) => bushClump(g, bx, by - 6, w, 18, this._season(e), s), [bx - 6, by - 12, w + 12, 28], [x, y - 1, 2, 2]);
            });
        }
        // garden things stay near the road in front of the houses; out on
        // the meadow only the odd rock or stump, so it does not look littered
        const smalls = ['barrel', 'crate', 'pot', 'bed', 'pumpkin', 'snowman', 'bed', 'pot'];
        for (let i = 0; i < C * R / 90; i++) {
            const kind = i % 3 ? pick(smalls) : pick(['rock', 'stump']);
            if (i % 3 === 0 && !chance(0.4))
                continue;
            if (kind === 'pumpkin' && env.season !== 'autumn')
                continue;
            if (kind === 'snowman' && env.season !== 'winter')
                continue;
            place(kind === 'bed' ? 3 : 1, 1, (x, y) => {
                const bx = x * TILE + 2, by = y * TILE + 14, s = randi(0, 1e6), c = pick([0xe84860, 0xf8d048, 0xf0f0f0, 0xb860d8]);
                const draw = {
                    rock: g => O.rock(g, bx, by, s, randi(0, 1)), stump: g => O.stump(g, bx, by), barrel: g => O.barrel(g, bx + 2, by),
                    crate: g => O.crate(g, bx, by), pot: (g, e) => O.flowerPot(g, bx + 2, by, c, this._season(e)),
                    bed: (g, e) => O.gardenBed(g, bx, by, 44, this._season(e)),
                    pumpkin: (g, e) => e.season === 'autumn' && O.pumpkin(g, bx, by),
                    snowman: (g, e) => e.weather.snowCover > 0.3 && O.snowman(g, bx + 6, by),
                }[kind];
                this.add(by, draw, [bx - 4, by - 34, kind === 'bed' ? 52 : 26, 38], [x, y, kind === 'bed' ? 3 : 1, 1]);
            }, 40, kind === 'rock' || kind === 'stump' ? R - 2 : mainY + 6);
        }
        // signpost at the road
        const spx = randi(2, C - 3);
        if (isFree(spx, mainY + 2)) {
            const x = spx * TILE + 6, y = (mainY + 2) * TILE + 14;
            this.add(y, g => O.signpost(g, x, y), [x - 12, y - 28, 26, 30], [spx, mainY + 2, 1, 1]);
        }
        // dense flowering grass patches on the open meadow
        this.patches = [];
        for (let i = 0; i < C * R / 22; i++) {
            const x = rand(0, this.w), y = rand((mainY + 2) * TILE, this.w && (R - waterRows) * TILE);
            const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
            if (ter.get(tx, ty) === T.GRASS && !used[ty * C + tx])
                this.patches.push([x, y, rand(10, 22), randi(0, 1e6)]);
        }
        for (let i = 0; i < C / 3; i++) {
            const x = rand(0, this.w), y = rand((ch + 2) * TILE + 4, (mainY - 1) * TILE);
            const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
            if (ter.get(tx, ty) === T.GRASS && !used[ty * C + tx])
                this.patches.push([x, y, rand(6, 12), randi(0, 1e6)]);
        }
        // life
        this.ducks = [];
        this.cats = [];
        for (let i = 0; i < randi(1, 2); i++)
            this.cats.push(this._newCat());
        this.waterTiles = [];
        for (let y = 0; y < R; y++)
            for (let x = 0; x < C; x++)
                if (ter.get(x, y) === T.WATER)
                    this.waterTiles.push([x, y, randi(0, 1000)]);
        // grass tufts that sway in the wind; renderStatic keeps the ones no
        // object covers
        this._tuftSpots = [];
        for (let y = mainY + 2; y < R; y++)
            for (let x = 0; x < C; x++)
                for (let k = 0; k < 2; k++)
                    if (ter.get(x, y) === T.GRASS && chance(0.75))
                        this._tuftSpots.push([x * TILE + randi(3, 13), y * TILE + randi(4, 15)]);
        this._tuftSeed = randi(0, 1e6);
        // ducks start on open water, never on the pier or under the boat
        const nDucks = randi(2, 5);
        for (let i = 0; i < 200 && this.ducks.length < nDucks && this.waterTiles.length; i++) {
            const [tx, ty] = pick(this.waterTiles), x = tx * TILE + rand(2, 14), y = ty * TILE + rand(4, 12);
            if (this._duckFree(x, y))
                this.ducks.push({x, y, vx: rand(-4, 4), t: rand(5), baby: this.ducks.length > 1});
        }
        for (let i = 0; i < Math.round(6 * env.people); i++)
            this._spawnWalker(env, true);
    }

    _season(env) {
        return env.weather.snowCover > 0.3 ? 'winter' : env.season;
    }

    renderStatic(g, env) {
        super.renderStatic(g, env);
        this.tufts = A.makeTufts(this._tuftSpots.filter(([x, y]) => !this._covered(x - 10, y - 11, 21, 13)), this._tuftSeed);
    }

    // does any object paint into the box (x, y, w, h)?
    _covered(x, y, w, h) {
        for (const o of this.objects) {
            if (!o.box)
                continue;
            const [bx, by, bw, bh] = o.box;
            const x1 = Math.max(bx, x), x2 = Math.min(bx + bw, x + w), y1 = Math.max(by, y), y2 = Math.min(by + bh, y + h);
            for (let yy = y1; yy < y2; yy++)
                for (let xx = x1; xx < x2; xx++)
                    if (o.mask[(yy - by) * bw + xx - bx])
                        return true;
        }
        return false;
    }

    _house(tx, top, wT, base, mainY, env) {
        const x = tx * TILE + 4, w = wT * TILE - 8, y = base * TILE;
        const mat = pick(['planks', 'planks', 'stone', 'brick', 'siding']);
        const wallR = A.ramp(pick(WALLS[mat])), roofR = A.ramp(pick(ROOFS)), frameR = A.ramp(pick([0x9a5a30, 0xf0ece0, 0x5a6a7a, 0x3a5a4a]));
        const seed = randi(0, 1e6), doorColor = pick([0x8a4a30, 0x9a3a30, 0x3a6a5a, 0x4a5a8a]);
        const style = chance(0.5) ? 'gable' : 'hip';
        const wallH = style === 'gable' ? 64 : 60, roofH = style === 'gable' ? Math.min(60, Math.round(w * 0.42)) : 44;
        const hh = new Household();
        this.add(y, (g, e) => O.house(g, x, y, w, {wallH, roofH, wallR, roofR, mat, seed, frameR, doorColor, style, season: this._season(e)}),
            [x - 14, y - wallH - roofH - 14, w + 28, wallH + roofH + 18], [tx, top, wT, base - top]);
        const L = O.houseLayout(x, y, w, style, wallH);
        for (const wn of L.wins) {
            const win = new Win(wn.x, wn.y, wn.w, wn.h, hh, pick(['living', 'kitchen', 'bed']));
            win.frameR = frameR;
            this.wins.push(win);
        }
        this.chimneys = this.chimneys || [];
        this.chimneys.push([x + Math.round(w * 0.72) + 4, y - wallH - roofH - (style === 'gable' ? -6 : 6)]);
        const doorX = L.door.x;
        const doorTile = Math.floor((doorX + 8) / TILE);
        this.terrain.rect(doorTile, base, 1, mainY - base, T.PATH);
        this.doors.push({x: doorX, y, w: L.door.w, h: L.door.h, tx: doorTile, ty: base, open: 0, lamp: [doorX + L.door.w + 5, y - 30]});
        // flower pots by the door
        for (const dx of [-18, 18]) {
            const px2 = doorX + 8 + dx - 4, py2 = y + 12;
            const c = pick([0xe84860, 0xf8d048, 0xf0f0f0, 0xb860d8]);
            this.add(py2, (g, e) => O.flowerPot(g, px2, py2, c, this._season(e)), [px2 - 6, py2 - 22, 22, 24]);
        }
        if (chance(0.6)) {
            const mx = x + w - 4, my = y + 14;
            this.add(my, g => O.mailbox(g, mx, my), [mx - 8, my - 26, 18, 28]);
        }
    }

    renderGround(g, env) {
        const season = this._season(env), W = this.w, H = this.h;
        const winter = season === 'winter';
        // ---- lake and beach
        const sand = A.ramp(0xe0c080), wet = A.ramp(0xb89a68);
        const deep = [0x0c2a6a, 0x123a88, 0x1a50a8, 0x2468c0, 0x3a88d8, 0x6ab0ec];
        for (let x = 0; x < W; x++) {
            const sy = Math.round(this.shore[x]);
            const beach = 7 + Math.round(Math.sin(x * 0.09) * 2 + Math.sin(x * 0.23) * 1);
            // sand band above the water line
            g.px(x, sy - beach - 1, INK);
            for (let y = sy - beach; y < sy; y++) {
                const k = y - (sy - beach);
                let c = k < 2 ? sand[3] : k > beach - 3 ? wet[2] : sand[2];
                if (((x * 7 + y * 13) % 23) === 0)
                    c = sand[4];
                else if (((x * 11 + y * 5) % 31) === 0)
                    c = sand[1];
                g.px(x, y, winter && k < beach - 2 ? 0xeef4ff : c);
            }
            // water deepens with distance from the shore
            for (let y = sy; y < H; y++) {
                const d = y - sy;
                const band = d < 2 ? 5 : d < 6 ? 4 : d < 14 ? 3 : d < 30 ? 2 : d < 52 ? 1 : 0;
                const bayer = ((x & 3) * 4 + (y & 3)) % 16;
                const edge = [2, 6, 14, 30, 52][4 - Math.min(4, band - 1)] || 0;
                let k = band;
                if (band > 0 && band < 5 && d > edge - 3 && bayer > 9)
                    k = band - 1;
                let c = deep[k];
                if (winter && d < 8)
                    c = d < 2 ? 0xffffff : 0xc8dcf0;
                g.px(x, y, c);
            }
            g.px(x, sy, winter ? 0xffffff : 0xd8f0ff);
        }
        // pier on top of the water
        for (let ty = 0; ty < this.rows; ty++)
            for (let tx = 0; tx < this.cols; tx++)
                if (this.terrain.get(tx, ty) === T.DECK) {
                    const x = tx * TILE, y = ty * TILE, R = A.ramp(0xa8703a);
                    g.rect(x, y, TILE, TILE, R[2]);
                    for (let py = y; py < y + TILE; py += 4) {
                        g.rect(x, py, TILE, 1, R[3]);
                        g.rect(x, py + 3, TILE, 1, R[0]);
                    }
                    if (this.terrain.get(tx - 1, ty) !== T.DECK)
                        g.rect(x, y, 1, TILE, INK);
                    if (this.terrain.get(tx + 1, ty) !== T.DECK)
                        g.rect(x + TILE - 1, y, 1, TILE, INK);
                    if (this.terrain.get(tx, ty + 1) !== T.DECK) {
                        g.rect(x, y + TILE - 1, TILE, 1, INK);
                        g.rect(x + 1, y + TILE, 3, 5, INK);
                        g.rect(x + TILE - 4, y + TILE, 3, 5, INK);
                        g.rect(x + 2, y + TILE, 1, 4, R[1]);
                        g.rect(x + TILE - 3, y + TILE, 1, 4, R[1]);
                    }
                }
        // ---- cliff with rock layers and an overhanging grass lip
        const rock = [0x2a140e, 0x5a2e1a, 0x8a4a26, 0xb86a30, 0xe09a48, 0xf8c070];
        const G = this._grass(season);
        for (let x = 0; x < W; x++) {
            const tx = Math.floor(x / TILE);
            if (this.stairs.some(s2 => tx >= s2 && tx < s2 + 2))
                continue;
            const top = Math.round(this.cliffTop[x]), bot = Math.round(this.cliffBot[x]);
            for (let y = top; y < bot; y++) {
                const d = y - top, layer = Math.floor((d + Math.sin(x * 0.11) * 2) / 6);
                const inL = (d + Math.round(Math.sin(x * 0.11) * 2)) % 6;
                let k = layer % 2 ? 2 : 3;
                if (inL === 0)
                    k = 1;
                else if (inL === 1)
                    k = layer % 2 ? 3 : 4;
                if (((x * 17 + layer * 31) % 29) === 0 && inL > 1)
                    k = 1; // crack
                if (((x * 7 + y * 3) % 41) === 0)
                    k = 5;
                if (d > bot - top - 4)
                    k = Math.max(0, k - 2);
                g.px(x, y, rock[k]);
            }
            g.px(x, bot, INK);
            g.px(x, bot + 1, G[1]);
            // grass lip
            const lip = 2 + ((x * 13) % 3);
            for (let i = 0; i < lip; i++)
                g.px(x, top + i, i === lip - 1 ? G[1] : G[2 + (i % 2)]);
            g.px(x, top + lip, INK);
        }
        // ---- flowering grass patches
        for (const [px, py, r, seed] of this.patches)
            this._patch(g, px, py, r, seed, season);
    }

    _grass(season) {
        return {spring: [0x1e4a2a, 0x2c6a30, 0x3e8c34, 0x5aac3e, 0x86cc52], summer: [0x163e26, 0x24602c, 0x347e30, 0x4c9c38, 0x76bc48],
            autumn: [0x3a3a1e, 0x5a5a26, 0x7a7a2e, 0x9e9436, 0xc4b04c], winter: [0x8a9ac0, 0xb0c0dc, 0xd4e0f0, 0xeaf2fc, 0xffffff]}[season];
    }

    _patch(g, px, py, r, seed, season) {
        const L = {spring: [0x0e3a1c, 0x1a5a26, 0x2a7a2e, 0x46a038, 0x76c450], summer: [0x0a2c18, 0x144a22, 0x22682a, 0x388a32, 0x5eac42],
            autumn: [0x2a2410, 0x4a4418, 0x6a6020, 0x8a7a2a, 0xb0a040], winter: [0x6a7a98, 0x9aaac8, 0xc8d4ea, 0xe8f0fc, 0xffffff]}[season];
        const B = {spring: [0xf8b0d0, 0xffe0ee], summer: [0xf098c8, 0xf8e8a0], autumn: [0xe8a040, 0xf0d060], winter: [0xffffff, 0xffffff]}[season];
        const h = (a, b) => (((a * 73856093) ^ (b * 19349663) ^ seed) >>> 0) % 1000;
        const cl = [];
        for (let y = -r; y <= r; y += 4)
            for (let x = -r * 1.4; x <= r * 1.4; x += 4) {
                if ((x / 1.4) ** 2 + y * y > r * r)
                    continue;
                const jx = (h(x, y) % 5) - 2, jy = (h(y, x) % 5) - 2;
                const tx = Math.floor((px + x) / TILE), ty = Math.floor((py + y) / TILE);
                if (this.terrain.get(tx, ty) !== T.GRASS || this._used[ty * this.cols + tx] || py + y > this.shore[clamp(Math.round(px + x), 0, this.w)] - 14)
                    continue;
                cl.push([Math.round(px + x + jx), Math.round(py + y + jy), 3 + (h(x + 1, y) % 2)]);
            }
        // tall grass: loose blades without an outline, so it reads as
        // meadow you can walk through and not as a bush
        cl.sort((a, b) => a[1] - b[1]);
        for (const [x, y, rr] of cl) {
            for (let i = 0; i < 4; i++) {
                const bx = x - 2 + i + (h(x + i, y) % 2), bh = 2 + rr - 3 + (h(y + i, x) % 3);
                g.rect(bx, y - bh + 1, 1, bh, L[i % 2 ? 2 : 3]);
                g.px(bx, y - bh + 1, L[4]);
                g.px(bx, y + 1, L[1]);
            }
            if (h(x, y) < 200) {
                g.px(x, y - rr, B[0]);
                g.px(x + 1, y - rr, B[1]);
            }
        }
    }

    // ---------- life ----------

    _newCat() {
        const tiles = [];
        for (let i = 0; i < 50; i++) {
            const x = randi(0, this.cols - 1), y = randi(this.mainY, this.rows - 1);
            if (this.walkable(x, y))
                return {cat: makeCat(), x: x * TILE + 8, y: y * TILE + 12, tx: x, ty: y, path: [], state: 'idle', timer: rand(3, 20), t: 0, dir: 1};
            tiles.push(i);
        }
        return {cat: makeCat(), x: 100, y: this.mainY * TILE + 12, tx: 6, ty: this.mainY, path: [], state: 'idle', timer: 5, t: 0, dir: 1};
    }

    _entries() {
        const e = [[0, this.mainY], [0, this.mainY + 1], [this.cols - 1, this.mainY], [this.cols - 1, this.mainY + 1]];
        for (const s of this.stairs)
            e.push([s, 0], [s + 1, 0]);
        return e;
    }

    _pois(env) {
        const p = [];
        for (const d of this.doors)
            p.push({kind: 'door', tx: d.tx, ty: d.ty, door: d, w: 3});
        for (const b of this.benches)
            p.push({kind: 'bench', tx: b.tx, ty: b.ty, bench: b, w: 2});
        p.push({kind: 'fish', tx: this.pier.x + (chance(0.5) ? 0 : 1), ty: this.pier.y + this.pier.len - 1, w: env.dark < 0.7 ? 1.5 : 0.3});
        for (const s of this.stalls)
            p.push({kind: 'shop', tx: s.tx, ty: s.ty, w: env.hour > 8 && env.hour < 18 ? 2 : 0});
        for (let i = 0; i < 3; i++)
            p.push({kind: 'idle', tx: this.plaza.x + randi(0, this.plaza.w - 1), ty: this.plaza.y + randi(0, this.plaza.h - 1), w: 1.5});
        for (const e of this._entries())
            p.push({kind: 'leave', tx: e[0], ty: e[1], w: 1.2});
        return p.filter(q => q.w > 0 && this.walkable(q.tx, q.ty));
    }

    _density(env) {
        const h = env.hour;
        let d = h < 5 ? 0.15 : h < 7 ? 0.4 : h < 10 ? 0.8 : h < 18 ? 1 : h < 21 ? 0.7 : 0.3;
        return d * (1 - Math.min(0.7, env.weather.v.rain * 0.45 + env.weather.v.snow * 0.2));
    }

    _spawnWalker(env, anywhere = false) {
        const p = makePerson(env);
        let start;
        if (anywhere) {
            for (let i = 0; i < 40 && !start; i++) {
                const x = randi(0, this.cols - 1), y = randi(this.mainY, this.rows - 1);
                if (this.walkable(x, y) && this.terrain.get(x, y) !== T.GRASS)
                    start = [x, y];
            }
        } else if (chance(0.4) && this.doors.length) {
            const d = pick(this.doors);
            start = [d.tx, d.ty];
            d.open = 1.2;
        } else {
            start = pick(this._entries());
        }
        if (!start)
            return;
        const w = {p, tx: start[0], ty: start[1], x: start[0] * TILE + 8, y: start[1] * TILE + 12, path: [], face: 'down', dir: 1, goals: randi(1, 3), state: 'walk', timer: 0};
        p.state = 'walk';
        if (env.dark > 0.6 && chance(0.4))
            p.lantern = true;
        this.walkers.push(w);
        this._nextGoal(w, env);
    }

    _nextGoal(w, env) {
        const pois = this._pois(env);
        let goal;
        if (w.goals <= 0)
            goal = pick(pois.filter(q => q.kind === 'leave' || q.kind === 'door')) || pick(pois);
        else
            goal = weighted(pois.filter(q => !(q.kind === 'leave' && w.goals > 1)).map(q => [q, q.w]));
        w.goals--;
        w.goal = goal;
        w.path = this.findPath(w.tx, w.ty, goal.tx, goal.ty) || [];
        if (!w.path.length) {
            w.gone = true;
        }
        w.state = 'walk';
        w.p.state = 'walk';
    }

    _arrive(w, env) {
        const g = w.goal;
        switch (g.kind) {
        case 'leave':
            w.gone = true;
            break;
        case 'door':
            w.gone = true;
            g.door.open = 1.2;
            break;
        case 'bench':
            w.state = 'sit';
            w.p.state = 'sit';
            w.timer = rand(20, 80);
            w.x = g.bench.x + 4;
            w.y = g.bench.y + 2;
            w.face = 'side';
            w.dir = chance(0.5) ? 1 : -1;
            break;
        case 'fish':
            w.state = 'fish';
            w.p.state = 'fish';
            w.timer = rand(40, 160);
            w.face = 'down';
            w.bob = 0;
            break;
        case 'shop':
            w.state = 'idle';
            w.p.state = 'idle';
            w.timer = rand(5, 15);
            w.face = 'up';
            break;
        default:
            w.state = 'idle';
            w.p.state = 'idle';
            w.timer = rand(4, 14);
            w.face = 'down';
        }
    }

    trigger(name, env, ctx) {
        switch (name) {
        case 'fireworks':
            for (let i = 0; i < randi(6, 12); i++)
                this.timers.add(i * rand(0.6, 1.6), () => ctx.sky.firework(rand(this.w * 0.2, this.w * 0.8)));
            break;
        case 'musician': {
            this.musician = {p: makePerson(env, {kid: false}), t: rand(90, 200), x: (this.plaza.x + 1) * TILE, y: (this.plaza.y + 1) * TILE + 12};
            break;
        }
        case 'kids':
            for (let i = 0; i < randi(2, 4); i++) {
                this._spawnWalker(env);
                const w = this.walkers[this.walkers.length - 1];
                if (w) {
                    w.p = makePerson(env, {kid: true});
                    w.p.speed = rand(24, 32);
                    w.p.state = 'walk';
                    w.goals = 4;
                }
            }
            break;
        case 'crows':
            for (let i = 0; i < randi(3, 6); i++)
                this.critters.push({kind: 'crow', x: rand(20, this.w - 20), y: rand(this.mainY * TILE, (this.rows - 7) * TILE), t: rand(5), fly: 0, land: rand(20, 60)});
            break;
        case 'festival':
            this.festival = rand(240, 600);
            break;
        }
    }

    _pickEvent(env) {
        const h = env.hour, night = env.dark > 0.6, dry = env.weather.v.rain < 0.2, P = env.people;
        return weighted([
            ['fireworks', night && (h > 20 || h < 1) ? (env.weekday === 6 ? 0.8 : 0.2) : 0],
            ['musician', h > 10 && h < 22 && dry ? 1.2 * P : 0], ['kids', !night && dry && h > 9 && h < 19 ? 1.2 * P : 0],
            ['crows', !night ? 1 : 0], ['festival', (env.dark > 0.3 && dry && (env.weekday >= 5) ? 0.6 : 0.05) * P],
        ]);
    }

    update(dt, real, env, ctx) {
        this.realT += real;
        this.timers.run(real);
        for (const w of this.wins)
            w.update(dt, real, env);
        for (const d of this.doors)
            d.open = Math.max(0, d.open - real);
        if (Math.random() < real / 2 && this.walkers.length < Math.round((this.cols * this.rows / 70 * this._density(env) + 1) * env.people))
            this._spawnWalker(env);
        for (const w of this.walkers) {
            const p = w.p;
            p.t += real;
            if (w.state === 'walk') {
                const next = w.path[0];
                if (!next) {
                    this._arrive(w, env);
                    continue;
                }
                const gx = next[0] * TILE + 8, gy = next[1] * TILE + 12;
                const dx = gx - w.x, dy = gy - w.y, d = Math.hypot(dx, dy);
                const step = p.speed * real;
                if (Math.abs(dx) > Math.abs(dy)) {
                    w.face = 'side';
                    w.dir = Math.sign(dx);
                } else if (dy !== 0) {
                    w.face = dy > 0 ? 'down' : 'up';
                }
                if (d <= step) {
                    w.x = gx;
                    w.y = gy;
                    w.tx = next[0];
                    w.ty = next[1];
                    w.path.shift();
                } else {
                    w.x += dx / d * step;
                    w.y += dy / d * step;
                }
            } else {
                w.timer -= real;
                if (w.state === 'fish') {
                    w.bob += real;
                    if (!w.catch && Math.random() < real / 25) {
                        w.catch = 1.6;
                        this.fx.push({kind: 'excl', x: w.x - 5, y: w.y - 46, t: 0, life: 1.2});
                    }
                    if (w.catch > 0) {
                        w.catch -= real;
                        if (w.catch <= 0) {
                            this.fx.push({kind: 'fish', x: w.x, y: w.y + 26, tx: w.x, ty: w.y - 20, t: 0, life: 0.8});
                            w.catch = 0;
                        }
                    }
                }
                if (w.timer <= 0) {
                    p.state = 'walk';
                    if (w.state === 'sit')
                        w.y = w.ty * TILE + 12;
                    this._nextGoal(w, env);
                }
            }
        }
        this.walkers = this.walkers.filter(w => !w.gone);
        // cats roam, nap and stare
        for (const c of this.cats) {
            c.t += real;
            if (c.state === 'walk') {
                const next = c.path[0];
                if (!next) {
                    c.state = 'idle';
                    c.timer = rand(10, 60);
                    continue;
                }
                const gx = next[0] * TILE + 8, gy = next[1] * TILE + 12, dx = gx - c.x, dy = gy - c.y, d = Math.hypot(dx, dy);
                if (dx)
                    c.dir = Math.sign(dx);
                if (d < 14 * real) {
                    c.x = gx;
                    c.y = gy;
                    c.tx = next[0];
                    c.ty = next[1];
                    c.path.shift();
                } else {
                    c.x += dx / d * 14 * real;
                    c.y += dy / d * 14 * real;
                }
            } else {
                c.timer -= real;
                if (c.timer <= 0) {
                    for (let i = 0; i < 20; i++) {
                        const x = clamp(c.tx + randi(-8, 8), 0, this.cols - 1), y = clamp(c.ty + randi(-5, 5), this.mainY, this.rows - 1);
                        if (this.walkable(x, y)) {
                            c.path = this.findPath(c.tx, c.ty, x, y) || [];
                            break;
                        }
                    }
                    c.state = c.path.length ? 'walk' : 'idle';
                    c.timer = rand(5, 20);
                }
            }
        }
        for (const d of this.ducks) {
            d.t += real;
            // look ahead, so a duck turns before the pier or the boat
            const nx = d.x + d.vx * real;
            if (this._duckFree(nx, d.y))
                d.x = nx;
            else
                d.vx = -d.vx;
            if (Math.random() < real / 8)
                d.vx = rand(-5, 5);
        }
        if (Math.random() < real / 5 && this.waterTiles.length) {
            const [x, y] = pick(this.waterTiles);
            if (this.terrain.get(x, y - 1) === T.WATER)
                this.fx.push({kind: 'jump', x: x * TILE + 8, y: y * TILE + 8, t: 0, life: 1});
        }
        for (const c of this.critters) {
            c.t += real;
            if (c.kind === 'crow') {
                if (!c.fly && this.walkers.some(w => Math.abs(w.x - c.x) < 20 && Math.abs(w.y - c.y) < 14)) {
                    c.fly = 1;
                    c.vx = rand(-60, 60);
                    c.vy = rand(-70, -40);
                }
                if (c.fly) {
                    c.x += c.vx * real;
                    c.y += c.vy * real;
                }
            }
        }
        this.critters = this.critters.filter(c => c.y > -30 && c.x > -30 && c.x < this.w + 30);
        for (const f of this.fx)
            f.t += real;
        this.fx = this.fx.filter(f => f.t < f.life);
        if ((env.season !== 'summer' || env.dark > 0.4) && Math.random() < real * 0.8 && this.chimneys)
            for (const [x, y] of this.chimneys)
                if (Math.random() < 0.5)
                    this.smoke.push({x, y, t: 0, life: rand(3, 6)});
        for (const s of this.smoke) {
            s.t += real;
            s.y -= 7 * real;
            s.x += (env.weather.wind * 7 + 2) * real;
        }
        this.smoke = this.smoke.filter(s => s.t < s.life);
        if (this.musician) {
            this.musician.t -= real;
            this.musician.p.t += real;
            if (Math.random() < real * 1.5)
                this.fx.push({kind: 'note', x: this.musician.x + 14, y: this.musician.y - 30, t: 0, life: 3, c: pick([0xffffff, 0xf0d050, 0xf080c0])});
            if (this.musician.t <= 0)
                this.musician = null;
        }
        if (this.festival > 0)
            this.festival -= real;
        // seasonal particles
        this.parts = this.parts || [];
        const wantFlies = env.season === 'summer' && env.dark > 0.5 ? 30 : env.season === 'spring' && env.dark > 0.5 ? 10 : 0;
        const wantButter = (env.season === 'spring' || env.season === 'summer') && env.dark < 0.2 && env.weather.v.rain < 0.1 ? 8 : 0;
        const wantLeaves = env.season === 'autumn' ? 14 : env.season === 'spring' ? 8 : 0;
        const count = k => this.parts.filter(q => q.kind === k).length;
        if (count('fly') < wantFlies)
            this.parts.push({kind: 'fly', x: rand(this.w), y: rand(this.h * 0.3, this.h), p: rand(6.28)});
        if (count('butterfly') < wantButter)
            this.parts.push({kind: 'butterfly', x: rand(this.w), y: rand(this.h * 0.3, this.h * 0.9), p: rand(6.28), c: pick([0xf8f0f0, 0xf0d050, 0xf080c0, 0x60b0f0])});
        if (count('leaf') < wantLeaves)
            this.parts.push({kind: 'leaf', x: rand(this.w), y: rand(-10, this.h * 0.3), p: rand(6.28), c: env.season === 'spring' ? pick([0xf8c0d8, 0xffe8f0]) : pick([0xe08a30, 0xd05a28, 0xf0c040])});
        for (const q of this.parts) {
            q.p += real;
            if (q.kind === 'fly') {
                q.x += Math.sin(q.p * 1.3) * 6 * real;
                q.y += Math.cos(q.p) * 5 * real;
            } else if (q.kind === 'butterfly') {
                q.x += Math.sin(q.p * 0.7) * 14 * real;
                q.y += Math.cos(q.p * 1.1) * 9 * real;
            } else {
                q.y += 12 * real;
                q.x += (Math.sin(q.p * 2) * 14 + env.weather.wind * 10) * real;
            }
        }
        this.parts = this.parts.filter(q => !(q.kind === 'leaf' && q.y > this.h) &&
            !(q.kind === 'fly' && count('fly') > wantFlies && Math.random() < real) &&
            !(q.kind === 'butterfly' && wantButter === 0));
        this.eventTimer -= real;
        if (this.eventTimer <= 0) {
            this.eventTimer = rand(45, 150);
            this.trigger(this._pickEvent(env), env, ctx);
        }
        if (env.holidays.newYear && env.dark > 0.5 && Math.random() < real * 1.5)
            ctx.sky.firework(rand(this.w * 0.1, this.w * 0.9));
    }

    // ---------- rendering ----------

    renderDynamic(g, env) {
        const t = this.realT;
        this.sway(g, env);
        A.drawTufts(g, this.tufts, this._season(env), env.weather);
        // water: drifting wave glints and shore foam
        if (this._season(env) !== 'winter' || env.weather.snowCover < 0.6) {
            const glint = mix(WATER[3], 0xffffff, 0.45);
            for (const [x, y, s] of this.waterTiles) {
                const ox = Math.floor((t * 5 + s) % 16), oy = (s >> 4) % 12;
                g.rect(x * TILE + ox, y * TILE + oy + 2, 3, 1, glint);
                if (s % 3 === 0)
                    g.px(x * TILE + ((ox + 8) % 16), y * TILE + ((oy + 7) % 14), WATER[4]);
            }
        }
        // boat bobbing at the pier
        O.boat(g, this.boat.x, this.boat.y + Math.round(Math.sin(t * 1.5)));
        for (const d of this.ducks)
            this._duck(g, d);
        for (const f of this.fx) {
            if (f.kind === 'jump') {
                const k = f.t / f.life, y = f.y - Math.sin(k * Math.PI) * 12;
                g.rect(f.x - 2, y - 1, 6, 3, INK);
                g.rect(f.x - 1, y, 4, 1, 0xe8a040);
                if (k > 0.8)
                    g.blend(f.x - 4, f.y + 2, 10, 1, 0xffffff, 0.6);
            }
        }
        // windows, doors, lamps, fire bowls
        for (const w of this.wins)
            w.render(g, env);
        for (const d of this.doors) {
            if (d.open > 0)
                g.rectE(d.x + 1, d.y - d.h + 1, d.w - 2, d.h - 1, env.dark > 0.4 ? 0xffd890 : 0x3a2a24);
            if (env.lampsOn) {
                g.rectE(d.lamp[0] - 1, d.lamp[1], 2, 3, 0xffe8a0);
                g.glow(d.lamp[0], d.lamp[1] + 1, 12, 0xffd080, 0.3);
            }
        }
        // walkers, cats and critters in depth order, objects in front redrawn
        const items = [];
        for (const w of this.walkers)
            items.push([w.y, 0, w]);
        for (const c of this.cats)
            items.push([c.y, 1, c]);
        for (const c of this.critters)
            if (!c.fly)
                items.push([c.y, 2, c]);
        for (const s of this.stalls)
            if (env.hour > 7.5 && env.hour < 18.5 && env.dark < 0.6)
                items.push([s.y + 2, 3, s]);
        if (this.musician)
            items.push([this.musician.y, 4, this.musician]);
        items.sort((a, b) => a[0] - b[0]);
        for (const [y, kind, o] of items) {
            let box;
            if (kind === 0) {
                const f = personFigure(o.p, 0, o.face);
                const left = o.x - f.w / 2;
                drawPerson(g, o.p, left, o.y, o.dir, env, o.face);
                box = [left - 4, o.y - f.h - 14, f.w + 8, f.h + 16];
                if (o.state === 'fish')
                    this._fishing(g, o, env);
            } else if (kind === 1) {
                const f = catFigure(o.cat, o.state === 'walk' ? (Math.floor(o.t * 6) % 2 ? 'walk1' : 'walk2') : 'sit');
                drawFigure(g, f, o.x - f.w / 2, o.y, o.dir < 0);
                box = [o.x - f.w / 2, o.y - f.h, f.w, f.h];
                if (o.state === 'idle' && env.dark > 0.6) {
                    g.pxE(o.x - 1, o.y - f.h + 3, 0xc0ff60);
                    g.pxE(o.x + 1, o.y - f.h + 3, 0xc0ff60);
                }
            } else if (kind === 2) {
                this._crow(g, o);
                box = [o.x - 6, o.y - 10, 14, 12];
            } else if (kind === 3) {
                o.vendor.state = 'idle';
                const f = personFigure(o.vendor, 0, 'down');
                drawPerson(g, o.vendor, o.x - f.w / 2, o.y, 1, env, 'down');
                // stands under the awning: only the counter hides the feet
                box = [o.x - f.w / 2, o.y - 2, f.w, 2];
            } else {
                o.p.state = 'sit';
                drawPerson(g, o.p, o.x, o.y, 1, env);
                const R = A.ramp(0xc88838);
                g.rect(o.x + 6, o.y - 16, 10, 7, INK);
                g.rect(o.x + 7, o.y - 15, 8, 5, R[2]);
                g.rect(o.x + 14, o.y - 22, 2, 8, R[0]);
                box = [o.x - 2, o.y - 34, 24, 36];
            }
            this.occlude(g, box[0], box[1], box[2], box[3], y);
        }
        // lights
        if (env.lampsOn) {
            for (const [x, y] of this._lampsAt) {
                g.rectE(x - 3, y - 55, 6, 6, 0xfff0c0);
                g.glow(x, y - 52, 16, 0xffe0a0, 0.35);
                g.glow(x, y - 2, 30, 0xffd890, 0.22, 0.45);
            }
        }
        for (const [x, y] of this.fires) {
            const fl = Math.sin(t * 9 + x) * 0.5 + 0.5;
            g.rectE(x - 3, y - 2, 6, 3, 0xff6020);
            g.rectE(x - 2, y - 5 - Math.round(fl * 2), 4, 4, 0xffa030);
            g.rectE(x - 1, y - 7 - Math.round(fl * 3), 2, 3, 0xffe080);
            if (env.dark > 0.2)
                g.glow(x, y - 3, 26 + fl * 4, 0xffa040, 0.35 * env.dark + 0.05);
        }
        if (this.centerpiece.kind === 'fountain' && this.spout && this._season(env) !== 'winter') {
            const [sx, sy] = this.spout;
            for (let i = 0; i < 14; i++) {
                const ph = (t * 1.1 + i / 14) % 1, side = i % 2 ? 1 : -1;
                g.blend(sx + side * ph * 16, sy - Math.sin(ph * Math.PI) * 12 + ph * 12, 1, 2, 0xc8e8ff, 0.85);
            }
        }
        if (this.festival > 0 && env.dark > 0.3) {
            const pz = this.plaza, cols = [0xff5050, 0xffd040, 0x50d0ff, 0x80ff80, 0xff80d0];
            for (let row = 0; row < 2; row++) {
                const y0 = (pz.y + row * (pz.h - 1)) * TILE - 30;
                for (let i = 0; i < pz.w * TILE; i += 8) {
                    const x = pz.x * TILE + i, y = y0 + Math.sin(i / (pz.w * TILE) * Math.PI) * 10;
                    g.pxE(x, y, 0x3a3a3a);
                    if (i % 16 === 0) {
                        g.rectE(x, y + 1, 2, 2, cols[(i / 16 + Math.floor(t * 2)) % cols.length]);
                        g.glow(x + 1, y + 2, 5, cols[(i / 16 + Math.floor(t * 2)) % cols.length], 0.3);
                    }
                }
            }
        }
        for (const s of this.smoke) {
            const a = 0.45 * (1 - s.t / s.life), r = 2 + Math.floor(s.t * 1.4);
            g.blend(s.x - r / 2, s.y - r / 2, r, r, 0xd8d8e0, a);
        }
        for (const c of this.critters)
            if (c.fly)
                this._crow(g, c);
        for (const f of this.fx) {
            if (f.kind === 'note') {
                const y = f.y - f.t * 8, x = f.x + Math.sin(f.t * 3) * 4;
                g.rect(x - 1, y - 1, 5, 7, INK);
                g.rect(x + 2, y, 1, 5, f.c);
                g.rect(x, y + 3, 3, 2, f.c);
            } else if (f.kind === 'excl') {
                g.rect(f.x - 2, f.y - 2, 9, 12, INK);
                g.rect(f.x - 1, f.y - 1, 7, 10, 0xffffff);
                g.rect(f.x + 2, f.y, 2, 5, 0xd84848);
                g.rect(f.x + 2, f.y + 6, 2, 2, 0xd84848);
            } else if (f.kind === 'fish') {
                const k = f.t / f.life, x = f.x + 4, y = f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * 20;
                g.rect(x - 1, y - 1, 9, 5, INK);
                g.rect(x, y, 7, 3, 0x6ab0e0);
                g.rect(x, y, 7, 1, 0xc8e8ff);
            }
        }
        for (const q of this.parts || []) {
            if (q.kind === 'fly') {
                if (Math.sin(q.p * 3) > 0.2) {
                    g.pxE(q.x, q.y, 0xe0ff80);
                    g.glow(q.x, q.y, 7, 0xc0ff60, 0.3);
                }
            } else if (q.kind === 'butterfly') {
                const up = Math.floor(q.p * 8) % 2;
                g.rect(q.x, q.y, 1, 2, INK);
                g.rect(q.x - 2, q.y - up, 2, 2, q.c);
                g.rect(q.x + 1, q.y - up, 2, 2, q.c);
            } else {
                g.rect(q.x, q.y, 2, 1, q.c);
                g.px(q.x + 1, q.y + 1, mix(q.c, 0x000000, 0.3));
            }
        }
    }

    _fishing(g, w, env) {
        const hx = w.x + 7, hy = w.y - 16;
        const bx = w.x + 14, by = w.y + 30 + Math.round(Math.sin(w.bob * 2) * 1) + (w.catch > 0 ? 2 : 0);
        g.line(hx, hy, hx + 10, hy - 14, 0x6a4a30);
        g.line(hx + 10, hy - 14, bx, by, 0xe8e8e8);
        g.rect(bx - 1, by - 1, 3, 3, INK);
        g.px(bx, by - 1, 0xff4040);
        g.px(bx, by, 0xffffff);
        if (w.catch > 0)
            g.blend(bx - 4, by + 2, 9, 1, 0xffffff, 0.6);
    }

    // the whole duck, about 14px wide, must sit on open water
    _duckFree(x, y) {
        if (x < 10 || x > this.w - 24)
            return false;
        const ty = Math.floor(y / TILE);
        for (const px of [x - 3, x + 5, x + 13])
            if (this.terrain.get(clamp(Math.floor(px / TILE), 0, this.cols - 1), ty) !== T.WATER)
                return false;
        const b = this.boat;
        return !(x + 13 > b.x - 2 && x - 3 < b.x + 30 && y > b.y - 12 && y < b.y + 6);
    }

    _duck(g, d) {
        const x = Math.floor(d.x), y = Math.floor(d.y), f = d.vx < 0;
        g.blend(x - 3, y + 1, 16, 1, 0xffffff, 0.35);
        if (d.baby) {
            g.rect(x - 1, y - 5, 8, 6, INK);
            g.rect(x, y - 4, 6, 4, 0xf0d850);
            g.rect(f ? x - 2 : x + 5, y - 8, 4, 4, INK);
            g.rect(f ? x - 1 : x + 6, y - 7, 2, 2, 0xf0d850);
            g.px(f ? x - 3 : x + 9, y - 6, 0xf08a20);
        } else {
            g.rect(x - 1, y - 7, 13, 8, INK);
            g.rect(x, y - 6, 11, 6, 0xf4f0e8);
            g.rect(x + 2, y - 5, 6, 2, 0xd8d4cc);
            g.rect(f ? x - 3 : x + 9, y - 12, 6, 7, INK);
            g.rect(f ? x - 2 : x + 10, y - 11, 4, 5, 0x3a8a4a);
            g.rect(f ? x - 5 : x + 14, y - 9, 3, 2, 0xf08a20);
        }
    }

    _crow(g, c) {
        const x = Math.floor(c.x), y = Math.floor(c.y);
        if (c.fly) {
            const up = Math.floor(c.t * 10) % 2;
            g.rect(x - 1, y - 4, 8, 4, INK);
            g.rect(x - 6, y - (up ? 8 : 3), 6, 2, INK);
            g.rect(x + 6, y - (up ? 8 : 3), 6, 2, INK);
            return;
        }
        const peck = Math.floor(c.t * 2 + c.x) % 3 === 0;
        g.rect(x - 1, y - 7, 10, 7, INK);
        g.rect(x, y - 6, 8, 5, 0x2a2a3a);
        g.rect(x + 1, y - 6, 4, 1, 0x4a4a6a);
        g.rect(x + 6, peck ? y - 4 : y - 9, 5, 5, INK);
        g.rect(x + 7, peck ? y - 3 : y - 8, 3, 3, 0x2a2a3a);
        g.px(x + 10, peck ? y - 2 : y - 7, 0xe8a040);
    }
}
