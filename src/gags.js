// ヨロヨロおつかい — ころび芸（転んだあとに起きる、ばかばかしいできごと。毎回ちがうものが出る）
// g はゲーム側（main.js）が渡す道具箱。g.t＝始まってからの秒、g.snap＝主人公の絵（写し）、g.P(x, y)＝世界→画面
(function () {
  const INK = '#3b2a1e';
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => cl((t - a) / (b - a)); // a〜b のあいだの進みぐあい（0〜1）
  const out3 = (p) => 1 - (1 - p) ** 3;
  const back = (p) => { const c = 1.9; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; };
  const lerp = (a, b, p) => a + (b - a) * p;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  // 世界の (x, y) に、メートル単位・下向きの座標で絵をかく
  function at(g, x, y, fn, rot = 0, sx = 1, sy = 1) {
    const c = g.c, [X, Y] = g.P(x, y);
    c.save(); c.translate(X, Y); if (rot) c.rotate(rot); c.scale(g.s * sx, g.s * sy);
    c.lineWidth = 0.035; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round';
    fn(c); c.restore();
  }
  const fs = (c, col) => { c.fillStyle = col; c.fill(); c.stroke(); };
  const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); };
  const ell = (c, x, y, rx, ry, a = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, TAU); };
  const poly = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
  // ふちつきの雲（けむり・ゆげ）
  function cloud(c, n, r, col, seed = 1) {
    c.fillStyle = col; c.beginPath();
    for (let i = 0; i < n; i++) { const a = i / n * TAU + seed; c.moveTo(Math.cos(a) * r * 0.7 + r * 0.45, Math.sin(a) * r * 0.5); c.arc(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.5, r * 0.45, 0, TAU); }
    c.fill();
  }

  // 写しを まっすぐ立てる回しかた（転んで横になっていても、頭が上になる）。頭を下にするときは +π
  const upRot = (sn) => { let r = Math.PI / 2 + Math.atan2(sn.cy - sn.hy, sn.cx - sn.hx); r = ((r + Math.PI) % TAU + TAU) % TAU - Math.PI; return r; };
  const headD = (sn) => Math.max(0.55, Math.hypot(sn.hx - sn.cx, sn.hy - sn.cy)); // まん中から頭まで
  // 写しを、まん中 (X, Y) を中心に回してかく
  const up = (g, sn, X, Y, rot, o = {}) => g.draw(sn, X - sn.cx, Y - sn.cy, { ...o, px: sn.cx, py: sn.cy, rot });

  // ---- 写しをかけらに分ける（こなごな・石がくずれる） ----
  function makePieces(sn, nx, ny, power, up) {
    const bb = sn.bb, w = (bb.r - bb.l) / nx, h = (bb.t - bb.b) / ny, list = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const rx = bb.l + i * w, ry = bb.b + j * h, cx = rx + w / 2, cy = ry + h / 2;
      const dx = cx - sn.cx, dy = cy - sn.cy;
      list.push({ rx, ry, w, h, x: sn.x + cx, y: sn.y + cy, vx: dx * power * rnd(1.2, 2.6) + rnd(-1, 1) * power, vy: up * rnd(0.6, 1.4) + dy * power, a: 0, va: rnd(-14, 14) * power });
    }
    return list;
  }
  function stepPieces(g, list) {
    const dt = g.dt;
    for (const p of list) {
      p.vy -= 14 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
      const fl = g.gy(p.x) + Math.min(p.w, p.h) * 0.45;
      if (p.y < fl) { p.y = fl; p.vy = Math.abs(p.vy) * 0.3; p.vx *= 0.6; p.va *= 0.5; }
    }
  }
  // 写しの上にひびをかく
  function cracks(g, sn, seed, n, k) {
    const r = (i) => { const v = Math.sin(i * 91.7 + seed * 13.1) * 43758.5; return v - Math.floor(v); };
    at(g, sn.x + sn.cx, sn.y + sn.cy, (c) => {
      c.lineWidth = 0.03; c.strokeStyle = '#fff'; c.beginPath();
      for (let i = 0; i < n; i++) {
        let x = 0, y = 0, a = i / n * TAU + r(i);
        c.moveTo(0, 0);
        for (let j = 0; j < 4 * k; j++) { a += (r(i * 7 + j) - 0.5) * 1.1; x += Math.cos(a) * 0.16; y += Math.sin(a) * 0.16; c.lineTo(x, y); }
      }
      c.stroke(); c.lineWidth = 0.012; c.strokeStyle = INK; c.stroke();
    });
  }

  // ---- 落ちてくるもの（ぺしゃんこ・ゴツン） ----
  const OBJ = {
    tarai(c) { poly(c, [[-0.55, -0.16], [0.55, -0.16], [0.42, 0.18], [-0.42, 0.18]]); fs(c, '#c3ccd6'); ell(c, 0, -0.16, 0.56, 0.07); fs(c, '#e4eaf0'); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(-0.3, -0.06, 0.08, 0.18); },
    kinko(c) { c.beginPath(); c.roundRect(-0.45, -0.45, 0.9, 0.9, 0.06); fs(c, '#3e6b57'); c.beginPath(); c.roundRect(-0.36, -0.36, 0.72, 0.72, 0.04); fs(c, '#4f8770'); circ(c, 0.05, 0, 0.14); fs(c, '#d9c27a'); c.beginPath(); c.moveTo(0.05, 0); c.lineTo(0.05, -0.12); c.stroke(); c.fillStyle = INK; c.fillRect(0.24, -0.06, 0.05, 0.14); },
    weight(c) { poly(c, [[-0.5, 0.4], [0.5, 0.4], [0.32, -0.3], [-0.32, -0.3]]); fs(c, '#4d4f5c'); c.beginPath(); c.arc(0, -0.38, 0.13, Math.PI, 0); c.lineWidth = 0.07; c.stroke(); c.lineWidth = 0.035; c.fillStyle = '#fff'; c.font = '900 0.3px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('10t', 0, 0.08); },
    piano(c) {
      c.beginPath(); c.moveTo(-0.85, -0.18); c.lineTo(0.35, -0.18); c.bezierCurveTo(0.65, -0.18, 0.55, -0.42, 0.85, -0.42); c.lineTo(0.85, 0.12); c.lineTo(-0.85, 0.12); c.closePath(); fs(c, '#1d1d22');
      c.fillStyle = '#fff'; c.fillRect(-0.85, 0.12, 0.7, 0.1); c.strokeRect(-0.85, 0.12, 0.7, 0.1); c.fillStyle = INK; for (let i = 0; i < 6; i++) c.fillRect(-0.8 + i * 0.11, 0.12, 0.04, 0.06);
      c.fillStyle = '#1d1d22'; for (const x of [-0.75, 0.7]) { c.fillRect(x, 0.12, 0.07, 0.4); c.strokeRect(x, 0.12, 0.07, 0.4); }
      c.beginPath(); c.moveTo(-0.2, -0.18); c.lineTo(0.5, -0.75); c.stroke();
    },
    suika(c) { circ(c, 0, 0, 0.38); fs(c, '#3f9b45'); c.strokeStyle = '#1f5a28'; c.lineWidth = 0.06; for (const x of [-0.22, 0, 0.22]) { c.beginPath(); c.moveTo(x, -0.36); c.quadraticCurveTo(x + 0.12, 0, x, 0.36); c.stroke(); } c.strokeStyle = INK; },
    pot(c) { poly(c, [[-0.3, -0.2], [0.3, -0.2], [0.22, 0.3], [-0.22, 0.3]]); fs(c, '#c8693f'); c.fillStyle = '#e07a4c'; c.fillRect(-0.34, -0.26, 0.68, 0.1); c.strokeRect(-0.34, -0.26, 0.68, 0.1); for (const a of [-0.5, 0, 0.5]) { ell(c, Math.sin(a) * 0.25, -0.45, 0.08, 0.2, a); fs(c, '#4fae4a'); } },
    tofu(c) { c.beginPath(); c.roundRect(-0.35, -0.3, 0.7, 0.6, 0.06); fs(c, '#fbfbf4'); c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(0.12, -0.28, 0.2, 0.56); },
    daikon(c) { c.beginPath(); c.moveTo(-0.2, -0.45); c.quadraticCurveTo(0.22, -0.45, 0.14, 0.1); c.quadraticCurveTo(0.05, 0.5, -0.02, 0.62); c.quadraticCurveTo(-0.16, 0.2, -0.2, -0.45); fs(c, '#f6f6ef'); for (const a of [-0.6, -0.1, 0.4]) { ell(c, Math.sin(a) * 0.15, -0.65, 0.08, 0.24, a); fs(c, '#5aa64a'); } },
    ramen(c) { c.beginPath(); c.moveTo(-0.5, -0.12); c.lineTo(0.5, -0.12); c.quadraticCurveTo(0.45, 0.32, 0, 0.34); c.quadraticCurveTo(-0.45, 0.32, -0.5, -0.12); fs(c, '#e8463c'); c.strokeStyle = '#fff'; c.lineWidth = 0.03; c.beginPath(); for (let i = 0; i < 6; i++) { c.moveTo(-0.36 + i * 0.13, 0.04); c.lineTo(-0.3 + i * 0.13, 0.12); c.lineTo(-0.24 + i * 0.13, 0.04); } c.stroke(); c.strokeStyle = INK; c.lineWidth = 0.035; ell(c, 0, -0.12, 0.5, 0.08); fs(c, '#f2c45a'); circ(c, 0.18, -0.15, 0.08); fs(c, '#fff'); },
    cake(c) { poly(c, [[-0.4, 0.25], [0.4, 0.25], [0.4, -0.15], [-0.4, 0.05]]); fs(c, '#fff7ea'); c.fillStyle = '#f7c86a'; c.fillRect(-0.39, 0.08, 0.78, 0.06); circ(c, 0.15, -0.25, 0.1); fs(c, '#e8303a'); },
    ball(c) { circ(c, 0, 0, 0.26); fs(c, '#fff'); c.fillStyle = '#e8303a'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 0.26, -0.5, 0.6); c.fill(); c.fillStyle = '#4aa3ff'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 0.26, 1.6, 2.7); c.fill(); c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 0.26, 3.7, 4.8); c.fill(); circ(c, 0, 0, 0.26); c.stroke(); },
  };
  const DROPS = [ // ぺしゃんこ（flat）か ゴツン（bonk）
    { id: 'tarai', name: jaen('タライ', 'Washtub'), h: 0.36, flat: true, snd: 'clang', word: jaen('ゴワーン', 'BWANG'), wob: true, w: 3 },
    { id: 'kinko', name: jaen('金庫', 'Safe'), h: 0.9, flat: true, snd: 'thud', word: jaen('ズシーン', 'THOOM'), w: 2 },
    { id: 'weight', name: jaen('10tのおもり', '10-Ton Weight'), h: 0.8, flat: true, snd: 'thud', word: jaen('ドスーン', 'WHUMP'), w: 2 },
    { id: 'piano', name: jaen('ピアノ', 'Piano'), h: 0.9, flat: true, snd: 'piano', word: jaen('ジャーン', 'KRANNG'), w: 0.6, who: { teacher: 14 } },
    { id: 'suika', name: jaen('スイカ', 'Watermelon'), h: 0.76, snd: 'splat', word: jaen('グシャッ', 'SPLAT'), splat: '#ff4d5e', w: 1.5 },
    { id: 'pot', name: jaen('植木ばち', 'Flowerpot'), h: 0.6, snd: 'crash', word: jaen('ガシャン', 'CRASH'), hat: 'plant', w: 1.5 },
    { id: 'tofu', name: jaen('とうふ', 'Tofu'), h: 0.6, snd: 'boyon', word: jaen('ぷるん', 'JIGGLE'), soft: true, w: 1.2 },
    { id: 'daikon', name: jaen('大根', 'Radish'), h: 1.0, snd: 'bonk', word: jaen('ポコッ', 'BONK'), w: 0.5, who: { grandpa: 14 } },
    { id: 'ramen', name: jaen('ラーメン', 'Ramen'), h: 0.5, snd: 'splat', word: jaen('ザバッ', 'SPLOOSH'), splat: '#f2c45a', hat: 'noodle', w: 0.5, who: { uncle: 14 } },
    { id: 'cake', name: jaen('ケーキ', 'Cake'), h: 0.5, snd: 'splat', word: jaen('ベチャ', 'SQUISH'), splat: '#fff7ea', hat: 'cream', w: 0.5, who: { sister: 14 } },
    { id: 'ball', name: jaen('ボール', 'Ball'), h: 0.52, snd: 'bonk', word: jaen('ボコッ', 'BOP'), w: 0.6, who: { friend: 14, brother: 5 } },
  ];

  // ---- 生きもの・のりもの ----
  function bird(c, kind, flap) {
    const col = { crow: '#24242c', stork: '#fafafa', parrot: '#2fb24a' }[kind], wing = kind === 'parrot' ? '#e8303a' : col;
    ell(c, 0, 0, 0.42, 0.2); fs(c, col);
    circ(c, 0.38, -0.12, 0.15); fs(c, col);
    const bl = kind === 'stork' ? 0.4 : 0.2, bc = kind === 'stork' ? '#ff8a1a' : kind === 'parrot' ? '#ffd23a' : '#555';
    poly(c, [[0.5, -0.16], [0.5 + bl, -0.08], [0.5, -0.04]]); fs(c, bc);
    circ(c, 0.42, -0.15, 0.03); c.fillStyle = kind === 'crow' ? '#fff' : INK; c.fill();
    poly(c, [[-0.5, -0.02], [-0.75, -0.12], [-0.72, 0.08]]); fs(c, kind === 'parrot' ? '#4aa3ff' : col);
    c.save(); c.translate(-0.02, -0.08); c.rotate(-0.9 + flap * 1.6);
    poly(c, [[0, 0], [-0.25, -0.6], [-0.55, -0.55], [-0.35, -0.1]]); fs(c, wing); c.restore();
    c.beginPath(); c.moveTo(-0.05, 0.18); c.lineTo(0, 0.42); c.moveTo(0.1, 0.18); c.lineTo(0.12, 0.42); c.stroke();
  }
  function cat(c, col, t, seed) {
    c.save(); c.rotate(Math.sin(t * 2 + seed) * 0.05);
    c.lineWidth = 0.05; c.strokeStyle = INK; c.beginPath(); c.moveTo(-0.22, 0); c.quadraticCurveTo(-0.45, -0.1 + Math.sin(t * 4 + seed) * 0.1, -0.38, -0.32); c.stroke();
    c.lineWidth = 0.03; c.strokeStyle = col; c.stroke(); c.strokeStyle = INK;
    ell(c, 0, 0, 0.26, 0.17); fs(c, col);
    circ(c, 0.2, -0.14, 0.15); fs(c, col);
    poly(c, [[0.08, -0.22], [0.1, -0.38], [0.2, -0.27]]); fs(c, col); poly(c, [[0.24, -0.27], [0.33, -0.37], [0.34, -0.2]]); fs(c, col);
    c.lineWidth = 0.02; c.beginPath(); c.arc(0.17, -0.14, 0.03, 0.2, Math.PI - 0.2); c.moveTo(0.29, -0.14); c.arc(0.26, -0.14, 0.03, 0.2, Math.PI - 0.2); c.stroke();
    c.restore();
  }
  function ufo(c, t) {
    ell(c, 0, -0.18, 0.35, 0.3); c.fillStyle = 'rgba(170,230,255,.85)'; c.fill(); c.stroke();
    ell(c, 0, 0, 0.95, 0.24); fs(c, '#a7b0c0');
    ell(c, 0, 0.06, 0.6, 0.1); fs(c, '#7d8798');
    for (let i = 0; i < 5; i++) { circ(c, -0.64 + i * 0.32, 0.02, 0.06); fs(c, (Math.floor(t * 8) + i) % 2 ? '#ffd23a' : '#ff6b8b'); }
  }
  function pudding(c, w, h, cream) {
    c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(w / 2, 0); c.lineTo(w * 0.36, -h); c.lineTo(-w * 0.36, -h); c.closePath(); fs(c, 'rgba(255,214,70,.78)');
    c.beginPath(); c.moveTo(-w * 0.36, -h); c.lineTo(w * 0.36, -h); c.lineTo(w * 0.38, -h * 0.85); c.quadraticCurveTo(w * 0.2, -h * 0.75, w * 0.1, -h * 0.82); c.quadraticCurveTo(0, -h * 0.7, -w * 0.12, -h * 0.84); c.quadraticCurveTo(-w * 0.28, -h * 0.76, -w * 0.38, -h * 0.85); c.closePath(); fs(c, '#8a4a1c');
    if (cream) { circ(c, 0, -h - 0.08, 0.14); fs(c, '#fff'); circ(c, 0.02, -h - 0.25, 0.08); fs(c, '#e8303a'); }
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-w * 0.32, -h * 0.6, w * 0.06, h * 0.45);
  }
  function plane(c, col) {
    poly(c, [[0.6, 0], [-0.5, -0.22], [-0.25, 0], [-0.5, 0.06]]); fs(c, '#fff');
    poly(c, [[0.6, 0], [-0.25, 0], [-0.42, 0.2]]); fs(c, '#e9eef3');
    c.strokeStyle = col; c.lineWidth = 0.05; c.beginPath(); c.moveTo(-0.3, -0.12); c.lineTo(0.3, -0.04); c.stroke();
  }
  function log(c) {
    c.beginPath(); c.roundRect(-0.7, -0.2, 1.4, 0.4, 0.2); fs(c, '#a0693a');
    c.strokeStyle = '#6b4220'; c.beginPath(); for (const x of [-0.3, 0.1, 0.4]) { c.moveTo(x, -0.18); c.quadraticCurveTo(x + 0.06, 0, x, 0.18); } c.stroke(); c.strokeStyle = INK;
    ell(c, 0.7, 0, 0.1, 0.2); fs(c, '#e2b47e'); ell(c, 0.7, 0, 0.05, 0.11); c.stroke();
  }
  function afro(c, col) { for (let i = 0; i < 9; i++) { const a = -Math.PI * (i / 8); circ(c, Math.cos(a) * 0.24, Math.sin(a) * 0.2 - 0.12, 0.13); fs(c, col); } circ(c, 0, -0.18, 0.22); c.fillStyle = col; c.fill(); }

  // ---- ころび芸の一覧 ----
  // w(cx)＝出やすさ（cx.reason＝転び方、cx.who＝届け先、cx.night＝夜っぽさ）。vs＝ちがう形（同じ芸の別バージョン）
  const LIST = [
    { id: 'crush', name: jaen('ぺしゃんこ', 'Squashed'), hint: jaen('空から何かが…', 'Something\'s falling from the sky…'), dur: 2.3, peak: 1.0, w: () => 3,
      vs: DROPS,
      start(g) { g.cam = [g.x + 0.3, g.y + 1.2]; },
      draw(g) {
        const v = g.v, st = g.st, tHit = 0.6;
        if (!st.tx) { const p = g.torso(); st.tx = p[0]; }
        if (g.t < tHit) { const p = g.torso(), h = g.head(); st.tx = p[0]; st.ty = Math.max(h[1] + 0.25, p[1] + 0.4); }
        if (v.flat) g.at(tHit - 0.06, 'snap', () => { g.snapNow(); });
        g.at(tHit, 'hit', () => {
          g.sfx(v.snd); g.shake(v.flat ? 16 : 8); g.buzz(80); g.puff(st.tx, g.gy(st.tx), v.flat ? 18 : 6, true);
          if (v.flat) g.hide = true;
          if (v.splat) g.splat(st.tx, st.ty, v.splat);
          if (v.id === 'pot') g.splat(st.tx, st.ty, '#c8693f');
          st.vx = rnd(1.5, 2.6); st.vy = v.soft ? 4.5 : 3.2; st.ox = st.tx; st.oy = st.ty + v.h / 2; st.oa = 0;
        });
        const sn = g.snap;
        if (v.flat && g.t >= tHit) {
          const a = g.t - tHit, sq = 0.15 + 0.12 * Math.exp(-a * 6) * Math.cos(a * 30);
          g.draw(sn, sn.x, sn.y, { sy: sq, sx: 1.5 });
          if (a > 0.5) for (let i = 0; i < 3; i++) { const an = g.t * 5 + i * 2.1; at(g, sn.x + sn.cx + Math.cos(an) * 0.6, sn.y + 0.45 + Math.sin(an) * 0.08, (c) => { c.fillStyle = '#ffd23a'; poly(c, [[0, -0.1], [0.03, -0.03], [0.1, 0], [0.03, 0.03], [0, 0.1], [-0.03, 0.03], [-0.1, 0], [-0.03, -0.03]]); c.fill(); c.stroke(); }); }
        }
        if (g.t < tHit) { // 落ちてくる（かげが大きくなる）
          const p = g.t / tHit, y = st.ty + v.h / 2 + 9 * (1 - p * p);
          at(g, st.tx, g.gy(st.tx), (c) => { ell(c, 0, 0, 0.2 + 0.5 * p, 0.06 + 0.06 * p); c.fillStyle = 'rgba(0,0,0,.25)'; c.fill(); });
          at(g, st.tx, y, (c) => OBJ[v.id](c));
        } else if (v.flat) { // 上にのったまま（タライはぐわんぐわん）
          const a = g.t - tHit, y = sn.y + sn.bb.t * 0.18 + v.h / 2 + Math.abs(Math.sin(a * 9)) * 0.5 * Math.exp(-a * 5);
          const rot = v.wob ? Math.sin(a * 22) * 0.25 * Math.exp(-a * 1.6) : 0;
          at(g, st.tx, y, (c) => OBJ[v.id](c), rot);
          if (v.wob) g.word(jaen('ゴワン ゴワン', 'WONG WONG'), st.tx + 0.4, y + 0.6, tHit + 0.5, { size: 0.32, col: '#e4eaf0' });
        } else { // はねかえって飛んでいく
          if (v.id !== 'suika' && v.id !== 'pot' && v.id !== 'cake' && v.id !== 'ramen') {
            st.vy -= 12 * g.dt; st.ox += st.vx * g.dt; st.oy += st.vy * g.dt; st.oa += 8 * g.dt;
            at(g, st.ox, st.oy, (c) => OBJ[v.id](c), st.oa);
          }
          const h = g.head(), a = g.t - tHit;
          if (!v.soft) at(g, h[0] - 0.02, h[1] + 0.2, (c) => { const r = 0.06 + 0.1 * back(cl(a / 0.3)); circ(c, 0, -r * 0.5, r); fs(c, g.skin()); }); // たんこぶ
          if (v.hat === 'plant') at(g, h[0], h[1] + 0.35, (c) => { for (const an of [-0.5, 0, 0.5]) { ell(c, Math.sin(an) * 0.15, -0.1, 0.06, 0.16, an); fs(c, '#4fae4a'); } });
          if (v.hat === 'noodle') at(g, h[0], h[1], (c) => { c.strokeStyle = '#f2c45a'; c.lineWidth = 0.035; for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(-0.22 + i * 0.07, -0.2); for (let k = 1; k < 6; k++) c.lineTo(-0.22 + i * 0.07 + Math.sin(k * 2 + i + g.t * 3) * 0.03, -0.2 + k * 0.09); c.stroke(); } });
          if (v.hat === 'cream') at(g, h[0], h[1] + 0.1, (c) => { cloud(c, 7, 0.28, '#fff7ea', 1); circ(c, 0.05, -0.2, 0.08); fs(c, '#e8303a'); });
        }
        g.word(v.word + '!', st.tx + 0.2, (st.ty || g.y + 1) + 0.6, tHit, { size: YL.latin ? 0.42 : 0.5, col: v.flat ? '#ffd23a' : '#fff' });
      } },

    { id: 'shatter', name: jaen('こなごな', 'Shattered'), hint: jaen('カチーンと かたまって…', 'Frozen stiff with a clink…'), dur: 2.6, peak: 1.0, w: () => 2,
      vs: [{ id: 'glass', name: jaen('ガラス', 'Glass'), tint: ['#bfe6ff', 0.45], snd: 'crash', word: jaen('パリーン', 'SMASH') }, { id: 'blocks', name: jaen('つみき', 'Blocks'), tint: null, snd: 'blocks', word: jaen('ガラガラ', 'CLATTER'), blocks: true }, { id: 'cookie', name: jaen('クッキー', 'Cookie'), tint: ['#c98a4b', 0.55], snd: 'crunch', word: jaen('サクッ', 'CRUNCH') }],
      draw(g) {
        const v = g.v, st = g.st;
        g.at(0.45, 'snap', () => { g.snapNow(); g.hide = true; g.sfx('crack'); });
        if (g.t < 0.45) return;
        const sn = g.snap;
        if (g.t < 0.95) {
          const j = (g.t - 0.45) * 0.06;
          g.draw(sn, sn.x + rnd(-j, j), sn.y);
          if (v.tint) g.draw(g.tint(sn, ...v.tint), sn.x, sn.y, { alpha: seg(g.t, 0.45, 0.7) });
          cracks(g, sn, 3, 7, seg(g.t, 0.5, 0.9));
          g.word(jaen('ピキッ', 'krik'), sn.x + sn.cx, sn.y + sn.bb.t + 0.2, 0.5, { size: 0.35, dur: 0.45 });
          return;
        }
        g.at(0.95, 'burst', () => { st.ps = makePieces(sn, 5, 6, 1.5, 4); g.sfx(v.snd); g.shake(10); g.sparkle(sn.x + sn.cx, sn.y + sn.cy, 14, v.tint ? '#fff' : '#ffd23a'); });
        stepPieces(g, st.ps);
        const img = v.tint ? g.tint(sn, ...v.tint) : sn;
        for (const p of st.ps) {
          g.piece(img, p.rx, p.ry, p.w, p.h, p.x, p.y, p.a);
          if (v.blocks) at(g, p.x, p.y, (c) => { c.lineWidth = 0.03; c.strokeStyle = ['#ff6b8b', '#4aa3ff', '#ffd23a', '#5fc96b'][Math.floor((p.rx + p.ry) * 7) & 3]; c.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h); }, p.a);
        }
        g.word(v.word + '!', sn.x + sn.cx, sn.y + sn.bb.t + 0.4, 0.95, { size: YL.latin ? 0.42 : 0.5 });
      } },

    { id: 'stuck', name: jaen('さかさまに ささる', 'Stuck Head-First'), hint: jaen('ポーンと とんで…', 'Up, up and away…'), dur: 2.5, peak: 1.4, w: (cx) => (cx.reason === 'head' ? 6 : 2),
      start(g) { g.hide = true; g.cam = [g.x + 0.7, g.y + 1.4]; g.sfx('whoosh'); },
      draw(g) {
        const sn = g.snap, p = seg(g.t, 0, 0.62), X0 = sn.x + sn.cx, x = X0 + 0.7 * p, gy = g.gy(x);
        const rEnd = (upRot(sn) + Math.PI + TAU) % TAU || TAU; // さかさま
        let y = lerp(sn.y + sn.cy, gy + 0.1, p) + 2.6 * Math.sin(Math.PI * p), rot = rEnd * out3(p);
        g.at(0.62, 'hit', () => { g.sfx('thud'); g.shake(12); g.buzz(60); g.puff(x, gy, 16, true); });
        if (g.t > 0.62) { const a = g.t - 0.62; rot = rEnd + Math.sin(a * 16) * 0.16 * (a < 1.2 ? 1 : 0.4); y = gy + 0.1 - Math.min(0.12, a * 0.6); }
        up(g, sn, x, y, rot, { clipY: gy });
        if (g.t > 0.62) {
          at(g, x, g.gy(x), (c) => { ell(c, 0, 0.02, 0.45, 0.08); fs(c, '#8a5a32'); for (let i = 0; i < 5; i++) { circ(c, -0.4 + i * 0.2, -0.02, 0.06); fs(c, '#a8743f'); } });
          g.word(jaen('ズボッ!', 'THUNK!'), x + 0.5, g.y + 1.6, 0.62, { size: 0.5 });
          g.word(jaen('ジタバタ', 'flail flail'), x - 0.6, g.y + 2.2, 1.3, { size: 0.32, dur: 1 });
        }
      } },

    { id: 'bury', name: jaen('うまる', 'Buried'), hint: jaen('地面が やわらかいと…', 'When the ground is soft…'), dur: 2.5, peak: 1.2, w: (cx) => (cx.reason === 'hole' ? 7 : 1.5),
      vs: [{ id: 'neck', name: jaen('首まで', 'Neck-Deep') }, { id: 'all', name: jaen('すっぽり', 'All the Way') }],
      start(g) { g.hide = true; g.sfx('sink'); },
      draw(g) {
        const sn = g.snap, all = g.v.id === 'all', X = sn.x + sn.cx, gy = g.gy(X), dh = headD(sn);
        const q = out3(seg(g.t, 0, 0.18)), y0 = gy + dh * 1.25, y1 = all ? gy - dh * 1.5 - 0.3 : gy + 0.18 - dh;
        const yc = lerp(sn.y + sn.cy, y0, q) - (y0 - y1) * out3(seg(g.t, 0.1, all ? 1.3 : 1.0)), j = g.t < 1.0 ? Math.sin(g.t * 40) * 0.03 : 0;
        up(g, sn, X + j, yc, upRot(sn) * q, { clipY: gy });
        at(g, X, gy, (c) => { ell(c, 0, 0, 0.55 + 0.1 * Math.sin(g.t * 6), 0.08); fs(c, '#8a5a32'); });
        if (all) {
          for (let i = 0; i < 3; i++) { const a = (g.t * 1.2 + i * 0.33) % 1; if (g.t > 1.3) at(g, X + (i - 1) * 0.2, gy + a * 0.7, (c) => { circ(c, 0, 0, 0.05 + a * 0.05); c.fillStyle = 'rgba(255,255,255,.7)'; c.fill(); c.stroke(); }); }
          g.at(1.8, 'sprout', () => g.sfx('pop'));
          if (g.t > 1.8) at(g, X, gy, (c) => { const k = back(seg(g.t, 1.8, 2.1)); c.scale(k, k); c.lineWidth = 0.04; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -0.3); c.stroke(); for (const s of [-1, 1]) { ell(c, s * 0.1, -0.32, 0.1, 0.05, s * 0.4); fs(c, '#5fc96b'); } });
          g.word(jaen('ポコポコ…', 'blub blub…'), sn.x + 0.8, g.y + 0.8, 1.3, { size: 0.32 });
        }
        g.word(jaen('ズブズブ…', 'squelch…'), sn.x + 0.9, g.y + 1.4, 0.2, { size: 0.4 });
      } },

    { id: 'star', name: jaen('お星さまになる', 'Shooting Star'), hint: jaen('いきおいよく とぶと…', 'Fly off way too fast…'), dur: 2.4, peak: 1.5, w: () => 1.6,
      start(g) { g.hide = true; g.sfx('whoosh'); g.cam = [g.x, g.y + 1]; },
      draw(g) {
        const sn = g.snap, p = seg(g.t, 0, 1.1), e = p * p;
        if (p < 1) g.draw(sn, sn.x + 5 * e, sn.y + 0.8 + 8 * e, { py: 0.8, rot: 14 * e, sx: 1 - 0.75 * p, sy: 1 - 0.75 * p });
        g.word(jaen('ポーン!', 'FWOOP!'), sn.x + 0.4, sn.y + 1.8, 0.05, { size: 0.45, dur: 0.7 });
      },
      screen(g) {
        g.at(1.1, 'tw', () => g.sfx('twinkle'));
        if (g.t < 1.1) return;
        const c = g.c, a = g.t - 1.1, X = g.W * 0.8, Y = g.H * 0.16, r = 26 * back(cl(a / 0.25)) * (1 + 0.15 * Math.sin(a * 12));
        c.save(); c.translate(X, Y); c.rotate(a * 2); c.fillStyle = '#fff6b0'; c.strokeStyle = INK; c.lineWidth = 3;
        c.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.3 : r; const an = i * Math.PI / 4; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke(); c.restore();
        g.word(jaen('キラーン☆', 'TING☆'), X - 30, Y + 46, 1.1, { scr: true, size: 26, dur: 1.3, col: '#ffd23a' });
      } },

    { id: 'screen', name: jaen('がめんに ベチャッ', 'Splat on Screen'), hint: jaen('こっちに とんでくると…', 'Flying right at you…'), dur: 2.7, peak: 1.0, w: () => 1.8,
      start(g) { g.hide = true; g.sfx('whoosh'); const [X, Y] = g.P(g.snap.x, g.snap.y + 1.0); g.st.X0 = X; g.st.Y0 = Y; },
      screen(g) {
        const sn = g.snap, st = g.st, c = g.c, p = seg(g.t, 0, 0.45), e = p * p;
        const big = Math.min(g.W, g.H) * 0.95 / (sn.bb.t - sn.bb.b) / g.s;
        let X = lerp(st.X0, g.W / 2, e), Y = lerp(st.Y0, g.H * 0.42, e), k = lerp(1, big, e), rot = (1 - p) * 4;
        g.at(0.45, 'hit', () => { g.sfx('screen'); g.shake(14); g.buzz(90); });
        if (g.t > 0.45) { const a = g.t - 0.45, sl = a > 0.5 ? (a - 0.5) ** 2 * g.H * 0.22 : 0; Y += sl; rot = 0;
          c.save(); c.globalAlpha = 0.25; c.fillStyle = '#fff'; c.fillRect(g.W / 2 - 60, g.H * 0.42, 120, sl); c.restore();
        }
        const sq = g.t > 0.45 ? 1 + 0.08 * Math.exp(-(g.t - 0.45) * 8) : 1;
        g.draw(sn, X, Y, { scr: true, py: 1.0, sx: k * sq, sy: k / sq, rot });
        if (g.t > 0.45) { // ガラスのひび
          c.save(); c.translate(g.W / 2, g.H * 0.42); c.lineJoin = 'round';
          for (let i = 0; i < 9; i++) { const an = i / 9 * TAU + 0.3; let x = 0, y = 0; c.beginPath(); c.moveTo(0, 0); for (let j = 0; j < 5; j++) { x += Math.cos(an + Math.sin(i * 7 + j) * 0.5) * g.W * 0.09; y += Math.sin(an + Math.sin(i * 3 + j) * 0.5) * g.W * 0.09; c.lineTo(x, y); }
            c.strokeStyle = 'rgba(40,40,60,.55)'; c.lineWidth = 3.5; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 1.6; c.stroke(); }
          c.restore();
          g.word(jaen('ベチャッ!', 'SPLAT!'), g.W * 0.5, g.H * 0.18, 0.45, { scr: true, size: 44, col: '#ff6b8b' });
          g.at(1.0, 'sq', () => g.sfx('squeak'));
          g.word(jaen('キュキュ〜', 'squeak~'), g.W * 0.72, g.H * 0.7, 1.05, { scr: true, size: 24, dur: 1.4 });
        }
      } },

    { id: 'stone', name: jaen('いしになる', 'Turned to Stone'), hint: jaen('かたまって うごけないと…', 'Stand still too long…'), dur: 2.9, peak: 1.3, w: (cx) => (cx.reason === 'stop' || cx.reason === 'timeup' ? 5 : 1.2),
      draw(g) {
        const st = g.st;
        g.at(0.35, 'snap', () => { g.snapNow(); g.hide = true; g.sfx('stone'); });
        if (g.t < 0.35) return;
        const sn = g.snap, stone = g.tint(sn, '#9a9a9a', 0.82);
        if (g.t < 1.6) {
          g.draw(sn, sn.x, sn.y); g.draw(stone, sn.x, sn.y, { alpha: seg(g.t, 0.35, 0.8) });
          g.word(jaen('ピキーン', 'KRRAK'), sn.x + sn.cx, sn.y + sn.bb.t + 0.3, 0.75, { size: 0.4, col: '#cfd3d8', dur: 0.8 });
          if (g.t > 1.15) { g.at(1.15, 'cr', () => g.sfx('crack')); cracks(g, sn, 5, 6, seg(g.t, 1.15, 1.55)); }
          return;
        }
        g.at(1.6, 'fall', () => { st.ps = makePieces(sn, 6, 7, 0.35, 0.6); g.sfx('stone'); g.shake(8); g.puff(sn.x + sn.cx, g.gy(sn.x), 14, true); });
        stepPieces(g, st.ps);
        for (const p of st.ps) g.piece(stone, p.rx, p.ry, p.w, p.h, p.x, p.y, p.a);
        g.word(jaen('ガラガラ…', 'crumble…'), sn.x + sn.cx + 0.4, sn.y + 1.4, 1.6, { size: 0.42 });
      } },

    { id: 'freeze', name: jaen('カチコチ', 'Frozen Solid'), hint: jaen('さむい日は…', 'On a cold day…'), dur: 2.7, peak: 1.0, w: (cx) => 1.2 + cx.night * 2,
      draw(g) {
        g.at(0.3, 'snap', () => { g.snapNow(); g.hide = true; g.sfx('freeze'); });
        if (g.t < 0.3) return;
        const sn = g.snap, bb = sn.bb, a = Math.max(0, g.t - 1.1), dx = a * a * 3.2 + a * 0.4;
        g.at(1.1, 'sl', () => g.sfx('slide'));
        const x = sn.x + dx, k = seg(g.t, 0.3, 0.6);
        g.draw(sn, x, sn.y); g.draw(g.tint(sn, '#bfe8ff', 0.4), x, sn.y, { alpha: k });
        at(g, x + (bb.l + bb.r) / 2, sn.y + (bb.b + bb.t) / 2, (c) => {
          const w = (bb.r - bb.l) / 2 + 0.05, h = (bb.t - bb.b) / 2 + 0.05;
          c.globalAlpha = k; c.beginPath(); c.roundRect(-w, -h, w * 2, h * 2, 0.12); c.fillStyle = 'rgba(190,232,255,.45)'; c.fill(); c.lineWidth = 0.045; c.stroke();
          c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 0.06; c.beginPath(); c.moveTo(-w + 0.15, -h + 0.35); c.lineTo(-w + 0.35, -h + 0.15); c.moveTo(-w + 0.15, -h + 0.65); c.lineTo(-w + 0.65, -h + 0.15); c.stroke();
        });
        if (a > 0 && Math.random() < 0.5) g.sparkle(x + bb.l, g.gy(x) + 0.05, 1, '#fff');
        g.word(jaen('カチーン', 'CLINK'), sn.x + sn.cx, sn.y + bb.t + 0.3, 0.35, { size: 0.45, col: '#bfe8ff', dur: 0.8 });
        g.word(jaen('ツルーッ', 'sliiide~'), x + bb.r + 0.2, sn.y + 1.0, 1.15, { size: 0.42, dur: 1.4 });
      } },

    { id: 'melt', name: jaen('とろける', 'Total Meltdown'), hint: jaen('あつい日は…', 'On a hot day…'), dur: 2.6, peak: 1.7, w: (cx) => (cx.reason === 'pudding' ? 4 : 1.3),
      draw(g) {
        g.at(0.3, 'snap', () => { g.snapNow(); g.hide = true; g.sfx('melt'); });
        if (g.t < 0.3) return;
        const sn = g.snap, p = seg(g.t, 0.35, 1.7), al = 1 - seg(g.t, 1.2, 1.9);
        const px = sn.x + sn.cx, gy = g.gy(px);
        at(g, px, gy, (c) => { ell(c, 0, -0.03, 0.3 + 1.0 * out3(p), 0.06 + 0.07 * p); fs(c, g.shirt()); if (p > 0.85) { c.lineWidth = 0.03; for (const ex of [-0.12, 0.12]) { c.beginPath(); c.moveTo(ex - 0.04, -0.09); c.lineTo(ex + 0.04, -0.01); c.moveTo(ex + 0.04, -0.09); c.lineTo(ex - 0.04, -0.01); c.stroke(); } } });
        if (al > 0) g.draw(sn, sn.x, sn.y, { sy: 1 - 0.85 * p, sx: 1 + 0.5 * p, alpha: al });
        if (p > 0 && p < 1 && Math.random() < 0.3) g.splat(px + rnd(-0.4, 0.4), gy + 0.4 * (1 - p) + 0.1, g.shirt(), 1);
        g.word(jaen('とろ〜り', 'gooey~'), px + 0.6, gy + 1.4, 0.5, { size: 0.42, col: '#ffd23a', dur: 1.5 });
      } },

    { id: 'soul', name: jaen('たましいが ぬける', 'Soul Pops Out'), hint: jaen('ころんだ ショックで…', 'The shock of falling…'), dur: 2.5, peak: 1.3, w: () => 1.8,
      vs: [{ id: 'back', name: jaen('もどる', 'Comes Back') }, { id: 'away', name: jaen('とんでいく', 'Floats Off') }],
      draw(g) {
        g.at(0.4, 'snap', () => { g.st.sn = g.takeSnap(); g.sfx('soul'); });
        const sn = g.st.sn; if (!sn) return;
        let up = 1.6 * out3(seg(g.t, 0.45, 1.5));
        if (g.v.id === 'back' && g.t > 1.75) { up *= 1 - seg(g.t, 1.75, 1.9); g.at(1.75, 'bk', () => g.sfx('back')); g.at(1.9, 'bump', () => g.shake(6)); }
        if (g.v.id === 'away') up += Math.max(0, g.t - 1.5) * 3;
        if (up > 0.02) g.draw(g.tint(sn, '#ffffff', 0.85), sn.x + Math.sin(g.t * 5) * 0.15, sn.y + up, { alpha: 0.6, sx: 1 + Math.sin(g.t * 9) * 0.06, py: 0.8 });
        g.word(jaen('ふわ〜', 'whoooo~'), sn.x + 0.9, sn.y + 2.2, 0.5, { size: 0.4, col: '#eef4ff', dur: 1.2 });
        if (g.v.id === 'back') g.word(jaen('シュポッ!', 'SHLOOP!'), sn.x + 0.6, sn.y + 1.5, 1.85, { size: 0.42, dur: 0.6 });
      } },

    { id: 'zap', name: jaen('まっくろこげ', 'Burnt to a Crisp'), hint: jaen('ゴロゴロ…ピカッ', 'Rumble, rumble… FLASH!'), dur: 2.6, peak: 1.2, w: (cx) => 1.3 + cx.night,
      draw(g) {
        g.at(0.3, 'snap', () => { g.snapNow(); g.hide = true; g.sfx('zap'); g.shake(14); g.buzz(120); });
        if (g.t < 0.3) return;
        const sn = g.snap, fl = g.t < 0.7 && Math.floor(g.t * 25) % 2;
        g.draw(sn, sn.x, sn.y); g.draw(g.tint(sn, fl ? '#ffffff' : '#1d1612', 0.9), sn.x, sn.y, { alpha: fl ? 1 : seg(g.t, 0.3, 0.7) });
        if (g.t > 0.7) {
          g.at(0.7, 'boff', () => { g.sfx('poof'); g.puff(sn.x + sn.hx, sn.y + sn.hy, 10, true); });
          at(g, sn.x + sn.hx, sn.y + sn.hy, (c) => { const k = back(seg(g.t, 0.7, 0.9)); c.scale(k, k); afro(c, '#2a1a10'); }, -sn.ha);
          for (let i = 0; i < 3; i++) { const a = (g.t * 0.7 + i / 3) % 1; at(g, sn.x + sn.hx + Math.sin(a * 6 + i) * 0.2, sn.y + sn.hy + 0.4 + a * 1.2, (c) => { c.globalAlpha = 1 - a; cloud(c, 5, 0.12 + a * 0.15, '#8d8d94', i); }); }
          g.word(jaen('ボフッ', 'POOF'), sn.x + sn.hx + 0.5, sn.y + sn.hy + 0.6, 0.7, { size: 0.4, dur: 0.8 });
          g.word(jaen('ケホッ', 'cough'), sn.x + sn.hx + 0.5, sn.y + sn.hy + 0.3, 1.7, { size: 0.32, dur: 0.8 });
        }
      },
      screen(g) {
        if (g.t < 0.3 || g.t > 0.75) return;
        const c = g.c, sn = g.snap, [X, Y] = g.P(sn.x + sn.hx, sn.y + sn.hy);
        c.save(); c.globalAlpha = 0.6 * (1 - seg(g.t, 0.3, 0.75)); c.fillStyle = '#fff'; c.fillRect(0, 0, g.W, g.H); c.restore();
        c.save(); c.strokeStyle = '#fff36b'; c.lineWidth = 10; c.lineJoin = 'miter'; c.beginPath(); c.moveTo(X + 40, 0);
        for (let i = 1; i <= 6; i++) c.lineTo(X + 40 - i * 7 + (i % 2 ? 26 : -26), Y * i / 6); c.stroke(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke(); c.restore();
        g.word(jaen('ビリビリ!', 'BZZZT!'), X + 70, Y - 90, 0.3, { scr: true, size: 34, col: '#fff36b', dur: 0.5 });
      } },

    { id: 'bird', name: jaen('とりに さらわれる', 'Bird-Napped'), hint: jaen('空から 大きなかげが…', 'A big shadow overhead…'), dur: 2.6, peak: 1.2, w: () => 1.5,
      vs: [{ id: 'crow', name: jaen('カラス', 'Crow'), snd: 'kaa' }, { id: 'stork', name: jaen('コウノトリ', 'Stork'), snd: 'flap' }, { id: 'parrot', name: jaen('オウム', 'Parrot'), snd: 'flap' }],
      start(g) { g.sfx('flap'); g.cam = [g.x, g.y + 1.6]; },
      draw(g) {
        const st = g.st, tg = 0.75;
        if (g.t < tg) { const p = g.torso(); st.gx = p[0]; st.gy = p[1] + 0.9; }
        g.at(tg, 'grab', () => { st.sn = g.takeSnap(); g.hide = true; g.sfx(g.v.snd); g.shake(4); });
        let bx, by, dir;
        if (g.t < tg) { const p = g.t / tg; bx = lerp(st.gx + 5, st.gx, out3(p)); by = lerp(st.gy + 5, st.gy, out3(p)); dir = -1; }
        else { const p = seg(g.t, tg, 2.4); bx = st.gx - 6 * p * p - 0.5 * p; by = st.gy + 7 * p * p + 0.6 * p; dir = -1; }
        const flap = (Math.sin(g.t * 18) + 1) / 2;
        if (st.sn) { const sn = st.sn, sw = Math.sin(g.t * 6) * 0.35; g.draw(sn, bx - sn.hx, by - 0.45 - sn.hy - 0.15, { px: sn.hx, py: sn.hy + 0.15, rot: Math.PI / 2 + Math.atan2(sn.cy - sn.hy, sn.cx - sn.hx) + sw }); }
        at(g, bx, by, (c) => bird(c, g.v.id, flap), 0, -dir * 1.5, 1.5);
        g.word(jaen('バサッ', 'FLAP'), bx + 0.7, by + 0.8, 0.6, { size: 0.36, dur: 0.8 });
        if (g.v.id === 'crow') g.word(jaen('カー!', 'CAW!'), bx + 0.9, by + 0.6, 1.2, { size: 0.42, dur: 0.9 });
      } },

    { id: 'balloon', name: jaen('ふうせん', 'Human Balloon'), hint: jaen('ぷくーっと…', 'Puffing up…'), dur: 2.7, peak: 1.3, w: () => 1.4,
      start(g) { g.hide = true; g.sfx('inflate'); g.st.x = g.snap.x; g.st.y = g.snap.y; g.st.a = 1.2; },
      draw(g) {
        const sn = g.snap, st = g.st, inf = back(seg(g.t, 0.05, 0.7));
        let k = 1 + 0.75 * inf, kx = 1 + 0.95 * inf;
        if (g.t < 1.45) { st.y = sn.y + 1.6 * out3(seg(g.t, 0.7, 1.45)); st.x = sn.x + Math.sin(g.t * 4) * 0.15; }
        else {
          g.at(1.45, 'pf', () => g.sfx('pfff'));
          st.a += g.dt * 9 * (Math.sin(g.t * 13) > 0 ? 1 : -0.4); st.x += Math.cos(st.a) * 7 * g.dt; st.y += Math.sin(st.a) * 7 * g.dt + 2 * g.dt;
          const s = 1 - seg(g.t, 1.45, 2.4) * 0.6; k *= s * 0.7; kx *= s * 0.7;
        }
        g.draw(sn, st.x, st.y, { py: sn.cy, sx: kx, sy: k, rot: g.t > 1.45 ? st.a : 0 });
        g.word(jaen('プクーッ', 'PUFF~'), sn.x + 1.2, sn.y + 2.2, 0.2, { size: 0.42, dur: 1 });
        g.word(jaen('プシューッ', 'PFFFFT'), st.x + 0.8, st.y + 1.2, 1.45, { size: 0.42, dur: 1 });
      } },

    { id: 'bounce', name: jaen('スーパーボール', 'Bouncy Ball'), hint: jaen('はずんで はずんで…', 'Bounce, bounce, bounce…'), dur: 2.6, peak: 1.0, w: () => 1.4,
      start(g) {
        g.hide = true; const hs = [0.5, 1.1, 2.0, 9], gr = 22, seq = []; let t = 0.1;
        for (const h of hs) { const T = 2 * Math.sqrt(2 * h / gr); seq.push({ t0: t, T, h }); t += T; }
        g.st.seq = seq; g.st.gr = gr;
      },
      draw(g) {
        const sn = g.snap, st = g.st;
        let y = sn.y, sq = 1, x = sn.x, i = 0;
        for (; i < st.seq.length; i++) { const s = st.seq[i]; if (g.t < s.t0 + s.T) break; }
        const s = st.seq[Math.min(i, st.seq.length - 1)], a = g.t - s.t0;
        if (g.t >= st.seq[0].t0) { const vy = st.gr * s.T / 2; y = sn.y + Math.max(0, vy * a - st.gr * a * a / 2); x = sn.x + (i + Math.min(1, a / s.T)) * 0.7; }
        g.at(st.seq[1].t0, 'b1', () => g.sfx('boing')); g.at(st.seq[2].t0, 'b2', () => g.sfx('boing2')); g.at(st.seq[3].t0, 'b3', () => g.sfx('boing3'));
        if (a < 0.08 && i > 0) sq = 0.6;
        g.draw(sn, x, y, { py: sn.cy, sx: 2 - sq, sy: sq, rot: g.t * (i + 1) * 2 });
        g.word(jaen('ボヨーン', 'BOING'), x + 0.8, sn.y + 1.2, st.seq[2].t0, { size: 0.42 });
      } },

    { id: 'drill', name: jaen('ドリルで ちていへ', 'Drill Dive'), hint: jaen('くるくる回って…', 'Spinning round and round…'), dur: 2.7, peak: 0.9, w: () => 1.3,
      start(g) { g.hide = true; g.sfx('drill'); g.cam = [g.x + 1.2, g.y + 1.2]; },
      draw(g) {
        const sn = g.snap, p = seg(g.t, 0, 0.3), d = seg(g.t, 0.3, 1.3), X = sn.x + sn.cx, gy = g.gy(X), dh = headD(sn);
        if (g.t < 1.35) {
          const y0 = sn.y + sn.cy + 0.6, y1 = gy - dh * 1.5 - 0.4, y = lerp(sn.y + sn.cy, y0, p) + (y1 - y0) * d * d;
          up(g, sn, X, y, (upRot(sn) + Math.PI) * out3(p), { sx: g.t > 0.3 ? Math.cos(g.t * 40) : 1, clipY: gy });
          if (g.t > 0.5 && Math.random() < 0.6) g.splat(X + rnd(-0.2, 0.2), gy + 0.05, '#8a5a32', 1);
          g.word(jaen('ギュイーン', 'VRRRRR'), sn.x + 0.8, sn.y + 1.8, 0.3, { size: 0.4, dur: 1 });
        } else if (g.t < 1.75) g.shake(2);
        at(g, X, gy, (c) => { ell(c, 0, 0, 0.3, 0.06); fs(c, '#5a3a1e'); });
        if (g.t > 1.75) { // ちがう所から顔を出す
          const x2 = X + 2.4, g2 = g.gy(x2);
          g.at(1.75, 'puha', () => { g.sfx('puha'); g.puff(x2, g2, 10, true); });
          up(g, sn, x2, lerp(g2 - dh * 1.5, g2 + 0.32 - dh, back(seg(g.t, 1.75, 2.0))), upRot(sn), { clipY: g2 });
          at(g, x2, g.gy(x2), (c) => { ell(c, 0, 0, 0.45, 0.08); fs(c, '#8a5a32'); });
          g.word(jaen('ぷはっ', 'PWAH!'), x2 + 0.6, g.gy(x2) + 0.9, 1.8, { size: 0.42 });
        }
      } },

    { id: 'purin', name: jaen('プリンに うもれる', 'Pudding Avalanche'), hint: jaen('大きな プリンが…', 'A giant pudding…'), dur: 2.5, peak: 1.0, w: (cx) => (cx.reason === 'pudding' ? 5 : 1) * (cx.who === 'king' ? 4 : 1),
      draw(g) {
        g.at(0.45, 'snap', () => { g.snapNow(); g.hide = true; });
        const sn = g.snap, x = (g.t < 0.45 ? g.torso()[0] : sn.x + sn.cx), hit = 0.55;
        if (g.t >= 0.45) g.draw(sn, sn.x, sn.y);
        g.at(hit, 'hit', () => { g.sfx('boyon'); g.shake(12); g.buzz(70); g.splat(x, g.gy(x) + 0.5, '#ffd23a'); });
        const p = seg(g.t, 0, hit), y = g.gy(x) + 9 * (1 - p * p);
        const a = Math.max(0, g.t - hit), j = Math.sin(a * 18) * 0.2 * Math.exp(-a * 2.5);
        at(g, x, y, (c) => pudding(c, 2.6, 1.9, true), 0, 1 + j, 1 - j);
        g.word(jaen('プルルン!', 'WOBBLE!'), x + 1.1, g.gy(x) + 2.4, hit, { size: 0.5, col: '#ffd23a' });
      } },

    { id: 'fart', name: jaen('おならで ぶっとぶ', 'Fart Rocket'), hint: jaen('おなかに 力が入ると…', 'Push too hard and…'), dur: 2.3, peak: 0.8, w: () => 1.5,
      draw(g) {
        const st = g.st;
        g.at(0.25, 'p1', () => { g.sfx('fart'); });
        g.at(0.6, 'go', () => { st.sn = g.takeSnap(); g.hide = true; g.sfx('fart'); g.shake(8); st.vx = 6; st.vy = 7; st.x = st.sn.x; st.y = st.sn.y; st.r = 0; st.puffs = []; });
        if (st.sn) {
          const sn = st.sn; st.vy -= 7 * g.dt; st.x += st.vx * g.dt; st.y += st.vy * g.dt; st.r += 9 * g.dt;
          if (st.puffs.length < 14 && Math.random() < 0.7) st.puffs.push({ x: st.x + sn.cx - 0.3, y: st.y + sn.cy, t: g.t });
          for (const q of st.puffs) { const a = g.t - q.t; at(g, q.x, q.y, (c) => { c.globalAlpha = Math.max(0, 0.75 - a * 0.4); cloud(c, 5, 0.25 + a * 0.3, '#b9d77a', q.t * 9); }); }
          g.draw(sn, st.x, st.y, { py: sn.cy, rot: st.r });
          g.word(jaen('ブッ!!', 'PRRT!!'), sn.x - 0.4, sn.y + 1.0, 0.6, { size: 0.6, col: '#b9d77a' });
        } else if (g.t > 0.25) { const p = g.torso(); at(g, p[0] - 0.35, p[1] - 0.2, (c) => { c.globalAlpha = 0.7; cloud(c, 5, 0.18, '#b9d77a', 2); }); g.word(jaen('ぷっ', 'pft'), p[0] - 0.5, p[1] + 0.2, 0.25, { size: 0.3, dur: 0.4 }); }
      } },

    { id: 'trap', name: jaen('おとしあな', 'Trapdoor!'), hint: jaen('地面が パカッと…', 'The ground pops open…'), dur: 2.5, peak: 0.7, w: (cx) => (cx.reason === 'hole' ? 4 : 1.2),
      draw(g) {
        const st = g.st;
        g.at(0.25, 'open', () => { g.snapNow(); g.hide = true; g.sfx('trap'); });
        if (g.t < 0.25) return;
        const sn = g.snap, x0 = sn.x + sn.bb.l - 0.15, x1 = sn.x + sn.bb.r + 0.15, gy = g.gy(sn.x), w = x1 - x0;
        const open = g.t < 1.1 ? out3(seg(g.t, 0.25, 0.4)) : 1 - out3(seg(g.t, 1.1, 1.25));
        if (open > 0.02) at(g, x0, gy, (c) => { c.fillStyle = '#1a120c'; c.fillRect(0, 0, w, 3); });
        const f = Math.max(0, g.t - 0.38), dy = 9 * f * f;
        if (dy < 6) {
          const [, Y] = g.P(0, gy), [X0] = g.P(x0, 0), [X1] = g.P(x1, 0), c = g.c;
          c.save(); c.beginPath(); c.rect(-g.W, -g.H * 2, g.W * 3, Y + g.H * 2); c.rect(X0, Y - 1, X1 - X0, g.H); c.clip();
          g.draw(sn, sn.x, sn.y - dy); c.restore();
        }
        for (const s of [0, 1]) at(g, s ? x1 : x0, gy, (c) => { c.rotate((s ? -1 : 1) * open * 1.45); c.fillStyle = '#9a6a3a'; c.fillRect(s ? -w / 2 : 0, 0, w / 2, 0.1); c.strokeRect(s ? -w / 2 : 0, 0, w / 2, 0.1); });
        g.at(1.25, 'shut', () => { g.sfx('shut'); g.shake(5); });
        g.word(jaen('ヒュ〜〜', 'aaah~~'), sn.x + 0.8, gy + 0.8, 0.4, { size: 0.42, dur: 0.8 });
        g.word(jaen('パタン', 'CLUNK'), sn.x + 0.6, gy + 0.5, 1.25, { size: 0.42 });
        if (g.t > 1.5) at(g, sn.x + sn.cx, gy, (c) => { const k = back(seg(g.t, 1.5, 1.75)); c.scale(k, k); c.lineWidth = 0.04; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -0.6); c.stroke(); poly(c, [[0, -0.6], [0.45, -0.5], [0, -0.38]]); fs(c, '#e8303a'); });
      } },

    { id: 'sleep', name: jaen('ねちゃう', 'Nap Attack'), hint: jaen('つかれていると…', 'When you\'re sleepy…'), dur: 2.5, peak: 1.4, w: (cx) => (cx.reason === 'timeup' ? 6 : cx.reason === 'stop' ? 3 : 0.8),
      start(g) { g.sfx('snore'); },
      draw(g) {
        const h = g.head(), ha = g.headA(), nx = h[0] + Math.cos(ha) * 0.22, ny = h[1] + Math.sin(ha) * 0.22 - 0.02;
        const pop = 2.0, r = g.t < pop ? 0.05 + 0.2 * seg(g.t, 0.4, 1.9) * (0.8 + 0.2 * Math.sin(g.t * 5)) : 0;
        g.at(1.0, 'sn2', () => g.sfx('snore'));
        if (r > 0) at(g, nx + r * 0.6, ny, (c) => { circ(c, 0, 0, r); c.fillStyle = 'rgba(190,230,255,.6)'; c.fill(); c.lineWidth = 0.02; c.stroke(); c.fillStyle = '#fff'; circ(c, -r * 0.35, -r * 0.35, r * 0.18); c.fill(); });
        g.at(pop, 'pop', () => { g.sfx('pop'); g.sparkle(nx + 0.15, ny, 6, '#bfe6ff'); });
        for (let i = 0; i < 3; i++) { const a = (g.t * 0.6 + i / 3) % 1; if (g.t > 0.3) at(g, h[0] + 0.3 + a * 0.6, h[1] + 0.4 + a * 0.9, (c) => { c.globalAlpha = 1 - a; c.font = `900 ${0.22 + a * 0.15}px sans-serif`; c.fillStyle = '#fff'; c.lineWidth = 0.05; c.strokeText('Z', 0, 0); c.fillText('Z', 0, 0); }); }
        g.word(jaen('グーグー', 'snore~'), h[0] + 0.9, h[1] + 1.4, 0.3, { size: 0.36, dur: 1.6 });
        g.word(jaen('パチン!', 'POP!'), nx + 0.5, ny + 0.5, pop, { size: 0.4 });
      } },

    { id: 'ufo', name: jaen('UFOに さらわれる', 'Abducted by UFO'), hint: jaen('夜空に あやしい光が…', 'A strange light in the night sky…'), dur: 2.7, peak: 1.3, w: (cx) => (cx.who === 'alien' ? 12 : 0.8) + cx.night,
      start(g) { g.sfx('ufo'); g.cam = [g.x, g.y + 2]; },
      draw(g) {
        const st = g.st, ux = g.x + 0.2;
        g.at(0.7, 'snap', () => { st.sn = g.takeSnap(); g.hide = true; });
        const inP = out3(seg(g.t, 0, 0.6)), outP = seg(g.t, 2.0, 2.5) ** 2;
        const X = lerp(ux + 6, ux, inP) - outP * 8, Y = g.y + 4.4 + (1 - inP) * 3 + outP * 6;
        if (g.t > 0.6 && g.t < 2.0) { // 光
          const fl = 0.35 + 0.15 * Math.sin(g.t * 30);
          at(g, X, Y, (c) => { c.fillStyle = `rgba(255,246,150,${fl})`; c.beginPath(); c.moveTo(-0.4, 0.1); c.lineTo(0.4, 0.1); c.lineTo(1.3, 4.6); c.lineTo(-1.3, 4.6); c.closePath(); c.fill(); });
        }
        if (st.sn) { const sn = st.sn, p = seg(g.t, 0.75, 1.8), k = 1 - 0.85 * p; if (p < 1) g.draw(sn, lerp(sn.x, X - sn.cx, p), lerp(sn.y, Y - 0.3 - sn.cy, p * p), { py: sn.cy, sx: k * Math.cos(g.t * 6), sy: k, rot: Math.sin(g.t * 3) * 0.3 }); }
        at(g, X, Y, (c) => ufo(c, g.t), Math.sin(g.t * 3) * 0.06, 1.3, 1.3);
        g.word(jaen('ピコピコ…', 'beep boop…'), X + 1.2, Y + 0.4, 0.6, { size: 0.36, dur: 1.2 });
        g.word(jaen('ピューン', 'ZOOM'), X + 1, Y - 0.6, 2.0, { size: 0.42, dur: 0.6 });
      } },

    { id: 'cats', name: jaen('ねこまみれ', 'Cat Pileup'), hint: jaen('ねこが すきな においが…', 'Smells like something cats love…'), dur: 2.6, peak: 1.8, w: (cx) => (cx.who === 'cat' ? 12 : cx.who === 'grandma' ? 5 : 0.8),
      start(g) { g.st.cats = []; },
      draw(g) {
        const st = g.st, cols = ['#f0a85a', '#2b2b33', '#fafafa', '#9a9aa4', '#e8c08a', '#f6d7a8'];
        for (let i = 0; i < 6; i++) {
          const t0 = 0.3 + i * 0.22;
          g.at(t0, 'c' + i, () => { const b = g.bodyPt(i); st.cats.push({ x: b[0] + rnd(-0.15, 0.15), y: Math.max(b[1], g.gy(b[0])) + 0.1 + i * 0.12, t0, col: cols[i], dir: Math.random() < 0.5 ? -1 : 1 }); g.sfx('meow'); });
        }
        for (const k of st.cats) { const p = seg(g.t, k.t0, k.t0 + 0.25); at(g, k.x, k.y + 3 * (1 - p) ** 2 + 0.15, (c) => cat(c, k.col, g.t, k.t0 * 9), 0, k.dir, 1); }
        const h = g.head();
        g.word(jaen('にゃーん', 'meow~'), h[0] + 0.8, h[1] + 1.6, 0.4, { size: 0.4, dur: 1.4, col: '#ffd0e6' });
      } },

    { id: 'tornado', name: jaen('たつまき', 'Tornado Ride'), hint: jaen('つよい風が…', 'A strong wind blows…'), dur: 2.6, peak: 1.2, w: () => 1.2,
      start(g) { g.sfx('wind'); g.cam = [g.x + 0.5, g.y + 1.6]; },
      draw(g) {
        const st = g.st, inP = out3(seg(g.t, 0, 0.5)), outP = seg(g.t, 1.7, 2.5) ** 2, fx = lerp(g.x + 5, g.x, inP) + outP * 6, gy = g.gy(fx);
        g.at(0.5, 'lift', () => { st.sn = g.takeSnap(); g.hide = true; });
        if (st.sn) { const sn = st.sn, up = seg(g.t, 0.5, 1.7) * 3 + outP * 4, an = g.t * 10; g.draw(sn, fx + Math.sin(an) * 0.6 - sn.cx, gy + up + 0.2, { py: sn.cy, sx: 0.8 * Math.cos(an), sy: 0.8, rot: g.t * 3 }); }
        at(g, fx, gy, (c) => {
          for (let i = 0; i < 9; i++) { const y = -i * 0.45, w = 0.25 + i * 0.16, o = Math.sin(g.t * 6 + i) * 0.12; ell(c, o, y, w, 0.12 + i * 0.02); c.fillStyle = 'rgba(200,205,215,.45)'; c.fill(); c.lineWidth = 0.025; c.strokeStyle = 'rgba(80,80,90,.6)'; c.stroke(); }
        });
        g.word(jaen('ビュオオオ', 'WHOOOSH'), fx + 1.2, gy + 2.6, 0.2, { size: 0.42, dur: 1.6 });
      } },

    { id: 'flower', name: jaen('お花になる', 'Flower Power'), hint: jaen('たねみたいに うまると…', 'Planted like a seed…'), dur: 2.6, peak: 2.0, w: () => 1.2,
      start(g) { g.hide = true; g.sfx('sink'); g.st.col = ['#ff8ab8', '#ffd23a', '#8ec5ff', '#ffb35c'][Math.floor(Math.random() * 4)]; },
      draw(g) {
        const sn = g.snap, x = sn.x + sn.cx, gy = g.gy(x), dh = headD(sn);
        if (g.t < 0.6) { const q = out3(seg(g.t, 0, 0.15)), y0 = gy + dh * 1.25; up(g, sn, x, lerp(sn.y + sn.cy, y0, q) - (dh * 2.8 + 0.3) * seg(g.t, 0.1, 0.55) ** 2, upRot(sn) * q, { clipY: gy }); }
        g.at(0.55, 'in', () => g.puff(x, gy, 10, true));
        const sh = 1.4 * out3(seg(g.t, 0.8, 1.4)), sway = Math.sin(g.t * 3) * 0.08;
        if (g.t > 0.8) at(g, x, gy, (c) => {
          c.rotate(sway); c.lineWidth = 0.07; c.strokeStyle = '#3f8f3a'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(0.15, -sh / 2, 0, -sh); c.stroke(); c.strokeStyle = INK;
          if (sh > 0.6) for (const s of [-1, 1]) { ell(c, s * 0.18, -0.45, 0.18, 0.08, s * -0.5); fs(c, '#5fc96b'); }
        });
        g.at(1.4, 'bloom', () => g.sfx('bloom'));
        if (g.t > 1.4) {
          const k = back(seg(g.t, 1.4, 1.7)), [fx, fy] = [x + Math.sin(sway) * sh, gy + Math.cos(sway) * sh];
          at(g, fx, fy, (c) => { c.scale(k, k); c.rotate(g.t * 0.5); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ell(c, Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.2, 0.12, a); fs(c, g.st.col); } });
          g.draw(sn, fx - sn.hx, fy - sn.hy, { px: sn.hx, py: sn.hy, sx: k * 0.95, sy: k * 0.95, rot: sway + sn.ha, circle: [sn.hx, sn.hy, 0.27] });
          g.word(jaen('ポンッ', 'POP!'), fx + 0.7, fy + 0.5, 1.4, { size: 0.42, col: g.st.col });
        }
      } },

    { id: 'shrink', name: jaen('ちっちゃくなる', 'Teeny Tiny'), hint: jaen('ちぢんで…', 'Shrinking…'), dur: 2.6, peak: 1.0, w: () => 1.2,
      start(g) { g.hide = true; g.sfx('shrink'); },
      draw(g) {
        const sn = g.snap, k = 1 - 0.72 * out3(seg(g.t, 0.05, 0.6)), a = Math.max(0, g.t - 0.8), hop = Math.floor(a / 0.24), ph = (a % 0.24) / 0.24;
        const x = sn.x + Math.min(hop, 9) * 0.45 + (a > 0 ? ph * 0.45 : 0), y = sn.y + (a > 0 ? Math.sin(ph * Math.PI) * 0.35 : 0);
        if (a > 0 && ph < 0.12 && hop < 8) g.at(0.8 + hop * 0.24, 'h' + hop, () => g.sfx('pip'));
        g.cam = [x + 0.2, sn.y + 0.8];
        g.draw(sn, x, y, { sx: k, sy: k });
        g.word(jaen('ちぢんだ!', 'SHRUNK!'), sn.x + 0.4, sn.y + 1.6, 0.4, { size: 0.42 });
        g.word(jaen('ピッピッ', 'pip pip'), x + 0.3, sn.y + 0.7, 1.0, { size: 0.3, dur: 1.3 });
      } },

    { id: 'log', name: jaen('かわりみの術', 'Ninja Log Swap'), hint: jaen('ドロンと…', 'In a puff of smoke…'), dur: 2.5, peak: 1.2, w: () => 1.2,
      draw(g) {
        g.at(0.45, 'doron', () => { const p = g.torso(); g.st.x = p[0]; g.hide = true; g.sfx('poof'); g.shake(6); for (let i = 0; i < 3; i++) g.puff(p[0] + rnd(-0.4, 0.4), g.gy(p[0]) + 0.3 * i, 10, true); });
        if (g.t < 0.45) return;
        const x = g.st.x, gy = g.gy(x), k = back(seg(g.t, 0.45, 0.65));
        if (g.t < 1.0) at(g, x, gy + 1.0, (c) => { c.globalAlpha = 1 - seg(g.t, 0.6, 1.0); cloud(c, 7, 0.9, '#f2f2f2', 1); c.globalAlpha = 1; });
        at(g, x, gy + 0.2, (c) => { c.scale(k, k); log(c); });
        const lf = seg(g.t, 1.0, 2.4); if (lf > 0) at(g, x + Math.sin(lf * 9) * 0.4, gy + 2.4 - lf * 2.1, (c) => { ell(c, 0, 0, 0.1, 0.05, Math.sin(lf * 9)); fs(c, '#5fc96b'); });
        const sn = g.snap, run = seg(g.t, 0.9, 2.4); // ずっと遠くを 小さく にげていく
        if (run > 0) g.draw(sn, x + 1.5 + run * 4, g.gy(x + 1.5 + run * 4) + Math.abs(Math.sin(run * 30)) * 0.12, { sx: 0.3, sy: 0.3 });
        g.word(jaen('ドロン!', 'POOF!'), x + 0.7, gy + 1.8, 0.45, { size: 0.5 });
      } },

    { id: 'roll', name: jaen('ころころ ころがる', 'Roly-Poly'), hint: jaen('まるくなって…', 'Curl up into a ball…'), dur: 2.3, peak: 0.9, w: (cx) => (cx.reason === 'down' || cx.reason === 'torso' ? 3 : 1.2),
      start(g) { g.hide = true; g.sfx('roll'); },
      draw(g) {
        const sn = g.snap, a = Math.max(0, g.t - 0.1), d = 2.6 * a * a + 0.8 * a, x = sn.x + d, r = 0.7;
        g.cam = [x + 0.6, g.gy(x) + 1.1];
        g.draw(sn, x, g.gy(x) + r - sn.cy, { py: sn.cy, rot: d / r, sx: 0.85, sy: 0.85 });
        if (Math.random() < 0.3) g.puff(x, g.gy(x), 1, false);
        g.word(jaen('ゴロゴロ〜', 'roll roll~'), sn.x + 1.4, sn.y + 1.6, 0.2, { size: 0.42, dur: 1.5 });
      } },

    { id: 'plane', name: jaen('かみひこうき', 'Paper Airplane'), hint: jaen('ペラペラに なって…', 'Flat as a sheet of paper…'), dur: 2.8, peak: 1.4, w: () => 1.2,
      start(g) { g.hide = true; g.sfx('paper'); },
      draw(g) {
        const sn = g.snap;
        if (g.t < 0.75) { const f = out3(seg(g.t, 0.05, 0.3)), fo = seg(g.t, 0.45, 0.75); g.draw(sn, sn.x, sn.y, { sy: 1 - 0.92 * f, sx: (1 + 0.3 * f) * (1 - fo) + 0.001 }); g.word(jaen('ペラッ', 'FLIP'), sn.x + 0.6, sn.y + 1.0, 0.1, { size: 0.42 }); return; }
        g.at(0.75, 'fly', () => g.sfx('whoosh'));
        const a = g.t - 0.75, x0 = sn.x, y0 = sn.y + 0.4;
        let x, y, rot;
        if (a < 0.5) { x = x0 + a * 3; y = y0 + a * 0.6; rot = -0.2; }
        else if (a < 1.25) { const th = (a - 0.5) / 0.75 * TAU; x = x0 + 1.5 + Math.sin(th) * 0.9; y = y0 + 0.3 + 0.9 - Math.cos(th) * 0.9; rot = -th; }
        else { const b = a - 1.25; x = x0 + 1.5 + b * 5; y = y0 + 0.3 + b * 3; rot = -0.5; }
        at(g, x, y, (c) => plane(c, g.shirt()), rot, 1.4, 1.4);
        g.word(jaen('スーッ', 'swoosh~'), x + 0.5, y + 0.6, 0.8, { size: 0.42, dur: 1.4 });
      } },

    { id: 'jelly', name: jaen('プリンになる', 'Turned to Pudding'), hint: jaen('ぷるぷるして…', 'All wiggly and jiggly…'), dur: 2.5, peak: 1.0, w: (cx) => (cx.reason === 'pudding' ? 3 : 1),
      draw(g) {
        g.at(0.3, 'snap', () => { g.snapNow(); g.hide = true; g.sfx('boyon'); });
        if (g.t < 0.3) return;
        const sn = g.snap, a = g.t - 0.3, j = Math.sin(a * 16) * 0.28 * Math.exp(-a * 1.3);
        g.draw(sn, sn.x, sn.y, { sx: 1 + j, sy: 1 - j }); g.draw(g.tint(sn, '#ffd23a', 0.5), sn.x, sn.y, { sx: 1 + j, sy: 1 - j, alpha: seg(a, 0, 0.3) });
        const top = sn.bb.t * (1 - j) - 0.1;
        at(g, sn.x + sn.cx, sn.y + top, (c) => { const k = seg(a, 0.6, 1.1); c.fillStyle = '#8a4a1c'; c.beginPath(); c.ellipse(0, 0, 0.45 * k, 0.12 * k, 0, 0, TAU); c.fill(); for (let i = 0; i < 3; i++) { c.fillRect(-0.3 + i * 0.28, 0, 0.07, 0.4 * k * (0.6 + i * 0.2)); } });
        g.word(jaen('プルンプルン', 'jiggle~'), sn.x + 1.0, sn.y + sn.bb.t + 0.4, 0.35, { size: 0.42, col: '#ffd23a', dur: 1.6 });
      } },

    { id: 'snowball', name: jaen('ゆきだま', 'Snowballed'), hint: jaen('さむい坂で…', 'On a snowy hill…'), dur: 2.6, peak: 1.8, w: (cx) => 0.9 + cx.night * 1.5,
      start(g) { g.hide = true; g.sfx('snow'); },
      draw(g) {
        const sn = g.snap, a = Math.max(0, g.t - 0.15), d = Math.min(4.5, 1.4 * a * a + 0.9 * a), r = 0.45 + Math.min(0.75, a * 0.42), x = sn.x + d, gy = g.gy(x);
        const k = r / 1.3; g.cam = [x + 0.3, gy + 1.2];
        g.draw(sn, x - sn.cx, gy + r - sn.cy, { px: sn.cx, py: sn.cy, rot: d / r, sx: k, sy: k });
        at(g, x, gy + r, (c) => { c.globalAlpha = Math.min(1, 0.25 + a * 0.6); circ(c, 0, 0, r); fs(c, '#f4f9ff'); c.globalAlpha = 1; c.fillStyle = 'rgba(180,210,240,.6)'; for (let i = 0; i < 6; i++) { const an = i + d / r; circ(c, Math.cos(an) * r * 0.6, Math.sin(an) * r * 0.6, r * 0.12); c.fill(); } });
        if (d >= 4.5) at(g, x, gy + r, (c) => { c.lineWidth = 0.05; c.strokeStyle = '#6b4220'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * r * 0.9, 0); c.lineTo(s * (r + 0.4), -0.35); c.lineTo(s * (r + 0.5), -0.5); c.stroke(); } poly(c, [[r * 0.2, -r * 0.2], [r * 0.75, -r * 0.1], [r * 0.2, -r * 0.02]]); fs(c, '#ff8a1a'); });
        g.word(jaen('ゴロゴロ', 'rumble…'), x + 0.9, gy + 1.8, 0.3, { size: 0.4, dur: 1.4 });
      } },
  ];

  // 芸ごとの寄りぐあい（小さな動きは大きく寄る・遠くへ行くものは引く）
  const ZOOM = { crush: 1.4, shatter: 1.4, stuck: 1.25, bury: 1.5, star: 1, screen: 1, stone: 1.45, freeze: 1.3, melt: 1.45, soul: 1.2, zap: 1.45, bird: 0.9, balloon: 1, bounce: 0.9, drill: 1.1, purin: 1.15, fart: 1, trap: 1.35, sleep: 1.6, ufo: 0.9, cats: 1.4, tornado: 0.95, flower: 1.35, shrink: 1.5, log: 1.15, roll: 1.1, plane: 1, jelly: 1.45, snowball: 1.05 };
  LIST.forEach((d) => { d.zoom = ZOOM[d.id] || 1.3; });

  // どれにするか選ぶ（さっき出たものは出にくく、まだ見ていないものは出やすく）
  const recent = [];
  function pick(cx, seen) {
    const wOf = (d) => (d.w ? d.w(cx) : 1) * (seen(d.id) ? 1 : 2.2) * (recent.includes(d.id) ? 0.08 : 1);
    const ws = LIST.map(wOf), sum = ws.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum, d = LIST[0];
    for (let i = 0; i < LIST.length; i++) { r -= ws[i]; if (r <= 0) { d = LIST[i]; break; } }
    recent.push(d.id); if (recent.length > 5) recent.shift();
    return { def: d, v: pickV(d, cx) };
  }
  function pickV(d, cx, vid) {
    if (!d.vs) return null;
    if (vid) return d.vs.find((v) => v.id === vid) || d.vs[0];
    const ws = d.vs.map((v) => (v.w || 1) * ((v.who && v.who[cx.who]) || 1)), sum = ws.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < d.vs.length; i++) { r -= ws[i]; if (r <= 0) return d.vs[i]; }
    return d.vs[0];
  }
  const nameOf = (d, v) => (v ? (YL.latin ? `${d.name} (${v.name})` : `${d.name}（${v.name}）`) : d.name);
  const total = () => LIST.reduce((a, d) => a + (d.vs ? d.vs.length : 1), 0); // 形まで数えた数

  window.YoroGags = { LIST, pick, pickV, nameOf, total };
})();
