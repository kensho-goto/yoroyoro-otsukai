// レベルごとの「ゴールできる割合」を自動で確かめる: node tools/levels.js [最大レベル]
const planck = require('planck');
const Core = require('../src/core.js');
const maxL = +(process.argv[2] || 15);
const JUMP = !process.argv.includes('--nojump');
function run(level, P, sd, jitter) {
  let s = sd, side = 0, next = P; const jr = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  const g = Core.create(planck, { level }); g.spawn(0);
  const obs = g.stage.hazards.map((h) => h.x); // 障害物の左はし・穴のふち（ジャンプ台の穴は台にまかせる）
  let f = 0, crouch = 0, gap = 0, done = new Set();
  for (; f < 60 * 90; f++) {
    const x = g.charX();
    const J = g.state.jump;
    if (JUMP && crouch === 0 && gap === 0 && J.phase === 'none') {
      const i = obs.findIndex((ox, k) => !done.has(k) && ox - x > 0.4 && ox - x < 0.4 + 0.5 * jr() + 0.3);
      if (i >= 0) { done.add(i); gap = 3; crouch = Math.round(14 + 10 * jr()); } // 両方はなしてから同時に押す
    }
    if (gap > 0) { g.setInput(false, false); gap--; }
    else if (crouch > 0) { g.setInput(true, true); crouch--; if (crouch === 0) next = f + 40; }
    else if (J.phase !== 'none') g.setInput(false, false);
    else {
      if (f >= next) { side = 1 - side; next = f + Math.round(P * (1 - jitter + 2 * jitter * jr())); }
      g.setInput(side === 0, side === 1);
    }
    g.step(); if (g.state.status !== 'play') break;
  }
  return { clear: g.state.status === 'clear', x: g.charX(), why: g.state.fallReason };
}
const minL = +(process.argv.find((a) => a.startsWith("--from="))?.slice(7) || 1);
for (let L = minL; L <= maxL; L++) {
  const st = Core.makeLevel(L);
  const res = { tidy: [], loose: [] };
  for (const P of [16, 20, 24, 28]) for (const sd of [3, 17, 29]) {
    res.tidy.push(run(L, P, sd * P, 0.2));
    res.loose.push(run(L, P, sd * P + 1, 0.45));
  }
  const rate = (a) => Math.round(100 * a.filter((r) => r.clear).length / a.length);
  const avg = (a) => (a.reduce((t, r) => t + Math.min(r.x, st.goal), 0) / a.length).toFixed(0);
  const whys = {}; for (const r of [...res.tidy, ...res.loose]) if (!r.clear) whys[r.why] = (whys[r.why] || 0) + 1;
  console.log(`Lv${L}`.padEnd(5), `${st.goal}m`.padEnd(4), 'きれいなリズム', `${rate(res.tidy)}%`.padStart(4), `平均${avg(res.tidy)}m`, '| 雑なリズム', `${rate(res.loose)}%`.padStart(4), `平均${avg(res.loose)}m`, JSON.stringify(whys));
}
