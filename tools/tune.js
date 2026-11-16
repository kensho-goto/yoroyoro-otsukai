// 歩けるかの自動チェック: node tools/tune.js '{"balanceKp":0.003}'
const Lib = require('planck');
const Core = require('../src/core.js');
const tuning = process.argv[2] ? JSON.parse(process.argv[2]) : {};

function run(policy, frames = 60 * 30) {
  const g = Core.create(Lib, { tuning });
  g.spawn(0);
  let f = 0;
  for (; f < frames; f++) {
    const [l, r] = policy(f, g);
    g.setInput(l, r);
    g.step();
    if (g.state.status !== 'play') break;
  }
  return { x: g.charX().toFixed(1), status: g.state.status, why: g.state.fallReason || '', sec: (f / 60).toFixed(1) };
}

const out = [];
out.push(['なにもしない', run(() => [false, false], 60 * 8)]);
out.push(['両方押しっぱなし', run(() => [true, true], 60 * 8)]);
for (const P of [8, 12, 16, 20, 25, 30, 40, 50]) {
  out.push([`交互 ${P}コマ`, run((f) => { const ph = Math.floor(f / P) % 2; return [ph === 0, ph === 1]; })]);
}
for (const [P, gap] of [[20, 6], [25, 8], [30, 10]]) {
  out.push([`交互${P}+休み${gap}`, run((f) => { const c = f % (2 * (P + gap)); return [c < P, c >= P + gap && c < 2 * P + gap]; })]);
}
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
out.push(['でたらめ', run(() => [rnd() > 0.5, rnd() > 0.5])]);
for (const [k, v] of out) console.log(k.padEnd(14), `${v.x}m`, v.status, v.why, `${v.sec}秒`);
