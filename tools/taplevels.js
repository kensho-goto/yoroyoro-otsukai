// タップ操作（自動で歩く・タップでジャンプ）で、何軒目までゴールできるかを自動で確かめる
// node tools/taplevels.js [最大] [--fx]（--fx はガチャの効き目を全部のせ）
const planck = require('planck');
const Core = require('../src/core.js');
const maxL = +(process.argv[2] || 15);
const FX = process.argv.includes('--fx');
function run(level, sd, sloppy) {
  let s = sd; const jr = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  const g = Core.create(planck, { level, auto: true });
  if (FX) { const T = g.state.tuning; T.jumpVy = T.jumpVy.map((v) => v * 1.12); T.jump2Vy *= 1.12; T.balance *= 1.1; T.accGain *= 0.8; T.driveMax += 0.4; }
  g.spawn(0);
  const hz = g.stage.hazards.map((h) => ({ ...h, at: 0.5 + jr() * (sloppy ? 1.4 : 0.7), done: false, two: false }));
  let f = 0;
  for (; f < 60 * 120; f++) {
    const x = g.charX(), J = g.state.jump;
    for (const h of hz) {
      if (!h.done && h.x - x < h.at && h.x - x > -0.2) { h.done = true; g.jump(); }
      // 穴の上で落ちはじめたら、もう1回（人はおそめ・はやめにずれる）
      if (h.kind === 'pit' && h.done && !h.two && J.phase === 'air' && x > h.x - 0.3 && g.state.char.torso.getLinearVelocity().y < (sloppy ? -1 + jr() * 2 : 0)) { h.two = true; g.jump(); }
    }
    g.step(); if (g.state.status !== 'play') break;
  }
  return { clear: g.state.status === 'clear', x: g.charX(), why: g.state.fallReason, t: f / 60, goal: g.stage.goal, lim: g.stage.timeLimit };
}
for (let L = 1; L <= maxL; L++) {
  const a = [], b = [];
  for (let k = 0; k < 12; k++) { a.push(run(L, 7 + k * 131, false)); b.push(run(L, 9 + k * 97, true)); }
  const rate = (r) => Math.round(100 * r.filter((q) => q.clear).length / r.length);
  const why = {}; for (const r of [...a, ...b]) if (!r.clear) why[r.why] = (why[r.why] || 0) + 1;
  const ok = a.filter((q) => q.clear); const sp = ok.length ? (ok.reduce((t, q) => t + q.goal / q.t, 0) / ok.length).toFixed(2) : '-';
  console.log(`${L}軒目`.padEnd(5), `${a[0].goal}m 制限${a[0].lim}秒`.padEnd(12), 'ていねい', `${rate(a)}%`.padStart(4), '| 雑', `${rate(b)}%`.padStart(4), `速さ${sp}m/秒`, JSON.stringify(why));
}
