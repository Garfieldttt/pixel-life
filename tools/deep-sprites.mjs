// Sprite sheet for the underwater motif: node tools/deep-sprites.mjs out.png
import {Gfx} from '../pixel-life@garfieldttt.github.io/engine/gfx.js';
import {diverSprite} from '../pixel-life@garfieldttt.github.io/engine/deep.js';
import {makePerson, personFigure} from '../pixel-life@garfieldttt.github.io/engine/people.js';
import {drawFigure} from '../pixel-life@garfieldttt.github.io/engine/figure.js';
import {savePng} from './pngout.mjs';
const W = 290, H = 40, g = new Gfx(W, H);
g.rect(0, 0, W, H, 0x2a88b0);
let x = 4;
for (const copper of [false, true])
    for (let f = 0; f < 5; f++) {
        drawFigure(g, diverSprite(f, copper ? 2 : 0, copper), x, 34, copper);
        x += 25;
    }
const env = {season: 'summer', weather: {v: {rain: 0}}, holidays: {}, dark: 0};
const p = makePerson(env, {kid: false});
drawFigure(g, personFigure(p, 0, 'down'), x, 36);
drawFigure(g, personFigure(p, 4, 'down'), x + 18, 36);
savePng(process.argv[2], g.bytes, W, H, 6);
