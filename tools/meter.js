// ぐらぐらメーターの効き方を確かめる
const planck = require('planck');
const Core = require('../src/core.js');
const tuning = JSON.parse(process.argv[2] || '{}');
function run(name, policy, frames = 60 * 40) {
  const g = Core.create(planck, { tuning }); g.spawn(0);
  let f = 0, maxD = 0, sumJ = 0;
  for (; f < frames; f++) { const [l, r] = policy(f); g.setInput(l, r); g.step(); maxD = Math.max(maxD, g.state.danger); if (g.state.status !== 'play') break; }
  console.log(name.padEnd(12), g.state.status, (g.state.fallReason || '').padEnd(7), g.charX().toFixed(1) + 'm', (f / 60).toFixed(1) + 's', 'max', maxD.toFixed(2));
}
let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
run('なにもしない', () => [false, false], 600);
run('両方押す', () => [true, true], 600);
for (const P of [12, 16, 20, 24, 28, 34]) {
  let s = P * 7, side = 0, next = P; const jr = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  run('交互' + P + 'ずれ', (f) => { if (f >= next) { side = 1 - side; next = f + Math.round(P * (0.75 + 0.5 * jr())); } return [side === 0, side === 1]; });
}
run('交互20休み10', (f) => { const c = f % 60; return [c < 20, c >= 30 && c < 50]; });
run('連打8', (f) => { const ph = Math.floor(f / 8) % 2; return [ph === 0, ph === 1]; });
run('でたらめ', () => [rnd() > 0.5, rnd() > 0.5]);
