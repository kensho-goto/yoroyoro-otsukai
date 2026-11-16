// 人のリズム（ずれあり）で歩ける設定を探す
const planck = require('planck');
const Core = require('../src/core.js');
let seed = +(process.argv[2] || 7);
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const R = (a, b) => a + (b - a) * rnd();
function idle(tuning) {
  const g = Core.create(planck, { tuning }); g.spawn(0);
  for (let f = 0; f < 300; f++) { g.setInput(false, false); g.step(); if (g.state.status !== 'play') return 0; }
  return 1;
}
function gapRun(tuning, P, gap) {
  const g = Core.create(planck, { tuning }); g.spawn(0);
  for (let f = 0; f < 60 * 15; f++) { const c = f % (2 * (P + gap)); g.setInput(c < P, c >= P + gap && c < 2 * P + gap); g.step(); if (g.state.status !== 'play') break; }
  return g.charX();
}
function run(tuning, P, jitterSeed, frames = 60 * 25) {
  let s = jitterSeed; const jr = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  const g = Core.create(planck, { tuning }); g.spawn(0);
  let f = 0, side = 0, next = P;
  for (; f < frames; f++) {
    if (f >= next) { side = 1 - side; next = f + Math.round(P * (0.8 + 0.4 * jr())); }
    g.setInput(side === 0, side === 1); g.step(); if (g.state.status !== 'play') break;
  }
  return { x: g.state.status === 'clear' ? 40 : g.charX(), sec: f / 60, lean: (g.state.leanSum || 0) / Math.max(1, f) };
}
function score(t) {
  const per = {};
  let tot = 0;
  let lean = 0;
  for (const P of [16, 20, 24, 28]) { let s = 0; for (const js of [11, 23]) { const r = run(t, P, js); s += r.x; lean += r.lean / 8; } per[P] = +(s / 2).toFixed(1); tot += s / 2; }
  per.lean = +(lean * 57.3).toFixed(0);
  const id = idle(t); const gp = (gapRun(t, 20, 8) + gapRun(t, 26, 12)) / 2;
  per.idle = id; per.gap = +gp.toFixed(1);
  return { score: tot / 4 + 8 * id + 0.5 * gp - 25 * Math.max(0, lean - 0.17), per };
}
const base = JSON.parse(process.argv[4] || 'null');
let best = [];
for (let i = 0; i < +(process.argv[3] || 300); i++) {
  let t;
  if (base && i > 0) { t = {}; for (const k in base) t[k] = base[k] * R(0.85, 1.15); }
  else if (base) t = base;
  else t = { hipUp: R(0.6, 1.7), hipDown: R(-0.9, 0), kneeUp: R(-2.2, -0.5), kneeDown: R(-0.4, 0), hipTorque: R(40, 250), kneeTorque: R(40, 250), hipSpeed: R(4, 20), kneeSpeed: R(4, 20), balance: R(4, 20), balanceDamp: R(0.5, 4), hipIdle: R(-0.4, 0.3), kneeIdle: R(-0.3, 0), lean: R(-0.5, 0.2) };
  best.push({ ...score(t), t });
}
best.sort((a, b) => b.score - a.score);
for (const b of best.slice(0, 4)) console.log(b.score.toFixed(1), JSON.stringify(b.per), JSON.stringify(Object.fromEntries(Object.entries(b.t).map(([k, v]) => [k, +v.toFixed(3)]))));
