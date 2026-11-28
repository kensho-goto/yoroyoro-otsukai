// ？の箱の高さを決めるための計算（画面なし）
//   node tools/box-reach.js            … いまの高さ（2.55 / 2.95）と、くらべる高さを調べる
//   HS=2.45,2.55 node tools/box-reach.js … 高さを指定
// 1) 歩くだけ：リズムを乱して歩き、道に 0.5m おきに並べた箱を何%取ってしまうか（少ないほどよい）
// 2) ジャンプ：箱の手前のいろいろな所（30か所）から跳んで、何か所で取れるか
//    hold1＝すばやい同時タップ（いちばん低いジャンプ）、hold24＝ためきったジャンプ
// 取れる判定は main.js の pickupBoxes と同じ（頭か胴が箱から 0.5m 以内）
const planck = require('planck');
const Core = require('../src/core.js');
const RAD = 0.5;
const HS = (process.env.HS || '1.65,2.45,2.55,2.65,2.95').split(',').map(Number);
const near = (c, x, y) => {
  const hp = c.head.getPosition(), tp = c.torso.getPosition();
  return Math.min(Math.hypot(hp.x - x, hp.y - y), Math.hypot(tp.x - x, tp.y - y)) <= RAD;
};

function walkOnly() {
  const got = HS.map(() => 0); let total = 0;
  for (let seed = 1; seed <= 20; seed++) for (const P of [10, 12, 14, 16, 18, 20, 24, 28, 34]) {
    let s = seed * 7919 + P; const rnd = () => ((s = (s * 48271) % 2147483647) / 2147483647);
    const g = Core.create(planck, {}); g.spawn(0);
    const xs = []; for (let x = 3; x < g.stage.goal - 1; x += 0.5) xs.push(x);
    const taken = HS.map(() => new Set());
    let side = 0, next = P, maxX = 0;
    for (let f = 0; f < 60 * 25; f++) {
      if (f >= next) { side ^= 1; next = f + Math.max(5, Math.round(P * (0.6 + 0.8 * rnd()))); }
      g.setInput(side === 0, side === 1); g.step();
      if (g.state.status !== 'play') break;
      if (g.state.jump.phase !== 'none') continue; // たまたまジャンプになったときは数えない
      maxX = Math.max(maxX, g.charX());
      HS.forEach((h, i) => { for (const x of xs) if (near(g.state.char, x, g.groundHeightAt(x) + h)) taken[i].add(x); });
    }
    total += xs.filter((x) => x < maxX - 0.5).length;
    HS.forEach((h, i) => { got[i] += [...taken[i]].filter((x) => x < maxX - 0.5).length; });
  }
  return HS.map((h, i) => (100 * got[i] / total).toFixed(1) + '%');
}

const BX = 8;
function jumpAt(boxH, d, hold) {
  const g = Core.create(planck, {}); g.spawn(0);
  const by = g.groundHeightAt(BX) + boxH;
  let side = 0, next = 20, mode = 'walk', jf = 0;
  for (let f = 0; f < 60 * 12; f++) {
    let l = false, r = false;
    if (mode === 'walk') {
      if (g.charX() >= BX - d) { mode = 'pre'; jf = f; } else { if (f >= next) { side ^= 1; next = f + 20; } l = side === 0; r = side === 1; }
    }
    if (mode === 'pre' && f - jf >= 3) { mode = 'press'; jf = f; } // いったん両方はなしてから、同時に押す
    if (mode === 'press') { if (f - jf < hold) l = r = true; else mode = 'air'; }
    if (mode === 'air' && f - jf > hold + 10 && g.state.jump.phase === 'none') { mode = 'after'; next = f; }
    if (mode === 'after') { if (f >= next) { side ^= 1; next = f + 20; } l = side === 0; r = side === 1; }
    g.setInput(l, r); g.step();
    if (near(g.state.char, BX, by)) return true;
    if (g.charX() > BX + 1.5 || g.state.status === 'fallen') return false;
  }
  return false;
}

const walk = walkOnly();
HS.forEach((h, i) => {
  const cols = [1, 24].map((hold) => {
    let ok = 0, n = 0;
    for (let d = -0.4; d <= 2.6; d += 0.1) { n++; if (jumpAt(h, d, hold)) ok++; }
    return `hold${hold} ${ok}/${n}`;
  });
  console.log(`高さ ${h}m  歩くだけで取れる ${walk[i].padStart(6)}  ジャンプ: ${cols.join('  ')}`);
});
