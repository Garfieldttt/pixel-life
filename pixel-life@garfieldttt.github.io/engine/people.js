// Pixel people (about 14x30), pets and their props. Every person is
// a random mix of body, clothes, hair and accessories; walk frames are
// built once per person and cached.
import {rand, chance, pick} from './util.js';
import {mix} from './gfx.js';
import {Cells, drawFigure} from './figure.js';
import {INK} from './art.js';

export const SKINS = [0xfbd8b4, 0xf0c098, 0xd8a074, 0xb07448, 0x7c4c30];
const HAIRS = [0x3a2418, 0x6a3c20, 0xa85c2c, 0xe8c060, 0x2a2430, 0xc8442c, 0x7a5aa8, 0xf0e0a0, 0x4a6aa0];
const SHIRTS = [0xd84a4a, 0x4a7ad0, 0x5aae58, 0xe8a63c, 0x9a58b8, 0xf2ecd8, 0x3aa8a8, 0xe8749e, 0x8a5a40, 0xf0d050, 0x384870, 0x5a8a5a];
const PANTS = [0x3a4470, 0x4a3a30, 0x2c2c3a, 0x6c6c7c, 0x52703c, 0x8a5a3a, 0x5a4a7a];
const SHOES = [0x4a2a20, 0x2a2430, 0xe8e4e0, 0x8a4a2a, 0xc83a3a];

const sh = (c, t = 0.3) => mix(c, 0x2a1040, t);
const hi = (c, t = 0.25) => mix(c, 0xfff4d0, t);

export function makePerson(env, opts = {}) {
    const kid = opts.kid ?? chance(0.16);
    const elder = !kid && chance(0.13);
    const p = {
        kid, elder,
        skin: pick(SKINS),
        hair: elder ? pick([0xe8e4dc, 0xc0bcb8, 0x9a9a9a]) : pick(HAIRS),
        style: pick(elder ? ['short', 'bald', 'bun', 'hat', 'bob'] : ['short', 'short', 'long', 'long', 'cap', 'bun', 'spiky', 'bald', 'hat', 'pony', 'bob', 'curly']),
        shirt: opts.shirt ?? pick(SHIRTS),
        pants: pick(PANTS),
        dress: !kid && chance(0.2),
        shoes: pick(SHOES),
        speed: kid ? rand(16, 22) : elder ? rand(7, 10) : rand(12, 18),
        frames: [],
        t: rand(10),
        blush: chance(0.5),
    };
    if (env.season === 'winter') {
        if (chance(0.7))
            p.scarf = pick([0xd84848, 0x4c7cd0, 0xf0d050, 0x5cae5c]);
        if (chance(0.4) && p.style !== 'hat')
            p.style = 'beanie';
        if (chance(0.6))
            p.coat = pick([0x6a4a3a, 0x3a4a6a, 0x8a3a3a, 0x4a5a4a]);
    }
    if (env.weather.v.rain > 0.3 && chance(0.75))
        p.umbrella = pick([0xd84848, 0x4c7cd0, 0xf0d050, 0x303040, 0x5cae5c, 0xe876a0]);
    else if (opts.jogger ?? (!kid && !elder && env.weather.v.rain < 0.2 && chance(0.06))) {
        p.jogger = true;
        p.speed = rand(34, 42);
        p.shirt = pick([0xf04080, 0x30c0f0, 0xa0f040, 0xf08020]);
        p.pants = 0x2a2a3a;
        p.dress = false;
    }
    if (!p.umbrella && !p.jogger) {
        if (kid && chance(0.25))
            p.balloon = pick([0xf04848, 0xf0d040, 0x4890f0, 0xf080c0, 0x60d060]);
        else if (!kid && chance(0.15))
            p.dog = makeDog();
        else if (!kid && chance(0.25))
            p.bag = pick([0xb07840, 0xe8e0d0, 0xd84848, 0x4c7cd0]);
        if (!kid && chance(0.1))
            p.coffee = true;
        if (elder && chance(0.4))
            p.cane = true;
        if (kid && chance(0.3))
            p.backpack = pick([0xd84848, 0x4c7cd0, 0xf0d050]);
    }
    p.phone = !kid && chance(0.25);
    if (env.holidays.halloween && kid && chance(0.5))
        p.costume = pick(['ghost', 'pumpkin', 'witch']);
    return p;
}

// frame: 0 stand, 1 step, 2 pass, 3 other step; 'sit' for sitting
function buildPerson(p, frame) {
    const kid = p.kid;
    const W = 16, H = kid ? 24 : 31;
    const c = new Cells(W, H + 3);
    const T = 3; // headroom for hats and buns
    const skin = p.skin, skinS = sh(skin, 0.22), hair = p.hair, hairS = sh(hair, 0.3), hairH = hi(hair, 0.3);
    const ghost = p.costume === 'ghost';
    let shirt = p.coat || p.shirt;
    if (p.costume === 'pumpkin')
        shirt = 0xf08a20;
    if (p.costume === 'witch')
        shirt = 0x4a2a6a;
    const shirtS = sh(shirt, 0.25), shirtH = hi(shirt, 0.2);
    const sit = frame === 'sit';
    // ---- head (12 wide incl. hair), facing right
    const hx = 2, hy = T;
    const headH = 10;
    c.rect(hx + 2, hy + 2, 9, headH - 2, skin);
    c.rect(hx + 3, hy + headH, 7, 1, skin);
    c.rect(hx + 2, hy + headH - 2, 2, 2, skinS);
    c.set(hx + 8, hy + 5, INK);
    c.set(hx + 8, hy + 6, INK);
    c.set(hx + 9, hy + 5, 0x6a4a5a);
    if (p.blush)
        c.set(hx + 7, hy + 8, 0xf09a9a);
    c.set(hx + 10, hy + 8, sh(skin, 0.35));
    c.set(hx + 11, hy + 5, skin);
    c.set(hx + 11, hy + 6, skin);
    c.set(hx + 4, hy + 6, skinS); // ear
    const style = p.costume === 'witch' ? 'witch' : p.style;
    if (style !== 'bald') {
        c.rect(hx + 3, hy, 7, 1, hair);
        c.rect(hx + 1, hy + 1, 10, 2, hair);
        c.rect(hx + 1, hy + 3, 4, 3, hair);
        c.rect(hx + 5, hy + 3, 6, 1, hair); // fringe
        c.set(hx + 9, hy + 4, hair);
        c.rect(hx + 4, hy + 1, 4, 1, hairH);
        c.set(hx + 1, hy + 5, hairS);
    } else {
        c.rect(hx + 1, hy + 4, 3, 3, hair);
    }
    switch (style) {
    case 'long':
        c.rect(hx, hy + 3, 3, 9, hair);
        c.rect(hx + 1, hy + 6, 3, 6, hair);
        c.set(hx, hy + 11, hairS);
        break;
    case 'bob':
        c.rect(hx, hy + 3, 4, 6, hair);
        c.rect(hx + 10, hy + 3, 1, 4, hair);
        break;
    case 'pony':
        c.rect(hx - 2, hy + 3, 3, 2, hair);
        c.rect(hx - 2, hy + 5, 2, 5, hair);
        c.set(hx - 1, hy + 3, 0xd84848);
        break;
    case 'bun':
        c.rect(hx + 2, hy - 3, 4, 3, hair);
        c.set(hx + 3, hy - 3, hairH);
        break;
    case 'spiky':
        for (let i = 0; i < 4; i++)
            c.set(hx + 2 + i * 2, hy - 1, hair);
        break;
    case 'curly':
        for (let i = 0; i < 6; i++)
            c.set(hx + 1 + i * 2, hy - 1, hair);
        c.rect(hx, hy + 2, 2, 6, hair);
        break;
    case 'cap':
        c.rect(hx + 1, hy - 1, 10, 3, p.shirt === shirt ? sh(p.shirt, 0.1) : p.shirt);
        c.rect(hx + 8, hy + 2, 5, 1, sh(p.shirt, 0.35));
        c.rect(hx + 3, hy - 1, 3, 1, hi(p.shirt, 0.3));
        break;
    case 'hat':
        c.rect(hx + 2, hy - 2, 8, 3, 0x6a4a34);
        c.rect(hx, hy + 1, 13, 1, 0x7a5a40);
        c.rect(hx + 2, hy, 8, 1, 0xc84a3a);
        break;
    case 'beanie':
        c.rect(hx + 1, hy - 1, 10, 4, p.scarf || 0xd84848);
        c.rect(hx + 1, hy + 2, 10, 1, hi(p.scarf || 0xd84848, 0.4));
        c.rect(hx + 5, hy - 3, 2, 2, 0xf4f4f4);
        break;
    case 'witch':
        c.rect(hx + 5, hy - 3, 2, 3, 0x2a1a3a);
        c.rect(hx + 3, hy - 1, 6, 2, 0x2a1a3a);
        c.rect(hx, hy + 1, 13, 1, 0x3a2a4a);
        break;
    }
    // ---- body
    const by = hy + headH + 1;
    const bodyH = kid ? 6 : 8;
    c.rect(hx + 2, by, 9, bodyH, shirt);
    c.rect(hx + 2, by, 1, bodyH, shirtH);
    c.rect(hx + 9, by, 2, bodyH, shirtS);
    c.rect(hx + 4, by, 5, 1, hi(shirt, 0.35)); // collar
    if (p.scarf) {
        c.rect(hx + 3, by, 8, 2, p.scarf);
        c.rect(hx + 4, by + 2, 2, 3, p.scarf);
    }
    if (p.jogger)
        c.rect(hx + 4, by + 2, 4, 3, 0xf4f4f4);
    if (p.backpack) {
        c.rect(hx, by + 1, 3, bodyH - 2, p.backpack);
        c.set(hx, by + 1, hi(p.backpack, 0.3));
    }
    // arm (front) swings with the walk
    const swing = sit ? 1 : frame === 1 ? 2 : frame === 3 ? -2 : 0;
    const ax = hx + 5 + swing;
    if (p.umbrella || p.balloon) {
        c.rect(hx + 7, by + 1, 3, 4, shirtS);
        c.rect(hx + 8, by + 4, 3, 2, skin);
    } else {
        c.rect(ax, by + 1, 3, bodyH - 3, sh(shirt, 0.15));
        c.set(ax, by + 1, shirtH);
        c.rect(ax, by + bodyH - 2, 3, 2, skin);
        if (p.coffee) {
            c.rect(ax + 2, by + bodyH - 4, 3, 4, 0xf4f0e8);
            c.rect(ax + 2, by + bodyH - 3, 3, 1, 0x8a5a3a);
        }
    }
    if (p.bag && !p.backpack) {
        c.rect(hx, by + 3, 3, 5, p.bag);
        c.set(hx + 1, by + 2, sh(p.bag, 0.3));
    }
    // ---- legs
    const ly = by + bodyH;
    const legH = kid ? 5 : 7;
    const pants = p.pants, pantsS = sh(pants, 0.3);
    if (ghost) {
        c.rect(hx, hy - 1, 13, ly - hy + legH + 2, 0xf4f4f8);
        c.rect(hx + 1, hy - 2, 11, 1, 0xf4f4f8);
        c.rect(hx + 8, hy + 4, 2, 2, INK);
        c.rect(hx + 4, hy + 4, 2, 2, INK);
        c.rect(hx + 6, hy + 8, 2, 2, 0x5a4a6a);
        const wv = frame % 2;
        for (let i = 0; i < 13; i += 2)
            c.set(hx + i + wv, ly + legH + 1, -1);
        return c.finish(INK);
    }
    if (sit) {
        c.rect(hx + 3, ly, 9, 3, pants);
        c.rect(hx + 9, ly + 3, 3, 3, pants);
        c.rect(hx + 9, ly + 6, 4, 2, p.shoes);
        return c.finish(INK);
    }
    if (p.dress) {
        c.rect(hx + 1, ly, 11, 4, shirt);
        c.rect(hx + 1, ly + 3, 11, 1, shirtS);
        c.rect(hx + 10, ly, 2, 4, shirtS);
    } else {
        c.rect(hx + 3, ly, 8, 2, pants);
        c.rect(hx + 3, ly, 8, 1, sh(pants, 0.45));
    }
    const legTop = p.dress ? ly + 4 : ly + 2;
    const lc = p.dress ? skin : pants, lcS = p.dress ? skinS : pantsS;
    const legRows = ly + legH - legTop;
    const shoe = p.shoes, shoeH = hi(shoe, 0.3);
    // back leg, front leg: x offsets per frame
    const off = frame === 1 ? [-2, 2] : frame === 3 ? [2, -2] : [0, 0];
    const legs = [[hx + 3, off[0], lcS], [hx + 7, off[1], lc]];
    for (const [lx, o, col] of legs) {
        for (let i = 0; i < legRows; i++) {
            const shift = Math.round(o * (i + 1) / legRows);
            c.rect(lx + shift, legTop + i, 3, 1, col);
        }
        const fx = lx + o;
        c.rect(fx, ly + legH, 4, 2, shoe);
        c.set(fx, ly + legH, shoeH);
    }
    return c.finish(INK);
}

// Front ('down') and back ('up') views.
function buildPersonFB(p, frame, face) {
    const kid = p.kid;
    const H = kid ? 24 : 31;
    const c = new Cells(16, H + 3);
    const T = 3, hx = 2, hy = T, headH = 10;
    const skin = p.skin, skinS = sh(skin, 0.22), hair = p.hair, hairS = sh(hair, 0.3), hairH = hi(hair, 0.3);
    let shirt = p.coat || p.shirt;
    if (p.costume === 'pumpkin')
        shirt = 0xf08a20;
    if (p.costume === 'witch' || p.costume === 'ghost')
        shirt = p.costume === 'ghost' ? 0xf4f4f8 : 0x4a2a6a;
    const shirtS = sh(shirt, 0.25), shirtH = hi(shirt, 0.2);
    const back = face === 'up';
    // head
    c.rect(hx + 1, hy + 2, 10, headH - 2, skin);
    c.rect(hx + 2, hy + headH, 8, 1, skin);
    c.rect(hx + 1, hy + headH - 2, 10, 1, skinS);
    if (p.style !== 'bald' || back) {
        c.rect(hx + 2, hy, 8, 1, hair);
        c.rect(hx + 1, hy + 1, 10, 3, hair);
        c.rect(hx + 3, hy + 1, 4, 1, hairH);
        c.rect(hx, hy + 2, 2, 5, hair);
        c.rect(hx + 10, hy + 2, 2, 5, hair);
    }
    if (back) {
        c.rect(hx + 1, hy + 2, 10, 7, hair);
        c.rect(hx + 2, hy + 3, 3, 1, hairH);
        if (p.style === 'long' || p.style === 'pony' || p.style === 'bob')
            c.rect(hx + 1, hy + 8, 10, p.style === 'bob' ? 2 : 5, hairS);
    } else {
        c.rect(hx + 3, hy + 4, 1, 2, INK);
        c.rect(hx + 8, hy + 4, 1, 2, INK);
        c.set(hx + 3, hy + 4, 0x6a4a5a);
        c.set(hx + 8, hy + 4, 0x6a4a5a);
        if (p.blush) {
            c.set(hx + 2, hy + 7, 0xf09a9a);
            c.set(hx + 9, hy + 7, 0xf09a9a);
        }
        c.rect(hx + 5, hy + 7, 2, 1, sh(skin, 0.4));
        if (p.style === 'long')
            c.rect(hx, hy + 2, 2, 10, hair), c.rect(hx + 10, hy + 2, 2, 10, hair);
    }
    if (p.style === 'cap' || p.style === 'beanie' || p.style === 'hat') {
        const hc = p.style === 'hat' ? 0x6a4a34 : p.style === 'beanie' ? (p.scarf || 0xd84848) : p.shirt;
        c.rect(hx + 1, hy - 1, 10, 3, hc);
        c.rect(hx + 2, hy - 1, 4, 1, hi(hc, 0.3));
        if (p.style === 'hat')
            c.rect(hx - 1, hy + 2, 14, 1, 0x7a5a40);
    }
    if (p.style === 'bun')
        c.rect(hx + 4, hy - 3, 4, 3, hair);
    // body
    const by = hy + headH + 1, bodyH = kid ? 6 : 8;
    c.rect(hx + 1, by, 10, bodyH, shirt);
    c.rect(hx + 1, by, 1, bodyH, shirtH);
    c.rect(hx + 10, by, 1, bodyH, shirtS);
    if (!back)
        c.rect(hx + 4, by, 4, 1, hi(shirt, 0.35));
    if (p.scarf)
        c.rect(hx + 2, by, 8, 2, p.scarf);
    if (p.backpack && back)
        c.rect(hx + 3, by + 1, 6, bodyH - 2, p.backpack);
    // arms swing opposite
    const sw = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    c.rect(hx - 1, by + 1 + sw, 2, bodyH - 3, sh(shirt, 0.15));
    c.rect(hx - 1, by + bodyH - 2 + sw, 2, 2, skin);
    if (frame === 4) {
        c.rect(hx + 11, by, 2, 2, sh(shirt, 0.15));
        c.rect(hx + 12, by - 6, 2, 6, sh(shirt, 0.15));
        c.rect(hx + 12, by - 8, 2, 2, skin);
    } else {
        c.rect(hx + 11, by + 1 - sw, 2, bodyH - 3, sh(shirt, 0.15));
        c.rect(hx + 11, by + bodyH - 2 - sw, 2, 2, skin);
    }
    // legs: one lifted while walking
    const ly = by + bodyH, legH = kid ? 5 : 7;
    if (p.dress) {
        c.rect(hx, ly, 12, 4, shirt);
        c.rect(hx, ly + 3, 12, 1, shirtS);
    } else {
        c.rect(hx + 2, ly, 8, 2, p.pants);
    }
    const legTop = p.dress ? ly + 4 : ly + 2;
    const lc = p.dress ? skin : p.pants;
    for (const [lx, lift] of [[hx + 2, frame === 1 ? 2 : 0], [hx + 6, frame === 3 ? 2 : 0]]) {
        c.rect(lx, legTop, 4, ly + legH - legTop - lift, lx === hx + 2 ? lc : sh(lc, 0.12));
        c.rect(lx, ly + legH - lift, 4, 2, p.shoes);
        if (!back)
            c.set(lx + 1, ly + legH - lift, hi(p.shoes, 0.3));
    }
    return c.finish(INK);
}

export function personFigure(p, frame, face = 'side') {
    if (face !== 'side' && frame !== 'sit') {
        // frame 4 is a front view wave with the right arm raised
        const fr = frame === 4 ? 4 : frame % 4, k = face + fr;
        return p.frames[k] || (p.frames[k] = buildPersonFB(p, fr, face));
    }
    const k = frame === 'sit' ? 'sit' : frame % 4;
    return p.frames[k] || (p.frames[k] = buildPerson(p, k));
}

// ---------------- pets ----------------

const DOGS = [[0xb07840, 0xe8d0a8], [0xf2ece0, 0x8a6a4a], [0x3a3030, 0xb08a60], [0xd8a050, 0xf8e8c8], [0x7a7a80, 0xe0e0e0], [0x8a4a2a, 0xf0e0c8]];

export function makeDog() {
    const [a, b] = pick(DOGS);
    return {a, b, big: chance(0.4), frames: [], t: 0, sniff: 0};
}

function buildDog(d, frame) {
    const big = d.big;
    const W = big ? 17 : 13, H = big ? 12 : 9;
    const c = new Cells(W, H);
    const a = d.a, b = d.b, aS = sh(a, 0.3), aH = hi(a, 0.25);
    const bodyY = big ? 4 : 3, bodyH = big ? 5 : 4, bodyW = big ? 11 : 8;
    c.rect(1, bodyY, bodyW, bodyH, a);
    c.rect(1, bodyY, bodyW, 1, aH);
    c.rect(3, bodyY + bodyH - 2, bodyW - 3, 2, b);
    // head
    const hx = bodyW - 1, hy = bodyY - (big ? 4 : 3);
    c.rect(hx, hy, 5, 5, a);
    c.rect(hx + 4, hy + 2, 2, 2, b);
    c.set(hx + 5, hy + 2, INK);
    c.set(hx + 3, hy + 1, INK);
    c.rect(hx, hy - 1, 2, 3, aS); // ear
    if (frame === 'happy')
        c.set(hx + 4, hy + 4, 0xe86070);
    // tail wags
    const wag = frame % 2;
    c.rect(0, bodyY - 1 - wag, 2, 2, a);
    c.set(0, bodyY - 2 - wag, aH);
    // legs
    const ly = bodyY + bodyH, lh = big ? 3 : 2;
    const pos = frame % 2 ? [1, 4, bodyW - 4, bodyW - 1] : [2, 3, bodyW - 3, bodyW - 2];
    pos.forEach((x, i) => c.rect(x, ly, 2, lh, i % 2 ? a : aS));
    return c.finish(INK);
}

export function dogFigure(d, frame) {
    const k = frame % 2;
    return d.frames[k] || (d.frames[k] = buildDog(d, k));
}

const CAT_COLORS = [[0x3a3038, 0x5a5058], [0xe89048, 0xf8c088], [0xf0ece4, 0xc8c0b4], [0x8a8a90, 0xb4b4b8], [0x6a4a30, 0xa07850]];
export function makeCat() {
    const [a, b] = pick(CAT_COLORS);
    return {a, b, frames: {}};
}

function buildCat(cat, pose) {
    const c = new Cells(12, 10);
    const a = cat.a, b = cat.b, aH = hi(a, 0.25);
    if (pose === 'sit') {
        c.rect(2, 4, 6, 6, a);
        c.rect(3, 5, 3, 4, b);
        c.rect(3, 0, 6, 5, a);
        c.set(3, -1, a);
        c.set(8, -1, a);
        c.set(4, 0, aH);
        c.set(6, 2, 0x58c040);
        c.set(8, 2, 0x58c040);
        c.set(7, 3, 0xf09a9a);
        c.rect(0, 6, 2, 4, a);
        c.set(0, 5, a);
    } else {
        const f = pose === 'walk1';
        c.rect(1, 4, 8, 3, a);
        c.rect(1, 4, 8, 1, aH);
        c.rect(7, 1, 4, 4, a);
        c.set(7, 0, a);
        c.set(10, 0, a);
        c.set(9, 2, 0x58c040);
        c.rect(0, 1, 1, 4, a);
        c.set(1, 0, a);
        c.rect(f ? 1 : 2, 7, 1, 2, a);
        c.rect(f ? 4 : 3, 7, 1, 2, a);
        c.rect(f ? 7 : 6, 7, 1, 2, a);
        c.rect(f ? 8 : 9, 7, 1, 2, a);
    }
    return c.finish(INK);
}

export function catFigure(cat, pose) {
    return cat.frames[pose] || (cat.frames[pose] = buildCat(cat, pose));
}

// Person plus props, feet at (x, y).
export function drawPerson(g, p, x, y, dir, env, face = 'side') {
    const moving = p.state !== 'wait' && p.state !== 'sit' && p.state !== 'chat' && p.state !== 'crosswait' && p.state !== 'fish' && p.state !== 'idle';
    const frame = p.state === 'sit' ? 'sit' : moving ? Math.floor(p.t * p.speed / 6) % 4 : 0;
    const f = personFigure(p, frame, face);
    const flip = dir < 0;
    const bob = moving && (frame === 1 || frame === 3) ? 1 : 0;
    // soft shadow
    g.blend(x + 1, y - 1, f.w - 2, 2, 0x1a1028, 0.25);
    drawFigure(g, f, x, y - bob, flip);
    const top = y - bob - f.h;
    if (p.umbrella) {
        // held in the hand, canopy well above the head
        const c = p.umbrella;
        const hand = face === 'side' ? (flip ? x + 4 : x + f.w - 5) : x + f.w - 3;
        const ux = Math.floor(hand - (face === 'side' ? (flip ? -2 : 2) : 3));
        const cy = top - 13;
        g.rect(hand, cy + 4, 1, top + 19 - cy - 4, INK);
        g.rect(hand - 1, top + 18, 2, 2, INK);
        for (let i = 0; i < 6; i++) {
            const half = 3 + i * 2;
            g.rect(ux - half - 1, cy + i, half * 2 + 3, 1, INK);
            g.rect(ux - half, cy + i, half * 2 + 1, 1, i < 2 ? hi(c, 0.35) : i === 5 ? sh(c, 0.25) : c);
        }
        for (let i = -12; i <= 12; i += 6) {
            g.px(ux + i, cy + 6, INK);
            g.px(ux + i, cy + 5, sh(c, 0.35));
        }
        g.rect(ux, cy - 2, 1, 2, INK);
    }
    if (p.balloon) {
        const bx = Math.floor(x + (flip ? 3 : f.w - 4)), by = Math.floor(top - 10 + Math.sin(p.t * 2) * 1.5);
        g.line(bx, by + 4, Math.floor(x + (flip ? 4 : f.w - 5)), top + 11, 0xd8d8d8);
        g.disc(bx, by, 4, INK);
        g.disc(bx, by, 3, p.balloon);
        g.rect(bx - 2, by - 2, 2, 1, hi(p.balloon, 0.6));
        g.px(bx, by + 4, p.balloon);
    }
    if (p.cane) {
        const cx = flip ? x + 1 : x + f.w - 2;
        g.rect(cx, y - 10, 1, 10, 0x6a4a30);
        g.rect(cx - (flip ? 0 : 1), y - 11, 2, 1, 0x6a4a30);
    }
    if (p.phone && env.dark > 0.5 && moving) {
        // held in the hand in front of the chest, not at the mouth
        const px = flip ? x + 3 : x + f.w - 4;
        g.rectE(px, top + 17, 2, 2, 0xb0d8ff);
        g.glow(px + 1, top + 16, 4, 0x80b0ff, 0.18);
    }
    if (p.dog) {
        const d = p.dog;
        const df = dogFigure(d, d.sniff > 0 ? 0 : Math.floor(p.t * 6));
        const dx = flip ? x + f.w + 6 : x - df.w - 6;
        drawFigure(g, df, dx, y, flip);
        g.line(flip ? x + 3 : x + f.w - 4, top + 19, flip ? dx + 3 : dx + df.w - 4, y - df.h + 5, 0xb83a3a);
    }
}
