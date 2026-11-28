// ジャンプ連打だけで進めてしまわないかを確かめる（画面なし）: node tools/jump-spam.js [ステージ数]
//   ふつうの遊び方（歩いて、障害物の前だけ跳ぶ）は tools/levels.js で確かめる
//   ジャンプの高さ・前への速さ・つかれ方は src/core.js の TUNING（jumpVx・jumpVy・jumpTired…）で変える
const planck = require('planck');
const Core = require('../src/core.js');
const N = +(process.argv[2] || 24);
function run(level, mode, arg) {
  const g = Core.create(planck, { level }); g.spawn(0);
  let side = 0, next = 20;
  for (let f = 0; f < 60 * 40; f++) {
    let l = false, r = false;
    if (mode === 'walk') { if (f >= next) { side ^= 1; next = f + arg; } l = side === 0; r = side === 1; }
    else { const k = f % (arg.hold + arg.gap); if (k < arg.hold) l = r = true; } // 左右を同時に押す → はなす、をくり返す
    g.setInput(l, r); g.step();
    if (g.state.status !== 'play') return g.state.status === 'clear' ? f / 60 : null;
  }
  return null;
}
const pats = [['歩くだけ（同じリズム）', 'walk', 18], ['すばやく連打', 'spam', { hold: 2, gap: 6 }], ['ゆっくり連打', 'spam', { hold: 2, gap: 14 }], ['ためて連打', 'spam', { hold: 24, gap: 8 }]];
for (const [name, mode, arg] of pats) {
  let c = 0, t = 0;
  for (let L = 1; L <= N; L++) { const s = run(L, mode, arg); if (s != null) { c++; t += s; } }
  console.log(name.padEnd(14, '　'), `クリア ${c}/${N}`, c ? `平均 ${(t / c).toFixed(1)}秒` : '');
}
