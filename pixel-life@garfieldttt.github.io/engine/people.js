// Pixel people (about 14x30), pets and their props. Every person is
// a random mix of body, clothes, hair and accessories; walk frames are
// built once per person and cached.
import {rand, chance, pick, weighted} from './util.js';
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

// ---------------- medieval townsfolk ----------------

// undyed wool and plant dyes for common folk, deep colors for the rich
const WOOL = [0x8a6a4a, 0x7a5a3a, 0xa08a6a, 0x6a6a5a, 0x9a7a5a, 0x5a6a4a, 0xb8a888, 0x8a7a68];
const DYED = [0x9a3a2a, 0x3a5a8a, 0x5a7a3a, 0xb88a3a, 0x7a4a6a, 0x8a2a2a, 0x4a6a6a];
const RICH = [0x8a1a2a, 0x1a3a7a, 0x2a5a3a, 0x5a2a6a, 0x9a6a1a, 0x1a1a3a];
const HOSE = [0x5a4a3a, 0x3a3a4a, 0x6a5a40, 0x7a2a2a, 0x3a4a6a, 0x4a5a3a];
const BOOTS = [0x4a2a1a, 0x3a2a20, 0x5a3a24];

// role: peasant, townsman, townswoman, merchant, monk, nun, guard, elder,
// kid, pilgrim, noble, watchman, crier, minstrel, juggler, knight, baker,
// water (carrier); without one a common townsperson is picked
export function makeMedieval(env, opts = {}) {
    const role = opts.role ?? weighted([['peasant', 5], ['townsman', 4], ['townswoman', 5], ['merchant', 1.2], ['monk', 0.7],
        ['nun', 0.3], ['guard', 0.6], ['elder', 1.2], ['kid', 2.4], ['pilgrim', 0.3], ['noble', 0.25]]);
    const kid = role === 'kid', elder = role === 'elder';
    const woman = role === 'townswoman' || role === 'nun' || ((kid || elder || role === 'peasant' || role === 'noble') && chance(0.5));
    const p = {
        role, kid, elder, woman,
        skin: pick(SKINS),
        hair: elder ? pick([0xe8e4dc, 0xc0bcb8, 0x9a9a9a]) : pick([0x3a2418, 0x6a3c20, 0xa85c2c, 0xe8c060, 0x2a2430, 0xc8442c, 0x7a5a3a]),
        style: woman ? pick(['long', 'bun', 'pony']) : pick(['short', 'short', 'curly', 'bald']),
        shirt: pick(WOOL),
        pants: pick(HOSE),
        shoes: pick(BOOTS),
        speed: kid ? rand(16, 22) : elder ? rand(7, 10) : rand(11, 16),
        frames: [],
        t: rand(10),
        blush: chance(0.5),
    };
    if (woman) {
        p.robe = !kid;
        p.tunic = kid;
        p.shirt = pick(chance(0.5) ? DYED : WOOL);
        p.style = kid ? pick(['long', 'pony']) : pick(['veil', 'coif', 'veil', 'long']);
        p.veil = pick([0xf2eee4, 0xe8e0c8, 0xd8e0e8]);
        if (!kid && chance(0.45))
            p.apron = pick([0xf0ece0, 0xe0d8c0]);
    } else {
        p.tunic = true;
        p.shirt = pick(chance(0.35) ? DYED : WOOL);
        if (chance(0.45)) {
            p.style = 'hood';
            p.hood = pick([...WOOL, ...DYED]);
        } else if (chance(0.3)) {
            p.style = pick(['straw', 'coif']);
        }
        p.belt = chance(0.7) ? pick([0x4a2a1a, 0x3a2418]) : 0;
    }
    switch (role) {
    case 'peasant':
        if (!woman && env.season === 'summer' && chance(0.4))
            p.style = 'straw';
        p.carry = weighted([['basket', 3], ['sack', 2], ['none', 4], ['staff', 0.5]]);
        break;
    case 'merchant':
        p.shirt = pick(RICH);
        p.robe = true;
        p.style = 'feather';
        p.cap = pick(RICH);
        p.feather = pick([0xf0ece0, 0x3a6aa8, 0xd84848]);
        p.belt = 0xd8b040;
        p.carry = chance(0.3) ? 'sack' : 'none';
        break;
    case 'monk':
        p.shirt = pick([0x5a3a24, 0x6a4a2a, 0x2a2420, 0xe8e0d0]);
        p.robe = true;
        p.tunic = false;
        p.style = chance(0.5) ? 'tonsure' : 'hood';
        p.hood = p.shirt;
        p.belt = 0xe8dcb8;
        p.carry = chance(0.3) ? 'staff' : 'none';
        p.speed = rand(8, 11);
        break;
    case 'nun':
        p.shirt = 0x2a2430;
        p.veil = 0x2a2430;
        p.style = 'veil';
        p.apron = 0;
        p.speed = rand(8, 11);
        break;
    case 'guard':
    case 'watchman':
        p.armor = true;
        p.shirt = 0x8a8e98;
        p.tabard = opts.tabard ?? 0x9a2a2a;
        p.charge = 0xf0c030;
        p.style = 'helm';
        p.pants = 0x5a5e68;
        p.carry = role === 'watchman' ? 'halberd' : chance(0.5) ? 'spear' : 'halberd';
        p.speed = rand(9, 12);
        if (role === 'watchman') {
            p.lantern = true;
            p.armor = false;
            p.shirt = pick([0x5a4a3a, 0x4a4a5a]);
            p.coat = 0x3a3a48;
            p.style = 'hood';
            p.hood = 0x3a3a48;
        }
        break;
    case 'elder':
        p.carry = chance(0.6) ? 'staff' : 'none';
        break;
    case 'kid':
        p.carry = chance(0.15) ? 'hoop' : 'none';
        break;
    case 'pilgrim':
        p.robe = true;
        p.shirt = 0x6a5a48;
        p.style = 'straw';
        p.carry = 'staff';
        p.shell = true;
        break;
    case 'noble':
        p.shirt = pick(RICH);
        p.robe = woman || chance(0.5);
        p.style = woman ? 'veil' : 'feather';
        p.veil = 0xf8f4ec;
        p.cap = pick(RICH);
        p.feather = 0xf0ece0;
        p.belt = 0xd8b040;
        break;
    case 'crier':
        p.shirt = 0x2a5a9a;
        p.style = 'feather';
        p.cap = 0x9a2a2a;
        p.feather = 0xf0d040;
        p.carry = 'bell';
        break;
    case 'minstrel':
        p.shirt = pick([0xd84848, 0x3a8a4a, 0xe8a640]);
        p.pants = pick([0xf0d040, 0x3a5a9a]);
        p.style = 'feather';
        p.cap = pick([0x3a8a4a, 0x9a2a2a]);
        p.carry = 'lute';
        break;
    case 'juggler':
        p.shirt = pick([0xd84848, 0x3a6ac8]);
        p.pants = pick([0xf0d040, 0x5aae58]);
        p.style = 'feather';
        p.cap = 0xf0d040;
        break;
    case 'knight':
        p.armor = true;
        p.shirt = 0x8a8e98;
        p.tabard = opts.tabard ?? pick([0x1a3a7a, 0x8a1a2a, 0x2a5a3a, 0xf0ece0]);
        p.charge = pick([0xf0c030, 0xf0ece0, 0xd83030]);
        p.style = 'helm';
        p.pants = 0x6a6e78;
        break;
    case 'baker':
        p.shirt = 0xf0ece0;
        p.apron = 0xffffff;
        p.style = 'coif';
        p.carry = 'bread';
        break;
    case 'water':
        p.carry = 'yoke';
        p.speed = rand(8, 11);
        break;
    }
    if (env.season === 'winter' && !p.armor && chance(0.6))
        p.coat = pick([0x5a3a2a, 0x3a4a3a, 0x4a3a4a, 0x6a5a48]);
    // no umbrellas: hoods go up in the rain
    if (env.weather.v.rain > 0.3 && !woman && !p.armor && p.style !== 'tonsure' && chance(0.7)) {
        p.style = 'hood';
        p.hood = p.hood || pick(WOOL);
    }
    // after dark the town law wants a light in the hand
    if (env.dark > 0.55 && !kid && chance(0.6))
        p.lantern = true;
    return p;
}

// frame: 0 stand, 1 step, 2 pass, 3 other step; 'sit' for sitting
// The head is drawn on its usual small grid and stretched on the way
// onto the figure: from row sys[i] on everything moves down one more row
// and from column sx on one column right, so rects spanning those lines
// grow. Every hair style and hat grows with it, giving the big round
// heads of cozy pixel games.
function stretchHead(c, sx, sys) {
    const X = x => x + (x >= sx ? 1 : 0), Y = y => y + sys.filter(s => y >= s).length;
    return {
        set: (x, y, col) => c.set(X(x), Y(y), col),
        rect: (x, y, w, h, col) => c.rect(X(x), Y(y), X(x + w - 1) - X(x) + 1, Y(y + h - 1) - Y(y) + 1, col),
        hline: (x, y, w, col) => c.rect(X(x), Y(y), X(x + w - 1) - X(x) + 1, 1, col),
        get: (x, y) => c.get(X(x), Y(y)),
    };
}
// rows the head grows by
const HEAD_GROW = 2;

function buildPerson(p, frame, blink = false) {
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
    const hc = stretchHead(c, hx + 6, [hy + 3, hy + 7]);
    hc.rect(hx + 2, hy + 2, 9, headH - 2, skin);
    hc.rect(hx + 3, hy + headH, 7, 1, skin);
    hc.rect(hx + 2, hy + headH - 2, 2, 2, skinS);
    if (blink) {
        hc.set(hx + 8, hy + 6, INK);
        hc.set(hx + 9, hy + 6, sh(skin, 0.3));
    } else {
        hc.set(hx + 8, hy + 5, INK);
        hc.set(hx + 8, hy + 6, INK);
        hc.set(hx + 9, hy + 5, 0x6a4a5a);
    }
    if (p.blush)
        hc.set(hx + 7, hy + 8, 0xf09a9a);
    hc.set(hx + 10, hy + 8, sh(skin, 0.35));
    hc.set(hx + 11, hy + 5, skin);
    hc.set(hx + 11, hy + 6, skin);
    hc.set(hx + 4, hy + 6, skinS); // ear
    const style = p.costume === 'witch' ? 'witch' : p.style;
    if (style !== 'bald') {
        hc.rect(hx + 3, hy, 7, 1, hair);
        hc.rect(hx + 1, hy + 1, 10, 2, hair);
        hc.rect(hx + 1, hy + 3, 4, 3, hair);
        hc.rect(hx + 5, hy + 3, 6, 1, hair); // fringe
        hc.set(hx + 9, hy + 4, hair);
        hc.rect(hx + 4, hy + 1, 4, 1, hairH);
        hc.set(hx + 1, hy + 5, hairS);
    } else {
        hc.rect(hx + 1, hy + 4, 3, 3, hair);
    }
    switch (style) {
    case 'long':
        hc.rect(hx, hy + 3, 3, 9, hair);
        hc.rect(hx + 1, hy + 6, 3, 6, hair);
        hc.set(hx, hy + 11, hairS);
        break;
    case 'bob':
        hc.rect(hx, hy + 3, 4, 6, hair);
        hc.rect(hx + 10, hy + 3, 1, 4, hair);
        break;
    case 'pony':
        hc.rect(hx - 2, hy + 3, 3, 2, hair);
        hc.rect(hx - 2, hy + 5, 2, 5, hair);
        hc.set(hx - 1, hy + 3, 0xd84848);
        break;
    case 'bun':
        hc.rect(hx + 2, hy - 3, 4, 3, hair);
        hc.set(hx + 3, hy - 3, hairH);
        break;
    case 'spiky':
        for (let i = 0; i < 4; i++)
            hc.set(hx + 2 + i * 2, hy - 1, hair);
        break;
    case 'curly':
        for (let i = 0; i < 6; i++)
            hc.set(hx + 1 + i * 2, hy - 1, hair);
        hc.rect(hx, hy + 2, 2, 6, hair);
        break;
    case 'cap':
        hc.rect(hx + 1, hy - 1, 10, 3, p.shirt === shirt ? sh(p.shirt, 0.1) : p.shirt);
        hc.rect(hx + 8, hy + 2, 5, 1, sh(p.shirt, 0.35));
        hc.rect(hx + 3, hy - 1, 3, 1, hi(p.shirt, 0.3));
        break;
    case 'hat':
        hc.rect(hx + 2, hy - 2, 8, 3, 0x6a4a34);
        hc.rect(hx, hy + 1, 13, 1, 0x7a5a40);
        hc.rect(hx + 2, hy, 8, 1, 0xc84a3a);
        break;
    case 'beanie':
        hc.rect(hx + 1, hy - 1, 10, 4, p.scarf || 0xd84848);
        hc.rect(hx + 1, hy + 2, 10, 1, hi(p.scarf || 0xd84848, 0.4));
        hc.rect(hx + 5, hy - 3, 2, 2, 0xf4f4f4);
        break;
    case 'witch':
        hc.rect(hx + 5, hy - 3, 2, 3, 0x2a1a3a);
        hc.rect(hx + 3, hy - 1, 6, 2, 0x2a1a3a);
        hc.rect(hx, hy + 1, 13, 1, 0x3a2a4a);
        break;
    // medieval headwear
    case 'hood': {
        // hood with a shoulder cape and a short tail (liripipe)
        const hd = p.hood, hdS = sh(hd, 0.3), hdH = hi(hd, 0.25);
        hc.rect(hx + 2, hy - 1, 8, 1, hd);
        hc.rect(hx + 1, hy, 10, 3, hd);
        hc.rect(hx, hy + 2, 5, 9, hd);
        hc.rect(hx + 9, hy + 2, 2, 2, hd);
        hc.rect(hx + 3, hy, 5, 1, hdH);
        hc.rect(hx, hy + 8, 3, 3, hdS);
        hc.rect(hx - 2, hy + 3, 3, 2, hd);
        hc.set(hx - 3, hy + 4, hdS);
        break;
    }
    case 'coif':
        hc.rect(hx + 1, hy - 1, 9, 4, 0xf0ece0);
        hc.rect(hx + 1, hy + 3, 3, 4, 0xf0ece0);
        hc.rect(hx + 2, hy - 1, 6, 1, 0xffffff);
        hc.rect(hx + 1, hy + 6, 3, 1, 0xd8d0c0);
        break;
    case 'veil': {
        // veil over the hair and a wimple around the chin
        const v = p.veil || 0xf2eee4, vS = sh(v, 0.2);
        hc.rect(hx + 1, hy - 1, 10, 3, v);
        hc.rect(hx, hy + 2, 5, 11, v);
        hc.rect(hx + 5, hy + 9, 5, 2, v);
        hc.rect(hx + 9, hy + 2, 2, 2, v);
        hc.rect(hx, hy + 10, 3, 3, vS);
        hc.rect(hx + 3, hy - 1, 5, 1, hi(v, 0.4));
        break;
    }
    case 'tonsure':
        hc.rect(hx + 3, hy, 6, 2, skin);
        hc.rect(hx + 4, hy, 3, 1, hi(skin, 0.25));
        break;
    case 'helm':
        // iron kettle hat with a wide brim
        hc.rect(hx + 2, hy - 2, 8, 4, 0x8a8e98);
        hc.rect(hx + 3, hy - 2, 4, 1, 0xc8ccd4);
        hc.rect(hx - 1, hy + 2, 14, 1, 0x6a6e78);
        hc.rect(hx, hy + 2, 6, 1, 0xa8acb4);
        break;
    case 'feather': {
        const cap = p.cap || 0x8a1a2a;
        hc.rect(hx + 1, hy - 1, 11, 3, cap);
        hc.rect(hx + 2, hy - 1, 5, 1, hi(cap, 0.3));
        hc.rect(hx, hy + 1, 3, 1, sh(cap, 0.3));
        hc.rect(hx + 1, hy - 5, 2, 4, p.feather || 0xf0ece0);
        hc.set(hx, hy - 6, p.feather || 0xf0ece0);
        break;
    }
    case 'straw':
        hc.rect(hx + 2, hy - 2, 8, 3, 0xe0c068);
        hc.rect(hx + 3, hy - 2, 4, 1, 0xf4dc90);
        hc.rect(hx - 2, hy + 1, 16, 1, 0xd0aa50);
        hc.rect(hx + 2, hy, 8, 1, 0x9a5a3a);
        break;
    case 'crown':
        hc.rect(hx + 2, hy - 2, 8, 2, 0xf0c030);
        hc.set(hx + 2, hy - 3, 0xf0c030);
        hc.set(hx + 5, hy - 3, 0xf0c030);
        hc.set(hx + 9, hy - 3, 0xf0c030);
        hc.set(hx + 5, hy - 2, 0xd83030);
        break;
    }
    // ---- body (shorter by what the head grew)
    const by = hy + headH + 1 + HEAD_GROW;
    const bodyH = kid ? 5 : 7;
    // the far arm swings the other way, mostly behind the body
    if (frame !== 'sit' && !p.umbrella) {
        const back = frame === 1 ? -3 : frame === 3 ? 3 : 0;
        c.rect(hx + 3 + back, by + 1, 3, bodyH - 3, sh(shirt, 0.35));
        c.rect(hx + 3 + back, by + bodyH - 2, 3, 2, skinS);
    }
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
    if (p.armor) {
        // mail shirt under a tabard in the wearer's colors
        for (let yy = by; yy < by + bodyH; yy++)
            for (let xx = hx + 2; xx < hx + 11; xx++)
                if ((xx + yy) % 2)
                    c.set(xx, yy, 0x6a6e78);
        c.rect(hx + 4, by, 6, bodyH, p.tabard);
        c.rect(hx + 4, by, 1, bodyH, hi(p.tabard, 0.25));
        c.rect(hx + 6, by + 2, 2, 3, p.charge || 0xf0c030);
    }
    if (p.style === 'hood' && !p.armor)
        c.rect(hx + 1, by, 11, 3, p.hood), c.rect(hx + 1, by + 2, 11, 1, sh(p.hood, 0.3));
    if (p.apron)
        c.rect(hx + 8, by + 3, 3, bodyH - 3, p.apron);
    if (p.belt)
        c.rect(hx + 2, by + bodyH - 2, 9, 1, p.belt);
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
    const legH = kid ? 4 : 6;
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
    if (p.robe) {
        // long robe down to the shoes; the hem sways with the step
        const sway = frame === 1 ? 1 : frame === 3 ? -1 : 0;
        for (let i = 0; i < legH; i++) {
            const k = i / legH, wid = 10 + Math.round(k * 2), o = Math.round(sway * k);
            c.rect(hx + 1 + o - Math.round(k), ly + i, wid, 1, shirt);
            c.set(hx + 10 + o + Math.round(k), ly + i, shirtS);
        }
        c.rect(hx + Math.round(sway), ly + legH - 1, 13, 1, shirtS);
        if (p.apron)
            c.rect(hx + 8, ly, 3, legH - 1, p.apron);
        const off = frame === 1 ? 2 : frame === 3 ? -2 : 0;
        c.rect(hx + 6 + off, ly + legH, 4, 2, p.shoes);
        if (frame === 1 || frame === 3)
            c.rect(hx + 3 - off, ly + legH, 4, 2, sh(p.shoes, 0.2));
        return c.finish(INK);
    }
    if (p.dress || p.tunic) {
        c.rect(hx + 1, ly, 11, 4, shirt);
        c.rect(hx + 1, ly + 3, 11, 1, shirtS);
        c.rect(hx + 10, ly, 2, 4, shirtS);
        if (p.armor)
            c.rect(hx + 4, ly, 6, 3, p.tabard);
        if (p.apron)
            c.rect(hx + 8, ly, 3, 3, p.apron);
    } else {
        c.rect(hx + 3, ly, 8, 2, pants);
        c.rect(hx + 3, ly, 8, 1, sh(pants, 0.45));
    }
    const legTop = p.dress || p.tunic ? ly + 4 : ly + 2;
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
function buildPersonFB(p, frame, face, blink = false) {
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
    const hc = stretchHead(c, hx + 6, [hy + 3, hy + 7]);
    hc.rect(hx + 1, hy + 2, 10, headH - 2, skin);
    hc.rect(hx + 2, hy + headH, 8, 1, skin);
    hc.rect(hx + 1, hy + headH - 2, 2, 1, skinS);
    hc.rect(hx + 9, hy + headH - 2, 2, 1, skinS);
    if (p.style !== 'bald' || back) {
        hc.rect(hx + 2, hy, 8, 1, hair);
        hc.rect(hx + 1, hy + 1, 10, 3, hair);
        hc.rect(hx + 3, hy + 1, 4, 1, hairH);
        hc.rect(hx, hy + 2, 2, 5, hair);
        hc.rect(hx + 10, hy + 2, 2, 5, hair);
    }
    if (back) {
        hc.rect(hx + 1, hy + 2, 10, 7, hair);
        hc.rect(hx + 2, hy + 3, 3, 1, hairH);
        if (p.style === 'long' || p.style === 'pony' || p.style === 'bob')
            hc.rect(hx + 1, hy + 8, 10, p.style === 'bob' ? 2 : 5, hairS);
    } else {
        hc.rect(hx + 3, hy + (blink ? 5 : 4), 1, blink ? 1 : 2, INK);
        hc.rect(hx + 8, hy + (blink ? 5 : 4), 1, blink ? 1 : 2, INK);
        hc.set(hx + 3, hy + 4, 0x6a4a5a);
        hc.set(hx + 8, hy + 4, 0x6a4a5a);
        if (p.blush) {
            hc.set(hx + 2, hy + 7, 0xf09a9a);
            hc.set(hx + 9, hy + 7, 0xf09a9a);
        }
        hc.rect(hx + 5, hy + 7, 2, 1, sh(skin, 0.4));
        if (p.style === 'long')
            hc.rect(hx, hy + 2, 2, 10, hair), hc.rect(hx + 10, hy + 2, 2, 10, hair);
    }
    if (p.style === 'cap' || p.style === 'beanie' || p.style === 'hat') {
        const hatC = p.style === 'hat' ? 0x6a4a34 : p.style === 'beanie' ? (p.scarf || 0xd84848) : p.shirt;
        hc.rect(hx + 1, hy - 1, 10, 3, hatC);
        hc.rect(hx + 2, hy - 1, 4, 1, hi(hatC, 0.3));
        if (p.style === 'hat')
            hc.rect(hx - 1, hy + 2, 14, 1, 0x7a5a40);
    }
    if (p.style === 'bun')
        hc.rect(hx + 4, hy - 3, 4, 3, hair);
    const headwear = {hood: p.hood, coif: 0xf0ece0, veil: p.veil || 0xf2eee4, helm: 0x8a8e98, feather: p.cap, straw: 0xe0c068, crown: 0xf0c030}[p.style];
    if (headwear) {
        hc.rect(hx + 1, hy - 1, 10, 3, headwear);
        hc.rect(hx + 2, hy - 1, 4, 1, hi(headwear, 0.3));
        if (p.style === 'hood' || p.style === 'veil') {
            hc.rect(hx, hy + 1, 2, 9, headwear);
            hc.rect(hx + 10, hy + 1, 2, 9, headwear);
            if (back)
                hc.rect(hx + 1, hy + 1, 10, 9, headwear);
        }
        if (p.style === 'straw' || p.style === 'helm')
            hc.rect(hx - 2, hy + 2, 16, 1, sh(headwear, 0.2));
    }
    // body
    const by = hy + headH + 1 + HEAD_GROW, bodyH = kid ? 5 : 7;
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
    if (p.armor)
        c.rect(hx + 3, by, 6, bodyH, p.tabard);
    if (p.apron && !back)
        c.rect(hx + 3, by + 3, 6, bodyH - 3, p.apron);
    if (p.belt)
        c.rect(hx + 1, by + bodyH - 2, 10, 1, p.belt);
    // legs: one lifted while walking
    const ly = by + bodyH, legH = kid ? 4 : 6;
    if (p.robe) {
        c.rect(hx, ly, 12, legH, shirt);
        c.rect(hx, ly + legH - 1, 12, 1, shirtS);
        if (p.apron && !back)
            c.rect(hx + 3, ly, 6, legH - 1, p.apron);
        c.rect(hx + 2, ly + legH, 3, 2, p.shoes);
        c.rect(hx + 7, ly + legH, 3, 2, p.shoes);
        return c.finish(INK);
    }
    if (p.dress || p.tunic) {
        c.rect(hx, ly, 12, 4, shirt);
        c.rect(hx, ly + 3, 12, 1, shirtS);
    } else {
        c.rect(hx + 2, ly, 8, 2, p.pants);
    }
    const legTop = p.dress || p.tunic ? ly + 4 : ly + 2;
    const lc = p.dress ? skin : p.pants;
    for (const [lx, lift] of [[hx + 2, frame === 1 ? 2 : 0], [hx + 6, frame === 3 ? 2 : 0]]) {
        c.rect(lx, legTop, 4, ly + legH - legTop - lift, lx === hx + 2 ? lc : sh(lc, 0.12));
        c.rect(lx, ly + legH - lift, 4, 2, p.shoes);
        if (!back)
            c.set(lx + 1, ly + legH - lift, hi(p.shoes, 0.3));
    }
    return c.finish(INK);
}

export function personFigure(p, frame, face = 'side', blink = false) {
    if (face !== 'side' && frame !== 'sit') {
        // frame 4 is a front view wave with the right arm raised
        const fr = frame === 4 ? 4 : frame % 4, k = face + fr + (blink ? 'b' : '');
        return p.frames[k] || (p.frames[k] = buildPersonFB(p, fr, face, blink));
    }
    const k = (frame === 'sit' ? 'sit' : frame % 4) + (blink ? 'b' : '');
    return p.frames[k] || (p.frames[k] = buildPerson(p, frame === 'sit' ? 'sit' : frame % 4, blink));
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
    // everybody blinks now and then
    p.blinkPh = p.blinkPh ?? Math.random() * 4;
    const blink = face !== 'up' && (p.t + p.blinkPh) % 3.7 < 0.14;
    const f = personFigure(p, frame, face, blink);
    const flip = dir < 0;
    const bob = moving && (frame === 1 || frame === 3) ? 1 : 0;
    g.footShadow(x + f.w / 2, y, f.w - 4, 0.3);
    drawFigure(g, f, x, y - bob, flip);
    const top = y - bob - f.h;
    if (p.umbrella) {
        // held in the hand, canopy well above the head
        const c = p.umbrella;
        const hand = face === 'side' ? (flip ? x + 4 : x + f.w - 5) : x + f.w - 3;
        const ux = Math.floor(hand - (face === 'side' ? (flip ? -2 : 2) : 3));
        const cy = top - 13;
        g.rect(hand, cy + 4, 1, top + 21 - cy - 4, INK);
        g.rect(hand - 1, top + 20, 2, 2, INK);
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
        g.line(bx, by + 4, Math.floor(x + (flip ? 4 : f.w - 5)), top + 13, 0xd8d8d8);
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
        g.rectE(px, top + 19, 2, 2, 0xb0d8ff);
        g.glow(px + 1, top + 18, 4, 0x80b0ff, 0.18);
    }
    if (p.carry && p.carry !== 'none')
        drawCarry(g, p, f, x, top, flip, env);
    if (p.lantern) {
        // lantern hanging from the hand: a candle behind horn panes
        const lx = Math.floor(flip ? x + 1 : x + f.w - 4), ly = top + 22 + (moving && Math.floor(p.t * 4) % 2 ? 1 : 0);
        g.rect(lx, ly - 3, 1, 3, INK);
        g.rect(lx - 2, ly, 5, 6, INK);
        if (env.dark > 0.4) {
            g.rectE(lx - 1, ly + 1, 3, 4, 0xffc860);
            g.glow(lx, ly + 3, 14, 0xffb850, 0.3);
        } else {
            g.rect(lx - 1, ly + 1, 3, 4, 0xd8c8a0);
        }
    }
    if (p.dog) {
        const d = p.dog;
        const df = dogFigure(d, d.sniff > 0 ? 0 : Math.floor(p.t * 6));
        const dx = flip ? x + f.w + 6 : x - df.w - 6;
        drawFigure(g, df, dx, y, flip);
        g.line(flip ? x + 3 : x + f.w - 4, top + 21, flip ? dx + 3 : dx + df.w - 4, y - df.h + 5, 0xb83a3a);
    }
}

// things medieval folk carry, drawn over the figure; the hand is at about
// top + 19 on the side the figure faces
function drawCarry(g, p, f, x, top, flip, env) {
    const front = flip ? x + 2 : x + f.w - 4, back = flip ? x + f.w - 4 : x + 2;
    const hy = top + 21, t = p.t;
    switch (p.carry) {
    case 'basket':
        g.rect(front - 3, hy - 1, 8, 6, INK);
        g.rect(front - 2, hy, 6, 4, 0xb8884a);
        g.rect(front - 2, hy + 2, 6, 1, 0x8a5a2a);
        g.rect(front - 1, hy - 1, 2, 1, 0xd84848);
        g.rect(front + 2, hy - 1, 2, 1, 0x6ab84a);
        g.rect(front - 1, hy - 4, 4, 1, INK);
        g.rect(front - 2, hy - 3, 1, 2, INK);
        g.rect(front + 3, hy - 3, 1, 2, INK);
        break;
    case 'sack': {
        // bulging sack over the shoulder, tied at the neck
        const sx = back - 3;
        g.rect(sx + 1, top + 11, 7, 11, INK);
        g.rect(sx, top + 13, 9, 7, INK);
        g.rect(sx + 2, top + 12, 5, 9, 0xc8b088);
        g.rect(sx + 1, top + 14, 7, 5, 0xc8b088);
        g.rect(sx + 2, top + 12, 2, 6, 0xe0cca8);
        g.rect(sx + 6, top + 15, 2, 5, 0xa08a68);
        g.rect(sx + 3, top + 10, 3, 2, INK);
        g.rect(sx + 4, top + 9, 1, 1, 0x8a6a40);
        break;
    }
    case 'staff':
        g.rect(front + 1, top - 2, 1, f.h + 2, 0x6a4a2a);
        g.rect(front, top - 3, 3, 2, 0x8a6a3a);
        if (p.shell)
            g.rect(front - 1, top + 1, 3, 2, 0xf0e8d8);
        break;
    case 'spear':
        g.rect(front + 1, top - 12, 1, f.h + 12, 0x6a4a2a);
        g.rect(front, top - 17, 3, 5, 0xc8ccd4);
        g.px(front + 1, top - 18, 0xc8ccd4);
        break;
    case 'halberd':
        g.rect(front + 1, top - 12, 1, f.h + 12, 0x6a4a2a);
        g.rect(front + 1, top - 18, 1, 6, 0xc8ccd4);
        g.rect(front - 3, top - 15, 4, 5, 0xa8acb4);
        g.rect(front - 3, top - 15, 4, 1, 0xd8dce4);
        g.rect(front + 2, top - 13, 2, 2, 0xa8acb4);
        break;
    case 'lute':
        g.rect(front - 6, top + 16, 8, 7, INK);
        g.rect(front - 5, top + 17, 6, 5, 0xc8883a);
        g.px(front - 3, top + 19, INK);
        g.rect(front + 1, top + 14, 6, 2, 0x8a5a2a);
        break;
    case 'bell': {
        // the crier rings a hand bell above his head
        const up = Math.floor(t * 6) % 2;
        g.rect(front, top - 2 + up, 1, 8, 0x6a4a2a);
        g.rect(front - 2, top - 7 + up, 5, 5, INK);
        g.rect(front - 1, top - 6 + up, 3, 4, 0xe0b040);
        break;
    }
    case 'bread':
        // board of loaves on the head
        g.rect(x, top + 2, f.w, 2, INK);
        g.rect(x + 1, top + 2, f.w - 2, 1, 0x8a6a40);
        for (let i = 0; i < 3; i++) {
            g.rect(x + 2 + i * 4, top - 1, 5, 3, INK);
            g.rect(x + 3 + i * 4, top, 3, 2, 0xd8983a);
            g.px(x + 3 + i * 4, top, 0xf0c060);
        }
        break;
    case 'yoke': {
        // water carrier: a pole over the shoulders, a bucket at each end
        const sx = x + f.w / 2;
        g.rect(sx - 13, top + 15, 27, 1, 0x6a4a2a);
        for (const bx of [sx - 13, sx + 11]) {
            g.rect(bx + 1, top + 16, 1, 6, 0x5a4a3a);
            g.rect(bx - 1, top + 22, 5, 6, INK);
            g.rect(bx, top + 23, 3, 4, 0x8a6a40);
            g.rect(bx, top + 23, 3, 1, 0x8ac0e8);
        }
        break;
    }
    case 'torch': {
        g.rect(front + 1, top + 6, 1, 16, 0x6a4a2a);
        const fl = Math.floor(t * 9) % 3;
        g.rectE(front, top + 1 - fl % 2, 3, 3, 0xffa030);
        g.pxE(front + 1, top - 1 - fl, 0xffe080);
        g.glow(front + 1, top + 2, 18, 0xff9a40, 0.35);
        break;
    }
    case 'banner': {
        // a banner on a pole, flying with the wind
        const lean = env.weather.lean(x), dir = lean < 0 ? -1 : 1, fx = front + 1;
        g.rect(fx, top - 22, 1, f.h + 22, 0x6a4a2a);
        for (let i = 0; i < 12; i++) {
            const wave = Math.round(Math.sin(t * 5 + i * 0.6) * Math.min(2, Math.abs(lean) + 0.5));
            g.rect(fx + dir * (i + 1), top - 21 + wave, 1, 8, i % 4 === 3 ? INK : p.flag || 0xd83030);
        }
        g.rect(fx, top - 23, 1, 1, 0xf0c030);
        break;
    }
    case 'hoop': {
        const hx = front + 6;
        g.rect(hx - 3, top + 24, 7, 1, 0x8a6a40);
        g.rect(hx - 3, top + 30, 7, 1, 0x8a6a40);
        g.rect(hx - 4, top + 25, 1, 5, 0x8a6a40);
        g.rect(hx + 4, top + 25, 1, 5, 0x8a6a40);
        g.line(front, top + 21, hx, top + 27, 0x6a4a2a);
        break;
    }
    }
}
