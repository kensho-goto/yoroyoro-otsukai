// ヨロヨロおつかい — 手描きのアイコン（絵文字のかわり。主人公と同じ太い線でかく）
// YoroIcon.draw(ctx, key, x, y, size) でキャンバスに、YoroIcon.html(key) で <img> にする
(function () {
  const INK = '#3b2a1e';
  const TAU = Math.PI * 2;
  // ---- 部品（100×100 の中でかく） ----
  const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); };
  const ell = (c, x, y, rx, ry, a = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, TAU); };
  const poly = (c, pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const fs = (c, col) => { c.fillStyle = col; c.fill(); c.stroke(); };
  const shine = (c, x, y, rx, ry, a = -0.5) => { c.fillStyle = 'rgba(255,255,255,.75)'; ell(c, x, y, rx, ry, a); c.fill(); };
  // ふちどりの太い線（線そのものに色をつける）
  const oline = (c, path, col, w) => { c.save(); path(); c.lineWidth = w + 6; c.strokeStyle = INK; c.stroke(); path(); c.lineWidth = w; c.strokeStyle = col; c.stroke(); c.restore(); };
  const star4 = (c, x, y, r, col) => { c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 3; c.stroke(); c.lineWidth = 6; };
  const starN = (c, x, y, n, r1, r2) => { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? r2 : r1; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); };
  const eyes = (c, y, dx = 9, x = 50) => { c.fillStyle = INK; circ(c, x - dx, y, 3.6); c.fill(); circ(c, x + dx, y, 3.6); c.fill(); };

  function pudding(c, body = '#ffd23a', cap = '#8a4a1c') {
    ell(c, 50, 82, 38, 8); fs(c, '#ffffff');
    poly(c, [[27, 80], [34, 38], [66, 38], [73, 80]]); fs(c, body);
    c.fillStyle = cap; poly(c, [[34, 39], [66, 39], [64.5, 50], [58, 47], [50, 52], [42, 47], [35.5, 50]]); c.fill();
    ell(c, 50, 38, 16, 5); fs(c, cap);
    c.fillStyle = 'rgba(255,255,255,.7)'; rr(c, 38, 55, 5, 18, 2.5); c.fill();
  }
  function shoe(c, col, sole = '#ffffff') {
    c.beginPath(); c.moveTo(14, 72); c.lineTo(16, 42); c.quadraticCurveTo(30, 36, 40, 46); c.lineTo(60, 55); c.quadraticCurveTo(86, 58, 87, 72); c.closePath(); fs(c, col);
    rr(c, 12, 70, 77, 11, 5); fs(c, sole);
    c.lineWidth = 4; c.beginPath(); c.moveTo(38, 50); c.lineTo(46, 46); c.moveTo(45, 54); c.lineTo(53, 50); c.stroke(); c.lineWidth = 6;
  }
  function tray(c, col) {
    ell(c, 50, 58, 42, 15); fs(c, col);
    c.fillStyle = 'rgba(255,255,255,.35)'; ell(c, 50, 55, 32, 9); c.fill();
  }
  function head(c, col) { circ(c, 50, 54, 32); fs(c, col); }

  const D = {
    // ---- 運ぶもの ----
    'c.pudding': (c) => pudding(c),
    'c.goldpudding': (c) => { pudding(c, '#ffcf3d', '#d08a00'); star4(c, 82, 26, 10, '#fff6c0'); star4(c, 18, 40, 7, '#fff6c0'); },
    'c.dango': (c) => {
      oline(c, () => { c.beginPath(); c.moveTo(50, 96); c.lineTo(50, 6); }, '#d9a868', 5);
      [['#ff9fb3', 24], ['#ffffff', 47], ['#8fd16a', 70]].forEach(([col, y]) => { circ(c, 50, y, 14); fs(c, col); });
    },
    'c.cake': (c) => {
      poly(c, [[14, 82], [86, 82], [86, 46], [14, 60]]); fs(c, '#fff1d6');
      c.lineWidth = 7; c.strokeStyle = '#ff6b8b'; c.beginPath(); c.moveTo(16, 71); c.lineTo(84, 63); c.stroke(); c.lineWidth = 6; c.strokeStyle = INK;
      poly(c, [[14, 82], [86, 82], [86, 46], [14, 60]]); c.stroke();
      poly(c, [[12, 61], [88, 47], [88, 38], [12, 52]]); fs(c, '#ffffff');
      c.beginPath(); c.moveTo(66, 22); c.bezierCurveTo(54, 22, 56, 42, 68, 42); c.bezierCurveTo(80, 42, 82, 22, 70, 22); c.closePath(); fs(c, '#e8303a');
      c.fillStyle = '#4fb36b'; poly(c, [[62, 22], [68, 14], [76, 22]]); c.fill(); c.stroke();
    },
    'c.egg': (c) => {
      c.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU, r = 34 + (i % 2 ? 4 : -2); c.lineTo(50 + Math.cos(a) * r * 1.1, 54 + Math.sin(a) * r * 0.8); } c.closePath(); fs(c, '#ffffff');
      circ(c, 54, 50, 15); fs(c, '#ffb020'); shine(c, 49, 45, 5, 3);
    },
    'c.suika': (c) => {
      c.beginPath(); c.arc(50, 34, 40, 0, Math.PI); c.closePath(); fs(c, '#4fb36b');
      c.beginPath(); c.arc(50, 34, 32, 0, Math.PI); c.closePath(); fs(c, '#ff5a5a');
      c.fillStyle = INK; [[38, 44], [50, 50], [62, 44], [44, 58], [56, 58]].forEach(([x, y]) => { ell(c, x, y, 2.5, 4); c.fill(); });
    },
    'c.goldfish': (c) => {
      circ(c, 50, 56, 36); fs(c, '#c8ecff');
      c.fillStyle = 'rgba(80,170,230,.35)'; c.beginPath(); c.arc(50, 56, 33, 0.25, Math.PI - 0.25); c.closePath(); c.fill();
      ell(c, 50, 22, 20, 5); fs(c, '#e6f6ff');
      poly(c, [[62, 62], [74, 52], [74, 72]]); fs(c, '#ff6a3d');
      ell(c, 48, 62, 15, 10); fs(c, '#ff6a3d'); c.fillStyle = INK; circ(c, 41, 60, 2.5); c.fill();
    },
    // ---- ころび方 ----
    'f.pudding': (c) => {
      c.save(); c.translate(56, 48); c.rotate(-0.55); c.translate(-50, -55); pudding(c); c.restore();
      c.lineWidth = 5; c.beginPath(); c.moveTo(8, 70); c.lineTo(24, 64); c.moveTo(10, 84); c.lineTo(28, 76); c.stroke(); c.lineWidth = 6;
    },
    'f.hole': (c) => {
      ell(c, 50, 70, 42, 15); fs(c, '#2a1c12');
      rr(c, 34, 28, 11, 40, 5); fs(c, '#4a6fa5'); rr(c, 55, 22, 11, 46, 5); fs(c, '#4a6fa5');
      rr(c, 30, 20, 18, 11, 5); fs(c, '#e8303a'); rr(c, 52, 14, 18, 11, 5); fs(c, '#e8303a');
    },
    'f.timeup': (c) => {
      circ(c, 28, 24, 10); fs(c, '#ff6b5a'); circ(c, 72, 24, 10); fs(c, '#ff6b5a');
      circ(c, 50, 56, 34); fs(c, '#ffffff');
      c.beginPath(); c.moveTo(50, 56); c.lineTo(50, 34); c.moveTo(50, 56); c.lineTo(66, 62); c.stroke();
      c.fillStyle = INK; circ(c, 50, 56, 4); c.fill();
    },
    'f.rhythm': (c) => {
      oline(c, () => { c.beginPath(); for (let i = 0; i < 60; i++) { const a = i * 0.32, r = 4 + i * 0.62; c.lineTo(50 + Math.cos(a) * r, 52 + Math.sin(a) * r); } }, '#9b6cf0', 6);
    },
    'f.stop': (c) => {
      c.save(); c.translate(50, 50); c.rotate(Math.PI / 8); c.translate(-50, -50);
      c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.lineTo(50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40); } c.closePath(); fs(c, '#e8303a'); c.restore();
      rr(c, 26, 44, 48, 12, 4); fs(c, '#ffffff');
    },
    'f.head': (c) => {
      head(c, '#ffd9b3');
      c.fillStyle = '#3b2a1e'; c.beginPath(); c.arc(50, 54, 32, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); c.fill();
      circ(c, 64, 20, 11); fs(c, '#ff9fb3');
      c.lineWidth = 4; [[38, 60], [62, 60]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x - 5, y - 5); c.lineTo(x + 5, y + 5); c.moveTo(x + 5, y - 5); c.lineTo(x - 5, y + 5); c.stroke(); }); c.lineWidth = 6;
      star4(c, 22, 22, 9, '#ffd23a'); star4(c, 86, 40, 7, '#ffd23a');
    },
    'f.torso': (c) => { starN(c, 50, 50, 10, 44, 26); fs(c, '#ffd23a'); starN(c, 50, 50, 10, 24, 14); c.fillStyle = '#ff6a3d'; c.fill(); },
    'f.knee': (c) => {
      oline(c, () => { c.beginPath(); c.moveTo(40, 10); c.lineTo(58, 52); c.lineTo(36, 84); }, '#4a6fa5', 16);
      rr(c, 22, 80, 28, 12, 6); fs(c, '#e8303a');
      c.lineWidth = 5; c.beginPath(); c.moveTo(72, 44); c.lineTo(86, 38); c.moveTo(72, 54); c.lineTo(88, 56); c.moveTo(70, 64); c.lineTo(82, 72); c.stroke(); c.lineWidth = 6;
    },
    'f.down': (c) => {
      oline(c, () => { c.beginPath(); c.moveTo(40, 40); c.lineTo(44, 68); }, '#ff9a3d', 16);
      oline(c, () => { c.beginPath(); c.moveTo(44, 68); c.lineTo(80, 70); }, '#4a6fa5', 14);
      circ(c, 36, 28, 13); fs(c, '#ffd9b3');
      c.lineWidth = 5; c.beginPath(); c.moveTo(22, 86); c.lineTo(34, 80); c.moveTo(44, 90); c.lineTo(46, 82); c.moveTo(66, 88); c.lineTo(60, 80); c.stroke(); c.lineWidth = 6;
    },
    // ---- おたから ----
    't.candy': (c) => {
      poly(c, [[30, 50], [10, 34], [10, 66]]); fs(c, '#ff9fb3'); poly(c, [[70, 50], [90, 34], [90, 66]]); fs(c, '#ff9fb3');
      circ(c, 50, 50, 21); fs(c, '#ff5c8a');
      c.save(); c.lineWidth = 5; c.strokeStyle = '#ffffff'; c.beginPath(); c.arc(50, 50, 11, 0.3, 2.6); c.stroke(); c.restore(); shine(c, 43, 42, 4, 2.5);
    },
    't.cookie': (c) => {
      circ(c, 50, 50, 36); fs(c, '#e0a35f');
      c.fillStyle = '#5a3420'; [[36, 38], [60, 34], [64, 58], [42, 62], [52, 48], [30, 54]].forEach(([x, y], i) => { ell(c, x, y, 5, 4, i); c.fill(); });
    },
    't.acorn': (c) => {
      c.lineWidth = 6; ell(c, 50, 60, 23, 27); fs(c, '#c98a4b'); shine(c, 41, 58, 4, 9, 0);
      c.beginPath(); c.moveTo(24, 46); c.quadraticCurveTo(26, 22, 50, 20); c.quadraticCurveTo(74, 22, 76, 46); c.closePath(); fs(c, '#7a4a2a');
      rr(c, 47, 8, 6, 14, 3); fs(c, '#7a4a2a');
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 3; c.beginPath(); c.moveTo(32, 40); c.lineTo(46, 26); c.moveTo(44, 44); c.lineTo(60, 26); c.moveTo(56, 44); c.lineTo(70, 32); c.stroke(); c.strokeStyle = INK; c.lineWidth = 6;
    },
    't.marble': (c) => {
      circ(c, 50, 50, 34); fs(c, '#8fdcff');
      c.save(); circ(c, 50, 50, 31); c.clip(); c.lineWidth = 9; c.strokeStyle = '#3f7fe0'; c.beginPath(); c.moveTo(20, 66); c.bezierCurveTo(40, 30, 60, 80, 84, 38); c.stroke(); c.restore();
      shine(c, 38, 36, 8, 5);
    },
    't.shell': (c) => {
      c.beginPath(); c.moveTo(50, 84); c.arc(50, 84, 44, -Math.PI * 0.94, -Math.PI * 0.06); c.closePath(); fs(c, '#ffc8b4');
      c.lineWidth = 4; for (let i = 1; i < 6; i++) { const a = -Math.PI * (0.94 - i * 0.88 / 6); c.beginPath(); c.moveTo(50, 84); c.lineTo(50 + Math.cos(a) * 42, 84 + Math.sin(a) * 42); c.stroke(); } c.lineWidth = 6;
      rr(c, 40, 80, 20, 10, 4); fs(c, '#ffb09a');
    },
    't.clover': (c) => {
      oline(c, () => { c.beginPath(); c.moveTo(50, 52); c.quadraticCurveTo(54, 76, 66, 92); }, '#4fb36b', 5);
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4; circ(c, 50 + Math.cos(a) * 17, 46 + Math.sin(a) * 17, 15); fs(c, '#5fc96b'); }
      c.fillStyle = '#4fb36b'; circ(c, 50, 46, 7); c.fill();
    },
    't.ribbon': (c) => {
      poly(c, [[44, 52], [34, 86], [44, 80], [50, 90]]); fs(c, '#e8457a'); poly(c, [[56, 52], [66, 86], [56, 80], [50, 90]]); fs(c, '#e8457a');
      c.beginPath(); c.moveTo(50, 46); c.bezierCurveTo(30, 18, 8, 30, 14, 48); c.bezierCurveTo(18, 66, 38, 60, 50, 50); c.closePath(); fs(c, '#ff6b9b');
      c.beginPath(); c.moveTo(50, 46); c.bezierCurveTo(70, 18, 92, 30, 86, 48); c.bezierCurveTo(82, 66, 62, 60, 50, 50); c.closePath(); fs(c, '#ff6b9b');
      rr(c, 42, 38, 16, 18, 6); fs(c, '#e8457a');
    },
    't.gem': (c) => {
      poly(c, [[30, 28], [70, 28], [88, 44], [50, 88], [12, 44]]); fs(c, '#6fd3ff');
      c.lineWidth = 3.5; c.beginPath(); c.moveTo(12, 44); c.lineTo(88, 44); c.moveTo(30, 28); c.lineTo(38, 44); c.lineTo(50, 88); c.lineTo(62, 44); c.lineTo(70, 28); c.moveTo(50, 28); c.lineTo(38, 44); c.moveTo(50, 28); c.lineTo(62, 44); c.stroke(); c.lineWidth = 6;
      c.fillStyle = 'rgba(255,255,255,.7)'; poly(c, [[33, 31], [45, 31], [37, 42]]); c.fill();
    },
    't.goldpudding': (c) => D['c.goldpudding'](c),
    't.crown': (c) => {
      poly(c, [[16, 74], [14, 32], [33, 50], [50, 22], [67, 50], [86, 32], [84, 74]]); fs(c, '#ffcf3d');
      rr(c, 14, 68, 72, 14, 4); fs(c, '#f0b400');
      circ(c, 50, 75, 5); fs(c, '#e8303a'); circ(c, 30, 75, 4); fs(c, '#6fd3ff'); circ(c, 70, 75, 4); fs(c, '#6fd3ff');
      c.fillStyle = INK; [[14, 32], [50, 22], [86, 32]].forEach(([x, y]) => { circ(c, x, y, 5); fs(c, '#fff3b0'); });
    },
    // ---- できごと ----
    'e.headwind': (c) => {
      [[30, '#8cc8f0'], [52, '#8cc8f0'], [74, '#8cc8f0']].forEach(([y, col], i) => oline(c, () => { c.beginPath(); c.moveTo(88 - i * 6, y); c.lineTo(28, y); c.quadraticCurveTo(12, y, 14, y - 10); }, col, 6));
      oline(c, () => { c.beginPath(); c.moveTo(22, 52); c.lineTo(10, 52); c.moveTo(16, 44); c.lineTo(8, 52); c.lineTo(16, 60); }, '#8cc8f0', 5);
    },
    'e.tailwind': (c) => {
      [[34, 0], [66, 8]].forEach(([y, d]) => oline(c, () => { c.beginPath(); c.moveTo(8 + d, y); c.lineTo(60, y); c.quadraticCurveTo(76, y, 74, y - 10); }, '#8cc8f0', 6));
      c.save(); c.translate(74, 62); c.rotate(-0.6); ell(c, 0, 0, 18, 9); fs(c, '#6cc04a'); c.lineWidth = 3; c.beginPath(); c.moveTo(-16, 0); c.lineTo(16, 0); c.stroke(); c.restore();
    },
    'e.goldday': (c) => { star4(c, 50, 52, 38, '#ffd23a'); star4(c, 82, 20, 11, '#fff3b0'); star4(c, 18, 82, 9, '#fff3b0'); },
    'e.rare': (c) => {
      ell(c, 50, 76, 40, 9); fs(c, '#2b2b2b');
      c.beginPath(); c.moveTo(28, 74); c.lineTo(30, 20); c.quadraticCurveTo(50, 14, 70, 20); c.lineTo(72, 74); c.closePath(); fs(c, '#2b2b2b');
      rr(c, 29, 56, 42, 11, 2); fs(c, '#e8303a');
      c.fillStyle = 'rgba(255,255,255,.25)'; rr(c, 36, 24, 6, 28, 3); c.fill();
    },
    // ---- ガチャ ----
    'g.sneaker': (c) => shoe(c, '#e8303a'),
    'g.boots': (c) => {
      c.beginPath(); c.moveTo(24, 12); c.lineTo(56, 12); c.lineTo(56, 54); c.quadraticCurveTo(84, 56, 86, 72); c.lineTo(24, 72); c.closePath(); fs(c, '#3f9a3a');
      rr(c, 20, 70, 70, 12, 5); fs(c, '#2b6a2a'); rr(c, 20, 8, 40, 10, 4); fs(c, '#56b84f');
    },
    'g.spring': (c) => {
      c.save(); c.translate(0, -14); shoe(c, '#a0a6b0'); c.restore();
      oline(c, () => { c.beginPath(); c.moveTo(30, 68); for (let i = 0; i < 5; i++) c.lineTo(i % 2 ? 30 : 70, 72 + i * 5); c.lineTo(50, 96); }, '#c9ced8', 4);
    },
    'g.grip': (c) => {
      c.save(); c.translate(0, -6); shoe(c, '#6b5442', '#3b2a1e'); c.restore();
      c.fillStyle = INK; for (let i = 0; i < 5; i++) { poly(c, [[18 + i * 15, 76], [24 + i * 15, 86], [30 + i * 15, 76]]); c.fill(); }
    },
    'g.rocket': (c) => {
      c.save(); c.translate(12, 6); c.scale(0.86, 0.86);
      c.beginPath(); c.moveTo(16, 50); c.quadraticCurveTo(-10, 56, -4, 66); c.quadraticCurveTo(-14, 80, 14, 80); c.closePath(); fs(c, '#ff9a3d');
      c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(16, 58); c.quadraticCurveTo(2, 62, 4, 68); c.quadraticCurveTo(0, 76, 16, 76); c.closePath(); c.fill();
      shoe(c, '#d0d4dc'); circ(c, 64, 64, 5); fs(c, '#e8303a'); c.restore();
    },
    'g.goldshoe': (c) => { shoe(c, '#ffc61a', '#fff3b0'); star4(c, 76, 30, 10, '#fff6c0'); star4(c, 22, 24, 7, '#fff6c0'); },
    'g.straw': (c) => {
      ell(c, 50, 64, 44, 14); fs(c, '#f2d27a');
      c.beginPath(); c.moveTo(26, 62); c.quadraticCurveTo(26, 28, 50, 28); c.quadraticCurveTo(74, 28, 74, 62); c.closePath(); fs(c, '#f5dc8e');
      c.fillStyle = '#e8303a'; c.beginPath(); c.moveTo(27, 52); c.lineTo(73, 52); c.lineTo(74, 61); c.lineTo(26, 61); c.closePath(); c.fill(); c.stroke();
    },
    'g.catears': (c) => {
      oline(c, () => { c.beginPath(); c.arc(50, 80, 36, Math.PI * 1.08, Math.PI * 1.92); }, '#f0a85a', 8);
      [[24, -1], [76, 1]].forEach(([x, s]) => {
        poly(c, [[x - 14, 52], [x - 4 * s, 16], [x + 14, 52]]); fs(c, '#f0a85a');
        c.fillStyle = '#ffb3c1'; poly(c, [[x - 7, 48], [x - 3 * s, 28], [x + 7, 48]]); c.fill();
      });
    },
    'g.helmet': (c) => {
      c.beginPath(); c.moveTo(14, 68); c.quadraticCurveTo(14, 20, 50, 20); c.quadraticCurveTo(86, 20, 86, 68); c.closePath(); fs(c, '#ffffff');
      rr(c, 8, 64, 84, 12, 6); fs(c, '#f2f2f2');
      c.fillStyle = '#e8303a'; rr(c, 44, 30, 12, 30, 2); c.fill(); rr(c, 35, 39, 30, 12, 2); c.fill();
    },
    'g.propeller': (c) => {
      oline(c, () => { c.beginPath(); c.moveTo(50, 44); c.lineTo(50, 22); }, '#c9ced8', 4);
      ell(c, 32, 18, 18, 6, -0.1); fs(c, '#ff6b5a'); ell(c, 68, 18, 18, 6, 0.1); fs(c, '#4fb8ff');
      c.beginPath(); c.moveTo(16, 74); c.quadraticCurveTo(16, 40, 50, 40); c.quadraticCurveTo(84, 40, 84, 74); c.closePath(); fs(c, '#ffd23a');
      c.save(); c.clip(); c.fillStyle = '#4fb8ff'; c.fillRect(38, 30, 12, 50); c.fillStyle = '#ff6b5a'; c.fillRect(62, 30, 12, 50); c.restore();
      c.beginPath(); c.moveTo(16, 74); c.quadraticCurveTo(16, 40, 50, 40); c.quadraticCurveTo(84, 40, 84, 74); c.closePath(); c.stroke();
      rr(c, 10, 70, 80, 10, 5); fs(c, '#ffd23a');
    },
    'g.halo': (c) => {
      oline(c, () => { ell(c, 50, 50, 36, 13); }, '#ffd23a', 10);
      star4(c, 84, 26, 8, '#fff6c0'); star4(c, 16, 70, 6, '#fff6c0');
    },
    'g.redtray': (c) => tray(c, '#d9534f'),
    'g.woodtray': (c) => { tray(c, '#4fb36b'); c.fillStyle = 'rgba(59,42,30,.35)'; for (let i = 0; i < 5; i++) { circ(c, 30 + i * 10, 56, 2.5); c.fill(); } },
    'g.silvertray': (c) => { tray(c, '#c9ced8'); star4(c, 80, 34, 8, '#ffffff'); },
    'g.robot': (c) => {
      oline(c, () => { c.beginPath(); c.moveTo(50, 26); c.lineTo(50, 12); }, '#aab0bb', 4); circ(c, 50, 10, 6); fs(c, '#e8303a');
      rr(c, 18, 26, 64, 60, 12); fs(c, '#c9ced8');
      circ(c, 36, 50, 9); fs(c, '#8fe0ff'); circ(c, 64, 50, 9); fs(c, '#8fe0ff');
      rr(c, 32, 66, 36, 10, 3); fs(c, '#6b7280');
      c.lineWidth = 3; c.beginPath(); for (let i = 1; i < 4; i++) { c.moveTo(32 + i * 9, 66); c.lineTo(32 + i * 9, 76); } c.stroke(); c.lineWidth = 6;
    },
    'g.bear': (c) => {
      circ(c, 24, 28, 12); fs(c, '#a86a35'); circ(c, 76, 28, 12); fs(c, '#a86a35');
      head(c, '#c98a4b'); ell(c, 50, 66, 15, 11); fs(c, '#ecc495');
      eyes(c, 50, 13); c.fillStyle = INK; ell(c, 50, 61, 5, 3.5); c.fill();
    },
    'g.penguin': (c) => {
      head(c, '#2b2b2b');
      c.fillStyle = '#ffffff'; ell(c, 39, 58, 13, 17); c.fill(); ell(c, 61, 58, 13, 17); c.fill(); ell(c, 50, 68, 22, 14); c.fill();
      eyes(c, 54, 10); poly(c, [[42, 64], [58, 64], [50, 74]]); fs(c, '#ff9a3d');
    },
    'g.gold': (c) => { starN(c, 50, 54, 5, 44, 20); fs(c, '#ffd84d'); eyes(c, 52, 8); c.lineWidth = 4; c.beginPath(); c.arc(50, 58, 7, 0.3, Math.PI - 0.3); c.stroke(); c.lineWidth = 6; },
    // ---- そのほか ----
    'x.lock': (c) => {
      oline(c, () => { c.beginPath(); c.moveTo(32, 48); c.lineTo(32, 34); c.arc(50, 34, 18, Math.PI, 0); c.lineTo(68, 48); }, '#b9c0cc', 6);
      rr(c, 22, 46, 56, 42, 8); fs(c, '#d8b45a');
      c.fillStyle = INK; circ(c, 50, 62, 6); c.fill(); rr(c, 47, 62, 6, 14, 2); c.fill();
    },
    'x.none': (c) => { c.strokeStyle = '#b9c0cc'; c.lineWidth = 8; circ(c, 50, 50, 30); c.stroke(); c.beginPath(); c.moveTo(29, 71); c.lineTo(71, 29); c.stroke(); },
    'x.bolt': (c) => { poly(c, [[58, 8], [22, 56], [46, 56], [38, 92], [78, 40], [54, 40]]); fs(c, '#ffd23a'); },
  };

  function draw(ctx, key, x, y, size) {
    const f = D[key]; if (!f) return false;
    ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 100, size / 100);
    ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    f(ctx); ctx.restore(); return true;
  }
  const cache = {};
  function url(key) {
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    draw(cv.getContext('2d'), key, 64, 64, 120);
    cache[key] = cv.toDataURL('image/png'); return cache[key];
  }
  const html = (key, cls) => (D[key] ? `<img class="ico${cls ? ' ' + cls : ''}" alt="" src="${url(key)}">` : '');
  window.YoroIcon = { draw, html, url, has: (k) => !!D[k], keys: () => Object.keys(D) };
})();
