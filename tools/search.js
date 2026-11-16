// 前に歩ける設定を自動で探す
const planck = require('planck');
const Core = require('../src/core.js');
let seed = +(process.argv[2] || 7);
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const R = (a, b) => a + (b - a) * rnd();
function run(tuning, P, frames = 60 * 20) {
  const g = Core.create(planck, { tuning }); g.spawn(0);
  let f = 0;
  for (; f < frames; f++) { const ph = Math.floor(f / P) % 2; g.setInput(ph === 0, ph === 1); g.step(); if (g.state.status !== 'play') break; }
  return g.state.status === 'clear' ? 40 : g.charX();
}
let best = [];
for (let i = 0; i < +(process.argv[3] || 150); i++) {
  const t = { hipUp: R(0.5, 1.5), hipDown: R(-0.7, 0.1), kneeUp: R(-1.8, -0.4), kneeDown: R(-0.3, 0), hipTorque: R(25, 120), kneeTorque: R(30, 120), hipSpeed: R(4, 14), kneeSpeed: R(4, 14), balance: R(2, 10), balanceDamp: R(0.5, 2) };
  const res = [10, 15, 20, 25, 30, 40].map((P) => [P, +run(t, P).toFixed(1)]);
  const score = Math.max(...res.map((r) => r[1]));
  best.push({ score, res, t });
}
best.sort((a, b) => b.score - a.score);
for (const b of best.slice(0, 5)) console.log(b.score, JSON.stringify(b.res), JSON.stringify(Object.fromEntries(Object.entries(b.t).map(([k, v]) => [k, +v.toFixed(2)]))));
