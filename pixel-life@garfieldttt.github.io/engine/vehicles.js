// Vehicles at the people scale (a car is about 46x20), built from cells
// facing right. Lights are emissive points that glow at night.
import {rand, chance, pick, weighted} from './util.js';
import {mix} from './gfx.js';
import {Cells, drawFigure, lightPos} from './figure.js';
import {makePerson, personFigure} from './people.js';
import {INK} from './art.js';

const CAR_COLORS = [0xd84848, 0x4870c8, 0xe8c040, 0x58a060, 0xf0eee6, 0x40404c, 0x9a6ab0, 0xe88838, 0x60b0c8, 0xb0b8c0, 0x8a3a3a, 0x3a7a6a, 0xf090b0];
const GLASS = [0x5a8ac8, 0x8ac0e8, 0xd0ecfc];
const TIRE = 0x2a2428, RIM = [0x8a8a96, 0xc8c8d4];

const sh = (c, t = 0.3) => mix(c, 0x2a1040, t);
const hi = (c, t = 0.3) => mix(c, 0xfff4d0, t);

export const CITY_TRAFFIC = [
    ['hatch', 10], ['sedan', 10], ['beetle', 5], ['van', 5], ['truck', 3], ['taxi', 4],
    ['convertible', 2], ['bike', 6], ['scooter', 3], ['delivery', 3], ['camper', 1],
];

export function makeVehicle(type, env) {
    const v = {type, color: pick(CAR_COLORS), frames: [], x: 0, speed: rand(34, 50), t: 0};
    const fixed = {taxi: 0xf0c838, police: 0xf4f4f8, ambulance: 0xf4f4f0, fire: 0xd83838, garbage: 0x5a9a4a,
        icecream: 0xf8d8e8, mail: 0xf0c030};
    if (fixed[type])
        v.color = fixed[type];
    if (type === 'bus')
        v.color = pick([0xd84848, 0xe8a830, 0x4870c8, 0x58a060]);
    if (type === 'tractor')
        v.color = pick([0x58a048, 0xd84838, 0x4870c8]);
    if (type === 'speeder')
        v.color = pick([0xd82828, 0xf0d020, 0x2a2a30]);
    if (type === 'bike' || type === 'scooter') {
        v.rider = makePerson(env, {kid: false});
        v.rider.umbrella = v.rider.dog = v.rider.balloon = null;
        v.rider.frames = [];
        v.speed = type === 'bike' ? rand(18, 26) : rand(28, 36);
    }
    if (['bus', 'truck', 'garbage', 'tractor'].includes(type))
        v.speed = rand(26, 34);
    if (['police', 'ambulance', 'fire', 'speeder'].includes(type))
        v.speed = rand(80, 100);
    v.driver = pick([0x3a2418, 0x6a3c20, 0xe8c060, 0x2a2430, 0xc8442c, 0xd0d0d0]);
    v.skin = pick([0xfbd8b4, 0xf0c098, 0xd8a074, 0xb07448, 0x7c4c30]);
    v.passengers = [];
    if (type === 'bus')
        for (let i = 0; i < 7; i++)
            v.passengers.push(chance(0.6) ? pick([0x3a2418, 0x6a3c20, 0xe8c060, 0x2a2430, 0xd0d0d0, 0xc8442c]) : -1);
    return v;
}

function wheel(c, x, y, frame, r = 4) {
    const d = r * 2;
    for (let yy = 0; yy < d; yy++)
        for (let xx = 0; xx < d; xx++) {
            const dx = xx - r + 0.5, dy = yy - r + 0.5;
            if (dx * dx + dy * dy <= r * r)
                c.set(x + xx, y + yy, TIRE);
        }
    c.rect(x + r - 1, y + r - 1, 2, 2, RIM[1]);
    const spoke = frame % 2;
    c.set(x + r - 2 + spoke * 3, y + r - 2, RIM[0]);
    c.set(x + r + 1 - spoke * 3, y + r + 1, RIM[0]);
}

function driver(c, v, x, y) {
    c.rect(x, y, 4, 4, v.skin);
    c.rect(x, y, 4, 2, v.driver);
    c.set(x + 3, y + 2, INK);
}

function glass(c, x, y, w, h) {
    c.rect(x, y, w, h, GLASS[1]);
    c.rect(x, y + h - 1, w, 1, GLASS[0]);
    c.set(x + w - 2, y, GLASS[2]);
    c.set(x + w - 3, y + 1, GLASS[2]);
}

function buildVehicle(v, frame) {
    const col = v.color, dk = sh(col, 0.3), dk2 = sh(col, 0.5), lt = hi(col, 0.3);
    let c;
    switch (v.type) {
    case 'hatch':
    case 'sedan':
    case 'taxi':
    case 'police':
    case 'speeder':
    case 'beetle': {
        const L = v.type === 'hatch' ? 38 : v.type === 'beetle' ? 36 : 46;
        c = new Cells(L, 20);
        const roofX = v.type === 'hatch' ? 8 : v.type === 'beetle' ? 9 : 12;
        const roofW = v.type === 'hatch' ? 20 : v.type === 'beetle' ? 18 : 22;
        // cabin
        for (let i = 0; i < 7; i++) {
            const inset = v.type === 'beetle' ? Math.max(0, 4 - i) : Math.max(0, 3 - i);
            c.rect(roofX + inset - (i > 3 ? i - 3 : 0), 1 + i, roofW - inset * 2 + (i > 3 ? (i - 3) * 2 : 0), 1, col);
        }
        c.rect(roofX + 3, 1, roofW - 6, 1, lt);
        glass(c, roofX + 2, 3, Math.floor(roofW / 2) - 3, 4);
        glass(c, roofX + Math.floor(roofW / 2) + 1, 3, Math.floor(roofW / 2) - 3, 4);
        c.rect(roofX + Math.floor(roofW / 2) - 1, 2, 2, 6, dk);
        driver(c, v, roofX + Math.floor(roofW / 2) + 2, 3);
        // body
        const bodyTop = 8;
        c.rect(0, bodyTop + 1, L, 7, col);
        c.rect(2, bodyTop, L - 4, 1, col);
        c.rect(1, bodyTop + 1, L - 2, 1, lt);
        c.rect(0, bodyTop + 6, L, 2, dk);
        c.rect(0, bodyTop + 7, L, 1, dk2);
        c.rect(roofX + 1, bodyTop + 2, 1, 4, dk); // door line
        c.rect(roofX + Math.floor(roofW / 2), bodyTop + 2, 1, 4, dk);
        c.rect(roofX + Math.floor(roofW / 2) + 3, bodyTop + 3, 3, 1, dk2); // handle
        c.rect(L - 3, bodyTop + 2, 3, 2, 0xfff4c0);
        c.rect(0, bodyTop + 2, 2, 2, 0xc02828);
        c.rect(L - 4, bodyTop + 5, 4, 1, 0xb8b8c4); // bumper
        c.rect(0, bodyTop + 5, 3, 1, 0xb8b8c4);
        if (v.type === 'police') {
            c.rect(0, bodyTop + 3, L, 2, 0x3058c0);
            c.rect(roofX + 6, 0, 4, 1, 0x3a5ae8);
            c.rect(roofX + 10, 0, 4, 1, 0xe83a3a);
            c.light(roofX + 7, 0, 0x4060ff, 'sirenB');
            c.light(roofX + 11, 0, 0xff3030, 'sirenR');
        }
        if (v.type === 'taxi') {
            c.rect(roofX + 6, 0, 8, 1, 0xf8f0d0);
            c.light(roofX + 9, 0, 0xfff0a0, 'sign');
            for (let i = 0; i < L; i += 4)
                c.rect(i, bodyTop + 4, 2, 1, INK);
        }
        if (v.type === 'speeder') {
            c.rect(1, bodyTop - 1, 5, 2, dk);
            c.rect(10, bodyTop + 3, L - 18, 1, 0xf4f4f4);
        }
        wheel(c, 5, 12, frame);
        wheel(c, L - 13, 12, frame);
        c.light(L - 2, bodyTop + 2, 0xfff4c0, 'head');
        c.light(0, bodyTop + 2, 0xff3030, 'tail');
        break;
    }
    case 'convertible': {
        const L = 44;
        c = new Cells(L, 18);
        c.rect(0, 6, L, 7, col);
        c.rect(1, 6, L - 2, 1, lt);
        c.rect(0, 11, L, 2, dk);
        glass(c, 26, 1, 2, 5);
        driver(c, v, 18, 1);
        c.rect(17, 5, 7, 2, 0x5a3a2a); // seat
        c.rect(9, 2, 4, 4, v.skin);
        c.rect(9, 1, 4, 2, (v.hair ??= pick([0xe8c060, 0xc8442c, 0x3a2418])));
        c.rect(L - 3, 7, 3, 2, 0xfff4c0);
        wheel(c, 5, 10, frame);
        wheel(c, L - 13, 10, frame);
        c.light(L - 2, 7, 0xfff4c0, 'head');
        c.light(0, 7, 0xff3030, 'tail');
        break;
    }
    case 'van':
    case 'delivery':
    case 'mail':
    case 'ambulance':
    case 'icecream':
    case 'camper': {
        const L = 50;
        c = new Cells(L, 26);
        c.rect(0, 1, 40, 18, col);
        c.rect(0, 1, 40, 1, lt);
        c.rect(40, 7, 10, 12, col);
        c.rect(41, 6, 6, 1, col);
        glass(c, 41, 8, 6, 5);
        driver(c, v, 42, 8);
        c.rect(0, 17, L, 2, dk);
        c.rect(0, 18, L, 1, dk2);
        c.rect(39, 2, 1, 16, dk);
        c.rect(L - 3, 13, 3, 2, 0xfff4c0);
        c.rect(0, 13, 2, 3, 0xc02828);
        if (v.type === 'delivery') {
            c.rect(6, 5, 26, 8, 0xe88838);
            c.rect(9, 7, 20, 4, 0xf8e8c8);
            c.rect(12, 8, 3, 2, 0xe88838);
        } else if (v.type === 'mail') {
            c.rect(6, 6, 20, 6, 0x2a2a3a);
            c.rect(10, 7, 6, 4, 0xf0c030);
            c.rect(11, 8, 4, 1, 0x2a2a3a);
        } else if (v.type === 'ambulance') {
            c.rect(0, 10, L, 2, 0xd83030);
            c.rect(15, 3, 3, 9, 0xd83030);
            c.rect(12, 6, 9, 3, 0xd83030);
            c.rect(34, 0, 3, 1, 0x4060ff);
            c.light(35, 0, 0x4060ff, 'sirenB');
            c.light(37, 0, 0xff3030, 'sirenR');
        } else if (v.type === 'icecream') {
            c.rect(4, 4, 18, 9, GLASS[1]);
            c.rect(4, 4, 18, 1, 0xe86090);
            for (let i = 0; i < 40; i += 4)
                c.rect(i, 15, 2, 2, 0xe86090);
            c.rect(27, 4, 7, 5, 0xf8c0d8);
            c.rect(28, 3, 4, 1, 0xfff0f0);
            for (let i = 0; i < 4; i++)
                c.rect(28 + (i >> 1), 9 + i, 5 - i, 1, 0xe8b070);
        } else if (v.type === 'camper') {
            glass(c, 4, 5, 8, 6);
            glass(c, 16, 5, 8, 6);
            c.rect(0, 13, 40, 2, 0x60b0c8);
            c.rect(28, 4, 8, 13, sh(col, 0.15));
            c.rect(33, 10, 2, 1, INK);
        } else {
            glass(c, 4, 5, 8, 6);
        }
        wheel(c, 6, 18, frame);
        wheel(c, L - 14, 18, frame);
        c.light(L - 2, 13, 0xfff4c0, 'head');
        c.light(0, 13, 0xff3030, 'tail');
        break;
    }
    case 'truck':
    case 'garbage':
    case 'fire': {
        const L = 68;
        c = new Cells(L, 30);
        const box = v.type === 'truck' ? (v.box ??= pick([0xf0eee6, 0xd8d0c0, 0x9ab0c8])) : col;
        c.rect(0, 0, 50, 21, box);
        c.rect(0, 0, 50, 1, hi(box, 0.3));
        c.rect(0, 20, 50, 1, sh(box, 0.35));
        c.rect(52, 6, 16, 15, col);
        c.rect(53, 5, 10, 1, col);
        glass(c, 54, 8, 9, 6);
        driver(c, v, 57, 8);
        c.rect(0, 21, L, 3, 0x3a3a44);
        c.rect(L - 3, 16, 3, 2, 0xfff4c0);
        if (v.type === 'truck') {
            const logo = v.logo ??= pick([0xd84848, 0x4870c8, 0x58a060, 0xe8a830]);
            c.rect(6, 6, 36, 8, logo);
            c.rect(8, 8, 10, 4, 0xf4f4f4);
            c.rect(22, 9, 16, 2, 0xf4f4f4);
        } else if (v.type === 'garbage') {
            c.rect(0, 2, 4, 18, sh(col, 0.3));
            c.rect(8, 8, 34, 2, 0xf0e040);
            c.rect(0, 22, 4, 2, 0x8a8a90);
            c.rect(1, 12, 2, 8, 0xf08a20);
        } else {
            c.rect(0, 4, 50, 1, 0xd8d8d8);
            c.rect(0, 9, 50, 1, 0xd8d8d8);
            for (let i = 0; i < 50; i += 5)
                c.rect(i, 4, 1, 6, 0xd8d8d8);
            c.rect(0, 16, L, 2, 0xf0e8d0);
            c.rect(58, 3, 4, 2, 0x4060ff);
            c.light(59, 3, 0x4060ff, 'sirenB');
            c.light(62, 3, 0xff3030, 'sirenR');
        }
        wheel(c, 6, 21, frame, 5);
        wheel(c, 36, 21, frame, 5);
        wheel(c, 54, 21, frame, 5);
        c.light(L - 2, 16, 0xfff4c0, 'head');
        c.light(0, 17, 0xff3030, 'tail');
        break;
    }
    case 'bus': {
        const L = 104;
        c = new Cells(L, 34);
        c.rect(0, 0, L, 27, col);
        c.rect(0, 0, L, 1, lt);
        c.rect(0, 20, L, 2, dk);
        c.rect(0, 26, L, 1, dk2);
        glass(c, L - 9, 4, 8, 12);
        driver(c, v, L - 7, 8);
        for (let i = 0; i < 7; i++) {
            const x = 4 + i * 12;
            glass(c, x, 4, 10, 10);
            if (v.passengers[i] >= 0) {
                c.rect(x + 3, 7, 4, 4, 0xf0c8a0);
                c.rect(x + 3, 7, 4, 2, v.passengers[i]);
                c.rect(x + 2, 11, 6, 3, [0xd84a4a, 0x4a7ad0, 0x5aae58, 0xe8a63c][(v.passengers[i] + i) % 4]);
            }
            c.lights.push({x: x + 1, y: 5, w: 10, h: 10, c: 0xfff0b0, kind: 'window'});
        }
        c.rect(88, 4, 6, 20, sh(GLASS[1], 0.2));
        c.rect(90, 4, 1, 20, INK);
        c.rect(4, -2, 22, 2, 0x6a6a74);
        c.rect(L - 3, 20, 3, 3, 0xfff4c0);
        wheel(c, 12, 25, frame, 5);
        wheel(c, L - 24, 25, frame, 5);
        c.light(L - 2, 21, 0xfff4c0, 'head');
        c.light(0, 21, 0xff3030, 'tail');
        c.light(L - 6, 0, 0xffb040, 'sign');
        break;
    }
    case 'tractor': {
        const L = 42;
        c = new Cells(L, 30);
        c.rect(0, 12, 30, 9, col);
        c.rect(0, 12, 30, 1, lt);
        c.rect(14, 0, 14, 13, col);
        glass(c, 16, 2, 10, 8);
        driver(c, v, 19, 4);
        c.rect(30, 14, 12, 7, col);
        c.rect(34, 6, 2, 8, 0x3a3a3a);
        c.rect(2, 13, 10, 2, 0xe8c040);
        wheel(c, 1, 15, frame, 7);
        c.rect(6, 20, 4, 4, frame % 2 ? 0xe8c040 : 0xc8a030);
        wheel(c, 30, 21, frame, 4);
        c.light(L - 2, 16, 0xfff4c0, 'head');
        c.light(0, 14, 0xff3030, 'tail');
        c.light(26, -1, 0xffa020, 'beacon');
        break;
    }
    default: { // bike, scooter: rider drawn separately
        c = new Cells(22, 12);
        const fc = col;
        if (v.type === 'bike') {
            for (const wx of [0, 13]) {
                for (let a = 0; a < 16; a++) {
                    const ang = a / 16 * Math.PI * 2;
                    c.set(Math.round(wx + 4 + Math.cos(ang) * 3.5), Math.round(7 + Math.sin(ang) * 3.5), TIRE);
                }
                c.set(wx + 4, 7, RIM[0]);
            }
            c.rect(4, 4, 11, 1, fc);
            c.rect(8, 4, 1, 4, fc);
            c.rect(4, 4, 1, 3, fc);
            c.rect(14, 1, 1, 6, fc);
            c.rect(13, 0, 3, 1, 0x5a5a5a);
            c.rect(6, 2, 4, 1, 0x3a2a2a);
            c.light(16, 2, 0xfff4c0, 'head');
            c.light(1, 4, 0xff3030, 'tail');
        } else {
            c.rect(2, 4, 16, 5, fc);
            c.rect(2, 4, 16, 1, hi(fc, 0.3));
            c.rect(14, 0, 4, 5, fc);
            c.rect(4, 2, 8, 2, 0x3a2a2a);
            wheel(c, 0, 6, frame, 3);
            wheel(c, 15, 6, frame, 3);
            c.light(19, 1, 0xfff4c0, 'head');
            c.light(0, 5, 0xff3030, 'tail');
        }
    }
    }
    // cars and bigger are drawn at half scale; bikes, scooters and the
    // tractor already match the people
    if (!['tractor', 'bike', 'scooter'].includes(v.type))
        c = c.scaled(2);
    return c.finish(INK);
}

export function vehicleFigure(v, frame) {
    const k = frame % 2;
    return v.frames[k] || (v.frames[k] = buildVehicle(v, k));
}

export function vehicleLength(v) {
    return vehicleFigure(v, 0).w;
}

export function drawVehicle(g, v, y, env, lightsOn) {
    const frame = v.cur > 1 || v.speed > 1 ? Math.floor(v.x / 4) : 0;
    const f = vehicleFigure(v, frame);
    const flip = v.dir < 0;
    g.footShadow(v.x + f.w / 2, y, f.w - 2, 0.35);
    if (v.rider) {
        drawFigure(g, f, v.x, y, flip);
        const pf = personFigure(v.rider, 'sit');
        drawFigure(g, pf, v.x + (flip ? 6 : 2), y - 6, flip);
    } else {
        drawFigure(g, f, v.x, y, flip);
    }
    const blink = Math.floor(v.t * 4) % 2 === 0;
    for (const l of f.lights) {
        const [lx, ly] = lightPos(f, l, v.x, y, flip);
        switch (l.kind) {
        case 'head':
            if (lightsOn) {
                g.rectE(lx - (flip ? 0 : 1), ly, 2, 2, l.c);
                const d = flip ? -1 : 1;
                for (let i = 2; i < 34; i++)
                    g.add(d > 0 ? lx + i : lx - i, ly - i * 0.12, 1, 2 + i * 0.3, 0xfff0c0, 0.2 * (1 - i / 34));
            }
            break;
        case 'tail':
            if (lightsOn || v.braking) {
                g.rectE(lx, ly, 2, 2, v.braking ? 0xff4040 : 0xd02020);
                g.glow(lx + 1, ly + 1, v.braking ? 7 : 4, 0xff2020, 0.3);
            }
            break;
        case 'sirenB':
        case 'sirenR':
            if (v.siren && (blink === (l.kind === 'sirenB'))) {
                g.rectE(lx - 1, ly, 3, 1, l.c);
                g.glow(lx, ly, 16, l.c, 0.35);
            }
            break;
        case 'beacon':
            if (Math.floor(v.t * 3) % 2) {
                g.rectE(lx, ly, 2, 2, l.c);
                g.glow(lx, ly, 8, l.c, 0.3);
            }
            break;
        case 'sign':
            if (lightsOn) {
                g.pxE(lx, ly, l.c);
                g.glow(lx, ly, 5, l.c, 0.2);
            }
            break;
        case 'window':
            if (lightsOn)
                g.add(lx, ly, l.w, l.h, l.c, 0.3);
            break;
        }
    }
}

export function randomTraffic(table) {
    return weighted(table);
}
