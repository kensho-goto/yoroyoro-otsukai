// ヨロヨロおつかい — 画面の描画と操作
(function () {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    dist: $('dist'), time: $('time'), timeN: $('timeN'), best: $('best'), hint: $('hint'), prog: $('progFill'), finger: $('finger'),
    padL: $('padL'), padR: $('padR'),
    title: $('title'), fail: $('fail'), pause: $('pause'), retry: $('retryBtn'),
    failTitle: $('failTitle'), failLine: $('failLine'), failDist: $('failDist'),
    failTag: $('failTag'), failAct: $('failAct'), failFace: $('failFace'),
    meter: $('meter'), meterFill: $('meterFill'), meterLabel: $('meterLabel'),
    meter2: $('meter2'), balFill: $('balFill'), spd: $('spd'),
  };

  // 道はレベルで区切らず、どこまでも続く。おうちに届けるたびに次のおうちへ（level＝何軒目か。先へ行くほど難しい）
  let game, S, stage, level = 1, hinted = new Set();
  const WT = window.YoroWaiter;
  let waiter = WT.forLevel(1), fails = 0, faceNow = 'wait', faceT0 = 0; // 待っている人・続けて失敗した回数・今の顔
  const RANK = window.YoroRank || { list: () => [], add: () => null, render() {} };
  const snd = window.YoroSound || { play() {}, bgm() {}, on: false, toggle() { return false; } };
  const ZK = window.YoroZukan || { mark: () => false, has: () => false, count: () => ({ got: 0, total: 0 }), pickTreasure: () => null, rareOf: () => false, render() {}, FALLS: [], MOOD_NAMES: {} };
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
  // この回で起きたこと（ずかんに新しく入ったもの・拾ったおたから・金のプリンの日・テスト用の強制）
  let runNew = [], runTreasure = 0, runMedals = 0, goldDay = false, boxes = [];
  const force = {}; // テスト用：{ rare, wind, gold }
  const CL = window.YoroCloset, DY = window.YoroDays;
  const GA = window.YoroGacha || { COST: 5, medals: 0, addMedals() {}, canPull: () => false, worn: () => ({}), effects: () => ({ jump: 1, wind: 1, speed: 0, balance: 1, pudding: 1 }), ITEMS: [], RARITY: {}, SLOTS: {}, count: () => ({ got: 0, total: 0 }), has: () => false, renderEquip() {} };
  let wear = GA.worn(); // ガチャで出て、身につけているもの（くつ・ぼうし・おぼん・すがた）
  // おたからのメダル：めずらしいほど多い
  const medalOf = (t) => (t.w >= 12 ? 1 : t.w >= 5 ? 2 : t.w >= 2 ? 3 : 5);
  const CLIP = window.YoroClip || { capture() {}, reset() {}, stopAfter() {}, ready: () => false, make: async () => null };
  let mode = 'free', look = null, curBest = 0, unlockAtStart = []; // free＝いつものコース／daily＝今日のコース・見た目・この回のベスト・はじめに使えたもの
  const ctxNow = () => { const st = CL.stats(); return { total: st.total, runs: st.runs, best: bestRun, zukan: ZK.count().got, streak: DY.streak().n, has: ZK.has }; };
  const itemName = () => (look ? look.carry.name : 'プリン');
  const tr = (t) => (itemName().includes('プリン') ? t : t.replace(/プリン/g, itemName())); // 文の「プリン」を運んでいるものの名前に
  function noteNew(isNew, text) { if (isNew) runNew.push(text); return isNew; }

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
    game = YoroCore.create(planck, { level: n, seed: mode === 'daily' ? DY.seed() : 0 });
    const R = mode === 'daily' ? DY.rng(n) : Math.random; // 今日のコースは、風・お客さん・箱の場所もみんな同じ
    S = game.state; stage = game.stage;
    { // ガチャで出たものの効き目（ほんの少し）
      const fx = GA.effects(), T = S.tuning;
      T.jumpVy = T.jumpVy.map((v) => v * fx.jump); T.balance *= fx.balance; T.accGain *= fx.pudding; T.driveMax += fx.speed;
      S.fx = fx;
    }
    if (old) { cam.x -= old.goal; cam.y -= old.gy; worldOff += old.goal; for (const q of prints) q.x -= old.goal; }
    else { cam.x = 0; cam.y = 1; worldOff = 0; delivered = null; prints.length = 0; } // 前の道の続きに見えるように
    ui.meterLabel.textContent = `${n}軒目`;
    hinted = new Set();
    prevWaiter = n > 1 ? (carry ? waiter : WT.forLevel(n - 1)) : null;
    const rare = n >= 2 && (force.rare != null ? force.rare : R() < 0.05); // ごくたまに、めずらしいお客さん
    waiter = rare ? WT.RARE[Math.floor(R() * WT.RARE.length)] : WT.forLevel(n); faceNow = 'wait';
    // たまに風がふく（3軒目から）
    const windy = n >= 3 && (force.wind != null ? force.wind !== 0 : R() < 0.15);
    S.wind = (windy ? (force.wind || (R() < 0.5 ? -4 : 4)) : 0) * S.fx.wind;
    makeBoxes(R);
    let msg = n === 1 ? `${waiter.name}に<br>プリンを とどけよう`
      : n === 3 ? `つぎは ${waiter.name}の家<br>左右同時で ジャンプ`
      : `つぎは ${waiter.name}の家`;
    if (rare) { msg = `えっ！？ つぎは<br><b>${waiter.name}</b>の家！？`; noteNew(ZK.mark('event', 'rare'), 'できごと「めずらしい お客さん」'); }
    if (S.wind) { const head = S.wind < 0; msg = `${head ? '向かい風だ！' : '追い風だ！'}<br>${msg.split('<br>')[0]}`; noteNew(ZK.mark('event', head ? 'headwind' : 'tailwind'), `できごと「${head ? '向かい風' : '追い風'}」`); }
    if (n === 1 && goldDay) msg = 'きょうは<br><b>金のプリンの日！</b>';
    if (n === 1 && mode === 'daily') msg = `きょうのコース<br>${DY.label()}`;
    showBanner(tr(msg));
    if (n > 1 && (rare || S.wind)) { snd.play(S.wind ? 'gust' : 'event'); hintTimer = setTimeout(() => { ui.hint.style.opacity = 0; }, 3000); }
  }
  // 道のおたから（？の箱）。ふつうの箱は歩くと取れる高さ、高い箱はジャンプしないと取れない
  function makeBoxes(R) {
    R = R || Math.random;
    boxes = [];
    const g = stage.goal;
    const busy = (x) => stage.pits.some((q) => x > q.x0 - 1 && x < q.x1 + 1) || stage.springs.some((q) => Math.abs(q.x - x) < 1.2)
      || stage.obstacles.some((o) => Math.abs(o.x - x) < 1) || boxes.some((b) => Math.abs(b.x - x) < 1.5);
    const k = (1 + Math.floor(g / 18) + (R() < 0.4 ? 1 : 0)) * (goldDay ? 2 : 1);
    for (let i = 0; i < k; i++) {
      for (let t = 0; t < 12; t++) {
        const x = 3 + R() * (g - 5.5);
        if (busy(x)) continue;
        const high = level >= 2 && R() < 0.3;
        boxes.push({ x, y: game.groundHeightAt(x) + (high ? 2.45 : 1.65), high, taken: 0, item: null });
        break;
      }
    }
    // じゃまな物や穴の上にも、ときどき（飛びこえるついでに取れる）
    for (const o of stage.obstacles) if (R() < 0.4) boxes.push({ x: o.x, y: game.groundHeightAt(o.x - 0.5) + 2.45, high: true, taken: 0, item: null });
    for (const q of stage.pits) if (!q.bySpring && R() < 0.4) boxes.push({ x: (q.x0 + q.x1) / 2, y: q.h + 2.35, high: true, taken: 0, item: null });
  }
  function pickupBoxes() {
    const c = S.char; if (!c) return;
    const hp = c.head.getPosition(), tp = c.torso.getPosition();
    for (const b of boxes) {
      if (b.taken) continue;
      const d = Math.min(Math.hypot(hp.x - b.x, hp.y - b.y), Math.hypot(tp.x - b.x, tp.y - b.y));
      if (d > 0.5) continue;
      const t = ZK.pickTreasure(); if (!t) continue;
      b.taken = performance.now(); b.item = t; runTreasure++;
      const isNew = noteNew(ZK.mark('treasure', t.id), `おたから「${t.name}」`);
      const m = medalOf(t), could = GA.canPull(); GA.addMedals(m); runMedals += m;
      pop(`${t.icon} ${t.name} +${m}${isNew ? ' NEW！' : ''}`, isNew ? '#d48a00' : '#7a4ad6');
      if (!could && GA.canPull()) setTimeout(() => pop('ガチャが回せる！', '#e8a600'), 450);
      paintMedal(true);
      snd.play('treasure', ZK.rareOf(t));
    }
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
  const playing = () => S.status === 'play' && !ui.title.classList.contains('show') && !ui.pause.classList.contains('show');
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
      if (gachaEl.classList.contains('show')) closeGacha();
      else if (zukanEl.classList.contains('show')) closeZukan();
      else if (closetEl.classList.contains('show')) closeCloset();
      else if (ui.title.classList.contains('show')) start();
      else if (ui.fail.classList.contains('show') && !ui.retry.disabled) restart();
      else if (ui.pause.classList.contains('show')) resume();
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
    for (const o of [ui.title, ui.fail, ui.pause]) o.classList.toggle('show', o === el);
    document.body.classList.toggle('menu', el === ui.title || el === ui.fail);
  }
  function start() { restart('free'); }
  // ゲームオーバーのあとは、いつも最初（おかしや）から
  let passedBest = false, nextMile = 50, lastShare = ''; // この回で自己ベストをこえたか・次の節目のきょり・送る文
  function restart(m) {
    if (m === 'free' || m === 'daily') mode = m;
    runNew = []; runTreasure = 0; runMedals = 0; wear = GA.worn(); paintMedal();
    const cx = ctxNow(); look = CL.current(cx); unlockAtStart = CL.unlockedIds(cx);
    curBest = mode === 'daily' ? DY.daily().best : bestRun;
    CLIP.reset();
    goldDay = force.gold != null ? !!force.gold : (mode === 'daily' ? DY.rng(0)() : Math.random()) < 0.03; // ごくたまに「金のプリンの日」
    if (goldDay) noteNew(ZK.mark('event', 'goldday'), 'できごと「金のプリンの日」');
    tutSteps = 0; loadLevel(1); pops.length = 0; elapsed = 0; runDist = 0; passedBest = false; nextMile = 50; game.spawn(0); showOnly(null); snd.play(goldDay ? 'event' : 'start'); snd.bgm(true);
  }
  const retry = () => restart();
  // おうちに着いた：プリンを届けて、止まらずに次のおうちへ
  function deliver() {
    const say = WT.happy(waiter, itemName()).say;
    noteNew(ZK.mark('face', `${waiter.id}.happy`), `${waiter.name}の「にっこり」顔`);
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
  $('dailyBtn').onclick = () => restart('daily');
  $('retryBtn').onclick = () => restart();
  // ゲームオーバーの画面は、ボタン以外のどこをタップしても すぐもう一回（動画を作っているあいだは待つ）
  ui.fail.addEventListener('click', (e) => { if (!e.target.closest('button, a, summary') && !ui.retry.disabled && !vidBusy) restart(); });
  // 転んだ動画：1回目のタップで作る → できたら、もう1回のタップで送る（スマホは送るときにタップが要る）
  let vidFile = null, vidBusy = false, clipInfo = null;
  const vidBtn = $('vidBtn'), vidLabel = vidBtn.querySelector('b');
  function resetVid() { vidFile = null; vidBusy = false; vidBtn.disabled = false; vidLabel.textContent = '動画'; }
  async function shareFile(f) {
    try {
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text: lastShare }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 10000);
  }
  vidBtn.onclick = async () => {
    if (vidFile) { shareFile(vidFile); return; }
    if (vidBusy || !clipInfo) return;
    vidBusy = true; vidBtn.disabled = true; vidLabel.textContent = 'つくり中';
    try { vidFile = await CLIP.make(clipInfo, (p) => { vidLabel.textContent = `${Math.round(p * 100)}%`; }); } catch (e) { vidFile = null; }
    vidBusy = false; vidBtn.disabled = false;
    vidLabel.textContent = !vidFile ? 'つくれない' : '動画を送る';
  };
  // きせかえ
  const closetEl = $('closet');
  function openCloset() {
    CL.render($('closetBody'), ctxNow(), () => { look = CL.current(ctxNow()); snd.play('tap'); });
    GA.renderEquip($('closetGacha'), () => { wear = GA.worn(); snd.play('tap'); });
    closetEl.classList.add('show'); closetEl.querySelector('.card').scrollTop = 0; snd.play('tap'); }
  function closeCloset() { closetEl.classList.remove('show'); look = CL.current(ctxNow()); wear = GA.worn(); }
  $('closetBtn').onclick = openCloset;
  $('closetClose').onclick = closeCloset;
  closetEl.addEventListener('click', (e) => { if (e.target === closetEl) closeCloset(); });
  // ガチャ：おたからのメダル🪙を5枚つかって1回。くつ・ぼうし・おぼん・すがたが出る
  const gachaEl = $('gacha'), gPull = $('gPull'), gMachine = $('gMachine');
  let gBusy = false;
  function paintGacha() {
    const c = GA.count();
    $('gMedals').innerHTML = `<span class="coin"></span> ${GA.medals}枚${GA.canPull() ? '' : `（あと ${GA.COST - GA.medals}枚）`}`;
    gPull.disabled = gBusy || !GA.canPull();
    gPull.textContent = GA.canPull() || gBusy ? '回す' : 'メダルが たりない';
    $('gCount').textContent = `${c.got} / ${c.total}`;
    $('gAll').innerHTML = GA.ITEMS.map((i) => (GA.has(i.id) ? `<span title="${i.name}">${i.icon}</span>` : '<span class="no">？</span>')).join('');
    paintMedal();
  }
  function openGacha() { $('gResult').innerHTML = ''; gMachine.className = 'gm'; paintGacha(); gachaEl.classList.add('show'); gachaEl.querySelector('.card').scrollTop = 0; snd.play('tap'); }
  function closeGacha() { if (gBusy) return; gachaEl.classList.remove('show'); wear = GA.worn(); refreshTitle(); paintFailGacha(); }
  gPull.onclick = () => {
    if (gBusy || !GA.canPull()) return;
    const res = GA.pull(); if (!res) return;
    gBusy = true; paintGacha(); $('gResult').innerHTML = '';
    const it = res.item, rr = GA.RARITY[it.r];
    $('gCap').style.background = `linear-gradient(${rr.color} 0 50%, #fff 50% 100%)`;
    gMachine.className = 'gm spin'; snd.play('event');
    setTimeout(() => { gMachine.className = 'gm spin drop'; snd.play('tap'); }, 900);
    setTimeout(() => {
      gBusy = false; gMachine.className = 'gm';
      $('gResult').innerHTML = `<div class="gres${it.r === 'SSR' ? ' ssr' : ''}"><span class="rr" style="color:${rr.color}">★ ${rr.name} ★</span><b>${it.icon}</b>`
        + `<span class="nm">${it.name}</span>（${GA.SLOTS[it.slot]}）<br>${it.say ? `<span class="fx">${it.say}</span><br>` : ''}`
        + (res.isNew ? '<span class="nw">NEW！ 身につけたよ</span>' : `ダブり… メダル${res.back}枚 もどった`) + '</div>';
      if (res.isNew) noteNew(true, `ガチャ「${it.name}」`);
      snd.play('treasure', it.r === 'SR' || it.r === 'SSR');
      if (navigator.vibrate) navigator.vibrate(it.r === 'SSR' ? [60, 40, 60, 40, 120] : 40);
      wear = GA.worn(); paintGacha();
    }, 1600);
  };
  $('gClose').onclick = closeGacha;
  $('gCloset').onclick = () => { if (gBusy) return; gachaEl.classList.remove('show'); wear = GA.worn(); openCloset(); };
  gachaEl.addEventListener('click', (e) => { if (e.target === gachaEl) closeGacha(); });
  $('titleGachaBtn').onclick = openGacha;
  $('failGachaBtn').onclick = openGacha;
  // メダルの数（左上）。ガチャが回せるときは黄色
  const medalChip = $('medalChip');
  function paintMedal(bump) {
    const n = GA.medals, ok = GA.canPull();
    medalChip.hidden = false;
    medalChip.innerHTML = `<span class="coin"></span>${n}`;
    medalChip.classList.toggle('ready', ok);
    if (bump) { medalChip.classList.remove('bump'); void medalChip.offsetWidth; medalChip.classList.add('bump'); }
  }
  function paintFailGacha() {
    const b = $('failGachaBtn'), n = GA.medals;
    b.hidden = !GA.canPull();
    const fm = $('failMedal'); fm.hidden = !runMedals;
    fm.innerHTML = `<span class="coin"></span>+${runMedals}`;
  }
  // ずかん
  const zukanEl = $('zukan');
  function openZukan() { ZK.render($('zukanBody')); zukanEl.classList.add('show'); zukanEl.querySelector('.card').scrollTop = 0; snd.play('tap'); }
  function closeZukan() { zukanEl.classList.remove('show'); }
  $('titleZukanBtn').onclick = openZukan;
  $('failZukanBtn').onclick = openZukan;
  $('zukanClose').onclick = closeZukan;
  zukanEl.addEventListener('click', (e) => { if (e.target === zukanEl) closeZukan(); });
  // アプリを離れたら、ひと休み（もどったら「つづける」を押してから再開）
  function pause() {
    if (S.status !== 'play' || ui.title.classList.contains('show') || ui.fail.classList.contains('show')) return;
    showOnly(ui.pause); snd.bgm(false);
  }
  function resume() {
    showOnly(null); snd.bgm(true);
    S.rhythm.sinceStep = 0; S.rhythm.first = true; S.rhythm.lastSide = null; S.rhythm.lastInterval = 0; // 最初の1歩と同じだけ待つ
  }
  $('resumeBtn').onclick = resume;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); snd.sleep(true); } else snd.sleep(false);
  });
  // 記録を送る（スマホのシェア。使えなければコピー）
  $('shareBtn').onclick = async () => {
    const url = location.origin + location.pathname;
    try {
      if (navigator.share) { await navigator.share({ title: 'ヨロヨロおつかい', text: lastShare, url }); return; }
      await navigator.clipboard.writeText(`${lastShare}\n${url}`);
      $('shareBtn').querySelector('b').textContent = 'コピーした';
      setTimeout(() => { $('shareBtn').querySelector('b').textContent = '送る'; }, 1800);
    } catch (e) { /* やめた・使えないときは何もしない */ }
  };
  const sndBtn = $('sndBtn');
  const paintSnd = () => { sndBtn.innerHTML = `<svg class="ic"><use href="#${snd.on ? 'i-snd' : 'i-mute'}"/></svg>`; sndBtn.setAttribute('aria-label', snd.on ? '音をけす' : '音を出す'); };
  sndBtn.onclick = () => { snd.toggle(); paintSnd(); snd.play('tap'); };
  paintSnd();
  function refreshTitle() {
    $('bestRun').hidden = bestRun <= 0;
    $('bestRun').innerHTML = `<svg class="ic"><use href="#i-flag"/></svg> ${bestRun.toFixed(1)}m`;
    const sk = DY.streak(), dd = DY.daily();
    $('streak').innerHTML = sk.n > 0 ? `<svg class="ic"><use href="#i-flame"/></svg> ${sk.n}日れんぞく` : '';
    $('dailyBtn').innerHTML = `きょうのコース<small>${DY.label()}${dd.tries ? `・ベスト ${dd.best.toFixed(1)}m` : ''}</small>`;
    $('titleMedal').textContent = GA.medals;
    $('titleGachaBtn').classList.toggle('ready', GA.canPull());
    paintMedal();
    showTitleRank();
  }
  // きろく・あそびかた（タイトルのすみの絵のボタン）
  for (const [btn, el, cl] of [['rankBtn', 'records', 'recordsClose'], ['howBtn', 'howto', 'howtoClose']]) {
    const o = $(el);
    $(btn).onclick = () => { o.classList.add('show'); snd.play('tap'); };
    $(cl).onclick = () => o.classList.remove('show');
    o.addEventListener('click', (e) => { if (e.target === o) o.classList.remove('show'); });
  }
  // タイトルに、じぶんの記録の上位を出す
  function showTitleRank() { RANK.render($('titleRank'), { list: RANK.list(), idx: -1 }); }

  let shownEnd = false;
  function onFall() {
    const left = Math.max(0, stage.goal - S.bestX);
    fails++;
    const r = WT.reaction(waiter, { reason: S.fallReason, fails, left, item: itemName() });
    faceNow = r.face; faceT0 = performance.now();
    const fr = ZK.FALLS.find((f) => f.id === S.fallReason);
    if (fr) noteNew(ZK.mark('fall', fr.id), `ころび方「${fr.name}」`);
    noteNew(ZK.mark('face', `${waiter.id}.${r.mood}`), `${waiter.name}の「${ZK.MOOD_NAMES[r.mood] || r.mood}」顔`);
    const total = runDist + Math.min(stage.goal, Math.max(0, S.bestX)); // ゲームオーバーまでに歩けたきょり
    const daily = mode === 'daily';
    const prevBest = curBest;
    let newBest;
    if (daily) { newBest = DY.addDaily(total).isBest; }
    else { newBest = total > bestRun + 0.05; if (newBest) { bestRun = total; store.set('yoro.bestRun', bestRun.toFixed(1)); } }
    // 合計きょり・回数・れんぞく日数 → 新しく使えるようになったもの
    CL.addRun(total);
    const sk = DY.touch();
    const extra = [];
    if (sk.up && sk.n >= 2) extra.push(`${sk.n}日 れんぞく！`);
    for (const x of CL.newly(unlockAtStart, ctxNow())) extra.push(`${x.name}が使える！`);
    runNew = extra.concat(runNew);
    refreshTitle();
    ui.failTag.textContent = tr(`${{ pudding: 'プリンを落とした', timeup: '時間切れ', rhythm: 'リズムがくずれた', stop: '止まってころんだ', hole: '穴に落ちた' }[S.fallReason] || 'ころんだ'}`);
    $('failNum').innerHTML = `${total.toFixed(1)}<small>m</small>`;
    ui.failTitle.textContent = r.title;
    ui.failLine.textContent = r.say;
    ui.failAct.textContent = r.action;
    ui.failDist.textContent = `${daily ? `今日のコース ${DY.daily().tries}回目\n` : ''}${level}軒目・${waiter.name}のおうちまで あと ${left.toFixed(1)}m\n歩いたきょり ${total.toFixed(1)}m${newBest ? '' : `（${daily ? '今日の' : ''}ベスト ${curBest.toFixed(1)}m）`}${runTreasure ? `\nこの回のおたから ${runTreasure}こ` : ''}`;
    $('retryBtn').textContent = 'もう一回';
    ui.retry.disabled = true; setTimeout(() => { ui.retry.disabled = false; }, 700); // 歩いていた指でうっかり押さないように
    lastShare = `ヨロヨロおつかい${daily ? `の今日のコース（${DY.label()}）` : ''}で ${total.toFixed(1)}m 歩いた！${newBest ? (daily ? '（今日のベスト！）' : '（自己ベスト！）') : ''} ${level}軒目の${waiter.name}に「${r.say}」と言われた…`;
    clipInfo = { dist: `${total.toFixed(1)}m`, title: r.title, say: r.say, tag: ui.failTag.textContent };
    resetVid();
    // 歩いたきょりを、じぶんの記録ランキングに入れて上位を出す（このスマホの中だけ。今日のコースは入れない）
    const rk = daily ? { list: [], idx: -1 } : total >= 0.5 ? RANK.add(total) : { list: RANK.list(), idx: -1 };
    RANK.render($('failRank'), rk);
    // あとちょっと：すぐ上の記録まで何mだったか
    const near = $('failNear'); near.classList.toggle('best', newBest);
    const bestWord = daily ? '今日のベスト' : '自己ベスト';
    if (newBest) near.textContent = prevBest > 0 ? `${bestWord}更新！ +${(total - prevBest).toFixed(1)}m` : 'はじめての記録！';
    else if (daily) { const gap = curBest - total; near.textContent = `今日のベストまで あと ${gap.toFixed(1)}m${gap < 5 ? '！ おしい！' : '！'}`; }
    else {
      const above = rk.list.filter((x) => x.d > total + 0.05).pop(); // すぐ上の記録
      const pos = above ? rk.list.indexOf(above) + 1 : 0;
      const gap = bestRun - total;
      near.innerHTML = !above ? '' : pos === 1 ? `ベストまで あと ${gap.toFixed(1)}m${gap < 5 ? '！ おしい！' : '！'}`
        : `${pos}位まで あと ${(above.d - total).toFixed(1)}m！<small>ベストまで ${gap.toFixed(1)}m</small>`;
    }
    // ずかん：この回で新しく入ったもの（なければ、まだ見ていないころび方のヒント）
    const zc = ZK.count(), nb = $('failNew');
    nb.innerHTML = `<b>NEW</b> ずかん ${zc.got}/${zc.total}`;
    nb.hidden = !runNew.length;
    paintFailGacha();
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
    // 自己ベストの金色の旗（この道の中にあるときだけ）
    const bx = curBest - runDist;
    if (curBest > 0 && bx > 0.3 && bx < stage.goal + 0.5) {
      const [x, y] = W2S(bx, game.groundHeightAt(bx)); const s = scale;
      ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 1.8); ctx.stroke();
      ctx.fillStyle = passedBest ? '#c9c9c9' : '#ffc61a';
      ctx.beginPath(); ctx.moveTo(x, y - s * 1.8); ctx.lineTo(x + s * 0.8, y - s * 1.58); ctx.lineTo(x, y - s * 1.36); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3b2a1e'; ctx.font = `900 ${Math.round(s * 0.2)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('ベスト', x + s * 0.32, y - s * 1.52);
    }
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

  // おたからの箱（？）。拾ったら中身が上にふわっと出る
  function drawBoxes() {
    const now = performance.now(), s = scale;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const b of boxes) {
      if (b.taken) {
        const a = (now - b.taken) / 1000; if (a > 1) continue;
        const [x, y] = W2S(b.x, b.y + a * 0.9);
        ctx.globalAlpha = 1 - a * a; ctx.font = `${Math.round(s * 0.55)}px sans-serif`; ctx.fillText(b.item.icon, x, y); ctx.globalAlpha = 1;
        continue;
      }
      const [x, y] = W2S(b.x, b.y + Math.sin(now / 300 + b.x) * 0.05); const h = s * 0.19;
      if (goldDay) { ctx.fillStyle = 'rgba(255,215,0,.35)'; ctx.beginPath(); ctx.arc(x, y, h * 1.8, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = b.high ? '#b46cf0' : '#ff9f1c'; ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 3;
      roundRect(x - h, y - h, h * 2, h * 2, h * 0.3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffe14d'; ctx.fillRect(x - h * 0.16, y - h + 1.5, h * 0.32, h * 2 - 3);
      ctx.font = `900 ${Math.round(h * 1.25)}px sans-serif`; ctx.lineWidth = 4; ctx.strokeStyle = '#3b2a1e'; ctx.strokeText('？', x, y + 1); ctx.fillStyle = '#fff'; ctx.fillText('？', x, y + 1);
    }
    ctx.textBaseline = 'alphabetic';
  }
  // 風の線（向かい風は左へ、追い風は右へ流れる）
  function drawWind() {
    if (!S.wind) return;
    const t = performance.now() / 1000, dir = Math.sign(S.wind), span = W + 240;
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const sp = 0.5 + ((i * 37) % 10) / 12;
      const px = (((i * 131 + t * W * sp * dir) % span) + span) % span - 120, py = ((i * 61) % 70) / 100 * H + H * 0.06;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - dir * scale * (0.6 + (i % 3) * 0.3), py); ctx.stroke();
    }
  }

  // 速いときの線（体のうしろに流れる）
  function drawSpeedLines() {
    if (!S.char || spdShown < 2.1) return;
    const p = S.char.torso.getPosition(); const [cx, cy] = W2S(p.x, p.y); const k = Math.min(1, (spdShown - 2.1) / 1);
    const t = performance.now() / 70;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + k * 0.4})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const y = cy + (i - 2.5) * scale * 0.28, off = ((t * 40 + i * 37) % (scale * 1.2));
      const x0 = cx - scale * 0.45 - off;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 - scale * (0.4 + k * 0.6), y); ctx.stroke();
    }
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
    ctx.fillStyle = who.animal ? who.hair : who.body || '#7bb7e8'; ctx.lineWidth = 3;
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

  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  const OUT = () => (look ? look.outfit : CL.OUTFITS[0]);
  const SKIN0 = { face: '#f7d3ae', arm: '#f2c9a0', hair: '#3b2a1e' };
  const SK = () => (wear.skin && wear.skin.skin) || SKIN0; // すがた（ガチャ）
  // 足：ひだり足はいつも奥（青）、みぎ足はいつも手前（ピンク）。ボタンと同じ色の帯で、どっちの足か見て分かるように
  const LEGCOL = { L: '#4aa3ff', R: '#ff6b8b' };
  function drawLeg(lg, side) {
    const back = side === 'L', o = OUT(), k = back ? 0.8 : 1;
    const pants = shade(o.pants, k), shoe = shade(wear.shoe ? wear.shoe.color : o.shoe, k), band = LEGCOL[side];
    const on = S.status === 'play' && (side === 'L' ? S.input.left : S.input.right);
    const glow = (fn) => { if (!on) return; ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 9 / scale; fn(); ctx.stroke(); ctx.restore(); };
    withBody(lg.thigh, () => { glow(() => rr(0, 0, 0.08, 0.23, 0.06)); ctx.fillStyle = pants; rr(0, 0, 0.08, 0.23, 0.06); ctx.fill(); ctx.stroke(); });
    withBody(lg.shin, () => {
      glow(() => rr(0, 0.02, 0.065, 0.2, 0.05));
      ctx.fillStyle = pants; rr(0, 0.02, 0.065, 0.2, 0.05); ctx.fill(); ctx.stroke();
      ctx.fillStyle = band; rr(0, -0.08, 0.068, 0.11, 0.03); ctx.fill(); ctx.stroke(); // 色のくつした（ボタンと同じ色）
      ctx.fillStyle = shoe; rr(0.07, -0.245, 0.16, 0.05, 0.04); ctx.fill(); ctx.stroke();
      const sid = wear.shoe && wear.shoe.id;
      if (sid === 'spring') { ctx.beginPath(); for (let i = 0; i <= 6; i++) ctx.lineTo(0.07 + (i % 2 ? 0.05 : -0.05), 0.295 + i * 0.012); ctx.stroke(); } // バネ
      else if (sid === 'rocket' && on) { ctx.fillStyle = '#ff9a1a'; ctx.beginPath(); ctx.moveTo(-0.09, 0.23); ctx.lineTo(-0.2 - Math.random() * 0.08, 0.245); ctx.lineTo(-0.09, 0.26); ctx.closePath(); ctx.fill(); } // ほのお
      else if (sid === 'goldshoe' && Math.sin(performance.now() / 150 + (back ? 1 : 0)) > 0.6) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0.16, 0.25, 0.018, 0, Math.PI * 2); ctx.fill(); }
    });
  }
  // 足あと（地面についた足。青＝ひだり・ピンク＝みぎ。交互にならんでいればいいリズム）
  const prints = [];
  function addPrint(side) {
    const c = S.char; if (!c) return;
    const last = prints[prints.length - 1];
    if (last && last.side === side && performance.now() - last.t < 200) return; // 同じ着地を2回数えない
    const p = c[side].shin.getWorldPoint(planck.Vec2(0.07, -0.25));
    prints.push({ x: p.x, side, t: performance.now() }); if (prints.length > 14) prints.shift();
  }
  function drawPrints() {
    const now = performance.now();
    for (const q of prints) {
      const a = 1 - (now - q.t) / 2500; if (a <= 0) continue;
      const [x, y] = W2S(q.x, game.groundHeightAt(q.x));
      ctx.globalAlpha = Math.min(1, a * 1.5) * 0.85; ctx.fillStyle = LEGCOL[q.side];
      ctx.beginPath(); ctx.ellipse(x, y - 2, scale * 0.16, scale * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

    function drawChar() {
    const c = S.char; if (!c) return;
    const down = S.status === 'fallen';
    drawLeg(c.L, 'L');
    // 体＋おぼん
    const hand = c.tray.getWorldPoint(planck.Vec2(-0.12, -0.02));
    const hand2 = c.tray.getWorldPoint(planck.Vec2(0.0, -0.02));
    const arm = (sx, sy, hx, hy) => { // 肩から手まで（ひじは少し下）
      const [a, b] = W2S(sx, sy), [hxS, hyS] = W2S(hx, hy);
      const ex = (a + hxS) / 2 - scale * 0.02, ey = Math.max(b, hyS) + scale * 0.12;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = scale * 0.1;
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(ex, ey); ctx.lineTo(hxS, hyS); ctx.stroke();
      ctx.strokeStyle = SK().arm; ctx.lineWidth = scale * 0.065;
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(ex, ey); ctx.lineTo(hxS, hyS); ctx.stroke();
    };
    const sh = c.torso.getWorldPoint(planck.Vec2(0.0, 0.2));
    arm(sh.x, sh.y, hand.x, hand.y); // 奥の腕
    const o = OUT();
    withBody(c.torso, () => {
      ctx.fillStyle = o.shirt; rr(0, 0, 0.16, 0.32, 0.12); ctx.fill(); ctx.stroke();
      if (o.apron) { ctx.fillStyle = o.apron; rr(0.03, -0.08, 0.1, 0.18, 0.06); ctx.fill(); ctx.stroke(); } // エプロン
      if (o.stripe) { ctx.fillStyle = o.stripe; ctx.fillRect(0.06, -0.3, 0.035, 0.6); } // ジャージの線
      if (o.dots) { ctx.fillStyle = '#fff'; for (const [dx, dy] of [[-0.06, -0.15], [0.06, 0], [-0.05, 0.15], [0.08, -0.22], [0.07, 0.2]]) { ctx.beginPath(); ctx.arc(dx, dy, 0.025, 0, Math.PI * 2); ctx.fill(); } }
      if (o.id === 'prince') { ctx.fillStyle = '#ffd23a'; ctx.fillRect(-0.16, 0.05, 0.32, 0.05); } // 金のベルト
    });
    // おぼん
    withBody(c.tray, () => {
      ctx.fillStyle = wear.tray ? wear.tray.color : '#b07a4a'; rr(0, 0, 0.34, 0.03, 0.02); ctx.fill(); ctx.stroke();
      rr(-0.325, 0.05, 0.022, 0.05, 0.01); ctx.fill(); ctx.stroke();
      rr(0.325, 0.05, 0.022, 0.05, 0.01); ctx.fill(); ctx.stroke();
      if (!c.pudding) drawPudding(0, 0.125, true);
    });
    const sh2 = c.torso.getWorldPoint(planck.Vec2(0.04, 0.18));
    arm(sh2.x, sh2.y, hand2.x, hand2.y); // 手前の腕
    drawLeg(c.R, 'R');
    // 頭
    const tilt = c.torso.getAngle();
    const panic = Math.min(1, Math.abs(c.torso.getAngularVelocity()) * 0.6 + Math.abs(tilt) * 1.5);
    withBody(c.head, () => {
      const sk = SK();
      if (sk.extra === 'ears') for (const ex of [-0.15, 0.1]) { ctx.fillStyle = sk.hair; ctx.beginPath(); ctx.arc(ex, -0.17, 0.07, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } // くまの耳
      ctx.fillStyle = sk.face; ctx.beginPath(); ctx.arc(0, 0, 0.21, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = sk.hair; // かみ
      ctx.beginPath(); ctx.arc(-0.02, -0.04, 0.215, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
      if (sk.extra === 'antenna') { ctx.beginPath(); ctx.moveTo(0, -0.2); ctx.lineTo(0.02, -0.33); ctx.stroke(); ctx.fillStyle = '#e8303a'; ctx.beginPath(); ctx.arc(0.02, -0.34, 0.035, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = sk.hair; }
      if (sk.extra === 'beak') { ctx.fillStyle = '#ffa31a'; ctx.beginPath(); ctx.moveTo(0.16, 0.03); ctx.lineTo(0.27, 0.06); ctx.lineTo(0.16, 0.09); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      if (sk.extra === 'shine') { const k = (Math.sin(performance.now() / 180) + 1) / 2; ctx.fillStyle = `rgba(255,255,255,${0.3 + k * 0.7})`; ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 0.015 : 0.05, a = i * Math.PI / 4; ctx.lineTo(-0.13 + Math.cos(a) * r, 0.05 + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#3b2a1e';
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
      drawHat(wear.hat ? wear.hat.id : o.hat);
    });
    if (c.pudding) withBody(c.pudding, () => drawPudding(0, 0, false));
  }

  // ぼうし（頭の座標。上がマイナス・前が＋x）
  function drawHat(hat) {
    if (!hat) return;
    ctx.lineWidth = 0.02; ctx.strokeStyle = '#3b2a1e';
    if (hat === 'crown') {
      ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(-0.13, -0.17); ctx.lineTo(-0.15, -0.33); ctx.lineTo(-0.07, -0.24); ctx.lineTo(0, -0.36); ctx.lineTo(0.07, -0.24); ctx.lineTo(0.15, -0.33); ctx.lineTo(0.13, -0.17); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (hat === 'hood') {
      ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(-0.02, -0.03, 0.245, Math.PI * 0.95, Math.PI * 2.02); ctx.lineTo(0.12, -0.1); ctx.quadraticCurveTo(-0.02, -0.2, -0.18, -0.02); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (hat === 'nightcap') {
      ctx.fillStyle = '#8ec5ff'; ctx.beginPath(); ctx.moveTo(-0.21, -0.07); ctx.quadraticCurveTo(0, -0.27, 0.19, -0.1); ctx.quadraticCurveTo(-0.05, -0.3, -0.36, -0.36); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-0.37, -0.36, 0.05, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (hat === 'band') {
      ctx.fillStyle = '#39405a'; ctx.fillRect(-0.21, -0.12, 0.42, 0.06); ctx.strokeRect(-0.21, -0.12, 0.42, 0.06);
      ctx.beginPath(); ctx.moveTo(-0.2, -0.1); ctx.lineTo(-0.36, -0.02 + Math.sin(performance.now() / 120) * 0.03); ctx.lineTo(-0.2, -0.07); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9ced8'; ctx.fillRect(0.03, -0.115, 0.08, 0.05);
    } else if (hat === 'straw') {
      ctx.fillStyle = '#f2d27a'; ctx.beginPath(); ctx.ellipse(-0.01, -0.16, 0.34, 0.06, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-0.01, -0.17, 0.17, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8303a'; ctx.fillRect(-0.17, -0.22, 0.34, 0.04);
    } else if (hat === 'catears') {
      for (const ex of [-0.12, 0.08]) { ctx.fillStyle = '#3b2a1e'; ctx.beginPath(); ctx.moveTo(ex - 0.07, -0.15); ctx.lineTo(ex, -0.32); ctx.lineTo(ex + 0.07, -0.15); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ff9ec7'; ctx.beginPath(); ctx.moveTo(ex - 0.035, -0.17); ctx.lineTo(ex, -0.26); ctx.lineTo(ex + 0.035, -0.17); ctx.closePath(); ctx.fill(); }
    } else if (hat === 'helmet') {
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-0.01, -0.05, 0.24, Math.PI * 1.0, Math.PI * 2.0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8303a'; ctx.fillRect(-0.04, -0.27, 0.06, 0.14); ctx.fillRect(-0.08, -0.23, 0.14, 0.06);
    } else if (hat === 'propeller') {
      ctx.fillStyle = '#4aa3ff'; ctx.beginPath(); ctx.arc(-0.01, -0.1, 0.18, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.01, -0.28); ctx.lineTo(-0.01, -0.36); ctx.stroke();
      const sp = Math.cos(performance.now() / (S.jump && S.jump.phase === 'air' ? 30 : 90)); ctx.fillStyle = '#ffd23a';
      ctx.beginPath(); ctx.ellipse(-0.01, -0.37, 0.2 * Math.abs(sp) + 0.02, 0.03, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (hat === 'halo') {
      ctx.strokeStyle = '#ffc61a'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.ellipse(-0.01, -0.36 + Math.sin(performance.now() / 300) * 0.02, 0.16, 0.045, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = '#3b2a1e';
    } else if (hat === 'chef') {
      ctx.fillStyle = '#fff'; ctx.fillRect(-0.14, -0.27, 0.27, 0.12); ctx.strokeRect(-0.14, -0.27, 0.27, 0.12);
      for (const [dx, r] of [[-0.1, 0.08], [0, 0.1], [0.1, 0.08]]) { ctx.beginPath(); ctx.arc(dx, -0.32, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.fillRect(-0.13, -0.3, 0.25, 0.1);
    }
  }
  // 運ぶもの（おぼんの上）。プリン以外は、きせかえで選んだもの
  function drawPudding(x, y, onTray) {
    const id = look ? look.carry.id : 'pudding';
    if (id === 'pudding' || id === 'goldpudding') return drawPurin(x, y, onTray, goldDay || id === 'goldpudding');
    if (onTray) { const target = (S.danger || 0) * 0.25 + (S.wobble || 0) * 0.15; jigV += (Math.sin(performance.now() / 45) * target - jig) * 0.3; jigV *= 0.7; jig += jigV; }
    const j = onTray ? jig : 0;
    ctx.save(); ctx.translate(x, -y + 0.1); ctx.transform(1, 0, -j * 1.2, 1, 0, 0); if (onTray) { ctx.scale(1.5, 1.5); ctx.lineWidth /= 1.5; } ctx.translate(0, -0.1);
    const C = (col) => { ctx.fillStyle = col; ctx.fill(); ctx.stroke(); };
    if (id === 'dango') {
      ctx.beginPath(); ctx.moveTo(-0.02, 0.1); ctx.lineTo(0.02, -0.24); ctx.lineWidth *= 0.8; ctx.strokeStyle = '#b07a4a'; ctx.stroke(); ctx.strokeStyle = '#3b2a1e';
      [['#ff9ec7', 0.04], ['#fff', -0.05], ['#8fd36b', -0.14]].forEach(([col, yy]) => { ctx.beginPath(); ctx.arc(0, yy, 0.055, 0, Math.PI * 2); C(col); });
    } else if (id === 'cake') {
      ctx.beginPath(); ctx.moveTo(-0.12, 0.1); ctx.lineTo(0.12, 0.1); ctx.lineTo(0.12, -0.06); ctx.lineTo(-0.12, -0.02); ctx.closePath(); C('#fff6e8');
      ctx.fillStyle = '#ffb3c7'; ctx.fillRect(-0.12, 0.02, 0.24, 0.025);
      ctx.beginPath(); ctx.arc(0.02, -0.08, 0.04, 0, Math.PI * 2); C('#e8303a');
    } else if (id === 'egg') {
      ctx.beginPath(); ctx.ellipse(0, 0.07, 0.16, 0.035, 0, 0, Math.PI * 2); C('#ffffff');
      ctx.beginPath(); ctx.ellipse(0.02, 0.04, 0.05, 0.035, 0, 0, Math.PI * 2); C('#ffb020');
    } else if (id === 'suika') {
      ctx.beginPath(); ctx.arc(0, 0.1, 0.17, Math.PI, 0); ctx.closePath(); C('#3f9a3a');
      ctx.beginPath(); ctx.arc(0, 0.1, 0.14, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#ff5a5a'; ctx.fill();
      ctx.fillStyle = '#3b2a1e'; for (const [dx, dy] of [[-0.07, 0.03], [0, -0.01], [0.07, 0.04], [-0.03, 0.07], [0.04, 0.07]]) { ctx.beginPath(); ctx.ellipse(dx, dy, 0.008, 0.014, 0, 0, Math.PI * 2); ctx.fill(); }
    } else if (id === 'goldfish') {
      ctx.beginPath(); ctx.arc(0, -0.02, 0.13, Math.PI * 1.75, Math.PI * 1.25); ctx.closePath(); C('rgba(160,215,255,.85)');
      const t = performance.now() / 300, fx = Math.sin(t) * 0.04;
      ctx.beginPath(); ctx.ellipse(fx, 0.01, 0.04, 0.025, 0, 0, Math.PI * 2); C('#ff7a2f');
      ctx.beginPath(); ctx.moveTo(fx - 0.035, 0.01); ctx.lineTo(fx - 0.075, -0.02); ctx.lineTo(fx - 0.075, 0.04); ctx.closePath(); C('#ff7a2f');
    }
    ctx.restore();
  }
  // プリン（ぷるぷる）。onTray のときはおぼんの上の位置（上向き座標）
  let jig = 0, jigV = 0;
  function drawPurin(x, y, onTray, gold) {
    if (onTray) {
      const target = (S.danger || 0) * 0.25 + (S.wobble || 0) * 0.15;
      jigV += (Math.sin(performance.now() / 45) * target - jig) * 0.3; jigV *= 0.7; jig += jigV;
    }
    const j = onTray ? jig : 0;
    ctx.save(); ctx.translate(x, -y + 0.1); ctx.transform(1, 0, -j * 1.2, 1, 0, 0); if (onTray) { ctx.translate(0, 0.0); ctx.scale(1.5, 1.5); ctx.lineWidth /= 1.5; } ctx.scale(1 + Math.abs(j) * 0.3, 1 - Math.abs(j) * 0.3); ctx.translate(0, -0.1);
    ctx.fillStyle = gold ? '#ffe85c' : '#ffd84d';
    ctx.beginPath(); ctx.moveTo(-0.13, 0.1); ctx.lineTo(0.13, 0.1); ctx.lineTo(0.09, -0.1); ctx.lineTo(-0.09, -0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = gold ? '#e0a800' : '#8a4b1f';
    ctx.beginPath(); ctx.moveTo(-0.095, -0.06); ctx.lineTo(0.095, -0.06); ctx.lineTo(0.09, -0.1); ctx.lineTo(-0.09, -0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-0.07, -0.02, 0.025, 0.08);
    if (gold) { // キラッ
      const k = (Math.sin(performance.now() / 200) + 1) / 2; ctx.fillStyle = `rgba(255,255,255,${0.4 + k * 0.6})`;
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 0.015 : 0.05, a = i * Math.PI / 4; ctx.lineTo(0.12 + Math.cos(a) * r, -0.12 + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    }
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

  // 次に押す足のボタンを光らせる（タイミングのバーは出さない）
  function updateGuide() {
    const R = S.rhythm, on = S.status === 'play' && R && S.char;
    if (!on) { ui.padL.classList.remove('next'); ui.padR.classList.remove('next'); return; }
    const air = S.jump && S.jump.phase !== 'none';
    const next = air ? null : R.lastSide === 'L' ? 'R' : R.lastSide === 'R' ? 'L' : null;
    ui.padL.classList.toggle('next', !air && next !== 'R');
    ui.padR.classList.toggle('next', !air && next !== 'L');
  }

  let lastTick = 0, spdShown = 0;
  let tutSteps = 0, tutDone = store.get('yoro.tut') === '1';
  function updateHud() {
    updateGuide();
    const st = S.steady == null ? 1 : S.steady;
    ui.balFill.style.width = `${Math.round(st * 100)}%`;
    ui.balFill.style.background = st < 0.35 ? '#ff4d4d' : st < 0.6 ? '#ffb020' : '#5cc96b';
    ui.meter2.classList.toggle('low', st < 0.35 && S.status === 'play');
    const v = S.char && S.status === 'play' ? Math.max(0, S.char.torso.getLinearVelocity().x) : 0;
    spdShown += (v - spdShown) * 0.1;
    ui.spd.textContent = `⚡${spdShown.toFixed(1)}m/秒`;
    ui.spd.classList.toggle('fast', spdShown > 2.3);
    const x = Math.max(0, game.charX());
    ui.dist.innerHTML = `${(runDist + Math.min(stage.goal, S.status === 'play' ? x : S.bestX)).toFixed(1)}<small>m</small>`; // ここまで歩いたきょり
    ui.prog.style.width = `${Math.round(Math.min(1, x / stage.goal) * 100)}%`; // おうちまでの線
    ui.finger.classList.toggle('show', !tutDone && level === 1 && S.status === 'play' && tutSteps < 6 && !ui.title.classList.contains('show') && !ui.pause.classList.contains('show'));
    const tl = Math.max(0, stage.timeLimit - elapsed);
    ui.timeN.textContent = tl < 10 ? tl.toFixed(1) : Math.ceil(tl);
    ui.time.classList.toggle('hurry', tl < 10 && S.status === 'play');
    if (S.status === 'play' && tl <= 5 && Math.ceil(tl) !== lastTick) { lastTick = Math.ceil(tl); snd.play('tick', lastTick); }
    const d = S.danger || 0;
    ui.meterFill.style.width = `${Math.round(d * 100)}%`;
    ui.meterFill.style.background = d > 0.7 ? '#ff4d4d' : d > 0.4 ? '#ffb020' : '#5cc96b';
    ui.meter.classList.toggle('danger', d > 0.7 && S.status === 'play');
    const now = S.status === 'play' ? runDist + Math.min(stage.goal, x) : 0; // ベストをこえたら、ベストの数字も一緒にふえる
    const bb = Math.floor(Math.max(curBest, now)); ui.best.innerHTML = bb > 0 ? `<svg class="ic"><use href="#i-flag"/></svg> ${bb}m` : '';
  }

  // ---- ループ ----
  let last = performance.now(), acc = 0;
  if (bestRun > 0 && !RANK.list().some((r) => r.d >= bestRun - 0.05)) RANK.add(bestRun); // 前からの自己ベストも記録ランキングに入れる
  bestRun = Math.max(bestRun, ...RANK.list().map((r) => r.d)); // 記録ランキングの1位と自己ベストをそろえる
  curBest = bestRun; look = CL.current(ctxNow());
  loadLevel(1); refreshTitle();
  game.spawn(0);
  function frame(now) {
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    const paused = ui.title.classList.contains('show') || ui.pause.classList.contains('show');
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
          if (ev.type === 'combo') pop(`ナイスリズム ×${ev.v} スピードUP！`, '#2f9e44');
          if (ev.type === 'jump2') pop('2だんジャンプ！', '#2f6fd6');
          if (ev.type === 'step') { addPrint(ev.v); if (++tutSteps === 6 && !tutDone) { tutDone = true; store.set('yoro.tut', '1'); } }
        }
      }
      if (level <= 10 && S.status === 'play') { // 最初のうちは、しかけの手前でやり方を出す
        const x = game.charX();
        stage.springs.forEach((q, i) => {
          if (!hinted.has('s' + i) && q.x - x < 2.6 && q.x - x > 0) { hinted.add('s' + i); showBanner('赤い台に乗ると<br>ピョーンと飛ぶよ！'); hintTimer = setTimeout(() => { ui.hint.style.opacity = 0; }, 2500); }
        });
        stage.pits.forEach((q, i) => {
          if (!hinted.has('p' + i) && q.x0 - x < 2.8 && q.x0 - x > 0) { hinted.add('p' + i); showBanner('穴だ！ 左右を同時にタップ！<br>とどかなければ 空中でもう1回！'); hintTimer = setTimeout(() => { ui.hint.style.opacity = 0; }, 2500); }
        });
        if (level <= 6) stage.obstacles.forEach((o, i) => {
          if (!hinted.has(i) && o.x - x < 2.6 && o.x - x > 0) {
            hinted.add(i); showBanner('左右を 同時にタップで ジャンプ！<br>長く押すと 高く飛ぶよ'); hintTimer = setTimeout(() => { ui.hint.style.opacity = 0; }, 3000);
          }
        });
      }
      if (S.status === 'play') { // 歩いたきょりの節目と、自己ベストをこえた瞬間
        const tot = runDist + Math.max(0, game.charX());
        if (!passedBest && curBest > 0 && tot > curBest) { passedBest = true; pop(mode === 'daily' ? '今日のベスト こえた！' : '自己ベスト こえた！', '#d48a00'); snd.play('best'); }
        if (tot >= nextMile) { pop(`${nextMile}m とっぱ！`, '#2f6fd6'); snd.play('checkpoint'); nextMile += 50; }
      }
      if (S.status === 'clear') deliver();
      if (S.status === 'play') pickupBoxes();
      if (S.status === 'fallen' && S.frame - S.fallFrame > 36) {
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
    drawPrints();
    drawBoxes();
    drawWind();
    drawSpeedLines();
    drawChar();
    drawCharge();
    drawPops();
    updateHud();
    if (S.char && !ui.title.classList.contains('show')) {
      if (S.status === 'fallen') CLIP.stopAfter(1400, now); // 転んだあと少しだけ取って止める
      const tp = S.char.torso.getPosition(); const [px, py] = W2S(tp.x, tp.y);
      CLIP.capture(canvas, px, py, W, H, DPR, now);
    }
    const shownFace = ui.fail.classList.contains('show') ? ui.failFace : null;
    if (shownFace) {
      const fc = shownFace.getContext('2d'); fc.clearRect(0, 0, 240, 240);
      WT.drawFace(fc, waiter, faceNow, 120, 132, 82, (performance.now() - faceT0) / 1000);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // テスト用（自動操作で動作確認するため）
  window.__yoro = { get game() { return game; }, get boxes() { return boxes; }, get mode() { return mode; }, force, openCloset, closeCloset, openGacha, closeGacha, GA, start, retry, restart, next, loadLevel, pause, resume, openZukan, closeZukan };
})();
