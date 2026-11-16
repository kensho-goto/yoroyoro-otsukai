const planck = require('planck');
const Core = require('../src/core.js');
function run(tuning, policy, frames) {
  const g = Core.create(planck, { tuning }); g.spawn(0);
  let f = 0; for (; f < frames; f++) { const [l, r] = policy(f); g.setInput(l, r); g.step(); if (g.state.status !== 'play') break; }
  return { ok: g.state.status, x: g.charX(), sec: f / 60 };
}
const jit = (P, sd) => { let s = sd, side = 0, next = P; const jr = () => ((s = (s * 48271) % 2147483647) / 2147483647); return (f) => { if (f >= next) { side = 1 - side; next = f + Math.round(P * (0.75 + 0.5 * jr())); } return [side === 0, side === 1]; }; };
const good = [[18, 3], [22, 5], [26, 7], [30, 9]];
const bad = [['連打5', (f) => { const ph = Math.floor(f / 5) % 2; return [ph === 0, ph === 1]; }], ['休み', (f) => { const c = f % 60; return [c < 20, c >= 30 && c < 50]; }], ['ばらばら', jit(20, 1).bind ? (() => { let s = 9; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); let l = false, rr = false; return (f) => { if (f % 7 === 0) { l = r() > 0.5; rr = r() > 0.5; } return [l, rr]; }; })() : null]];
const res = [];
for (const accSafe of [14, 17, 20]) for (const accGain of [0.002, 0.004, 0.008]) for (const spinSafe of [1.4, 1.8, 2.2]) for (const spinGain of [0.01, 0.03]) for (const calm of [0.004, 0.008]) {
  const t = { accSafe, accGain, spinSafe, spinGain, calm };
  const gd = good.map(([P, sd]) => run(t, jit(P, sd), 60 * 45));
  const bd = bad.map(([n, p]) => run(t, p, 60 * 30));
  const goodScore = gd.reduce((a, r) => a + Math.min(40, r.x), 0) / gd.length; // 大きいほど良い
  const badScore = bd.reduce((a, r) => a + Math.min(40, r.x), 0) / bd.length; // 小さいほど良い
  res.push({ t, goodScore, badScore, s: goodScore - badScore, gd: gd.map((r) => r.x.toFixed(0)).join(','), bd: bd.map((r) => r.x.toFixed(0)).join(',') });
}
res.sort((a, b) => b.s - a.s);
for (const r of res.slice(0, 8)) console.log(r.s.toFixed(1), 'good', r.gd, 'bad', r.bd, JSON.stringify(r.t));
