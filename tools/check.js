const planck = require('planck');
const Core = require('../src/core.js');
const t = JSON.parse(process.argv[2] || '{}');
for (const P of [16, 20, 24, 28]) for (const js of [11, 23, 37]) {
  let s = js; const jr = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  const g = Core.create(planck, { tuning: t }); g.spawn(0);
  let f = 0, side = 0, next = P; const marks = [];
  for (; f < 60 * 60; f++) {
    if (f >= next) { side = 1 - side; next = f + Math.round(P * (0.8 + 0.4 * jr())); }
    g.setInput(side === 0, side === 1); g.step(); if (g.state.status !== 'play') break;
    if (f % 300 === 299) marks.push(g.charX().toFixed(1));
  }
  console.log(P, js, g.state.status, g.state.fallReason || '', g.charX().toFixed(1) + 'm', (f / 60).toFixed(1) + 's', marks.join(' '));
}
