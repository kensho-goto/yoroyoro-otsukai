// ヨロヨロおつかい — 画面の描画と操作
(function () {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    dist: $('dist'), time: $('time'), best: $('best'), hint: $('hint'),
    padL: $('padL'), padR: $('padR'),
    title: $('title'), fail: $('fail'),
    failTitle: $('failTitle'), failLine: $('failLine'), failDist: $('failDist'),
    failTag: $('failTag'), failAct: $('failAct'), failFace: $('failFace'),
    meter: $('meter'), meterFill: $('meterFill'), meterLabel: $('meterLabel'),
  };

  // 道はレベルで区切らず、どこまでも続く。おうちに届けるたびに次のおうちへ（level＝何軒目か。先へ行くほど難しい）
  let game, S, stage, level = 1, hinted = new Set();
  const WT = window.YoroWaiter;
  let waiter = WT.forLevel(1), fails = 0, faceNow = 'wait', faceT0 = 0; // 待っている人・続けて失敗した回数・今の顔
  const RANK = window.YoroRank || { list: () => [], add: () => null, render() {} };
  const snd = window.YoroSound || { play() {}, bgm() {}, on: false, toggle() { return false; } };

  // ---- 記録 ----
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても遊べる */ } },
  };
  let runDist = 0; // 届けたおうちまでのきょりの合計（今の道の分は入れない）
  let bestRun = Math.max(0, parseFloat(store.get('yoro.bestRun')) || 0); // 歩いたきょりの自己ベスト
  let prevWaiter = null, delivered = null, worldOff = 0; // 前のおうちの人・届けたときのひとこと・背景をつなぐためのずれ
  function loadLevel(n, carry) {
    const old = carry ? { goal: stage.goal, gy: game.groundHeightAt(stage.goal) } : null;
    level = n;
    game = YoroCore.create(planck, { level: n });
    S = game.state; stage = game.stage;
    if (old) { cam.x -= old.goal; cam.y -= old.gy; worldOff += old.goal; } // 前の道の続きに見えるように
    else { cam.x = 0; cam.y = 1; worldOff = 0; delivered = null; }
    ui.meterLabel.textContent = `${n}軒目`;
    hinted = new Set();
    prevWaiter = n > 1 ? WT.forLevel(n - 1) : null;
    waiter = WT.forLevel(n); faceNow = 'wait';
    showBanner(n === 1 ? `${waiter.name}に プリンを とどけよう！<br>左・右…トン、トン、とリズムよく！`
      : n === 3 ? `つぎは ${waiter.name}の家<br>じゃまな物は ジャンプで こえよう！`
      : `つぎは ${waiter.name}の家<br>${stage.goal}m先で まってるよ`);
  }
  function showBanner(html) {
    ui.hint.innerHTML = html; ui.hint.style.opacity = 1;
    clearTimeout(hintTimer); hintTimer = null;
  }

  // ---- 画面サイズ ----
  let W = 0, H = 0, DPR = 1, scale = 60;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    scale = Math.max(48, Math.min(H / 4.4, W / 4.6));
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- 操作（タッチ・マウス・キー） ----
  const pointers = new Map();
  const keys = { left: false, right: false };
  function updateInput() {
    let l = keys.left, r = keys.right;
    for (const x of pointers.values()) { if (x < W / 2) l = true; else r = true; }
    game.setInput(l, r);
    ui.padL.classList.toggle('on', l);
    ui.padR.classList.toggle('on', r);
    if ((l || r) && playing()) hideHintSoon();
  }
  const playing = () => S.status === 'play' && !ui.title.classList.contains('show');
  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.overlay.show') || e.target.closest('#sndBtn')) return;
    pointers.set(e.pointerId, e.clientX); updateInput(); e.preventDefault();
  }, { passive: false });
  window.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) { pointers.set(e.pointerId, e.clientX); updateInput(); }
  });
  const up = (e) => { pointers.delete(e.pointerId); updateInput(); };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('blur', () => { pointers.clear(); keys.left = keys.right = false; updateInput(); });
  const LK = ['KeyF', 'KeyA', 'ArrowLeft', 'KeyZ'], RK = ['KeyJ', 'KeyL', 'ArrowRight', 'KeyM'];
  window.addEventListener('keydown', (e) => {
    if (LK.includes(e.code)) keys.left = true;
    else if (RK.includes(e.code)) keys.right = true;
    else if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
      if (ui.title.classList.contains('show')) start();
      else if (ui.fail.classList.contains('show')) restart();
      return;
    } else return;
    e.preventDefault(); updateInput();
  });
  window.addEventListener('keyup', (e) => {
    if (LK.includes(e.code)) keys.left = false;
    if (RK.includes(e.code)) keys.right = false;
    updateInput();
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- 進行 ----
  let elapsed = 0; // 秒
  let hintTimer = null;
  function hideHintSoon() {
    if (hintTimer) return;
    hintTimer = setTimeout(() => { ui.hint.style.opacity = 0; }, 2500);
  }
  function showOnly(el) {
    for (const o of [ui.title, ui.fail]) o.classList.toggle('show', o === el);
  }
  function start() { restart(); }
  // ゲームオーバーのあとは、いつも最初（おかしや）から
  function restart() { loadLevel(1); pops.length = 0; elapsed = 0; runDist = 0; game.spawn(0); showOnly(null); snd.play('start'); snd.bgm(true); }
  const retry = restart;
  // おうちに着いた：プリンを届けて、止まらずに次のおうちへ
  function deliver() {
    const say = WT.happy(waiter).say;
    snd.play('clear');
    fails = 0;
    runDist += stage.goal;
    const snap = game.snapshot();
    loadLevel(level + 1, snap);
    game.spawn(0, snap);
    elapsed = 0; lastTick = 0;
    delivered = { say, t0: performance.now() };
    pop('とどけた！ つぎへ！', '#2f9e44');
  }
  function next() { loadLevel(level + 1); restart(); }
  $('startBtn').onclick = () => start();
  $('retryBtn').onclick = restart;
  const sndBtn = $('sndBtn');
  const paintSnd = () => { sndBtn.textContent = snd.on ? '🔊' : '🔇'; sndBtn.setAttribute('aria-label', snd.on ? '音をけす' : '音を出す'); };
  sndBtn.onclick = () => { snd.toggle(); paintSnd(); snd.play('tap'); };
  paintSnd();
  function refreshTitle() {
    $('bestRun').hidden = bestRun <= 0;
    $('bestRun').textContent = `自己ベスト：${bestRun.toFixed(1)}m`;
    showTitleRank();
  }
  // タイトルに、じぶんの記録の上位を出す
  function showTitleRank() { RANK.render($('titleRank'), { list: RANK.list(), idx: -1 }); }

  let shownEnd = false;
  function onFall() {
    const left = Math.max(0, stage.goal - S.bestX);
    fails++;
    const r = WT.reaction(waiter, { reason: S.fallReason, fails, left });
    faceNow = r.face; faceT0 = performance.now();
    const total = runDist + Math.min(stage.goal, Math.max(0, S.bestX)); // ゲームオーバーまでに歩けたきょり
    const newBest = total > bestRun + 0.05;
    if (newBest) { bestRun = total; store.set('yoro.bestRun', bestRun.toFixed(1)); refreshTitle(); }
    ui.failTag.textContent = `ゲームオーバー（${{ pudding: 'プリンを落とした', timeup: '時間切れ', rhythm: 'リズムがくずれてころんだ', stop: '止まってころんだ', hole: '穴に落ちた' }[S.fallReason] || 'ころんだ'}）`;
    ui.failTitle.textContent = r.title;
    ui.failLine.textContent = r.say;
    ui.failAct.textContent = r.action;
    ui.failDist.textContent = `${level}軒目・${waiter.name}のおうちまで あと ${left.toFixed(1)}m\n歩いたきょり ${total.toFixed(1)}m${newBest ? '　🎉自己ベスト！' : `（自己ベスト ${bestRun.toFixed(1)}m）`}`;
    $('retryBtn').textContent = 'もう一回（最初から）';
    // 歩いたきょりを、じぶんの記録ランキングに入れて上位を出す（このスマホの中だけ）
    RANK.render($('failRank'), total >= 0.5 ? RANK.add(total) : { list: RANK.list(), idx: -1 });
    showTitleRank();
    showOnly(ui.fail);
    if (navigator.vibrate) navigator.vibrate(80);
  }
  // ---- 描画 ----
  const cam = { x: 0, y: 1 };
  const W2S = (x, y) => [W * 0.45 + (x - cam.x) * scale, H * 0.6 - (y - cam.y) * scale];

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8fd3ff'); g.addColorStop(0.6, '#d9f1ff'); g.addColorStop(1, '#fff3d6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 雲
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 6; i++) {
      const wx = i * 9 - ((cam.x + worldOff) * 0.15) % 54;
      const sx = ((wx * scale) % (W + 300) + W + 300) % (W + 300) - 150;
      const sy = H * (0.1 + (i % 3) * 0.07);
      cloud(sx, sy, scale * (0.6 + (i % 2) * 0.3));
    }
    // 遠くの丘
    hills(0.25, '#b9e3a1', H * 0.62, 1.2);
    hills(0.45, '#9ad282', H * 0.7, 0.8);
  }
  function cloud(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.arc(x + r * 0.6, y - r * 0.2, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x + r * 1.3, y, r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  function hills(par, color, baseY, amp) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    for (let sx = 0; sx <= W + 20; sx += 20) {
      const wx = (sx - W / 2) / scale + (cam.x + worldOff) * par;
      ctx.lineTo(sx, baseY - (Math.sin(wx * 0.5) * 0.5 + Math.sin(wx * 0.23 + 1) * 0.8 + 1) * scale * 0.5 * amp);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }

  function drawGround() {
    const p = stage.points;
    ctx.beginPath();
    let [sx, sy] = W2S(p[0][0], p[0][1]); ctx.moveTo(sx, sy);
    for (const [x, h] of p) { [sx, sy] = W2S(x, h); ctx.lineTo(sx, sy); }
    ctx.lineTo(sx, H + 10); [sx] = W2S(p[0][0], 0); ctx.lineTo(sx, H + 10); ctx.closePath();
    ctx.fillStyle = '#c99566'; ctx.fill();
    ctx.lineWidth = Math.max(6, scale * 0.14); ctx.strokeStyle = '#6cc04a'; ctx.lineJoin = 'round';
    ctx.beginPath(); [sx, sy] = W2S(p[0][0], p[0][1]); ctx.moveTo(sx, sy);
    for (const [x, h] of p) { [sx, sy] = W2S(x, h); ctx.lineTo(sx, sy); }
    ctx.stroke();
    // 穴（暗い穴）とジャンプ台
    for (const q of stage.pits) {
      const [ax, ay] = W2S(q.x0, q.h), [bx] = W2S(q.x1, q.h);
      const g = ctx.createLinearGradient(0, ay, 0, ay + scale * 2.5);
      g.addColorStop(0, '#3b2a1e'); g.addColorStop(1, '#120c08');
      ctx.fillStyle = g; ctx.fillRect(ax + 2, ay, bx - ax - 4, H - ay + 10);
      ctx.strokeStyle = '#6cc04a'; ctx.lineWidth = Math.max(6, scale * 0.14);
      ctx.beginPath(); ctx.moveTo(ax - scale * 0.2, ay); ctx.lineTo(ax + 1, ay); ctx.moveTo(bx - 1, ay); ctx.lineTo(bx + scale * 0.2, ay); ctx.stroke();
    }
    for (const q of stage.springs) drawSpring(q);
    // 距離のかんばん
    ctx.font = `800 ${Math.round(scale * 0.22)}px sans-serif`; ctx.textAlign = 'center';
    for (let m = 5; m < stage.goal; m += 5) {
      if (stage.checkpoints.includes(m) || stage.obstacles.some((o) => Math.abs(o.x - m) < 0.9)
        || stage.pits.some((q) => m > q.x0 - 0.6 && m < q.x1 + 0.6) || stage.springs.some((q) => Math.abs(q.x - m) < 0.8)) continue;
      const [x, y] = W2S(m, game.groundHeightAt(m));
      ctx.fillStyle = '#8a5a35'; ctx.fillRect(x - 2, y - scale * 0.5, 4, scale * 0.5);
      ctx.fillStyle = '#fff7e6'; ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 2;
      roundRect(x - scale * 0.3, y - scale * 0.75, scale * 0.6, scale * 0.3, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3b2a1e'; ctx.fillText(`${m}m`, x, y - scale * 0.53);
    }
    // 旗
    stage.checkpoints.forEach((m, i) => {
      if (i === 0) return;
      const [x, y] = W2S(m, game.groundHeightAt(m));
      const got = S.checkpointIndex >= i || S.bestX >= m + 0.3;
      ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - scale * 1.4); ctx.stroke();
      ctx.fillStyle = got ? '#ffcf3d' : '#ff6b8b';
      ctx.beginPath(); ctx.moveTo(x, y - scale * 1.4); ctx.lineTo(x + scale * 0.55, y - scale * 1.22); ctx.lineTo(x, y - scale * 1.04); ctx.closePath();
      ctx.fill(); ctx.stroke();
    });
    // じゃまな物
    for (const o of stage.obstacles) drawObstacle(o);
    // スタート：1軒目はおかしや、それより先は前のおうち（届けた人が手をふっている）
    if (level === 1) {
      const [sx0, sy0] = W2S(-3.2, 0); const s = scale;
      ctx.lineWidth = 3; ctx.strokeStyle = '#3b2a1e';
      ctx.fillStyle = '#e9f4ff'; ctx.fillRect(sx0 - s * 1.0, sy0 - s * 2.2, s * 2.0, s * 2.2); ctx.strokeRect(sx0 - s * 1.0, sy0 - s * 2.2, s * 2.0, s * 2.2);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#ff6b8b'; ctx.fillRect(sx0 - s * 1.1 + i * s * 0.44, sy0 - s * 2.45, s * 0.44, s * 0.35); }
      ctx.strokeRect(sx0 - s * 1.1, sy0 - s * 2.45, s * 2.2, s * 0.35);
      ctx.fillStyle = '#3b2a1e'; ctx.font = `900 ${Math.round(s * 0.28)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('おかしや', sx0, sy0 - s * 1.65);
      ctx.fillStyle = '#8fd3ff'; ctx.fillRect(sx0 - s * 0.7, sy0 - s * 1.4, s * 1.4, s * 0.8); ctx.strokeRect(sx0 - s * 0.7, sy0 - s * 1.4, s * 1.4, s * 0.8);
    } else {
      drawHouse(1.6, prevWaiter, 'happy', level - 1);
      if (delivered && performance.now() - delivered.t0 < 3500) bubble(-0.15, 1.45, delivered.say);
    }
    // ゴールの線
    const [lx, ly] = W2S(stage.goal, game.groundHeightAt(stage.goal)); const s = scale;
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#3b2a1e' : '#fff'; ctx.fillRect(lx - 4, ly - (i + 1) * s * 0.25, 8, s * 0.25); }
    // ゴールのおうち
    drawHouse(stage.goal + 1.6, waiter, faceNow, level);
  }

  // おうちと、げんかんの前で待っている人（x はおうちのまん中）
  const ROOFS = ['#e8574f', '#4f8be8', '#4fb36b', '#b05fd1', '#e8a24f', '#5fc7c7'];
  function drawHouse(hx, who, face, n) {
    const [gx, gy] = W2S(hx, game.groundHeightAt(hx)); const s = scale;
    ctx.lineWidth = 3; ctx.strokeStyle = '#3b2a1e';
    ctx.fillStyle = '#fff1d0'; ctx.fillRect(gx - s * 1.2, gy - s * 1.9, s * 2.4, s * 1.9); ctx.strokeRect(gx - s * 1.2, gy - s * 1.9, s * 2.4, s * 1.9);
    ctx.fillStyle = ROOFS[n % ROOFS.length]; ctx.beginPath(); ctx.moveTo(gx - s * 1.5, gy - s * 1.9); ctx.lineTo(gx, gy - s * 3); ctx.lineTo(gx + s * 1.5, gy - s * 1.9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9b6a43'; ctx.fillRect(gx - s * 1.0, gy - s * 1.2, s * 0.6, s * 1.2); ctx.strokeRect(gx - s * 1.0, gy - s * 1.2, s * 0.6, s * 1.2);
    ctx.fillStyle = '#8fd3ff'; ctx.fillRect(gx + s * 0.2, gy - s * 1.4, s * 0.7, s * 0.55); ctx.strokeRect(gx + s * 0.2, gy - s * 1.4, s * 0.7, s * 0.55);
    ctx.fillStyle = '#3b2a1e'; ctx.font = `900 ${Math.round(s * 0.24)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(`${who.name}の家`, gx, gy - s * 2.1);
    const wx = gx - s * 1.75, wy = gy;
    ctx.fillStyle = who.animal ? who.hair : '#7bb7e8'; ctx.lineWidth = 3;
    if (!who.animal) { roundRect(wx - s * 0.2, wy - s * 0.75, s * 0.4, s * 0.75, s * 0.1); ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.ellipse(wx, wy - s * 0.2, s * 0.3, s * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    WT.drawFace(ctx, who, face, wx, wy - s * (who.animal ? 0.55 : 0.98), s * 0.26, performance.now() / 1000);
  }
  // ふきだし（世界の座標 x,y の上に）
  function bubble(x, y, text) {
    const [bx, by] = W2S(x, game.groundHeightAt(x) + y); const s = scale;
    ctx.font = `800 ${Math.round(s * 0.2)}px sans-serif`; ctx.textAlign = 'center';
    const lines = text.split('\n'); const w = Math.min(W * 0.8, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20), h = lines.length * s * 0.26 + 14;
    const left = Math.max(8, Math.min(W - w - 8, bx - w / 2));
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 3;
    roundRect(left, by - h, w, h, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3b2a1e'; lines.forEach((l, i) => ctx.fillText(l, left + w / 2, by - h + 8 + (i + 0.8) * s * 0.26));
  }

  function drawSpring(q) { // ジャンプ台：赤い板と、ばね
    const [cx, by] = W2S(q.x, q.y); const s = scale, w = q.w * s;
    const squash = S.char && Math.abs(game.charX() - q.x) < 0.6 ? 0.6 : 1;
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = '#3b2a1e';
    ctx.beginPath(); ctx.moveTo(cx - w * 0.3, by);
    for (let i = 1; i <= 6; i++) ctx.lineTo(cx + (i % 2 ? 0.3 : -0.3) * w, by - i * s * 0.02 * squash);
    ctx.stroke();
    ctx.fillStyle = '#e8303a'; roundRect(cx - w * 0.6, by - s * 0.22 * squash, w * 1.2, s * 0.1, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffcf3d'; ctx.font = `900 ${Math.round(s * 0.32)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('▲', cx, by - s * 0.3); ctx.strokeText('▲', cx, by - s * 0.3);
    ctx.restore();
  }

  function drawObstacle(o) {
    const [cx, by] = W2S(o.x, o.y); const s = scale, w = o.w * s, h = o.h * s;
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = '#3b2a1e'; ctx.lineJoin = 'round';
    if (o.kind === 'box') { // だんボール
      ctx.fillStyle = '#d9a066'; ctx.fillRect(cx - w / 2, by - h, w, h); ctx.strokeRect(cx - w / 2, by - h, w, h);
      ctx.fillStyle = '#f2d5a0'; ctx.fillRect(cx - w * 0.1, by - h, w * 0.2, h * 0.45);
      ctx.beginPath(); ctx.moveTo(cx - w / 2, by - h * 0.55); ctx.lineTo(cx + w / 2, by - h * 0.55); ctx.stroke();
    } else if (o.kind === 'pot') { // 植木ばち
      ctx.fillStyle = '#5bb04a';
      for (const [dx, dy, r] of [[-0.25, 1.05, 0.28], [0.22, 1.1, 0.3], [0, 1.3, 0.3]]) {
        ctx.beginPath(); ctx.ellipse(cx + dx * w, by - h * dy, w * r, h * 0.22, dx, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#d0693f';
      ctx.beginPath(); ctx.moveTo(cx - w * 0.5, by - h * 0.8); ctx.lineTo(cx + w * 0.5, by - h * 0.8); ctx.lineTo(cx + w * 0.38, by); ctx.lineTo(cx - w * 0.38, by); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(cx - w * 0.56, by - h * 0.95, w * 1.12, h * 0.18); ctx.strokeRect(cx - w * 0.56, by - h * 0.95, w * 1.12, h * 0.18);
    } else if (o.kind === 'cone') { // コーン
      ctx.fillStyle = '#ff7a2f';
      ctx.beginPath(); ctx.moveTo(cx, by - h); ctx.lineTo(cx + w * 0.42, by - h * 0.1); ctx.lineTo(cx - w * 0.42, by - h * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - w * 0.22, by - h * 0.6, w * 0.44, h * 0.14);
      ctx.fillStyle = '#ff7a2f'; ctx.fillRect(cx - w * 0.65, by - h * 0.12, w * 1.3, h * 0.12); ctx.strokeRect(cx - w * 0.65, by - h * 0.12, w * 1.3, h * 0.12);
    } else { // ねている ねこ
      ctx.fillStyle = '#f0a85a';
      ctx.beginPath(); ctx.ellipse(cx, by - h * 0.42, w * 0.5, h * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + w * 0.18, by - h * 0.75); ctx.lineTo(cx + w * 0.26, by - h * 1.05); ctx.lineTo(cx + w * 0.38, by - h * 0.72); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - w * 0.02, by - h * 0.8); ctx.lineTo(cx + w * 0.06, by - h * 1.08); ctx.lineTo(cx + w * 0.18, by - h * 0.82); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + w * 0.08, by - h * 0.5); ctx.quadraticCurveTo(cx + w * 0.13, by - h * 0.45, cx + w * 0.18, by - h * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + w * 0.26, by - h * 0.5); ctx.quadraticCurveTo(cx + w * 0.31, by - h * 0.45, cx + w * 0.36, by - h * 0.5); ctx.stroke();
      ctx.fillStyle = '#3b2a1e'; ctx.font = `900 ${Math.round(s * 0.2)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('zzz', cx + w * 0.5, by - h * 1.05 - Math.sin(performance.now() / 400) * 4);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // 体の部品をその体の向きで描く
  function withBody(body, fn) {
    const p = body.getPosition();
    const [sx, sy] = W2S(p.x, p.y);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(-body.getAngle()); ctx.scale(scale, scale);
    ctx.lineWidth = 3 / scale; ctx.strokeStyle = '#3b2a1e'; ctx.lineJoin = 'round';
    fn(); ctx.restore();
  }
  function rr(x, y, w, h, r) { // 上向き座標で角丸四角（中心 x,y・半分の幅 w,h）
    ctx.beginPath();
    const X = x - w, Y = -y - h, Wd = 2 * w, Hd = 2 * h;
    ctx.moveTo(X + r, Y); ctx.arcTo(X + Wd, Y, X + Wd, Y + Hd, r); ctx.arcTo(X + Wd, Y + Hd, X, Y + Hd, r);
    ctx.arcTo(X, Y + Hd, X, Y, r); ctx.arcTo(X, Y, X + Wd, Y, r); ctx.closePath();
  }

  function drawLeg(lg, back) {
    const pants = back ? '#33507a' : '#3f639a', shoe = back ? '#a83a2a' : '#d4493a';
    withBody(lg.shin, () => {
      ctx.fillStyle = pants; rr(0, 0.02, 0.065, 0.2, 0.05); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shoe; rr(0.07, -0.245, 0.16, 0.05, 0.04); ctx.fill(); ctx.stroke();
    });
    withBody(lg.thigh, () => { ctx.fillStyle = pants; rr(0, 0, 0.08, 0.23, 0.06); ctx.fill(); ctx.stroke(); });
  }

    function drawChar() {
    const c = S.char; if (!c) return;
    const down = S.status === 'fallen';
    drawLeg(S.input.left ? c.L : c.R, true);
    // 体＋おぼん
    const hand = c.tray.getWorldPoint(planck.Vec2(-0.12, -0.02));
    const hand2 = c.tray.getWorldPoint(planck.Vec2(0.0, -0.02));
    const arm = (sx, sy, hx, hy) => { // 肩から手まで（ひじは少し下）
      const [a, b] = W2S(sx, sy), [hxS, hyS] = W2S(hx, hy);
      const ex = (a + hxS) / 2 - scale * 0.02, ey = Math.max(b, hyS) + scale * 0.12;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = scale * 0.1;
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(ex, ey); ctx.lineTo(hxS, hyS); ctx.stroke();
      ctx.strokeStyle = '#f2c9a0'; ctx.lineWidth = scale * 0.065;
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(ex, ey); ctx.lineTo(hxS, hyS); ctx.stroke();
    };
    const sh = c.torso.getWorldPoint(planck.Vec2(0.0, 0.2));
    arm(sh.x, sh.y, hand.x, hand.y); // 奥の腕
    withBody(c.torso, () => {
      ctx.fillStyle = '#ff9f43'; rr(0, 0, 0.16, 0.32, 0.12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; rr(0.03, -0.08, 0.1, 0.18, 0.06); ctx.fill(); ctx.stroke(); // エプロン
    });
    // おぼん
    withBody(c.tray, () => {
      ctx.fillStyle = '#b07a4a'; rr(0, 0, 0.34, 0.03, 0.02); ctx.fill(); ctx.stroke();
      rr(-0.325, 0.05, 0.022, 0.05, 0.01); ctx.fill(); ctx.stroke();
      rr(0.325, 0.05, 0.022, 0.05, 0.01); ctx.fill(); ctx.stroke();
      if (!c.pudding) drawPudding(0, 0.125, true);
    });
    const sh2 = c.torso.getWorldPoint(planck.Vec2(0.04, 0.18));
    arm(sh2.x, sh2.y, hand2.x, hand2.y); // 手前の腕
    drawLeg(S.input.left ? c.R : c.L, false);
    // 頭
    const tilt = c.torso.getAngle();
    const panic = Math.min(1, Math.abs(c.torso.getAngularVelocity()) * 0.6 + Math.abs(tilt) * 1.5);
    withBody(c.head, () => {
      ctx.fillStyle = '#f7d3ae'; ctx.beginPath(); ctx.arc(0, 0, 0.21, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3b2a1e'; // かみ
      ctx.beginPath(); ctx.arc(-0.02, -0.04, 0.215, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 0.025;
      if (down) { // ×の目
        for (const ex of [0.05, 0.14]) {
          ctx.beginPath(); ctx.moveTo(ex - 0.03, -0.03); ctx.lineTo(ex + 0.03, 0.03); ctx.moveTo(ex + 0.03, -0.03); ctx.lineTo(ex - 0.03, 0.03); ctx.stroke();
        }
      } else {
        const r = 0.025 + panic * 0.015;
        for (const ex of [0.05, 0.14]) { ctx.beginPath(); ctx.arc(ex, 0, r, 0, Math.PI * 2); ctx.fill(); }
        ctx.beginPath(); ctx.moveTo(0.02, -0.07 - panic * 0.02); ctx.lineTo(0.08, -0.08 + panic * 0.02); ctx.stroke(); // まゆ
        ctx.beginPath(); ctx.moveTo(0.11, -0.08 + panic * 0.02); ctx.lineTo(0.17, -0.07 - panic * 0.02); ctx.stroke();
      }
      ctx.beginPath(); // 口
      if (down || panic > 0.5) { ctx.ellipse(0.1, 0.1, 0.03, 0.04, 0, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.arc(0.1, 0.07, 0.04, 0.2, Math.PI - 0.2); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,120,120,.45)'; ctx.beginPath(); ctx.arc(0.0, 0.07, 0.035, 0, Math.PI * 2); ctx.fill();
    });
    if (c.pudding) withBody(c.pudding, () => drawPudding(0, 0, false));
  }

  // プリン（ぷるぷる）。onTray のときはおぼんの上の位置（上向き座標）
  let jig = 0, jigV = 0;
  function drawPudding(x, y, onTray) {
    if (onTray) {
      const target = (S.danger || 0) * 0.25 + (S.wobble || 0) * 0.15;
      jigV += (Math.sin(performance.now() / 45) * target - jig) * 0.3; jigV *= 0.7; jig += jigV;
    }
    const j = onTray ? jig : 0;
    ctx.save(); ctx.translate(x, -y + 0.1); ctx.transform(1, 0, -j * 1.2, 1, 0, 0); if (onTray) { ctx.translate(0, 0.0); ctx.scale(1.5, 1.5); ctx.lineWidth /= 1.5; } ctx.scale(1 + Math.abs(j) * 0.3, 1 - Math.abs(j) * 0.3); ctx.translate(0, -0.1);
    ctx.fillStyle = '#ffd84d';
    ctx.beginPath(); ctx.moveTo(-0.13, 0.1); ctx.lineTo(0.13, 0.1); ctx.lineTo(0.09, -0.1); ctx.lineTo(-0.09, -0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8a4b1f';
    ctx.beginPath(); ctx.moveTo(-0.095, -0.06); ctx.lineTo(0.095, -0.06); ctx.lineTo(0.09, -0.1); ctx.lineTo(-0.09, -0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-0.07, -0.02, 0.025, 0.08);
    ctx.restore();
  }

  const pops = []; // 頭の上に出る ひとこと
  function pop(text, color) { pops.push({ text, color, t0: performance.now() }); if (pops.length > 3) pops.shift(); }
  function drawPops() {
    if (!S.char) return;
    const now = performance.now(), p = S.char.head.getPosition();
    pops.forEach((q, i) => {
      const a = (now - q.t0) / 900; if (a > 1) return;
      let [x, y] = W2S(p.x, p.y + 0.55 + a * 0.4 + i * 0.35);
      ctx.globalAlpha = 1 - a * a; ctx.font = `900 ${Math.round(scale * 0.3)}px sans-serif`; ctx.textAlign = 'center';
      const half = ctx.measureText(q.text).width / 2 + 8; x = Math.max(half, Math.min(W - half, x)); // 画面からはみ出さない
      ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.strokeText(q.text, x, y); ctx.fillStyle = q.color; ctx.fillText(q.text, x, y);
      ctx.globalAlpha = 1;
    });
  }
  function drawCharge() { // ジャンプをためている量（頭の上のゲージ）
    if (!S.char || !S.jump || S.jump.phase !== 'crouch') return;
    const p = S.char.head.getPosition(); const [x, y] = W2S(p.x, p.y + 0.42);
    const k = Math.min(1, S.jump.crouch / 24), w = scale * 0.8, h = scale * 0.13;
    ctx.lineWidth = 3; ctx.strokeStyle = '#3b2a1e'; ctx.fillStyle = '#fff';
    roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = k >= 1 ? '#ff4d4d' : '#ffb020';
    if (k > 0.05) { roundRect(x - w / 2 + 2, y - h / 2 + 2, (w - 4) * k, h - 4, (h - 4) / 2); ctx.fill(); }
    ctx.fillStyle = '#3b2a1e'; ctx.font = `900 ${Math.round(scale * 0.2)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(k >= 1 ? 'はなせ！' : 'ためて…', x, y - h);
  }

  let lastTick = 0;
  function updateHud() {
    const x = Math.max(0, game.charX());
    ui.dist.innerHTML = `${(runDist + Math.min(stage.goal, S.status === 'play' ? x : S.bestX)).toFixed(1)}<small>m</small>`; // ここまで歩いたきょり
    ui.meterLabel.textContent = `🏠あと${Math.ceil(Math.max(0, stage.goal - x))}m`;
    const tl = Math.max(0, stage.timeLimit - elapsed);
    ui.time.innerHTML = `<small>のこり</small>${tl < 10 ? tl.toFixed(1) : Math.ceil(tl)}<small>秒</small>`;
    ui.time.classList.toggle('hurry', tl < 10 && S.status === 'play');
    if (S.status === 'play' && tl <= 5 && Math.ceil(tl) !== lastTick) { lastTick = Math.ceil(tl); snd.play('tick', lastTick); }
    const d = S.danger || 0;
    ui.meterFill.style.width = `${Math.round(d * 100)}%`;
    ui.meterFill.style.background = d > 0.7 ? '#ff4d4d' : d > 0.4 ? '#ffb020' : '#5cc96b';
    ui.meter.classList.toggle('danger', d > 0.7 && S.status === 'play');
    ui.best.innerHTML = `<small>ベスト</small>${Math.floor(bestRun)}<small>m</small>`;
  }

  // ---- ループ ----
  let last = performance.now(), acc = 0;
  bestRun = Math.max(bestRun, ...RANK.list().map((r) => r.d)); // 記録ランキングの1位と自己ベストをそろえる
  loadLevel(1); refreshTitle();
  game.spawn(0);
  function frame(now) {
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    const paused = ui.title.classList.contains('show');
    if (!paused) {
      // 転んだ直後はスローモーション
      const slow = S.status === 'fallen' && S.frame - S.fallFrame < 20 ? 0.35 : 1;
      acc += dt * slow;
      while (acc >= 1 / 60) {
        acc -= 1 / 60;
        if (S.status === 'play') elapsed += 1 / 60;
        game.step();
      }
      for (const ev of S.events.splice(0)) {
        if (ev.type === 'clear') continue; // 届けたときの音は deliver() で鳴らす
        else if (ev.type === 'fall' || ev.type === 'pudding' || ev.type === 'timeup') { snd.bgm(false); snd.play(ev.type); }
        else {
          snd.play(ev.type, ev.v);
          if (ev.type === 'stumble') pop({ same: '同じ足！', fast: 'あせりすぎ！', slow: 'もたもた！' }[ev.v.why] || 'おっと！', ev.v.bad > 0.6 ? '#e8303a' : '#ff8a00');
          if (ev.type === 'stop') { for (let i = pops.length - 1; i >= 0; i--) if (pops[i].text.startsWith('ふらふら')) pops.splice(i, 1); pop('止まっちゃだめ！', '#e8303a'); }
          if (ev.type === 'wobble') pop('ふらふら…', '#ff8a00');
        }
      }
      if (level <= 10 && S.status === 'play') { // 最初のうちは、しかけの手前でやり方を出す
        const x = game.charX();
        stage.springs.forEach((q, i) => {
          if (!hinted.has('s' + i) && q.x - x < 2.6 && q.x - x > 0) { hinted.add('s' + i); showBanner('赤い台に乗ると<br>ピョーンと飛ぶよ！'); hintTimer = setTimeout(() => { ui.hint.style.opacity = 0; }, 2500); }
        });
        stage.pits.forEach((q, i) => {
          if (!hinted.has('p' + i) && q.x0 - x < 2.8 && q.x0 - x > 0) { hinted.add('p' + i); showBanner('穴だ！ 両方押して…<br>はなしてジャンプ！'); hintTimer = setTimeout(() => { ui.hint.style.opacity = 0; }, 2500); }
        });
        if (level <= 6) stage.obstacles.forEach((o, i) => {
          if (!hinted.has(i) && o.x - x < 2.6 && o.x - x > 0) {
            hinted.add(i); showBanner('両方の足を いっしょに押して…<br>はなすと ジャンプ！'); hintTimer = setTimeout(() => { ui.hint.style.opacity = 0; }, 3000);
          }
        });
      }
      if (S.status === 'clear') deliver();
      if (S.status === 'fallen' && S.frame - S.fallFrame > 50) {
        if (!shownEnd) { shownEnd = true; onFall(); }
      } else if (S.status === 'play') shownEnd = false;
    }
    if (S.char) {
      const p = S.char.torso.getPosition();
      cam.x += (p.x + 0.6 - cam.x) * 0.08;
      cam.y += (game.groundHeightAt(p.x) + 0.9 - cam.y) * 0.05;
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBackground();
    drawGround();
    drawChar();
    drawCharge();
    drawPops();
    updateHud();
    const shownFace = ui.fail.classList.contains('show') ? ui.failFace : null;
    if (shownFace) {
      const fc = shownFace.getContext('2d'); fc.clearRect(0, 0, 240, 240);
      WT.drawFace(fc, waiter, faceNow, 120, 132, 82, (performance.now() - faceT0) / 1000);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // テスト用（自動操作で動作確認するため）
  window.__yoro = { get game() { return game; }, start, retry, restart, next, loadLevel };
})();
