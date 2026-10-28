// Runs every motif through days, seasons, all weathers and all events; reports errors and timing.
import {Engine} from '../pixel-life@garfieldttt.github.io/engine/scene.js';
import {WEATHER_TYPES} from '../pixel-life@garfieldttt.github.io/engine/weather.js';
const EVENTS = {city: ['kids', 'chase', 'ambulance', 'fire', 'icecream', 'garbage', 'mail', 'camper', 'fireworks', 'outage', 'marathon', 'ducks', 'balloon', 'musician', 'catcross', 'tourists', 'wedding'],
    village: ['fireworks', 'musician', 'kids', 'crows', 'festival'],
    country: ['train', 'tractor', 'mail', 'bike', 'icecream', 'camper', 'hikers', 'kite', 'deer', 'rabbit', 'fox', 'fireworks'],
    space: ['cruiser', 'patrol', 'dogfight', 'freighter', 'jump', 'arrive', 'shuttle', 'comet', 'asteroids', 'probe'],
    underwater: ['sub', 'merfolk', 'diver', 'school', 'turtle', 'shark', 'manta', 'grouper', 'whale', 'jelly', 'boat', 'crab', 'kraken'],
    medieval: ['knight', 'messenger', 'caravan', 'royal', 'procession', 'pilgrims', 'herd', 'geese', 'pigs', 'crier', 'minstrel', 'juggler', 'pillory', 'drunk', 'wedding'],
    arcade: ['highscore', 'repair', 'party', 'cleaner', 'group', 'power'],
    airport: ['jumbo', 'cargo', 'bizjet', 'cessna', 'goaround', 'salute', 'plow', 'fireworks'],
    harbor: ['tallship', 'tug', 'pilot', 'cutter', 'regatta', 'yacht', 'motorboat', 'rowboat', 'cutterOut', 'cutterHome', 'far', 'gulls', 'ship', 'ferry', 'fireworks']};
let worst = 0, frames = 0, total = 0;
for (const [W, H] of [[640, 360], [480, 270], [853, 480]]) {
    for (const motif of ['village', 'city', 'country', 'medieval', 'arcade', 'airport', 'harbor', 'space', 'underwater']) {
        for (const month of [0, 3, 6, 9, 11]) {
            const e = new Engine(W, H, {motif, clock: 'infobox'});
            e.timeOffset = true;
            e.setTime(new Date(2026, month, month === 11 ? 24 : 15, 5, 0).getTime());
            e.opts.speed = 240;
            WEATHER_TYPES.forEach((w, i) => {
                e.weather.force(w);
                for (const ev of EVENTS[e.motif.name])
                    e.motif.trigger(ev, e.env, e);
                for (const k of ['ufo', 'balloon', 'plane', 'sleigh', 'heli', 'birds', 'bats']) {
                    e.sky._spawnFlyer({...e.env, dark: 1, holidays: {...e.env.holidays, christmasEve: true}});
                }
                for (let f = 0; f < 300; f++) {
                    e.tick(0.05);
                    const t0 = performance.now();
                    e.render();
                    const dt = performance.now() - t0;
                    total += dt; frames++;
                    if (dt > worst) worst = dt;
                }
            });
        }
    }
}
console.log(`frames ${frames}, avg ${(total / frames).toFixed(2)} ms, worst ${worst.toFixed(1)} ms`);
