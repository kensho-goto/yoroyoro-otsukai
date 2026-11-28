// ヨロヨロおつかい — 画面の描画と操作
(function () {
  const canvas = document.getElementById('c');
  let ctx = canvas.getContext('2d'); // ころび芸で主人公の写しを取るとき、いっとき別の紙にかく
  const $ = (id) => document.getElementById(id);
  const ui = {
    dist: $('dist'), time: $('time'), timeN: $('timeN'), best: $('best'), hint: $('hint'), prog: $('progFill'), finger: $('finger'),
    padL: $('padL'), padR: $('padR'),
    title: $('title'), fail: $('fail'), pause: $('pause'), goal: $('goal'), retry: $('retryBtn'),
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
  const IC = window.YoroIcon;
  const snd = window.YoroSound || { play() {}, bgm() {}, mood() {}, on: false, toggle() { return false; } };
  const ZK = window.YoroZukan || { mark: () => false, has: () => false, count: () => ({ got: 0, total: 0 }), pickTreasure: () => null, rareOf: () => false, render() {}, FALLS: [], MOOD_NAMES: {} };
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
  // この回で起きたこと（ずかんに新しく入ったもの・拾ったおたから・金のプリンの日・テスト用の強制）
  let runNew = [], runTreasure = 0, runMedals = 0, goldDay = false, boxes = [];
  const force = {}; // テスト用：{ rare, wind, gold }
  const CL = window.YoroCloset, DY = window.YoroDays;
  const GA = window.YoroGacha || { COST: 5, medals: 0, addMedals() {}, canPull: () => false, worn: () => ({}), effects: () => ({ jump: 1, wind: 1, speed: 0, balance: 1, pudding: 1 }), ITEMS: [], RARITY: {}, SLOTS: {}, count: () => ({ got: 0, total: 0 }), has: () => false, renderEquip() {} };
  // ミッション（ステージごとの小さなお題）。mis＝このステージのお題・mst＝この道で数えたもの
  const MI = window.YoroMissions || { pick: () => [], update: () => [], finish: () => 0, progress: () => '', done: () => 0, kinds: () => ({ seen: 0, total: 0 }) };
  let mis = [], mst = {};
  let wear = GA.worn(); // ガチャで出て、身につけているもの（くつ・ぼうし・おぼん・すがた）
  // おたからのメダル：めずらしいほど多い
  const medalOf = (t) => (t.w >= 12 ? 1 : t.w >= 5 ? 2 : t.w >= 2 ? 3 : 5);
  const CLIP = window.YoroClip || { capture() {}, reset() {}, stopAfter() {}, ready: () => false, make: async () => null };
  let mode = 'free', look = null, curBest = 0, unlockAtStart = []; // free＝いつものコース／daily＝今日のコース・見た目・この回のベスト・はじめに使えたもの
  const ctxNow = () => { const st = CL.stats(); return { total: st.total, runs: st.runs, best: bestRun, zukan: ZK.count().got, streak: DY.streak().n, has: ZK.has }; };
  const itemName = () => (look ? look.carry.name : jaen('プリン', 'pudding'));
  const titleCase = (n) => n.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  const tr = (t) => (!YL.en ? (itemName().includes('プリン') ? t : t.replace(/プリン/g, itemName())) // 文の「プリン」を運んでいるものの名前に
    : YL.zh ? (itemName().includes('布丁') ? t : t.replace(/布丁/g, itemName()))
    : /pudding/i.test(itemName()) ? t : t.replace(/pudding/g, itemName()).replace(/Pudding/g, titleCase(itemName())));
  const JF = YL.zh ? '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif' : '"Hiragino Sans", sans-serif'; // 絵の中の字
  const NF = YL.zh ? '"ZCOOL QingKe HuangYou", "PingFang SC", "Microsoft YaHei", sans-serif' : '"Dela Gothic One", "Hiragino Sans", sans-serif'; // 芸の大きな字
  const poss = (n) => (YL.zh ? n : /s$/i.test(n) ? `${n}'` : `${n}'s`); // 英語の「〜の」（中国語は名前のまま）
  function noteNew(isNew, text) { if (isNew) runNew.push(text); return isNew; }

  // ---- 記録 ----
  const store = {
    get(k) { return YS.get(k); }, // 保存先は src/save.js
    set(k, v) { YS.set(k, v); },
  };
  let runDist = 0; // 届けたおうちまでのきょりの合計（今の道の分は入れない）
  let bestRun = Math.max(0, parseFloat(store.get('yoro.bestRun')) || 0); // 歩いたきょりの自己ベスト（きせかえの条件に使う）
  // ステージ：おうちに着くと GOAL → 次のステージ。転んだら同じステージから。どこまでも続く
  let stageNow = Math.max(1, parseInt(store.get('yoro.stage'), 10) || 1);
  let stageClears = Math.max(0, parseInt(store.get('yoro.clears'), 10) || 0);
  const dailyStage = () => { const b = DY.daily().best; return Number.isInteger(b) ? b + 1 : 1; }; // 今日のコースは、今日いちばん先にクリアしたステージの次から
  let prevWaiter = null, delivered = null, worldOff = 0; // 前のおうちの人・届けたときのひとこと・背景をつなぐためのずれ
  function loadLevel(n, carry) {
    const old = carry ? { goal: stage.goal, gy: game.groundHeightAt(stage.goal) } : null;
    level = n; snd.mood(Math.floor((n - 1) / 3)); // 空の色（themeOf）と同じ区切りで曲の雰囲気を変える
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
    ui.meterLabel.textContent = jaen(`${n}軒目`, `House ${n}`, `第${n}户`);
    parts.length = 0; shakeA = 0;
    hinted = new Set();
    prevWaiter = n > 1 ? (carry ? waiter : WT.forLevel(n - 1)) : null;
    const rare = n >= 2 && (force.rare != null ? force.rare : R() < 0.05); // ごくたまに、めずらしいお客さん
    waiter = force.who ? [...WT.WAITERS, ...WT.RARE].find((w) => w.id === force.who) : rare ? WT.RARE[Math.floor(R() * WT.RARE.length)] : WT.forLevel(n); faceNow = 'wait';
    // たまに風がふく（3軒目から）
    pickCarryFor(n, R);
    const windy = n >= 3 && (force.wind != null ? force.wind !== 0 : R() < 0.15);
    S.wind = (windy ? (force.wind || (R() < 0.5 ? -4 : 4)) : 0) * S.fx.wind;
    S.tuning.accGain *= look.carry.shake || 1; // 運ぶものによって、ぐらぐらのたまりやすさが少しちがう
    makeBoxes(R);
    mst = { boxes: 0, high: 0, jumps: 0, jump2: 0, boing: 0, combo: 0, stumble: 0, wobble: 0, stop: 0, shaky: 0, fast: 0, oops: 0, time: 0 };
    mis = MI.pick(misCtx());
    paintMis();
    let msg = YL.zh
      ? (n === 1 ? `把布丁<br>送到${waiter.name}那里！`
        : n === 3 ? `下一站：${waiter.name}家<br>左右同时按就能跳`
        : `下一站：${waiter.name}家`)
      : YL.en
      ? (n === 1 ? `Deliver the pudding<br>to ${waiter.name}!`
        : n === 3 ? `Next: ${poss(waiter.name)} house<br>Tap both sides to jump`
        : `Next: ${poss(waiter.name)} house`)
      : (n === 1 ? `${waiter.name}に<br>プリンを とどけよう`
        : n === 3 ? `つぎは ${waiter.name}の家<br>左右同時で ジャンプ`
        : `つぎは ${waiter.name}の家`);
    if (rare) { msg = jaen(`えっ！？ つぎは<br><b>${waiter.name}</b>の家！？`, `Whoa?! Next up is<br><b>${poss(waiter.name)}</b> house?!`, `咦？！下一站是<br><b>${waiter.name}</b>家？！`); noteNew(ZK.mark('event', 'rare'), jaen('できごと「めずらしい お客さん」', 'Event: Rare visitor')); }
    if (S.wind) { const head = S.wind < 0; msg = `${head ? jaen('向かい風だ！', 'Headwind!') : jaen('追い風だ！', 'Tailwind!')}<br>${msg.split('<br>')[0]}`; noteNew(ZK.mark('event', head ? 'headwind' : 'tailwind'), jaen(`できごと「${head ? '向かい風' : '追い風'}」`, `Event: ${head ? 'Headwind' : 'Tailwind'}`, `事件：${head ? '逆风' : '顺风'}`)); }
    if (n === 1 && goldDay) msg = jaen('きょうは<br><b>金のプリンの日！</b>', "It's<br><b>Golden Pudding Day!</b>");
    if (n === 1 && mode === 'daily') msg = jaen(`きょうのコース<br>${DY.label()}`, `Daily Course<br>${DY.label()}`, `每日挑战<br>${DY.label()}`);
    if (!(n === 1 && mode !== 'daily' && (goldDay || look.carry.id === 'pudding'))) msg += `<br><span class="hc">${IC.html(look.carry.icon)}${look.carry.name}${look.carry.bonus ? `<i class="cb"><span class="coin"></span>+${look.carry.bonus}</i>` : ''}${carryFirst ? jaen(' はじめて！', ' First time!') : ''}</span>`;
    if (mis.length) msg += `<small class="hm">${mis.some((m) => m.isNew) ? '<i>NEW</i> ' : ''}${jaen('ミッション', 'Mission')}：${mis.map((m) => m.text).join(jaen('・', ' · '))}</small>`;
    showBanner(tr(msg));
    if (n > 1 && (rare || S.wind)) { snd.play(S.wind ? 'gust' : 'event'); hintTimer = setTimeout(() => { ui.hint.style.opacity = 0; }, 3000); }
  }
  // 道のおたから（？の箱）。歩くだけでは取れない。ふつうの箱はジャンプで、高い箱（むらさき）はためたジャンプで取る
  //   高さは tools/box-reach.js で決めた（歩くだけで取れてしまうのは、リズムが大きく乱れて体がはねたときの 1〜2% だけ）
  const BOX_Y = 2.55, BOX_HIGH_Y = 2.95;
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
        boxes.push({ x, y: game.groundHeightAt(x) + (high ? BOX_HIGH_Y : BOX_Y), high, taken: 0, item: null });
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
      b.taken = performance.now(); b.item = t; runTreasure++; sparkle(b.x, b.y, 12);
      mst.boxes++; if (b.high) mst.high++;
      const isNew = noteNew(ZK.mark('treasure', t.id), jaen(`おたから「${t.name}」`, `Treasure: ${t.name}`, `宝物：${t.name}`));
      const m = medalOf(t), could = GA.canPull(); GA.addMedals(m); runMedals += m;
      pop(`${t.name} +${m}${isNew ? jaen(' NEW！', ' NEW!') : ''}`, isNew ? '#d48a00' : '#7a4ad6');
      if (!could && GA.canPull()) setTimeout(() => pop(jaen('ガチャが回せる！', 'Gacha ready!'), '#e8a600'), 450);
      paintMedal(true);
      snd.play('treasure', ZK.rareOf(t));
    }
  }
  // ---- 運ぶもの：届け先の人が毎回ランダムで頼む（服は自分で選ぶ）。同じステージのやり直しは同じもの ----
  let carryFirst = false;
  function pickCarryFor(n, R) {
    const cx = ctxNow(), base = CL.current(cx);
    let item;
    if (goldDay) item = CL.CARRY.find((x) => x.id === 'goldpudding');
    else if (n === 1 && stageClears === 0) item = CL.CARRY[0]; // いちばんはじめはプリン
    else if (force.carry) item = CL.CARRY.find((x) => x.id === force.carry);
    else {
      let saved = null; try { saved = JSON.parse(store.get('yoro.carryNow') || 'null'); } catch (e) { /* なくてよい */ }
      const keep = mode === 'free' && saved && saved.stage === n && CL.CARRY.find((x) => x.id === saved.id && CL.ok(x, cx));
      item = keep || CL.pickCarry(cx, waiter.id, mode === 'daily' ? DY.rng(n + 500) : R, look && look.carry.id);
      if (mode === 'free') store.set('yoro.carryNow', JSON.stringify({ stage: n, id: item.id }));
    }
    carryFirst = !(CL.delivered()[item.id] > 0) && item.id !== 'pudding';
    look = { carry: item || CL.CARRY[0], outfit: base.outfit };
  }
  // ---- ミッション ----
  function misCtx() { return { level, boxes: boxes.length, high: boxes.filter((b) => b.high).length, springs: stage.springs.length, timeLimit: stage.timeLimit, seed: mode === 'daily' ? DY.seed() : 0 }; }
  function paintMis() {
    const el = $('mis'); if (!el) return;
    document.body.dataset.mis = mis.length; // 札が多いときは、左のメーターを下へずらす
    el.innerHTML = mis.map((m) => {
      const pr = m.state === 'go' ? MI.progress(m, mst) : '';
      return `<span class="mi ${m.state}"><b>${m.state === 'ok' ? '✓' : m.state === 'ng' ? '✕' : ''}</b>${tr(m.text)}${pr ? ` <em>${pr}</em>` : ''}</span>`;
    }).join('');
  }
  let misShown = '';
  function tickMis() {
    if (!mis.length || S.status !== 'play') return;
    mst.time = elapsed; mst.oops = mst.stumble + mst.wobble + mst.stop;
    for (const m of MI.update(mis, mst, misCtx())) {
      if (m.state === 'ok') { pop(jaen(`ミッション達成！ +${m.medal}`, `Mission done! +${m.medal}`, `任务完成！+${m.medal}`), '#d48a00'); snd.play('best'); }
      else pop(jaen('ミッション しっぱい…', 'Mission failed…'), '#7a8796');
    }
    const key = mis.map((m) => m.state + MI.progress(m, mst)).join();
    if (key !== misShown) { misShown = key; paintMis(); }
  }
  function showBanner(html) {
    ui.hint.innerHTML = html; ui.hint.style.opacity = 1;
    clearTimeout(hintTimer); hintTimer = null;
  }

  // ---- 画面サイズ ----
  let W = 0, H = 0, DPR = 1, scale = 60, baseScale = 60, zoom = 1; // zoom＝ころび芸のときに寄る
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    // 横長の画面は高さが足りないので少し引く（頭の上の ？の箱 が、上の残り時間・お題の札にかからないように）
    baseScale = Math.max(48, Math.min(H / (W > H ? 5.0 : 4.4), W / 4.6)); scale = baseScale * zoom;
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
  // パソコン（マウス）ではキーの絵、タッチしたら大きな足ボタン。最後に使った方に合わせて切りかえる
  const setKb = (on) => document.body.classList.toggle('kb', on);
  try { setKb(matchMedia('(hover: hover) and (pointer: fine)').matches); } catch (e) { /* 古いブラウザは足ボタンのまま */ }
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') setKb(false);
    if (gag && !shownEnd && gag.t > 1.0) gag.skip = true; // ころび芸は、とちゅうでタップすると とばせる
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
    if (LK.includes(e.code) || RK.includes(e.code)) setKb(true);
    if (LK.includes(e.code)) keys.left = true;
    else if (RK.includes(e.code)) keys.right = true;
    else if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
      if (gachaEl.classList.contains('show')) closeGacha();
      else if (zukanEl.classList.contains('show')) closeZukan();
      else if (closetEl.classList.contains('show')) closeCloset();
      else if (ui.goal.classList.contains('show')) goNext();
      else if (ui.title.classList.contains('show')) start();
      else if (ui.fail.classList.contains('show') && !ui.retry.disabled && !vidBusy) afterAd(() => restart());
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
    for (const o of [ui.title, ui.fail, ui.pause, ui.goal]) o.classList.toggle('show', o === el);
    document.body.classList.toggle('menu', el === ui.title || el === ui.fail || el === ui.goal);
    if (window.YP) { if (el) YP.stop(); else YP.start(); } // ゲームサイトに「遊んでいる／止まった」を知らせる
  }
  // ゲームサイトでは「もう一回」「つぎへ」の前に区切りの広告（出るかはサイトが決める）。ふつうの公開版ではすぐ進む
  let adWait = false;
  function afterAd(fn) {
    if (!window.YP || !YP.active) { fn(); return; }
    if (adWait) return;
    adWait = true; snd.bgm(false);
    YP.breakAd(() => { adWait = false; fn(); });
  }
  function start() { restart('free'); }
  // ゲームオーバーのあとは、いつも最初（おかしや）から
  let passedBest = false, nextMile = 50, lastShare = ''; // この回で自己ベストをこえたか・次の節目のきょり・送る文
  function restart(m) {
    if (m === 'free' || m === 'daily') mode = m;
    runNew = []; runTreasure = 0; runMedals = 0; wear = GA.worn(); paintMedal();
    const cx = ctxNow(); look = CL.current(cx); unlockAtStart = CL.unlockedIds(cx);
    curBest = 0; // きょりのベストの旗は出さない（ステージ制）
    CLIP.reset();
    goldDay = force.gold != null ? !!force.gold : (mode === 'daily' ? DY.rng(0)() : Math.random()) < 0.03; // ごくたまに「金のプリンの日」
    if (goldDay) noteNew(ZK.mark('event', 'goldday'), jaen('できごと「金のプリンの日」', 'Event: Golden Pudding Day'));
    tutSteps = 0; loadLevel(mode === 'daily' ? dailyStage() : stageNow); pops.length = 0; elapsed = 0; runDist = 0; passedBest = false; nextMile = 50; game.spawn(0); showOnly(null); snd.play(goldDay ? 'event' : 'start'); snd.bgm(true);
  }
  const retry = () => restart();
  // 届け先の人の声（言葉ではなく「ごにょごにょ」。人ごとに高さ・くせが変わる）
  const VOICE = { mom: 330, grandma: [290, 1], grandpa: 150, dad: 125, sister: 560, brother: 470, aunt: 360, uncle: 165, friend: 420, teacher: 380,
    cat: 'cat', dog: 'dog', king: 115, ghost: 'ghost', alien: [520, 'alien'] };
  function speak(who, mood, text, delay = 0) {
    const v = VOICE[who.id] || 300, a = Array.isArray(v) ? v : [v];
    const kind = typeof a[0] === 'string' ? a[0] : a[1] === 'alien' ? 'alien' : 'human';
    snd.play('voice', { pitch: typeof a[0] === 'number' ? a[0] : 0, shaky: a[1] === 1, kind, mood, len: YL.latin ? Math.ceil((text || '').length / 2.5) : (text || '').length, delay });
  }
  // おうちに着いた：GOAL！ タップで次のステージへ
  let goalSay = '', goalAt = 0;
  function deliver() {
    goalSay = WT.happy(waiter, itemName()).say;
    noteNew(ZK.mark('face', `${waiter.id}.happy`), jaen(`${waiter.name}の「にっこり」顔`, `${poss(waiter.name)} happy face`, `${waiter.name}的「开心」表情`));
    faceNow = 'happy'; faceT0 = performance.now();
    snd.play('clear'); snd.bgm(false); confetti(); speak(waiter, 'happy', goalSay, 1.1); // ファンファーレのあとに よろこぶ声
    fails = 0;
    const misMedal = MI.finish(mis); paintMis();
    const cBonus = look.carry.bonus || 0; CL.addDelivered(look.carry.id);
    if (misMedal + cBonus) { GA.addMedals(misMedal + cBonus); runMedals += misMedal + cBonus; paintMedal(true); }
    const gmi = $('goalMis');
    if (gmi) { gmi.hidden = !mis.length && !cBonus; gmi.innerHTML = (cBonus ? `<span class="mi ok"><b>✓</b>${jaen(`${look.carry.name}を とどけた`, `Delivered the ${look.carry.name}`, `送到了${look.carry.name}`)} <i>+${cBonus}</i></span>` : '') + mis.map((m) => `<span class="mi ${m.state}"><b>${m.state === 'ok' ? '✓' : '✕'}</b>${tr(m.text)}${m.state === 'ok' ? ` <i>+${m.medal}</i>` : ''}</span>`).join(''); }
    runDist += stage.goal;
    CL.addRun(stage.goal);
    if (mode === 'daily') DY.addDaily(level);
    else { if (level + 1 > stageNow && window.YP) YP.happy(); stageNow = level + 1; store.set('yoro.stage', String(stageNow)); } // はじめてのクリアはサイトに「よろこびの場面」を知らせる
    stageClears++; store.set('yoro.clears', String(stageClears));
    $('goalTag').textContent = jaen(`ステージ ${level} クリア`, `Stage ${level} Clear!`, `第${level}关 通过！`);
    $('goalLine').textContent = goalSay;
    const gn = $('goalNew'); gn.innerHTML = jaen(`<b>NEW</b> ずかん ${ZK.count().got}/${ZK.count().total}`, `<b>NEW</b> Album ${ZK.count().got}/${ZK.count().total}`, `<b>NEW</b> 图鉴 ${ZK.count().got}/${ZK.count().total}`); gn.hidden = !runNew.length;
    const gm = $('goalMedal'); gm.innerHTML = `<span class="coin"></span>+${runMedals}`; gm.hidden = !runMedals;
    $('nextBtn').innerHTML = jaen(`つぎへ<small>ステージ ${level + 1}</small>`, `Next<small>Stage ${level + 1}</small>`, `下一关<small>第${level + 1}关</small>`);
    goalAt = performance.now();
    refreshTitle();
    showOnly(ui.goal);
    if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
  }
  function nextStage() {
    if (performance.now() - goalAt < 700) return; // 歩いていた指でうっかり押さないように
    const was = waiter;
    runNew = []; runMedals = 0;
    loadLevel(level + 1);
    prevWaiter = was;
    game.spawn(0);
    elapsed = 0; lastTick = 0; pops.length = 0;
    delivered = { say: goalSay, t0: performance.now() };
    showOnly(null); snd.play('start'); snd.bgm(true);
  }
  const goNext = () => { if (performance.now() - goalAt >= 700) afterAd(nextStage); };
  $('nextBtn').onclick = goNext;
  ui.goal.addEventListener('click', (e) => { if (!e.target.closest('button')) goNext(); });
  $('startBtn').onclick = () => start();
  $('dailyBtn').onclick = () => restart('daily');
  $('retryBtn').onclick = () => afterAd(() => restart());
  // ゲームオーバーの画面は、ボタン以外のどこをタップしても すぐもう一回（動画を作っているあいだは待つ）
  ui.fail.addEventListener('click', (e) => { if (!e.target.closest('button, a, summary') && !ui.retry.disabled && !vidBusy) afterAd(() => restart()); });
  // 転んだ動画：1回目のタップで作る → できたら、もう1回のタップで送る（スマホは送るときにタップが要る）
  let vidFile = null, vidBusy = false, clipInfo = null;
  const vidBtn = $('vidBtn'), vidLabel = vidBtn.querySelector('b');
  function resetVid() { vidFile = null; vidBusy = false; vidBtn.disabled = false; vidLabel.textContent = jaen('動画', 'Video'); }
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
    vidBusy = true; vidBtn.disabled = true; vidLabel.textContent = jaen('つくり中', 'Making…');
    try { vidFile = await CLIP.make(clipInfo, (p) => { vidLabel.textContent = `${Math.round(p * 100)}%`; }); } catch (e) { vidFile = null; }
    vidBusy = false; vidBtn.disabled = false;
    vidLabel.textContent = !vidFile ? jaen('つくれない', "Can't make") : jaen('動画を送る', 'Send video');
  };
  // きせかえ
  const closetEl = $('closet');
  function openCloset() {
    CL.render($('closetBody'), ctxNow(), () => { look = { carry: look.carry, outfit: CL.current(ctxNow()).outfit }; snd.play('tap'); });
    GA.renderEquip($('closetGacha'), () => { wear = GA.worn(); snd.play('tap'); });
    closetEl.classList.add('show'); closetEl.querySelector('.card').scrollTop = 0; snd.play('tap'); }
  function closeCloset() { closetEl.classList.remove('show'); look = { carry: look.carry, outfit: CL.current(ctxNow()).outfit }; wear = GA.worn(); }
  $('closetBtn').onclick = openCloset;
  $('closetClose').onclick = closeCloset;
  closetEl.addEventListener('click', (e) => { if (e.target === closetEl) closeCloset(); });
  // ガチャ：おたからのメダル🪙を5枚つかって1回。くつ・ぼうし・おぼん・すがたが出る
  const gachaEl = $('gacha'), gPull = $('gPull'), gMachine = $('gMachine');
  let gBusy = false;
  function paintGacha() {
    const c = GA.count();
    $('gMedals').innerHTML = jaen(`<span class="coin"></span> ${GA.medals}枚${GA.canPull() ? '' : `（あと ${GA.COST - GA.medals}枚）`}`,
      `<span class="coin"></span> ${GA.medals}${GA.canPull() ? '' : ` (need ${GA.COST - GA.medals} more)`}`, `<span class="coin"></span> ${GA.medals}枚${GA.canPull() ? "" : `（还差${GA.COST - GA.medals}枚）`}`);
    gPull.disabled = gBusy || !GA.canPull();
    gPull.textContent = GA.canPull() || gBusy ? jaen('回す', 'Spin!') : jaen('メダルが たりない', 'Not enough medals');
    $('gCount').textContent = `${c.got} / ${c.total}`;
    $('gAll').innerHTML = GA.ITEMS.map((i) => (GA.has(i.id) ? `<span title="${i.name}">${IC.html(i.icon)}</span>` : '<span class="no">？</span>')).join('');
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
      $('gResult').innerHTML = `<div class="gres${it.r === 'SSR' ? ' ssr' : ''}"><span class="rr" style="color:${rr.color}">★ ${rr.name} ★</span><b>${IC.html(it.icon)}</b>`
        + `<span class="nm">${it.name}</span>${jaen(`（${GA.SLOTS[it.slot]}）`, ` (${GA.SLOTS[it.slot]})`, `（${GA.SLOTS[it.slot]}）`)}<br>${it.say ? `<span class="fx">${it.say}</span><br>` : ''}`
        + (res.isNew ? jaen('<span class="nw">NEW！ 身につけたよ</span>', '<span class="nw">NEW! Now wearing it</span>')
          : jaen(`ダブり… メダル${res.back}枚 もどった`, `Already have it… got ${res.back} medal${res.back === 1 ? '' : 's'} back`, `重复了…退回${res.back}枚奖牌`)) + '</div>';
      if (res.isNew) noteNew(true, jaen(`ガチャ「${it.name}」`, `Gacha: ${it.name}`, `扭蛋：${it.name}`));
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
    const url = window.YP && YP.active ? '' : location.origin + location.pathname; // ゲームサイトでは よそのURLを付けない
    try {
      if (navigator.share) { await navigator.share(url ? { title: jaen('ヨロヨロおつかい', 'Yoroyoro Errand'), text: lastShare, url } : { title: jaen('ヨロヨロおつかい', 'Yoroyoro Errand'), text: lastShare }); return; }
      await navigator.clipboard.writeText(url ? `${lastShare}\n${url}` : lastShare);
      $('shareBtn').querySelector('b').textContent = jaen('コピーした', 'Copied!');
      setTimeout(() => { $('shareBtn').querySelector('b').textContent = jaen('送る', 'Share'); }, 1800);
    } catch (e) { /* やめた・使えないときは何もしない */ }
  };
  const sndBtn = $('sndBtn');
  const paintSnd = () => { sndBtn.innerHTML = `<svg class="ic"><use href="#${snd.on ? 'i-snd' : 'i-mute'}"/></svg>`; sndBtn.setAttribute('aria-label', snd.on ? jaen('音をけす', 'Mute') : jaen('音を出す', 'Sound on')); };
  sndBtn.onclick = () => { snd.toggle(); paintSnd(); snd.play('tap'); };
  paintSnd();
  function refreshTitle() {
    $('bestRun').hidden = true;
    $('startBtn').innerHTML = jaen(`あるく<small>ステージ ${stageNow}</small>`, `Play<small>Stage ${stageNow}</small>`, `出发<small>第${stageNow}关</small>`);
    const sk = DY.streak(), dd = DY.daily();
    $('streak').innerHTML = sk.n > 0 ? `<svg class="ic"><use href="#i-flame"/></svg> ${jaen(`${sk.n}日れんぞく`, `${sk.n}-day streak`, `连续${sk.n}天`)}` : '';
    $('dailyBtn').innerHTML = jaen(`きょうのコース<small>${DY.label()}・ステージ ${dailyStage()}</small>`, `Daily Course<small>${DY.label()} · Stage ${dailyStage()}</small>`, `每日挑战<small>${DY.label()} · 第${dailyStage()}关</small>`);
    $('titleMedal').textContent = GA.medals;
    $('titleGachaBtn').classList.toggle('ready', GA.canPull());
    paintMedal();
    showTitleRank();
  }
  // きろく・あそびかた（タイトルのすみの絵のボタン）
  for (const [btn, el, cl] of [['rankBtn', 'records', 'recordsClose'], ['howBtn', 'howto', 'howtoClose']]) {
    const o = $(el);
    $(btn).onclick = () => { if (el === 'records') paintRecords(); o.classList.add('show'); snd.play('tap'); };
    $(cl).onclick = () => o.classList.remove('show');
    o.addEventListener('click', (e) => { if (e.target === o) o.classList.remove('show'); });
  }
  // ことばの切りかえ（あそびかたの中のボタン）
  const lbs = document.getElementById('langBtns');
  if (lbs) {
    lbs.innerHTML = YL.LANGS.map((l) => `<button class="btn sub${l === YL.lang ? ' on' : ''}" type="button" data-l="${l}">${YL.NAMES[l]}</button>`).join('');
    lbs.querySelectorAll('button').forEach((b) => { b.onclick = () => YL.set(b.dataset.l); });
  }
  function paintRecords() {
    const st = CL.stats();
    $('recBody').innerHTML = (YL.zh
      ? [['现在的关卡', stageNow], ['通关次数', `${stageClears}次`], ['完成的任务', `${MI.done()}个`], ['走过的总距离', `${Math.floor(st.total || 0)}m`], ['每日挑战', `第${dailyStage()}关`]]
      : YL.en
      ? [['Current stage', stageNow], ['Stages cleared', `${stageClears}`], ['Missions done', `${MI.done()}`], ['Total distance walked', `${Math.floor(st.total || 0)}m`], ['Daily Course', `Stage ${dailyStage()}`]]
      : [['いまのステージ', stageNow], ['クリアした回数', `${stageClears}回`], ['ミッション達成', `${MI.done()}回`], ['歩いたきょり（合計）', `${Math.floor(st.total || 0)}m`], ['きょうのコース', `ステージ ${dailyStage()}`]])
      .map(([k, v]) => `<div class="rec"><span>${k}</span><b>${v}</b></div>`).join('');
  }
  // タイトルに、じぶんの記録の上位を出す
  function showTitleRank() { RANK.render($('titleRank'), { list: RANK.list(), idx: -1 }); }

  let shownEnd = false;
  function onFall() {
    const left = Math.max(0, stage.goal - S.bestX);
    fails++;
    const r = WT.reaction(waiter, { reason: S.fallReason, fails, left, item: itemName() });
    faceNow = r.face; faceT0 = performance.now(); speak(waiter, r.mood, r.say);
    const fr = ZK.FALLS.find((f) => f.id === S.fallReason);
    if (fr) noteNew(ZK.mark('fall', fr.id), jaen(`ころび方「${fr.name}」`, `Fall: ${fr.name}`, `摔法：${fr.name}`));
    const gagName = gag && gag.def.name ? GG.nameOf(gag.def, gag.v) : '';
    if (gag && gag.def.name) { noteNew(ZK.mark('gag', gag.def.id), jaen(`ころび芸「${gag.def.name}」`, `Wipeout: ${gag.def.name}`, `绝技：${gag.def.name}`)); if (gag.v) ZK.mark('gagv', `${gag.def.id}.${gag.v.id}`); }
    noteNew(ZK.mark('face', `${waiter.id}.${r.mood}`), jaen(`${waiter.name}の「${ZK.MOOD_NAMES[r.mood] || r.mood}」顔`, `${poss(waiter.name)} "${ZK.MOOD_NAMES[r.mood] || r.mood}" face`, `${waiter.name}的「${ZK.MOOD_NAMES[r.mood] || r.mood}」表情`));
    const total = runDist + Math.min(stage.goal, Math.max(0, S.bestX)); // ゲームオーバーまでに歩けたきょり
    const daily = mode === 'daily';
    const prevBest = curBest;
    let newBest;
    if (daily) { newBest = false; }
    else { newBest = total > bestRun + 0.05; if (newBest) { bestRun = total; store.set('yoro.bestRun', bestRun.toFixed(1)); } }
    // 合計きょり・回数・れんぞく日数 → 新しく使えるようになったもの
    CL.addRun(Math.min(stage.goal, Math.max(0, S.bestX))); // 届けたぶんは GOAL のときに入れた
    const sk = DY.touch();
    const extra = [];
    if (sk.up && sk.n >= 2) extra.push(jaen(`${sk.n}日 れんぞく！`, `${sk.n}-day streak!`, `连续${sk.n}天！`));
    for (const x of CL.newly(unlockAtStart, ctxNow())) extra.push(x.icon ? jaen(`${x.name}も 頼まれるように！`, `Now people may ask for ${x.name}!`, `以后也会有人请你送${x.name}了！`) : jaen(`${x.name}が使える！`, `${x.name} unlocked!`, `${x.name}可以用了！`));
    runNew = extra.concat(runNew);
    refreshTitle();
    const why = YL.zh
      ? { pudding: '布丁掉了', timeup: '时间到', rhythm: '乱了节奏', stop: '停下摔倒了', hole: '掉进洞里' }[S.fallReason] || '摔倒了'
      : YL.en
      ? { pudding: 'Dropped the pudding', timeup: "Time's up", rhythm: 'Lost the rhythm', stop: 'Stopped and fell', hole: 'Fell in a hole' }[S.fallReason] || 'Fell over'
      : { pudding: 'プリンを落とした', timeup: '時間切れ', rhythm: 'リズムがくずれた', stop: '止まってころんだ', hole: '穴に落ちた' }[S.fallReason] || 'ころんだ';
    ui.failTag.textContent = tr(`${why}${gagName ? ` → ${gagName}` : ''}`);
    $('failNum').innerHTML = jaen(`<small>ステージ</small> ${level}`, `<small>Stage</small> ${level}`, `<small>关卡</small> ${level}`);
    ui.failTitle.textContent = r.title;
    ui.failLine.textContent = r.say;
    ui.failAct.textContent = r.action;
    ui.failDist.textContent = YL.zh
      ? `${daily ? `每日挑战 第${DY.daily().tries}次\n` : ''}第${level}户 · 离${waiter.name}家还有 ${left.toFixed(1)}m\n走了 ${total.toFixed(1)}m${newBest ? '' : `（${daily ? '今日' : ''}最佳 ${curBest.toFixed(1)}m）`}${runTreasure ? `\n这次拿到的宝物 ${runTreasure}个` : ''}`
      : YL.en
      ? `${daily ? `Daily Course · Try #${DY.daily().tries}\n` : ''}House ${level} · ${left.toFixed(1)}m to ${poss(waiter.name)} house\nWalked ${total.toFixed(1)}m${newBest ? '' : ` (${daily ? "Today's best" : 'Best'} ${curBest.toFixed(1)}m)`}${runTreasure ? `\nTreasures this run: ${runTreasure}` : ''}`
      : `${daily ? `今日のコース ${DY.daily().tries}回目\n` : ''}${level}軒目・${waiter.name}のおうちまで あと ${left.toFixed(1)}m\n歩いたきょり ${total.toFixed(1)}m${newBest ? '' : `（${daily ? '今日の' : ''}ベスト ${curBest.toFixed(1)}m）`}${runTreasure ? `\nこの回のおたから ${runTreasure}こ` : ''}`;
    $('retryBtn').textContent = jaen('もう一回', 'Try again');
    ui.retry.disabled = true; setTimeout(() => { ui.retry.disabled = false; }, 700); // 歩いていた指でうっかり押さないように
    lastShare = YL.zh
      ? `摇摇晃晃去跑腿${daily ? `（每日挑战 ${DY.label()}）` : ''}：我在第${level}关${gagName ? `变成了「${gagName}」，` : '摔倒了，'}被${waiter.name}说了一句「${String(r.say).replace(/\s*\n\s*/g, ' ')}」…`
      : YL.en
      ? `Yoroyoro Errand${daily ? ` (Daily Course: ${DY.label()})` : ''}: I wiped out on Stage ${level}${gagName ? ` with a "${gagName}"` : ''} and ${waiter.name} said, "${String(r.say).replace(/\s*\n\s*/g, ' ')}"`
      : `ヨロヨロおつかい${daily ? `の今日のコース（${DY.label()}）` : ''} ステージ${level}で${gagName ? `「${gagName}」になって` : ''}${waiter.name}に「${r.say}」と言われた…`;
    clipInfo = { dist: jaen(`ステージ${level}`, `Stage ${level}`, `第${level}关`), title: r.title, say: r.say, tag: ui.failTag.textContent };
    resetVid();
    // 歩いたきょりを、じぶんの記録ランキングに入れて上位を出す（このスマホの中だけ。今日のコースは入れない）
    const rk = daily ? { list: [], idx: -1 } : total >= 0.5 ? RANK.add(total) : { list: RANK.list(), idx: -1 };
    RANK.render($('failRank'), rk);
    // あとちょっと：すぐ上の記録まで何mだったか
    const near = $('failNear'); near.classList.remove('best');
    near.textContent = jaen(`おうちまで あと ${left.toFixed(1)}m${left < 3 ? '！ おしい！' : ''}`, `${left.toFixed(1)}m to go${left < 3 ? '! So close!' : ''}`, `还差${left.toFixed(1)}m${left < 3 ? '！就差一点！' : ''}`);
    // ずかん：この回で新しく入ったもの（なければ、まだ見ていないころび方のヒント）
    const zc = ZK.count(), nb = $('failNew');
    nb.innerHTML = jaen(`<b>NEW</b> ずかん ${zc.got}/${zc.total}`, `<b>NEW</b> Album ${zc.got}/${zc.total}`, `<b>NEW</b> 图鉴 ${zc.got}/${zc.total}`);
    nb.hidden = !runNew.length;
    paintFailGacha();
    showTitleRank();
    showOnly(ui.fail);
    if (navigator.vibrate) navigator.vibrate(80);
  }
  // ---- 描画 ----
  const cam = { x: 0, y: 1 };
  let anc = 0.6, ancX = 0.45; // カメラの中心を、画面の上から何割・左から何割に置くか（結果の板が出ているときは、板にかくれない所へ）
  const W2S = (x, y) => [W * ancX + (x - cam.x) * scale, H * anc - (y - cam.y) * scale];
  function ancTarget() {
    const fs = ui.fail.classList.contains('show') ? $('failSheet') : ui.goal.classList.contains('show') ? $('goalSheet') : null;
    if (!fs || !H) return [0.6, 0.45];
    const fr = fs.getBoundingClientRect();
    if (fr.left > W * 0.3) return [0.6, Math.max(0.2, (fr.left * 0.5 - 0.3 * scale) / W)]; // 板が右にある（横長）：左の空いた所のまん中
    const sh = ui.goal.classList.contains('show') ? ui.goal.querySelector('.goalw') : fs;
    const top = sh.getBoundingClientRect().top; // 板（GOAL! の字）の上はし
    const gy = game.groundHeightAt(cam.x); // カメラが見ている所の地面（ころび芸で上を見ているときも、地面は板のすぐ上に）
    return [Math.max(0.1, Math.min(0.6, (top - 18 + (gy - cam.y) * scale) / H)), 0.45];
  }

  // 3ステージごとに 朝→昼→夕方→夜 と変わる（進んでいる感じを出す）
  const THEMES = [
    { sky: ['#8fd3ff', '#d9f1ff', '#fff3d6'], hill: ['#b9e3a1', '#9ad282'], town: ['#bcd9e6', '#a6c8d8'], pole: '#7d93a3', cloud: 'rgba(255,255,255,.92)', sun: '#fff2b0', night: 0 },
    { sky: ['#4fb8ff', '#b4e4ff', '#f2fbff'], hill: ['#a8dc8c', '#86c96b'], town: ['#a9cde0', '#8fb9d0'], pole: '#6d8495', cloud: 'rgba(255,255,255,.96)', sun: '#fff7c9', night: 0 },
    { sky: ['#ff8f6b', '#ffbf8a', '#ffe7b8'], hill: ['#e0b57d', '#c99a63'], town: ['#d99a7a', '#c4826a'], pole: '#8a5a4a', cloud: 'rgba(255,230,205,.9)', sun: '#ff6a3d', night: 0.35 },
    { sky: ['#17214d', '#2f3d7a', '#5d5c9c'], hill: ['#3b5560', '#2d4650'], town: ['#2b3768', '#222c58'], pole: '#151b3a', cloud: 'rgba(190,200,255,.28)', sun: '#fff6d0', night: 1 },
  ];
  const themeOf = (n) => THEMES[Math.floor((n - 1) / 3) % THEMES.length];
  const hash = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  function drawBackground() {
    const T = themeOf(level), t = performance.now() / 1000;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, T.sky[0]); g.addColorStop(0.6, T.sky[1]); g.addColorStop(1, T.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
    if (T.night >= 1) { // 星
      for (let i = 0; i < 40; i++) {
        const x = hash(i) * W, y = hash(i + 99) * H * 0.55, tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
        ctx.fillStyle = `rgba(255,255,230,${0.35 + tw * 0.6})`; ctx.fillRect(x, y, 2 + (i % 3 === 0), 2 + (i % 3 === 0));
      }
    }
    // お日さま・お月さま（右上の少し下）
    const sx = W * 0.78, sy = H * 0.3, sr = scale * 0.55;
    ctx.fillStyle = T.sun; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(sx, sy, sr * 1.6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    if (T.night >= 1) { ctx.fillStyle = T.sky[0]; ctx.beginPath(); ctx.arc(sx + sr * 0.45, sy - sr * 0.25, sr * 0.85, 0, Math.PI * 2); ctx.fill(); }
    // 雲
    ctx.fillStyle = T.cloud;
    for (let i = 0; i < 6; i++) {
      const wx = i * 9 - ((cam.x + worldOff) * 0.15) % 54;
      const cx = ((wx * scale) % (W + 300) + W + 300) % (W + 300) - 150;
      cloud(cx, H * (0.1 + (i % 3) * 0.07), scale * (0.6 + (i % 2) * 0.3));
    }
    hills(0.2, T.hill[0], H * anc, 1.2);
    drawTown(T);
    hills(0.45, T.hill[1], H * (anc + 0.1), 0.8);
    drawPoles(T);
  }
  // 遠くの町並み（家の屋根がならぶ。夕方と夜は窓に明かり）
  function drawTown(T) {
    const par = 0.3, cw = 1.5, base = H * (anc + 0.065), off = (cam.x + worldOff) * par;
    const i0 = Math.floor(((0 - W * 0.5) / scale + off) / cw) - 1, i1 = Math.floor(((W - W * 0.5) / scale + off) / cw) + 1;
    for (let i = i0; i <= i1; i++) {
      if (hash(i * 3.1) < 0.18) continue; // ところどころ空き地
      const x = W * 0.5 + (i * cw - off) * scale, w = scale * cw * (0.62 + hash(i) * 0.3), h = scale * (0.7 + hash(i + 7) * 0.9);
      const col = hash(i + 3) < 0.5 ? T.town[0] : T.town[1];
      ctx.fillStyle = col; ctx.fillRect(x - w / 2, base - h, w, h + H);
      ctx.beginPath();
      if (hash(i + 5) < 0.6) { ctx.moveTo(x - w / 2 - 4, base - h); ctx.lineTo(x, base - h - w * 0.42); ctx.lineTo(x + w / 2 + 4, base - h); }
      else { ctx.rect(x - w / 2 - 3, base - h - 6, w + 6, 6); }
      ctx.fill();
      if (T.night > 0) {
        for (let k = 0; k < 2; k++) {
          if (hash(i * 7 + k) < 0.45) continue;
          ctx.fillStyle = `rgba(255,214,110,${0.45 + T.night * 0.5})`;
          ctx.fillRect(x - w * 0.3 + k * w * 0.36, base - h * 0.7, w * 0.22, w * 0.18);
        }
      }
    }
  }
  // 電柱と電線（手前を流れていく）
  function drawPoles(T) {
    const par = 0.7, gap = 5.5, top = H * 0.4, base = H * 0.78, off = (cam.x + worldOff) * par;
    const i0 = Math.floor((-W * 0.5 / scale + off) / gap) - 1, i1 = Math.floor((W * 0.5 / scale + off) / gap) + 1;
    ctx.strokeStyle = T.pole; ctx.fillStyle = T.pole; ctx.lineWidth = 1.5;
    let prev = null;
    for (let i = i0; i <= i1; i++) {
      const x = W * 0.5 + (i * gap - off) * scale;
      ctx.fillRect(x - 3, top, 6, base - top);
      ctx.fillRect(x - scale * 0.35, top + 10, scale * 0.7, 4);
      if (prev != null) for (const dy of [12, 22]) { ctx.beginPath(); ctx.moveTo(prev, top + dy); ctx.quadraticCurveTo((prev + x) / 2, top + dy + scale * 0.35, x, top + dy); ctx.stroke(); }
      prev = x;
    }
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
    const [, gy0] = W2S(cam.x, game.groundHeightAt(cam.x));
    const gg = ctx.createLinearGradient(0, gy0, 0, H);
    const nt = themeOf(level).night;
    gg.addColorStop(0, nt >= 1 ? '#9c7556' : nt > 0 ? '#d29462' : '#cf9b6a'); gg.addColorStop(1, nt >= 1 ? '#6e4f38' : nt > 0 ? '#a26a44' : '#a8764a');
    ctx.fillStyle = gg; ctx.fill();
    ctx.save(); ctx.clip();
    // 土の層（地面の形にそった帯）
    for (const [dy, col] of [[0.55, 'rgba(120,72,38,.16)'], [1.35, 'rgba(120,72,38,.12)'], [2.3, 'rgba(255,240,210,.10)']]) {
      ctx.lineWidth = scale * 0.22; ctx.strokeStyle = col; ctx.beginPath();
      [sx, sy] = W2S(p[0][0], p[0][1]); ctx.moveTo(sx, sy + scale * dy);
      for (const [x, h] of p) { [sx, sy] = W2S(x, h); ctx.lineTo(sx, sy + scale * dy + Math.sin((x + worldOff) * 1.3) * scale * 0.06); }
      ctx.stroke();
    }
    // 小石
    const vx0 = cam.x - W * 0.5 / scale - 1, vx1 = cam.x + W * 0.6 / scale + 1;
    for (let k = Math.floor((vx0 + worldOff) / 0.55); k * 0.55 - worldOff < vx1; k++) {
      const r = hash(k * 1.7); if (r < 0.45) continue;
      const wx = k * 0.55 - worldOff + hash(k) * 0.4, [px, py] = W2S(wx, game.groundHeightAt(wx));
      const d = scale * (0.35 + hash(k + 11) * 2.2), rr = scale * (0.04 + r * 0.06);
      ctx.fillStyle = r > 0.8 ? 'rgba(255,240,215,.45)' : 'rgba(110,66,34,.35)';
      ctx.beginPath(); ctx.ellipse(px, py + d, rr * 1.4, rr, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // 草のふち（下に影の線・上に草の束）
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(9, scale * 0.2); ctx.strokeStyle = '#4f9e3a';
    ctx.beginPath(); [sx, sy] = W2S(p[0][0], p[0][1]); ctx.moveTo(sx, sy + 3);
    for (const [x, h] of p) { [sx, sy] = W2S(x, h); ctx.lineTo(sx, sy + 3); }
    ctx.stroke();
    ctx.lineWidth = Math.max(6, scale * 0.14); ctx.strokeStyle = '#6cc04a';
    ctx.beginPath(); [sx, sy] = W2S(p[0][0], p[0][1]); ctx.moveTo(sx, sy);
    for (const [x, h] of p) { [sx, sy] = W2S(x, h); ctx.lineTo(sx, sy); }
    ctx.stroke();
    ctx.fillStyle = '#5fb444';
    for (let k = Math.floor((vx0 + worldOff) / 0.38); k * 0.38 - worldOff < vx1; k++) {
      if (hash(k * 2.3) < 0.35) continue;
      const wx = k * 0.38 - worldOff + hash(k + 5) * 0.2;
      if (stage.pits.some((q) => wx > q.x0 - 0.15 && wx < q.x1 + 0.15)) continue;
      const [px, py] = W2S(wx, game.groundHeightAt(wx)), hgt = scale * (0.1 + hash(k + 9) * 0.1), bw = scale * 0.035;
      ctx.beginPath();
      ctx.moveTo(px - bw * 3, py - 2); ctx.lineTo(px - bw * 2.2, py - hgt * 0.8); ctx.lineTo(px - bw, py - 2);
      ctx.moveTo(px - bw, py - 2); ctx.lineTo(px, py - hgt); ctx.lineTo(px + bw, py - 2);
      ctx.moveTo(px + bw, py - 2); ctx.lineTo(px + bw * 2.4, py - hgt * 0.75); ctx.lineTo(px + bw * 3, py - 2);
      ctx.fill();
    }
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
      ctx.fillText(jaen('ベスト', 'BEST'), x + s * 0.32, y - s * 1.52);
    }
    // じゃまな物
    for (const o of stage.obstacles) drawObstacle(o);
    // スタート：1軒目はおかしや、それより先は前のおうち（届けた人が手をふっている）
    if (ui.title.classList.contains('show')) drawTitleHouse();
    else if (level === 1) {
      const [sx0, sy0] = W2S(-3.2, 0); const s = scale;
      ctx.lineWidth = 3; ctx.strokeStyle = '#3b2a1e';
      ctx.fillStyle = '#e9f4ff'; ctx.fillRect(sx0 - s * 1.0, sy0 - s * 2.2, s * 2.0, s * 2.2); ctx.strokeRect(sx0 - s * 1.0, sy0 - s * 2.2, s * 2.0, s * 2.2);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#ff6b8b'; ctx.fillRect(sx0 - s * 1.1 + i * s * 0.44, sy0 - s * 2.45, s * 0.44, s * 0.35); }
      ctx.strokeRect(sx0 - s * 1.1, sy0 - s * 2.45, s * 2.2, s * 0.35);
      ctx.fillStyle = '#3b2a1e'; ctx.font = `900 ${Math.round(s * 0.28)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(jaen('おかしや', 'SWEETS'), sx0, sy0 - s * 1.65);
      ctx.fillStyle = '#8fd3ff'; ctx.fillRect(sx0 - s * 0.7, sy0 - s * 1.4, s * 1.4, s * 0.8); ctx.strokeRect(sx0 - s * 0.7, sy0 - s * 1.4, s * 1.4, s * 0.8);
    } else {
      drawHouse(1.6, prevWaiter, 'happy', level - 1);
      if (delivered && performance.now() - delivered.t0 < 3500) bubble(0.28, 1.45, delivered.say);
    }
    // ゴールの線
    const [lx, ly] = W2S(stage.goal, game.groundHeightAt(stage.goal)); const s = scale;
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#3b2a1e' : '#fff'; ctx.fillRect(lx - 4, ly - (i + 1) * s * 0.25, 8, s * 0.25); }
    // ゴールのおうち
    drawHouse(stage.goal + 1.6, waiter, faceNow, level);
  }

  // タイトル：うしろに届け先の家が次々にポンと出てくる（15軒を順番に見せる）
  const TITLE_WHO = [...WT.WAITERS, ...WT.RARE], TITLE_SEC = 2.6;
  function drawTitleHouse() {
    const tt = performance.now() / 1000, i = Math.floor(tt / TITLE_SEC) % TITLE_WHO.length, u = (tt % TITLE_SEC) / TITLE_SEC;
    const back = (v) => 1 + 2.7 * Math.pow(v - 1, 3) + 1.7 * Math.pow(v - 1, 2); // 少し行きすぎてもどる
    const k = u < 0.14 ? back(u / 0.14) : u > 0.93 ? 1 - (u - 0.93) / 0.07 : 1;
    if (k <= 0.01) return;
    const hx = game.charX() + 1.75, [fx, fy] = W2S(hx, game.groundHeightAt(hx)), sc = 0.68;
    ctx.save(); ctx.translate(fx, fy); ctx.scale(sc * (2 - k) * k, sc * k); ctx.translate(-fx, -fy);
    drawHouse(hx, TITLE_WHO[i], 'wait', level);
    ctx.restore();
    if (u < 0.05) puff(hx + 0.3, game.groundHeightAt(hx), 2, false);
  }

  // おたからの箱（？）。拾ったら中身が上にふわっと出る
  function drawBoxes() {
    const now = performance.now(), s = scale;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const b of boxes) {
      if (b.taken) {
        const a = (now - b.taken) / 1000; if (a > 1) continue;
        const [x, y] = W2S(b.x, b.y + a * 0.9);
        ctx.globalAlpha = 1 - a * a; IC.draw(ctx, b.item.icon, x, y, s * 0.62); ctx.globalAlpha = 1;
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
  // 色を少し暗く（k<1）・明るく（k>1）
  function tone(hex, k) {
    const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1))));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  const SHIRTS = { mom: '#f28aa0', grandma: '#9b7bd1', grandpa: '#7a9a5a', dad: '#4a6fa5', sister: '#ffa8c2', brother: '#5fb3e8', aunt: '#e8a24f', uncle: '#6b8e5a', friend: '#e8574f', teacher: '#3b4a6b' };
  // 届ける相手ごとの家（人はその人らしく、動物と珍しい人はへんてこ）。g = { gx, gy, s, who, face, night, t }
  // 座標は (gx, gy)＝家の足もと から、右へ dx・上へ dy（どちらも 1＝1m）
  const INK = '#3b2a1e';
  function H0(g) {
    const X = (d) => g.gx + d * g.s, Y = (d) => g.gy - d * g.s;
    const box = (x0, y0, x1, y1, col, r = 0) => { ctx.fillStyle = col; if (r) roundRect(X(x0), Y(y1), (x1 - x0) * g.s, (y1 - y0) * g.s, r); else { ctx.beginPath(); ctx.rect(X(x0), Y(y1), (x1 - x0) * g.s, (y1 - y0) * g.s); } ctx.fill(); ctx.stroke(); };
    const poly = (pts, col) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.closePath(); if (col) { ctx.fillStyle = col; ctx.fill(); } ctx.stroke(); };
    const line = (x0, y0, x1, y1, w, col) => { ctx.save(); ctx.lineWidth = w; ctx.strokeStyle = col || INK; ctx.beginPath(); ctx.moveTo(X(x0), Y(y0)); ctx.lineTo(X(x1), Y(y1)); ctx.stroke(); ctx.restore(); };
    const dot = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(x), Y(y), r * g.s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
    return { X, Y, box, poly, line, dot };
  }
  const HOUSES = {
    // お母さん：自分の家。洗濯物に水玉の巨大パンツ
    mom(g) {
      const { X, Y, box, poly, line, dot } = H0(g), t = g.t, lit = g.night ? '#ffd56b' : '#bfe6ff';
      box(-1.0, 0, 1.05, 1.75, '#fdf1dc');
      poly([[-1.25, 1.7], [1.3, 1.7], [0.95, 2.4], [-0.9, 2.4]], '#c96a4a');
      for (let i = 1; i < 3; i++) line(-1.1 + i * 0.05, 1.7 + i * 0.23, 1.15 - i * 0.05, 1.7 + i * 0.23, 2, 'rgba(0,0,0,.18)');
      box(-0.75, 0, -0.2, 1.05, '#9b6a43', 4); dot(-0.3, 0.52, 0.04, '#ffcf3d');
      box(0.15, 0.55, 0.8, 1.05, lit); line(0.475, 0.55, 0.475, 1.05, 2);
      box(-0.6, 1.15, 0.6, 1.5, lit); line(0, 1.15, 0, 1.5, 2);
      // ものほしと洗濯物
      box(1.12, 0, 1.18, 1.6, '#9aa3ad'); box(1.72, 0, 1.78, 1.6, '#9aa3ad');
      ctx.beginPath(); ctx.moveTo(X(1.15), Y(1.55)); ctx.quadraticCurveTo(X(1.45), Y(1.45), X(1.75), Y(1.55)); ctx.stroke();
      const w = Math.sin(t * 3) * 0.04;
      ctx.save(); ctx.translate(X(1.45), Y(1.5)); ctx.rotate(w); ctx.scale(1.45, 1.45); ctx.lineWidth = 2;
      ctx.fillStyle = '#ff6b8b'; ctx.beginPath(); const P = (x, y) => [x * g.s, -y * g.s];
      ctx.moveTo(...P(-0.2, 0)); ctx.lineTo(...P(0.2, 0)); ctx.lineTo(...P(0.22, -0.42)); ctx.lineTo(...P(0.05, -0.42)); ctx.lineTo(...P(0, -0.25)); ctx.lineTo(...P(-0.05, -0.42)); ctx.lineTo(...P(-0.22, -0.42)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; for (const [x, y] of [[-0.12, -0.12], [0.08, -0.08], [-0.1, -0.32], [0.14, -0.3], [0, -0.17]]) { ctx.beginPath(); ctx.arc(...P(x, y), 0.035 * g.s, 0, 7); ctx.fill(); }
      ctx.restore();
    },
    // おばあちゃん：瓦屋根の平屋。縁側も屋根もねこだらけ
    grandma(g) {
      const { X, Y, box, poly, line, dot } = H0(g), s = g.s;
      box(-1.15, 0, 1.55, 1.25, '#efe0c0');
      const shoji = g.night ? '#ffd98a' : '#fffaf0';
      box(-1.0, 0.42, 0.95, 1.15, shoji);
      for (let i = 1; i < 6; i++) line(-1.0 + i * 0.325, 0.42, -1.0 + i * 0.325, 1.15, i % 2 ? 1.5 : 3, i % 2 ? 'rgba(59,42,30,.35)' : INK);
      for (let j = 1; j < 3; j++) line(-1.0, 0.42 + j * 0.243, 0.95, 0.42 + j * 0.243, 1.5, 'rgba(59,42,30,.35)');
      box(1.1, 0.55, 1.45, 1.05, g.night ? '#ffd98a' : '#cfe8f2'); line(1.275, 0.55, 1.275, 1.05, 2); line(1.1, 0.8, 1.45, 0.8, 2);
      for (const x of [-1.15, -0.03, 0.95, 1.55]) box(x - 0.06, 0, x + 0.06, 1.25, '#7a4a2a');
      box(-1.3, 0.3, 1.0, 0.42, '#b9824f'); for (const x of [-1.2, -0.1, 0.9]) box(x - 0.04, 0, x + 0.04, 0.3, '#8a5a35');
      ctx.beginPath(); ctx.moveTo(X(-1.6), Y(1.18)); ctx.quadraticCurveTo(X(-1.2), Y(1.26), X(-0.95), Y(2.05)); ctx.lineTo(X(1.35), Y(2.05)); ctx.quadraticCurveTo(X(1.6), Y(1.26), X(2.0), Y(1.18)); ctx.closePath();
      ctx.fillStyle = '#5d6672'; ctx.fill(); ctx.save(); ctx.clip();
      for (let i = 0; i < 4; i++) line(-1.7, 1.38 + i * 0.2, 2.1, 1.38 + i * 0.2, 2.5, '#7d8794');
      ctx.restore(); ctx.stroke();
      box(-1.0, 2.02, 1.4, 2.14, '#4a525d', 3); poly([[-1.12, 2.0], [-0.94, 2.0], [-0.94, 2.24], [-1.06, 2.3], [-1.12, 2.22]], '#4a525d'); poly([[1.52, 2.0], [1.34, 2.0], [1.34, 2.24], [1.46, 2.3], [1.52, 2.22]], '#4a525d');
      box(-0.1, 0.5, 0.1, 1.05, '#e9c48f', 3);
      ctx.fillStyle = INK; ctx.font = `800 ${Math.round(s * 0.12)}px ${JF}`; ctx.textAlign = 'center';
      if (YL.latin) { // 英語は縦書きにせず、柱にそって横に寝かせる
        ctx.save(); ctx.translate(X(0), Y(0.775)); ctx.rotate(Math.PI / 2); ctx.font = `800 ${Math.round(s * 0.1)}px ${JF}`; ctx.textBaseline = 'middle';
        ctx.fillText(g.who.name, 0, 0, s * 0.52); ctx.restore();
      } else [...g.who.name].slice(0, 4).forEach((ch, i) => ctx.fillText(ch, X(0), Y(0.92 - i * 0.13)));
      // ねこだらけ（縁側に4匹・屋根に1匹）
      const cols = ['#f0a85a', '#fafafa', '#3b3b3b', '#c9c9c9', '#e8c08a'];
      const loaf = (x, y, col, k) => {
        const zz = Math.sin(g.t * 2 + k) * 0.01;
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(X(x), Y(y + 0.09 + zz), 0.16 * s, 0.1 * s, 0, 0, 7); ctx.fill(); ctx.stroke();
        poly([[x - 0.13, y + 0.14], [x - 0.11, y + 0.25], [x - 0.04, y + 0.17]], col); poly([[x - 0.02, y + 0.18], [x + 0.03, y + 0.27], [x + 0.06, y + 0.17]], col);
        line(x - 0.1, y + 0.1, x - 0.06, y + 0.1, 2); line(x - 0.01, y + 0.1, x + 0.03, y + 0.1, 2);
      };
      [[-0.75, 0], [-0.4, 1], [0.05, 2], [0.65, 3]].forEach(([x, k]) => loaf(x, 0.42, cols[k], k));
      loaf(0.6, 2.14, cols[4], 4);
      ctx.fillStyle = 'rgba(59,42,30,.6)'; ctx.font = `800 ${Math.round(s * 0.14)}px sans-serif`; ctx.fillText('z', X(-0.55 + Math.sin(g.t) * 0.03), Y(0.78 + (g.t % 2) * 0.08));
    },
    // おじいちゃん：畑のある家。家より大きい大根
    grandpa(g) {
      const { X, Y, box, poly, line, dot } = H0(g), t = g.t;
      box(0.3, 0, 1.65, 1.2, '#e9dcc0');
      ctx.beginPath(); ctx.moveTo(X(0.1), Y(1.15)); for (let i = 0; i <= 8; i++) ctx.lineTo(X(0.1 + i * 0.2), Y(1.15 + (i % 2) * 0.05)); ctx.lineTo(X(1.85), Y(1.15)); ctx.lineTo(X(1.45), Y(1.75)); ctx.lineTo(X(0.5), Y(1.75)); ctx.closePath(); ctx.fillStyle = '#7d9a5a'; ctx.fill(); ctx.stroke();
      box(0.5, 0, 0.95, 0.95, '#c9a27a'); for (let i = 1; i < 4; i++) line(0.5, i * 0.24, 0.95, i * 0.24, 1.5, 'rgba(59,42,30,.4)');
      box(1.1, 0.5, 1.5, 0.9, g.night ? '#ffd56b' : '#cfe8f2');
      line(1.58, 0, 1.75, 1.0, 4, '#8a5a35'); poly([[1.7, 0.95], [1.88, 1.02], [1.8, 0.86]], '#9aa3ad');
      // 畑のうね
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#8a5a35'; ctx.beginPath(); ctx.ellipse(X(-1.0 + i * 0.42), Y(0.02), 0.2 * g.s, 0.1 * g.s, 0, Math.PI, 0); ctx.fill(); ctx.stroke(); dot(-1.0 + i * 0.42, 0.13, 0.05, '#6cc04a'); }
      // 巨大な大根
      const sw = Math.sin(t * 1.5) * 0.04;
      for (const [a, len] of [[-0.5, 1.3], [-0.15, 1.6], [0.2, 1.45], [0.5, 1.15]]) {
        ctx.save(); ctx.translate(X(0.05), Y(0.82)); ctx.rotate(a + sw);
        ctx.fillStyle = '#5fb444'; ctx.beginPath(); ctx.ellipse(0, -len * g.s / 2, 0.16 * g.s, len * g.s / 2, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len * g.s * 0.9); ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = '#8a5a35'; ctx.beginPath(); ctx.ellipse(X(0.05), Y(0.02), 0.6 * g.s, 0.14 * g.s, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      const dk = ctx.createLinearGradient(0, Y(0.85), 0, Y(0.45)); dk.addColorStop(0, '#bfe08a'); dk.addColorStop(1, '#fbfbf2');
      ctx.fillStyle = dk; ctx.beginPath(); ctx.moveTo(X(-0.4), Y(0.05)); ctx.bezierCurveTo(X(-0.46), Y(0.6), X(-0.36), Y(0.85), X(0.05), Y(0.86)); ctx.bezierCurveTo(X(0.46), Y(0.85), X(0.56), Y(0.6), X(0.5), Y(0.05)); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (const y of [0.25, 0.4]) line(-0.36, y, -0.24, y + 0.02, 2, 'rgba(59,42,30,.35)');
      line(0.36, 0.3, 0.46, 0.32, 2, 'rgba(59,42,30,.35)');
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(X(-0.08), Y(0.55), 0.035 * g.s, 0, 7); ctx.arc(X(0.18), Y(0.55), 0.035 * g.s, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,140,.5)'; ctx.beginPath(); ctx.arc(X(-0.16), Y(0.45), 0.05 * g.s, 0, 7); ctx.arc(X(0.26), Y(0.45), 0.05 * g.s, 0, 7); ctx.fill();
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X(0.05), Y(0.5), 0.06 * g.s, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.lineWidth = 3;
      ctx.fillStyle = '#8a5a35'; ctx.beginPath(); ctx.ellipse(X(0.05), Y(0.02), 0.62 * g.s, 0.07 * g.s, 0, 0, Math.PI); ctx.fill();
      for (const d of [-0.62, 0.68]) dot(d, 0.05, 0.05, '#8a5a35');
    },
    // お父さん：会社のビル。窓から同僚が手をふる
    dad(g) {
      const { X, Y, box, poly, line, dot } = H0(g), t = g.t;
      box(-0.4, 0, 1.6, 3.1, '#c9d3dc'); box(-0.5, 3.05, 1.7, 3.2, '#9aa8b5');
      const skins = ['#ffd9b8', '#f3c9a4', '#ffe0c8', '#f0c49c'];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        const x0 = -0.25 + c * 0.62, y0 = 0.95 + r * 0.52;
        box(x0, y0, x0 + 0.45, y0 + 0.38, g.night ? '#ffd56b' : '#9fd1f0');
        if ((r * 3 + c) % 3 !== 1) { dot(x0 + 0.22, y0 + 0.17, 0.09, skins[(r + c) % 4]); line(x0 + 0.33, y0 + 0.1, x0 + 0.4, y0 + 0.28 + Math.sin(t * 8 + r + c) * 0.05, 3, skins[(r + c) % 4]); }
      }
      box(0.25, 0, 0.95, 0.75, '#bfe6ff'); line(0.6, 0, 0.6, 0.75, 3);
      box(0.1, 0.78, 1.1, 0.88, '#4a6fa5');
      const tw = Math.sin(t * 2) * 0.03;
      poly([[0.38, 3.2], [0.82, 3.2], [0.72, 2.95], [0.48, 2.95]], '#c0392b');
      poly([[0.48, 2.95], [0.72, 2.95], [0.95 + tw, 1.1], [0.6 + tw, 0.92], [0.25 + tw, 1.1]], '#e8303a');
      ctx.save(); poly([[0.48, 2.95], [0.72, 2.95], [0.95 + tw, 1.1], [0.6 + tw, 0.92], [0.25 + tw, 1.1]]); ctx.clip();
      for (let i = 0; i < 6; i++) line(0.1, 1.2 + i * 0.35, 1.1, 1.6 + i * 0.35, 6, '#ffd23a'); ctx.restore();
      poly([[0.48, 2.95], [0.72, 2.95], [0.95 + tw, 1.1], [0.6 + tw, 0.92], [0.25 + tw, 1.1]]);
    },
    // 妹：ショートケーキの家。てっぺんに巨大いちご
    sister(g) {
      const { X, Y, box, poly, line, dot } = H0(g);
      poly([[-0.9, 0], [1.6, 0], [1.6, 1.3], [-0.9, 1.75]], '#fff0d0');
      ctx.save(); poly([[-0.9, 0], [1.6, 0], [1.6, 1.3], [-0.9, 1.75]]); ctx.clip();
      line(-0.9, 0.62, 1.6, 0.52, 10, '#ff8fb1'); line(-0.9, 1.15, 1.6, 0.98, 8, '#ffffff');
      ctx.restore(); poly([[-0.9, 0], [1.6, 0], [1.6, 1.3], [-0.9, 1.75]]);
      poly([[-1.0, 1.72], [1.7, 1.27], [1.7, 1.45], [-1.0, 1.95]], '#ffffff');
      for (let i = 0; i < 6; i++) dot(-0.8 + i * 0.45, 1.95 - i * 0.075, 0.1, '#ffffff');
      // 巨大いちご
      ctx.fillStyle = '#e8303a'; ctx.beginPath(); ctx.moveTo(X(0.35), Y(1.7)); ctx.bezierCurveTo(X(-0.35), Y(1.85), X(-0.2), Y(2.85), X(0.35), Y(2.8)); ctx.bezierCurveTo(X(0.9), Y(2.85), X(1.05), Y(1.85), X(0.35), Y(1.7)); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffe9a8'; for (const [x, y] of [[0.1, 2.0], [0.35, 1.95], [0.6, 2.05], [0.2, 2.35], [0.5, 2.4], [0.35, 2.6]]) { ctx.beginPath(); ctx.ellipse(X(x), Y(y), 3, 4.5, 0, 0, 7); ctx.fill(); }
      poly([[0.1, 2.78], [0.35, 3.0], [0.6, 2.78], [0.35, 2.84]], '#4fb36b');
      // ハートのドアと丸い窓
      ctx.fillStyle = '#ff6b9b'; ctx.beginPath(); ctx.moveTo(X(-0.35), Y(0)); ctx.lineTo(X(-0.35), Y(0.6)); ctx.arc(X(-0.1), Y(0.6), 0.25 * g.s, Math.PI, 0); ctx.lineTo(X(0.15), Y(0)); ctx.closePath(); ctx.fill(); ctx.stroke();
      dot(0.95, 0.85, 0.2, g.night ? '#ffd56b' : '#bfe6ff'); dot(0.07, 0.3, 0.03, '#ffcf3d');
    },
    // 弟：木の上のひみつきち。ドクロの旗
    brother(g) {
      const { X, Y, box, poly, line, dot } = H0(g), t = g.t;
      box(0.8, 0, 1.15, 2.2, '#8a5a35');
      for (const [x, y, r] of [[0.4, 2.6, 0.55], [1.0, 2.9, 0.6], [1.5, 2.5, 0.45], [0.9, 2.3, 0.5]]) dot(x, y, r, '#5fb444');
      box(-0.25, 1.4, 1.45, 1.5, '#b9824f');
      box(-0.15, 1.5, 0.95, 2.2, '#d9a46a'); box(0.95, 1.5, 1.35, 2.05, '#c8955a');
      poly([[-0.3, 2.15], [1.0, 2.15], [0.35, 2.55]], '#c96a4a');
      box(0.1, 1.6, 0.5, 1.95, '#3b2a1e', 3);
      line(-0.2, 1.4, -0.2, 0, 3); line(0.05, 1.4, 0.05, 0, 3); for (let i = 1; i < 7; i++) line(-0.2, i * 0.2, 0.05, i * 0.2, 3, '#b9824f');
      line(1.3, 2.05, 1.3, 2.7, 3);
      const w = Math.sin(t * 4) * 0.04;
      poly([[1.3, 2.7], [1.75, 2.62 + w], [1.75, 2.38 + w], [1.3, 2.42]], '#2b2b2b');
      dot(1.52, 2.55 + w, 0.07, '#ffffff'); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(X(1.49), Y(2.56 + w), 2, 0, 7); ctx.arc(X(1.55), Y(2.56 + w), 2, 0, 7); ctx.fill();
      box(1.05, 1.55, 1.35, 1.75, '#fff7e6', 2);
      ctx.fillStyle = '#e8303a'; ctx.font = `900 ${Math.round(g.s * (YL.latin ? 0.075 : 0.12))}px sans-serif`; ctx.textAlign = 'center'; ctx.save(); ctx.translate(X(1.2), Y(1.62)); ctx.rotate(-0.08); ctx.fillText(jaen('ひみつ', 'SECRET'), 0, 0); ctx.restore();
    },
    // となりのおばさん：花の家。家より高いひまわり
    aunt(g) {
      const { X, Y, box, poly, line, dot } = H0(g), t = g.t;
      box(-0.9, 0, 0.95, 1.4, '#fde8e8'); poly([[-1.1, 1.35], [1.15, 1.35], [0.02, 2.05]], '#e87fa8');
      box(-0.6, 0, -0.1, 0.95, '#9b6a43', 4); box(0.2, 0.5, 0.75, 1.0, g.night ? '#ffd56b' : '#bfe6ff');
      for (let i = 0; i < 4; i++) { box(0.18 + i * 0.15, 0.4, 0.3 + i * 0.15, 0.5, '#c96a4a'); dot(0.24 + i * 0.15, 0.56, 0.06, ['#ff6b8b', '#ffd23a', '#b46cf0', '#ff9a3d'][i]); }
      for (let i = 0; i < 6; i++) { const x = -0.95 + i * 0.36; line(x, 0, x, 0.25, 3, '#4fb36b'); dot(x, 0.3, 0.07, ['#ff5c5c', '#ffd23a', '#ff8fb1'][i % 3]); }
      // ひまわり
      const sx = 1.35, top = 3.0, sw = Math.sin(t * 1.2) * 0.05;
      line(sx, 0, sx + sw, top - 0.3, 7, '#4fb36b');
      ctx.fillStyle = '#5fb444'; ctx.beginPath(); ctx.ellipse(X(sx + 0.18), Y(1.2), 0.18 * g.s, 0.08 * g.s, -0.5, 0, 7); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.ellipse(X(sx + sw) + Math.cos(a) * 0.38 * g.s, Y(top) + Math.sin(a) * 0.38 * g.s, 0.18 * g.s, 0.07 * g.s, a, 0, 7); ctx.fill(); ctx.stroke(); }
      dot(sx + sw, top, 0.3, '#8a5a35');
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(X(sx + sw - 0.1), Y(top + 0.05), 3, 0, 7); ctx.arc(X(sx + sw + 0.1), Y(top + 0.05), 3, 0, 7); ctx.fill();
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X(sx + sw), Y(top - 0.02), 0.12 * g.s, 0.3, Math.PI - 0.3); ctx.stroke(); ctx.lineWidth = 3;
    },
    // 親せきのおじさん：巨大どんぶりの屋台。湯気とお箸
    uncle(g) {
      const { X, Y, box, poly, line, dot } = H0(g), t = g.t;
      box(0.0, 0, 0.9, 0.25, '#c9302c');
      // 麺・具（どんぶりのうしろ）
      ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.ellipse(X(0.45), Y(1.45), 1.05 * g.s, 0.22 * g.s, 0, 0, 7); ctx.fill(); ctx.stroke();
      dot(0.0, 1.55, 0.22, '#e8b07a'); dot(0.0, 1.55, 0.12, '#f5d0a5');
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(X(0.55), Y(1.55), 0.18 * g.s, 0.12 * g.s, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.strokeStyle = '#ff6b8b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X(0.55), Y(1.55), 0.06 * g.s, 0, 5); ctx.stroke(); ctx.restore();
      poly([[0.85, 1.4], [1.15, 1.4], [1.1, 2.05], [0.85, 2.0]], '#2f4a2a');
      line(-0.2, 1.4, 0.7, 2.9, 7, '#d9a868'); line(0.0, 1.4, 0.95, 2.85, 7, '#d9a868');
      // どんぶり
      ctx.fillStyle = '#c9302c'; ctx.beginPath(); ctx.moveTo(X(-0.65), Y(1.45)); ctx.quadraticCurveTo(X(-0.55), Y(0.25), X(0.45), Y(0.25)); ctx.quadraticCurveTo(X(1.45), Y(0.25), X(1.55), Y(1.45)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.clip(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
      ctx.beginPath(); for (let i = 0; i <= 12; i++) { const x = -0.6 + i * 0.18; ctx.lineTo(X(x), Y(1.15 + (i % 2) * 0.12)); } ctx.stroke(); ctx.restore();
      // 湯気
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4;
      for (let k = 0; k < 3; k++) { const x = 0.1 + k * 0.35, ph = t * 2 + k; ctx.beginPath(); ctx.moveTo(X(x), Y(1.75)); ctx.bezierCurveTo(X(x - 0.1 + Math.sin(ph) * 0.05), Y(2.0), X(x + 0.1), Y(2.15), X(x + Math.sin(ph + 1) * 0.06), Y(2.4)); ctx.stroke(); }
      ctx.restore();
    },
    // となりのケンタ：家。窓が割れてボールが刺さっている
    friend(g) {
      const { X, Y, box, poly, line, dot } = H0(g);
      box(-0.95, 0, 1.25, 1.75, '#e6f0f7');
      poly([[-1.15, 1.7], [1.45, 1.7], [0.15, 2.45]], '#4f8be8');
      box(-0.7, 0, -0.15, 1.05, '#9b6a43', 4); dot(-0.25, 0.52, 0.04, '#ffcf3d');
      box(0.15, 0.55, 0.95, 1.2, g.night ? '#ffd56b' : '#bfe6ff');
      // ひび
      ctx.save(); ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) { const a = i * 0.9; line(0.62, 0.9, 0.62 + Math.cos(a) * 0.3, 0.9 + Math.sin(a) * 0.28, 2); }
      ctx.restore();
      dot(0.62, 0.9, 0.15, '#ffffff');
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(X(0.62 + Math.cos(a) * 0.08), Y(0.9 - Math.sin(a) * 0.08), 0.035 * g.s, 0, 7); ctx.fill(); }
      dot(-0.4, 1.95, 0.12, '#ffffff'); // 屋根にもボール
      // 小さいゴール
      line(1.35, 0, 1.35, 0.7, 4, '#ffffff'); line(1.35, 0.7, 1.75, 0.7, 4, '#ffffff');
      ctx.save(); ctx.strokeStyle = 'rgba(59,42,30,.4)'; ctx.lineWidth = 1.5; for (let i = 1; i < 4; i++) { line(1.35 + i * 0.1, 0, 1.35 + i * 0.1, 0.7, 1.5, 'rgba(59,42,30,.35)'); line(1.35, i * 0.17, 1.75, i * 0.17, 1.5, 'rgba(59,42,30,.35)'); } ctx.restore();
    },
    // ピアノの先生：グランドピアノの家。音符がうかぶ
    teacher(g) {
      const { X, Y, box, poly, line, dot } = H0(g), t = g.t;
      for (const x of [-0.6, 1.3]) box(x - 0.07, 0, x + 0.07, 0.65, '#1f1f1f');
      line(0.9, 1.25, 0.6, 2.25, 4, '#2b2b2b');
      poly([[-0.85, 1.25], [1.7, 1.25], [1.4, 2.0], [0.2, 2.6]], '#2b2b2b');
      ctx.beginPath(); ctx.moveTo(X(-0.85), Y(0.65)); ctx.lineTo(X(1.0), Y(0.65)); ctx.quadraticCurveTo(X(1.75), Y(0.65), X(1.7), Y(1.25)); ctx.lineTo(X(-0.85), Y(1.25)); ctx.closePath(); ctx.fillStyle = '#1f1f1f'; ctx.fill(); ctx.stroke();
      box(-1.05, 0.95, -0.85, 1.05, '#ffffff');
      for (let i = 0; i < 6; i++) box(-0.8 + i * 0.25, 0.68, -0.65 + i * 0.25, 1.0, '#ffffff');
      for (let i = 0; i < 5; i++) box(-0.68 + i * 0.25, 0.8, -0.6 + i * 0.25, 1.0, '#1f1f1f');
      dot(1.15, 0.95, 0.15, g.night ? '#ffd56b' : '#bfe6ff');
      box(0.35, 0, 0.8, 0.62, '#7a4a2a', 3);
      ctx.fillStyle = INK;
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.5 + k / 3) % 1, x = 0.4 + k * 0.4 + Math.sin(t * 2 + k) * 0.08, y = 2.2 + ph * 0.9;
        ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(X(x), Y(y), 0.07 * g.s, 0.05 * g.s, -0.4, 0, 7); ctx.fill();
        ctx.fillRect(X(x + 0.05), Y(y + 0.3), 3, 0.3 * g.s); ctx.globalAlpha = 1;
      }
    },
    // ねこのタマ：ダンボール箱。横に積んだ「ねこマンション」から目がのぞく
    cat(g) {
      const { X, Y, box, poly, line, dot } = H0(g), t = g.t;
      const c1 = '#d9a46a', c2 = '#b98450', c3 = '#7a5230';
      // ねこマンション
      [[0.75, 0, 1.55, 0.7], [0.85, 0.7, 1.5, 1.3], [0.8, 1.3, 1.4, 1.85]].forEach(([x0, y0, x1, y1], i) => {
        box(x0, y0, x1, y1, i % 2 ? c2 : c1);
        const hx = (x0 + x1) / 2, hy = (y0 + y1) / 2; dot(hx, hy, 0.17, '#2a1c12');
        const blink = Math.sin(t * 1.3 + i * 2) > 0.95;
        ctx.fillStyle = g.night ? '#ffe66b' : '#d8f0a0';
        if (!blink) for (const dx of [-0.06, 0.06]) { ctx.beginPath(); ctx.ellipse(X(hx + dx), Y(hy), 0.035 * g.s, 0.05 * g.s, 0, 0, 7); ctx.fill(); }
      });
      line(1.1, 1.85, 1.1, 2.2, 3); line(0.98, 2.2, 1.22, 2.2, 3);
      poly([[-1.0, 0.9], [0.45, 0.9], [0.75, 1.12], [-0.7, 1.12]], c3);
      poly([[-0.7, 1.12], [0.75, 1.12], [0.95, 1.55], [-0.5, 1.55]], c2);
      drawWaiter(X(-0.25), Y(0.48), g.who, g.face);
      poly([[0.45, 0], [0.75, 0.22], [0.75, 1.12], [0.45, 0.9]], c2);
      box(-1.0, 0, 0.45, 0.9, c1);
      line(-1.0, 0.45, 0.45, 0.45, 5, 'rgba(255,255,255,.35)');
      poly([[-1.0, 0.9], [0.45, 0.9], [0.35, 0.62], [-0.9, 0.62]], c2);
      poly([[-1.0, 0.9], [-0.7, 1.12], [-1.25, 1.4], [-1.42, 1.1]], c1);
      ctx.save(); ctx.globalAlpha = 0.55;
      for (const [x, y] of [[-0.75, 0.25], [-0.55, 0.35]]) { dot(x, y, 0.05, INK); for (const [dx, dy] of [[-0.06, 0.07], [0, 0.09], [0.06, 0.07]]) dot(x + dx, y + dy, 0.022, INK); }
      line(-0.15, 0.25, 0.25, 0.25, 3); for (const x of [-0.05, 0.05, 0.15]) line(x, 0.17, x, 0.33, 2.5); poly([[0.25, 0.25], [0.33, 0.33], [0.33, 0.17]]); dot(-0.18, 0.25, 0.04, INK);
      ctx.restore();
      return true; // 待つ人はもうかいた
    },
    // 犬のコロ：骨の形の屋根の犬小屋
    dog(g) {
      const { X, Y, box, poly, line, dot } = H0(g);
      box(-0.3, 0, 0.9, 0.75, '#c96a4a');
      ctx.fillStyle = '#2a1c12'; ctx.beginPath(); ctx.moveTo(X(0.1), Y(0)); ctx.lineTo(X(0.1), Y(0.35)); ctx.arc(X(0.3), Y(0.35), 0.2 * g.s, Math.PI, 0); ctx.lineTo(X(0.5), Y(0)); ctx.closePath(); ctx.fill(); ctx.stroke();
      // 骨の屋根
      box(-0.45, 0.75, 1.05, 1.05, '#fff7e6', 12);
      for (const [x, y] of [[-0.5, 0.78], [-0.5, 1.02], [1.1, 0.78], [1.1, 1.02]]) dot(x, y, 0.13, '#fff7e6');
      box(-0.4, 0.8, 1.0, 1.0, '#fff7e6', 10); ctx.stroke();
      box(0.12, 0.8, 0.48, 0.98, '#e9c48f', 3);
      ctx.fillStyle = INK; ctx.font = `800 ${Math.round(g.s * (YL.latin ? 0.1 : 0.12))}px ${JF}`; ctx.textAlign = 'center'; ctx.fillText(jaen('コロ', 'KORO'), X(0.3), Y(0.85));
      // えさ皿と骨の山
      poly([[1.1, 0], [1.55, 0], [1.48, 0.13], [1.17, 0.13]], '#4f8be8');
      for (const [x, y, a] of [[1.25, 0.2, 0.3], [1.42, 0.24, -0.4], [1.33, 0.33, 0.1]]) { ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(a); ctx.fillStyle = '#fff7e6'; ctx.fillRect(-0.12 * g.s, -0.025 * g.s, 0.24 * g.s, 0.05 * g.s); ctx.strokeRect(-0.12 * g.s, -0.025 * g.s, 0.24 * g.s, 0.05 * g.s); ctx.restore(); }
    },
    // 王さま：プリンのお城（真ん中が巨大プリン）
    king(g) {
      const { X, Y, box, poly, line } = H0(g), t = g.t;
      const sd = '#c2b9a5', rf = '#c0392b', win = g.night ? '#ffd56b' : '#3b4a6b';
      const tower = (x0, x1, h) => {
        box(x0, 0, x1, h, sd);
        ctx.save(); ctx.beginPath(); ctx.rect(X(x0), Y(h), (x1 - x0) * g.s, h * g.s); ctx.clip(); for (let r = 1; r * 0.22 < h; r++) line(x0, r * 0.22, x1, r * 0.22, 1.5, 'rgba(59,42,30,.22)'); ctx.restore();
        poly([[x0 - 0.08, h], [x1 + 0.08, h], [(x0 + x1) / 2, h + 0.9]], rf);
        const fx = (x0 + x1) / 2, fy = h + 0.9; line(fx, fy, fx, fy + 0.45, 3);
        const w = Math.sin(t * 5 + x0) * 0.05; poly([[fx, fy + 0.45], [fx + 0.38, fy + 0.36 + w], [fx, fy + 0.27]], '#ffd23a');
        box(fx - 0.1, h - 0.75, fx + 0.1, h - 0.4, win, 6);
      };
      tower(-1.05, -0.45, 2.4); tower(1.15, 1.75, 2.4);
      // お皿と巨大プリン
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(X(0.35), Y(0.05), 1.0 * g.s, 0.12 * g.s, 0, 0, 7); ctx.fill(); ctx.stroke();
      poly([[-0.5, 0.08], [1.2, 0.08], [0.95, 2.0], [-0.25, 2.0]], '#ffd23a');
      ctx.fillStyle = '#8a4a1c'; ctx.beginPath(); ctx.moveTo(X(-0.25), Y(2.0)); ctx.lineTo(X(0.95), Y(2.0)); ctx.lineTo(X(0.98), Y(1.75)); ctx.quadraticCurveTo(X(0.85), Y(1.55), X(0.75), Y(1.78)); ctx.quadraticCurveTo(X(0.55), Y(1.45), X(0.4), Y(1.75)); ctx.quadraticCurveTo(X(0.15), Y(1.6), X(0.0), Y(1.78)); ctx.quadraticCurveTo(X(-0.15), Y(1.65), X(-0.22), Y(1.78)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8a4a1c'; ctx.beginPath(); ctx.ellipse(X(0.35), Y(2.0), 0.6 * g.s, 0.1 * g.s, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.65)'; roundRect(X(-0.15), Y(1.5), 0.1 * g.s, 0.9 * g.s, 4); ctx.fill();
      line(0.35, 2.05, 0.35, 2.6, 3); const w = Math.sin(t * 5) * 0.05; poly([[0.35, 2.6], [0.8, 2.5 + w], [0.35, 2.4]], '#e8303a');
      // 門
      ctx.fillStyle = '#6b4226'; ctx.beginPath(); ctx.moveTo(X(0.08), Y(0.06)); ctx.lineTo(X(0.08), Y(0.6)); ctx.arc(X(0.35), Y(0.6), 0.27 * g.s, Math.PI, 0); ctx.lineTo(X(0.62), Y(0.06)); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (const x of [-0.05, 0.75]) box(x - 0.09, 1.0, x + 0.09, 1.3, win, 6);
      ctx.fillStyle = '#d63a3a'; ctx.beginPath(); ctx.moveTo(X(0.12), Y(0)); ctx.lineTo(X(0.58), Y(0)); ctx.lineTo(X(-1.0), Y(-0.08)); ctx.lineTo(X(-1.6), Y(-0.08)); ctx.closePath(); ctx.fill();
    },
    // おばけのフワリ：かたむいた洋館。窓から目・コウモリ
    ghost(g) {
      const { X, Y, box, poly, line, dot } = H0(g), t = g.t;
      ctx.save(); ctx.translate(X(0.3), Y(0)); ctx.rotate(0.06); ctx.translate(-X(0.3), -Y(0));
      box(-0.8, 0, 1.4, 1.9, '#7c7394');
      poly([[-1.0, 1.85], [1.6, 1.85], [0.3, 2.9]], '#3e3756');
      line(0.6, 2.5, 0.85, 2.3, 2, '#9d95b8'); line(-0.2, 2.2, 0.0, 2.45, 2, '#9d95b8');
      for (const [x, y] of [[-0.55, 1.1], [0.95, 1.1], [0.2, 2.15]]) {
        box(x, y, x + 0.4, y + 0.45, '#1c1830');
        const bl = Math.sin(t * 1.7 + x * 3) > 0.9;
        if (!bl) { ctx.fillStyle = '#ffe66b'; ctx.beginPath(); ctx.ellipse(X(x + 0.13), Y(y + 0.25), 0.04 * g.s, 0.06 * g.s, 0, 0, 7); ctx.ellipse(X(x + 0.27), Y(y + 0.25), 0.04 * g.s, 0.06 * g.s, 0, 0, 7); ctx.fill(); }
      }
      line(0.95, 1.1, 1.35, 1.55, 6, '#8a5a35'); line(0.95, 1.55, 1.35, 1.1, 6, '#8a5a35');
      box(0.1, 0, 0.65, 0.95, '#3b2a1e', 4);
      ctx.restore();
      for (let k = 0; k < 2; k++) {
        const bx = 0.4 + k * 0.9 + Math.sin(t * 1.3 + k) * 0.25, by = 3.1 + Math.cos(t * 1.7 + k) * 0.12, f = Math.sin(t * 14 + k) * 0.08;
        ctx.fillStyle = '#2b2440'; ctx.beginPath(); ctx.moveTo(X(bx), Y(by)); ctx.lineTo(X(bx - 0.22), Y(by + 0.08 + f)); ctx.lineTo(X(bx - 0.12), Y(by - 0.02)); ctx.lineTo(X(bx), Y(by - 0.06)); ctx.lineTo(X(bx + 0.12), Y(by - 0.02)); ctx.lineTo(X(bx + 0.22), Y(by + 0.08 + f)); ctx.closePath(); ctx.fill();
      }
    },
    // うちゅう人：UFO。光で牛を吸い上げている
    alien(g) {
      const { X, Y, poly, line, dot } = H0(g), t = g.t, hov = Math.sin(t * 2) * 0.06;
      ctx.save(); ctx.fillStyle = 'rgba(255,240,140,.45)'; ctx.beginPath(); ctx.moveTo(X(0.2), Y(1.9 + hov)); ctx.lineTo(X(0.9), Y(1.9 + hov)); ctx.lineTo(X(1.35), Y(0)); ctx.lineTo(X(-0.25), Y(0)); ctx.closePath(); ctx.fill(); ctx.restore();
      // うく牛
      const cy = 0.7 + Math.sin(t * 1.2) * 0.15, cr = Math.sin(t) * 0.2;
      ctx.save(); ctx.translate(X(0.55), Y(cy)); ctx.rotate(cr); const S = g.s;
      for (const dx of [-0.2, -0.08, 0.1, 0.22]) { ctx.fillStyle = '#ffffff'; ctx.fillRect(dx * S - 2, 0.1 * S, 5, 0.18 * S); ctx.strokeRect(dx * S - 2, 0.1 * S, 5, 0.18 * S); }
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, 0.32 * S, 0.17 * S, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(-0.1 * S, -0.05 * S, 0.08 * S, 0.06 * S, 0.3, 0, 7); ctx.ellipse(0.14 * S, 0.04 * S, 0.06 * S, 0.05 * S, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0.36 * S, -0.1 * S, 0.12 * S, 0.1 * S, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffb3c1'; ctx.beginPath(); ctx.ellipse(0.44 * S, -0.08 * S, 0.06 * S, 0.05 * S, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
      // UFO
      const uy = 2.05 + hov;
      ctx.fillStyle = '#bfe6ff'; ctx.beginPath(); ctx.ellipse(X(0.55), Y(uy + 0.15), 0.4 * g.s, 0.35 * g.s, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9ced8'; ctx.beginPath(); ctx.ellipse(X(0.55), Y(uy), 1.05 * g.s, 0.25 * g.s, 0, 0, 7); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 6; i++) { const on = Math.floor(t * 6 + i) % 3 === 0; dot(-0.25 + i * 0.32, uy - 0.05, 0.05, on ? '#ffe66b' : '#7a5af8'); }
    },
  };
  function drawHouse(hx, who, face, n) {
    const [gx, gy] = W2S(hx, game.groundHeightAt(hx)); const s = scale;
    if (HOUSES[who.id]) {
      ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const done = HOUSES[who.id]({ gx, gy, s, who, face, night: themeOf(level).night > 0.3, t: performance.now() / 1000 });
      ctx.restore();
      if (!done) drawWaiter(gx - s * 1.32, gy, who, face); // ゴールの線の先に立つ
      return;
    }
    const roof = ROOFS[n % ROOFS.length];
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = '#3b2a1e'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // えんとつ（屋根のうしろ）
    ctx.fillStyle = '#c96f4a'; ctx.fillRect(gx + s * 0.55, gy - s * 3.0, s * 0.32, s * 0.75); ctx.strokeRect(gx + s * 0.55, gy - s * 3.0, s * 0.32, s * 0.75);
    ctx.fillStyle = '#8a4a32'; ctx.fillRect(gx + s * 0.5, gy - s * 3.08, s * 0.42, s * 0.12); ctx.strokeRect(gx + s * 0.5, gy - s * 3.08, s * 0.42, s * 0.12);
    // かべ（よこの板）
    ctx.fillStyle = '#fff1d0'; ctx.fillRect(gx - s * 1.2, gy - s * 1.9, s * 2.4, s * 1.9);
    ctx.strokeStyle = 'rgba(59,42,30,.12)'; ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) { const y = gy - s * 1.9 + i * s * 0.32; ctx.beginPath(); ctx.moveTo(gx - s * 1.2, y); ctx.lineTo(gx + s * 1.2, y); ctx.stroke(); }
    ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 3; ctx.strokeRect(gx - s * 1.2, gy - s * 1.9, s * 2.4, s * 1.9);
    // 屋根（のき＋かわらの段）
    ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(gx - s * 1.6, gy - s * 1.85); ctx.lineTo(gx, gy - s * 3.05); ctx.lineTo(gx + s * 1.6, gy - s * 1.85); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip(); ctx.strokeStyle = tone(roof, 0.75); ctx.lineWidth = 2.5;
    for (let i = 1; i < 4; i++) { const y = gy - s * 1.85 - i * s * 0.3; ctx.beginPath(); ctx.moveTo(gx - s * 1.6, y); ctx.lineTo(gx + s * 1.6, y); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = tone(roof, 0.7); roundRect(gx - s * 1.68, gy - s * 1.92, s * 3.36, s * 0.14, 4); ctx.fill(); ctx.stroke();
    // まど（わく・十字・まどがまち）
    const wx0 = gx + s * 0.2, wy0 = gy - s * 1.45, ww = s * 0.72, wh = s * 0.58;
    ctx.fillStyle = themeOf(level).night > 0.3 ? '#ffd56b' : '#9fdcff'; ctx.fillRect(wx0, wy0, ww, wh);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(wx0 + ww * 0.12, wy0 + wh * 0.85); ctx.lineTo(wx0 + ww * 0.32, wy0 + wh * 0.12); ctx.lineTo(wx0 + ww * 0.42, wy0 + wh * 0.12); ctx.lineTo(wx0 + ww * 0.22, wy0 + wh * 0.85); ctx.fill();
    ctx.strokeRect(wx0, wy0, ww, wh);
    ctx.beginPath(); ctx.moveTo(wx0 + ww / 2, wy0); ctx.lineTo(wx0 + ww / 2, wy0 + wh); ctx.moveTo(wx0, wy0 + wh / 2); ctx.lineTo(wx0 + ww, wy0 + wh / 2); ctx.stroke();
    ctx.fillStyle = '#fff'; roundRect(wx0 - s * 0.06, wy0 + wh, ww + s * 0.12, s * 0.08, 3); ctx.fill(); ctx.stroke();
    // ドア（ふち・ノブ・ステップ）
    ctx.fillStyle = '#a8703f'; roundRect(gx - s * 1.0, gy - s * 1.25, s * 0.62, s * 1.25, 6); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(59,42,30,.35)'; ctx.lineWidth = 2; roundRect(gx - s * 0.92, gy - s * 1.15, s * 0.46, s * 0.45, 4); ctx.stroke(); roundRect(gx - s * 0.92, gy - s * 0.62, s * 0.46, s * 0.5, 4); ctx.stroke();
    ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 3;
    ctx.fillStyle = '#ffcf3d'; ctx.beginPath(); ctx.arc(gx - s * 0.48, gy - s * 0.62, s * 0.05, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9c2b4'; ctx.fillRect(gx - s * 1.08, gy - s * 0.07, s * 0.78, s * 0.07); ctx.strokeRect(gx - s * 1.08, gy - s * 0.07, s * 0.78, s * 0.07);
    // 表札（木の小さい板）
    ctx.font = `800 ${Math.round(s * (YL.latin ? 0.11 : 0.13))}px ${JF}`; ctx.textAlign = 'center';
    const tw = ctx.measureText(who.name).width + s * 0.16, tx = wx0 + ww / 2, ty = gy - s * 0.6;
    ctx.fillStyle = '#e9c48f'; roundRect(tx - tw / 2, ty - s * 0.13, tw, s * 0.24, 4); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#3b2a1e'; ctx.fillText(who.name, tx, ty + s * 0.04);
    // 植木
    ctx.lineWidth = 3; ctx.fillStyle = '#5fb35a';
    for (const [dx, r] of [[0.95, 0.22], [1.18, 0.17], [0.76, 0.16]]) { ctx.beginPath(); ctx.arc(gx + s * dx, gy - s * r * 0.9, s * r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    drawWaiter(gx - s * 1.32, gy, who, face); // ゴールの線の先・ドアの前に立つ
  }
  // 待っている人：主人公と同じ線の太さで、体と手足をかく。気持ちで手の動きが変わる
  function drawWaiter(wx, wy, who, face) {
    const s = scale, t = performance.now() / 1000;
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = '#3b2a1e'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const limb = (x, y, len, ang, w, col) => { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = col; roundRect(-w / 2, -w / 2, w, len + w / 2, w / 2); ctx.fill(); ctx.stroke(); ctx.restore(); };
    if (who.animal) { // すわっている ねこ・犬（しっぽをふる）
      const col = who.hair, wag = Math.sin(t * (face === 'happy' ? 14 : 4)) * 0.5;
      ctx.save(); ctx.translate(wx + s * 0.28, wy - s * 0.18); ctx.rotate(-0.9 + wag); ctx.fillStyle = col; roundRect(-s * 0.05, -s * 0.38, s * 0.1, s * 0.4, s * 0.05); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(wx, wy - s * 0.28, s * 0.3, s * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = tone(col, 1.35); ctx.beginPath(); ctx.ellipse(wx, wy - s * 0.24, s * 0.15, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      for (const dx of [-0.12, 0.12]) { ctx.fillStyle = col; roundRect(wx + s * (dx - 0.06), wy - s * 0.22, s * 0.12, s * 0.22, s * 0.05); ctx.fill(); ctx.stroke(); }
      WT.drawFace(ctx, who, face, wx, wy - s * 0.72, s * 0.26, t);
      ctx.restore(); return;
    }
    const shirt = who.body || SHIRTS[who.id] || '#7bb7e8', pants = who.id === 'ghost' ? null : tone(shirt, 0.55);
    const hipY = wy - s * 0.5, shY = wy - s * 1.0;
    if (pants) { // 足とくつ
      for (const dx of [-0.08, 0.08]) {
        limb(wx + s * dx, hipY, s * 0.42, 0, s * 0.13, pants);
        ctx.fillStyle = '#3b2a1e'; roundRect(wx + s * dx - s * 0.08, wy - s * 0.07, s * 0.2, s * 0.08, s * 0.04); ctx.fill();
      }
    }
    // 手（気持ちで動き）
    const arm = (side) => {
      let a; // 0 = まっすぐ下
      if (face === 'happy') a = side * (2.6 + Math.sin(t * 12 + side) * 0.35);
      else if (face === 'wait') a = side < 0 ? -(2.4 + Math.sin(t * 5) * 0.4) : 0.15;
      else if (face === 'angry') a = side * 0.9;
      else if (face === 'cry' || face === 'sad') a = side * 0.12;
      else a = side * 0.3;
      limb(wx + side * s * 0.2, shY + s * 0.06, s * 0.36, -a, s * 0.11, shirt);
    };
    arm(1);
    // 体（服）
    ctx.fillStyle = shirt;
    if (who.id === 'ghost') { ctx.beginPath(); ctx.moveTo(wx - s * 0.26, shY); ctx.lineTo(wx - s * 0.3, wy - s * 0.1); for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(wx - s * 0.3 + (i + 0.5) * s * 0.15, wy + s * (i % 2 ? 0.02 : -0.2), wx - s * 0.3 + (i + 1) * s * 0.15, wy - s * 0.1); ctx.lineTo(wx + s * 0.26, shY); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else { roundRect(wx - s * 0.24, shY, s * 0.48, s * 0.56, s * 0.14); ctx.fill(); ctx.stroke(); }
    arm(-1);
    WT.drawFace(ctx, who, face, wx, shY - s * 0.26, s * 0.27, t);
    ctx.restore();
  }
  // ふきだし（世界の座標 x,y の上に）
  function bubble(x, y, text) {
    const [bx, by] = W2S(x, game.groundHeightAt(x) + y); const s = scale;
    ctx.font = `800 ${Math.round(s * 0.2)}px sans-serif`; ctx.textAlign = 'center';
    if (YL.en) { const mw = Math.max(...text.split('\n').map((l) => ctx.measureText(l).width)), room = W * 0.8 - 20; if (mw > room) ctx.font = `800 ${Math.max(10, Math.floor(s * 0.2 * room / mw))}px sans-serif`; }
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
  // つぶ（土ぼこり・キラキラ・プリンのしぶき・ピヨピヨ星・紙吹雪）。scr=true は画面の位置
  const parts = []; let shakeA = 0, partT = performance.now(), partDt = 0;
  function puff(x, y, n, big) {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.1 + 0.8 * Math.random()), sp = (big ? 1.6 : 0.8) * (0.4 + Math.random());
      parts.push({ k: 'dust', x: x + (Math.random() - 0.5) * 0.2, y: y + 0.03, vx: Math.cos(a) * sp * (i % 2 ? 1 : -1), vy: Math.sin(a) * sp * 0.5, g: -0.4, life: 0, max: 0.45 + Math.random() * 0.3, r: (big ? 0.12 : 0.07) + Math.random() * 0.05 });
    }
  }
  function sparkle(x, y, n, col) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2; parts.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 2, life: 0, max: 0.6 + Math.random() * 0.3, r: 0.09 + Math.random() * 0.06, col: col || '#ffd23a' }); }
  }
  function splat(x, y) {
    for (let i = 0; i < 16; i++) { const a = -Math.PI * Math.random(), sp = 1.5 + Math.random() * 3; parts.push({ k: 'blob', x, y, vx: Math.cos(a) * sp, vy: -Math.sin(a) * sp, g: 9, life: 0, max: 1.2, r: 0.05 + Math.random() * 0.07, col: i % 4 ? '#ffd23a' : '#8a4a1c' }); }
  }
  function confetti() {
    const cols = ['#ffd23a', '#ff6b8b', '#4fb8ff', '#5fc96b', '#b46cf0', '#ff9a3d'];
    for (let i = 0; i < 90; i++) parts.push({ k: 'conf', scr: true, x: Math.random() * W, y: -20 - Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 160, g: 0, life: 0, max: 4.5, r: 5 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, col: cols[i % cols.length] });
  }
  function drawParts(scr) {
    if (!scr) { const now = performance.now(); partDt = Math.min(0.05, (now - partT) / 1000); partT = now; }
    const dt = partDt;
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; if (!!q.scr !== scr) continue;
      if (!scr || q.k === 'conf') { q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (scr ? 0 : -q.g) * dt; }
      if (q.life > q.max) { parts.splice(i, 1); continue; }
      const a = 1 - q.life / q.max;
      if (q.k === 'conf') {
        q.rot += q.vr * dt; q.vx += Math.sin(q.life * 4 + i) * 2;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(1, Math.abs(Math.cos(q.life * 6 + i)) + 0.2);
        ctx.globalAlpha = Math.min(1, a * 3); ctx.fillStyle = q.col; ctx.fillRect(-q.r, -q.r * 0.6, q.r * 2, q.r * 1.2); ctx.restore(); ctx.globalAlpha = 1; continue;
      }
      const [x, y] = W2S(q.x, q.y), r = q.r * scale;
      if (q.k === 'dust') { ctx.globalAlpha = a * 0.75; ctx.fillStyle = '#f3e3cc'; ctx.beginPath(); ctx.arc(x, y, r * (1 + q.life * 2.2), 0, Math.PI * 2); ctx.fill(); }
      else if (q.k === 'blob') { ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      else if (q.k === 'spark') { ctx.globalAlpha = a; star4(x, y, r * (0.6 + a * 0.6), q.col); }
      ctx.globalAlpha = 1;
    }
  }
  function star4(x, y, r, col) {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
  }
  // 転んだあと、頭のまわりを回る星
  function drawDizzy() {
    if (S.status !== 'fallen' || !S.char) return;
    const hp = S.char.head.getPosition(), [x, y] = W2S(hp.x, hp.y + 0.32), t = performance.now() / 1000;
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * Math.PI * 2 / 3, px = x + Math.cos(a) * scale * 0.32, py = y + Math.sin(a) * scale * 0.1;
      ctx.lineWidth = 2; ctx.strokeStyle = '#3b2a1e'; star4(px, py, scale * 0.11, '#ffd23a');
    }
  }
  // ---- ころび芸（転んだあとの、毎回ちがうばかばかしいできごと。gags.js に一覧） ----
  const GG = window.YoroGags || { LIST: [], pick: () => null, pickV: () => null, nameOf: (d) => d.name, total: () => 0 };
  let gag = null; // 今やっている芸
  const GBOX = { l: -1.7, r: 2.0, b: -0.7, t: 2.8 }; // 写しを取る広さ（地面の足もとから、メートル）
  // 主人公を今の形のまま、別の紙に写す
  function takeSnap() {
    const c = S.char; if (!c) return null;
    const keepS = scale; scale = baseScale * 1.7; // 寄っても ぼやけないよう、大きめに写す
    const tp = c.torso.getPosition(), ax = tp.x, ay = game.groundHeightAt(tp.x), s = scale;
    const w = (GBOX.r - GBOX.l) * s, h = (GBOX.t - GBOX.b) * s;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * DPR); cv.height = Math.ceil(h * DPR);
    const g2 = cv.getContext('2d'), [sx, sy] = W2S(ax, ay);
    g2.setTransform(DPR, 0, 0, DPR, (-GBOX.l * s - sx) * DPR, (GBOX.t * s - sy) * DPR);
    const keep = ctx; ctx = g2; try { drawChar(); } finally { ctx = keep; scale = keepS; }
    let l = 9, r = -9, b = 9, t = -9;
    for (const bd of [c.head, c.torso, c.tray, c.L.thigh, c.L.shin, c.R.thigh, c.R.shin]) {
      const p = bd.getPosition(); l = Math.min(l, p.x - ax); r = Math.max(r, p.x - ax); b = Math.min(b, p.y - ay); t = Math.max(t, p.y - ay);
    }
    const hp = c.head.getPosition();
    const bb = { l: Math.max(GBOX.l, l - 0.3), r: Math.min(GBOX.r, r + 0.4), b: Math.max(GBOX.b, b - 0.3), t: Math.min(GBOX.t, t + 0.35) };
    return { img: cv, ax: -GBOX.l * s, ay: GBOX.t * s, w, h, s, x: ax, y: ay, bb, cx: (bb.l + bb.r) / 2, cy: (bb.b + bb.t) / 2, hx: hp.x - ax, hy: hp.y - ay, ha: c.head.getAngle(), tints: {} };
  }
  // 写しをかく。(x, y)＝写しの足もとを置く世界の位置。px/py＝回す中心（足もとからのずれ）、scr＝画面の位置で指定
  function drawSnap(sn, x, y, o = {}) {
    if (!sn) return;
    const px = o.px || 0, py = o.py || 0, k = scale / sn.s;
    ctx.save();
    if (o.clipY !== undefined) { const [, cy] = W2S(0, o.clipY); ctx.beginPath(); ctx.rect(-W, -H * 2, W * 3, cy + H * 2); ctx.clip(); }
    if (o.alpha !== undefined) ctx.globalAlpha *= Math.max(0, o.alpha);
    const [X, Y] = o.scr ? [x, y] : W2S(x + px, y + py);
    ctx.translate(X, Y); if (o.rot) ctx.rotate(o.rot); ctx.scale((o.sx ?? 1) * k, (o.sy ?? 1) * k);
    const ox = -sn.ax - px * sn.s, oy = -sn.ay + py * sn.s;
    if (o.circle) { const [mx, my, r] = o.circle; ctx.beginPath(); ctx.arc(ox + sn.ax + mx * sn.s, oy + sn.ay - my * sn.s, r * sn.s, 0, Math.PI * 2); ctx.clip(); }
    ctx.drawImage(sn.img, ox, oy, sn.w, sn.h);
    ctx.restore();
  }
  // 写しの一部（かけら）を、世界の (x, y) を中心に回してかく。rx, ry, rw, rh は足もとからのメートル
  function drawPiece(sn, rx, ry, rw, rh, x, y, rot) {
    const k = DPR, [X, Y] = W2S(x, y);
    ctx.save(); ctx.translate(X, Y); ctx.rotate(rot || 0);
    const w = rw * scale, h = rh * scale;
    ctx.drawImage(sn.img, (sn.ax + rx * sn.s) * k, (sn.ay - (ry + rh) * sn.s) * k, rw * sn.s * k, rh * sn.s * k, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  // 写しに色をかぶせたもの（石・氷・こげ・たましい。iPhone でも動くよう、色を上からぬる方法で）
  function tintSnap(sn, col, a) {
    const key = col + a; if (sn.tints[key]) return sn.tints[key];
    const cv = document.createElement('canvas'); cv.width = sn.img.width; cv.height = sn.img.height;
    const g2 = cv.getContext('2d'); g2.drawImage(sn.img, 0, 0); g2.globalCompositeOperation = 'source-atop'; g2.globalAlpha = a; g2.fillStyle = col; g2.fillRect(0, 0, cv.width, cv.height);
    return (sn.tints[key] = { ...sn, img: cv, tints: {} });
  }
  // 芸の中から使う道具
  const GAPI = {
    get c() { return ctx; }, get s() { return scale; }, get W() { return W; }, get H() { return H; },
    P: (x, y) => W2S(x, y), gy: (x) => game.groundHeightAt(x),
    takeSnap, snapNow() { const sn = takeSnap(); if (sn) this.snap = sn; return this.snap; },
    draw: drawSnap, piece: drawPiece, tint: tintSnap,
    at(t, key, fn) { if (this.t >= t && !this.fired.has(key)) { this.fired.add(key); fn(); } },
    puff, sparkle,
    splat(x, y, col, n = 14) { for (let i = 0; i < n; i++) { const a = -Math.PI * Math.random(), sp = 1.5 + Math.random() * 3; parts.push({ k: 'blob', x, y, vx: Math.cos(a) * sp, vy: -Math.sin(a) * sp, g: 9, life: 0, max: 1.2, r: 0.05 + Math.random() * 0.07, col: col || '#ffd23a' }); } },
    shake(a) { shakeA = Math.max(shakeA, a); }, buzz(ms) { if (navigator.vibrate) navigator.vibrate(ms); }, sfx(n) { snd.play('g', n); },
    head() { const p = S.char.head.getPosition(); return [p.x, p.y]; }, headA() { return S.char.head.getAngle(); },
    torso() { const p = S.char.torso.getPosition(); return [p.x, p.y]; },
    bodyPt(i) { const c = S.char, b = [c.torso, c.head, c.L.thigh, c.R.shin, c.tray, c.R.thigh][i % 6].getPosition(); return [b.x, b.y]; },
    shirt: () => OUT().shirt, skin: () => SK().face,
    // 音のことば（ドーン！など）。from 秒から dur 秒だけ、ポンと出て消える
    word(str, x, y, from, o = {}) {
      const a = this.t - from, dur = o.dur || 1.0; if (a < 0 || a > dur) return;
      const p = a / 0.14 - 1, k = a < 0.14 ? Math.max(0.01, 1 + 2.9 * p ** 3 + 1.9 * p ** 2) : 1, al = a > dur - 0.25 ? (dur - a) / 0.25 : 1;
      const [X, Y] = o.scr ? [x, y] : W2S(x, y + a * 0.25), size = o.scr ? o.size : (o.size || 0.5) * scale;
      ctx.save(); ctx.globalAlpha = al; ctx.translate(X, Y); ctx.rotate(o.rot ?? -0.1); ctx.scale(k, k);
      ctx.font = `${Math.round(size)}px ${NF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = size * 0.24; ctx.strokeText(str, 0, 0); ctx.fillStyle = o.col || '#fff'; ctx.fillText(str, 0, 0);
      ctx.restore();
    },
  };
  const OPENING = [['crush', 'piano'], ['screen'], ['bird']]; // はじめて遊ぶ人の 1回目・2回目・3回目の芸（ピアノでぺしゃんこ → 画面にベチャッ → とりにさらわれる）
  function startGag() {
    gag = null;
    clearTimeout(hintTimer); hintTimer = null; ui.hint.style.opacity = 0; // 開始の案内が芸の上に残らないように
    if (!S.char || !GG.LIST.length) return;
    const cx = { reason: S.fallReason, who: waiter.id, night: themeOf(level).night, level };
    let pk;
    if (force.gag) { const d = GG.LIST.find((x) => x.id === force.gag); if (d) pk = { def: d, v: GG.pickV(d, cx, force.gagv) }; }
    if (!pk && S.fallReason !== 'hole' && GG.LIST.filter((d) => ZK.has('gag', d.id)).length < 3) { // はじめの3回は、ひと目で笑える派手な芸から
      const o = OPENING.find(([id]) => !ZK.has('gag', id)), d = o && GG.LIST.find((x) => x.id === o[0]);
      if (d) pk = { def: d, v: GG.pickV(d, cx, o[1]) };
    }
    if (!pk) pk = GG.pick(cx, (id) => ZK.has('gag', id));
    const tp = S.char.torso.getPosition();
    gag = Object.assign(Object.create(GAPI), { def: pk.def, v: pk.v, t0: performance.now(), t: 0, dt: 0, st: {}, fired: new Set(), hide: false, cam: null, skip: false, pic: false, x: tp.x, y: game.groundHeightAt(tp.x) });
    gag.snap = takeSnap();
    gagRun('start');
  }
  function gagRun(fn) {
    if (!gag || !gag.def[fn]) return;
    try { gag.def[fn](gag); } catch (e) { console.warn('gag', gag.def.id, e); gag.hide = false; gag.def = { id: gag.def.id, name: gag.def.name, dur: 0.6 }; }
  }
  // ずかん用に、芸のいちばんおもしろいところを小さな写真で取っておく
  function gagPhoto() {
    try {
      if (!ZK.gagPic) return;
      const sz = Math.min(W, H) * 0.86, [cx, cy] = gag.def.id === 'screen' ? [W / 2, H * 0.45] : [W * ancX, H * (anc - 0.02)];
      const cv = document.createElement('canvas'); cv.width = cv.height = 132;
      cv.getContext('2d').drawImage(canvas, (cx - sz / 2) * DPR, (cy - sz / 2) * DPR, sz * DPR, sz * DPR, 0, 0, 132, 132);
      ZK.gagPic(gag.def.id, cv.toDataURL('image/jpeg', 0.72));
    } catch (e) { /* 写真が取れなくても遊べる */ }
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
    ctx.fillText(k >= 1 ? jaen('はなせ！', 'Let go!') : jaen('ためて…', 'Hold…'), x, y - h);
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
  let tutSteps = 0, tutDone = store.get('yoro.tut') === '1', tiredTold = false, tiredAt = 0;
  function updateHud() {
    updateGuide();
    const st = S.steady == null ? 1 : S.steady;
    ui.balFill.style.width = `${Math.round(st * 100)}%`;
    ui.balFill.style.background = st < 0.35 ? '#ff4d4d' : st < 0.6 ? '#ffb020' : '#5cc96b';
    ui.meter2.classList.toggle('low', st < 0.35 && S.status === 'play');
    const v = S.char && S.status === 'play' ? Math.max(0, S.char.torso.getLinearVelocity().x) : 0;
    spdShown += (v - spdShown) * 0.1;
    ui.spd.textContent = jaen(`${spdShown.toFixed(1)}m/秒`, `${spdShown.toFixed(1)}m/s`, `${spdShown.toFixed(1)}m/秒`);
    ui.spd.classList.toggle('fast', spdShown > 2.3);
    const x = Math.max(0, game.charX());
    $('stgNow').textContent = level; $('stgNext').textContent = level + 1;
    ui.dist.innerHTML = `<svg class="ic"><use href="#i-house"/></svg>${jaen(`あと${Math.ceil(Math.max(0, stage.goal - x))}m`, `${Math.ceil(Math.max(0, stage.goal - x))}m to go`, `还有${Math.ceil(Math.max(0, stage.goal - x))}m`)}`; // おうちまで
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

  }

  // ---- ループ ----
  let last = performance.now(), acc = 0;
  if (bestRun > 0 && !RANK.list().some((r) => r.d >= bestRun - 0.05)) RANK.add(bestRun); // 前からの自己ベストも記録ランキングに入れる
  bestRun = Math.max(bestRun, ...RANK.list().map((r) => r.d)); // 記録ランキングの1位と自己ベストをそろえる
  curBest = bestRun; look = CL.current(ctxNow());
  loadLevel(1); refreshTitle();
  game.spawn(0);
  function frameBody(now) {
    if (force.crash > 0) { force.crash--; throw new Error('test crash'); } // テスト用：わざとエラーを起こす
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    const paused = ui.title.classList.contains('show') || ui.pause.classList.contains('show') || ui.goal.classList.contains('show');
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
        else if (ev.type === 'fall' || ev.type === 'pudding' || ev.type === 'timeup') {
          snd.bgm(false); snd.play(ev.type);
          if (S.char) {
            const tp = S.char.torso.getPosition(); puff(tp.x, game.groundHeightAt(tp.x), 14, true); shakeA = 14;
            if (ev.type === 'pudding') { const tr = S.char.tray.getPosition(); splat(tr.x, tr.y + 0.1); }
            if (navigator.vibrate) navigator.vibrate(60);
          }
          startGag();
        }
        else {
          if (ev.type in mst && ev.type !== 'combo') mst[ev.type]++;
          if (ev.type === 'jump') mst.jumps++;
          if (ev.type === 'combo') mst.combo++;
          snd.play(ev.type, ev.v);
          if ((ev.type === 'land' || ev.type === 'boing') && S.char) { const tp = S.char.torso.getPosition(); puff(tp.x, game.groundHeightAt(tp.x), 8, true); shakeA = Math.max(shakeA, ev.type === 'land' ? 4 : 3); }
          if (ev.type === 'stumble') pop((YL.en ? YL.t({ same: 'Same foot!', fast: 'Too fast!', slow: 'Too slow!' }) : { same: '同じ足！', fast: 'あせりすぎ！', slow: 'もたもた！' })[ev.v.why] || jaen('おっと！', 'Whoops!'), ev.v.bad > 0.6 ? '#e8303a' : '#ff8a00');
          if (ev.type === 'stop') { for (let i = pops.length - 1; i >= 0; i--) if (pops[i].text.startsWith(jaen('ふらふら', 'Wobbly'))) pops.splice(i, 1); pop(jaen('止まっちゃだめ！', "Don't stop!"), '#e8303a'); }
          if (ev.type === 'wobble') pop(jaen('ふらふら…', 'Wobbly…'), '#ff8a00');
          if (ev.type === 'combo') pop(jaen(`ナイスリズム ×${ev.v} スピードUP！`, `Nice rhythm ×${ev.v} Speed UP!`, `节奏不错 ×${ev.v} 加速！`), '#2f9e44');
          if (ev.type === 'jump2' && !(ev.v >= 3)) pop(jaen('2だんジャンプ！', 'Double jump!'), '#2f6fd6'); // 連打でつかれているときは出さない（文字が重なる）
          // 続けて跳ぶと つかれる（はじめは わけも出す。そのあとは 1.5秒に1回まで）
          if (ev.type === 'tired' && performance.now() - tiredAt > 1500) { tiredAt = performance.now(); pop(tiredTold ? jaen('ハァハァ…', 'Huff huff…', '呼哧呼哧…') : jaen('跳びすぎ！ ハァハァ…', 'Too many jumps! Huff…', '跳太多了！呼哧…'), '#ff8a00'); tiredTold = true; }
          if (ev.type === 'tiredLand') { snd.play('stumble', { bad: 0.6 }); shakeA = Math.max(shakeA, 6); }
          if (ev.type === 'step') { const fp = S.char && S.char[ev.v] && S.char[ev.v].shin.getWorldPoint(planck.Vec2(0.07, -0.25)); if (fp) puff(fp.x, game.groundHeightAt(fp.x), 3, false); addPrint(ev.v); if (++tutSteps === 6 && !tutDone) { tutDone = true; store.set('yoro.tut', '1'); } }
        }
      }
      if (level <= 10 && S.status === 'play') { // 最初のうちは、しかけの手前でやり方を出す
        const x = game.charX();
        stage.springs.forEach((q, i) => {
          if (!hinted.has('s' + i) && q.x - x < 2.6 && q.x - x > 0) { hinted.add('s' + i); showBanner(jaen('赤い台に乗ると<br>ピョーンと飛ぶよ！', 'Step on the red springboard<br>to go BOING!')); hintTimer = setTimeout(() => { ui.hint.style.opacity = 0; }, 2500); }
        });
        stage.pits.forEach((q, i) => {
          if (!hinted.has('p' + i) && q.x0 - x < 2.8 && q.x0 - x > 0) { hinted.add('p' + i); showBanner(jaen('穴だ！ 左右を同時にタップ！<br>とどかなければ 空中でもう1回！', 'A hole! Tap both sides at once!<br>Too short? Tap again in midair!')); hintTimer = setTimeout(() => { ui.hint.style.opacity = 0; }, 2500); }
        });
        if (level <= 3 && !hinted.has('b') && ui.hint.style.opacity !== '1') { // ？の箱は歩くだけでは取れないので、はじめのうちは手前で教える（出だしの案内が消えてから）
          const b = boxes.find((q) => !q.taken && q.x - x < 2.6 && q.x - x > 0.8);
          if (b) {
            hinted.add('b');
            showBanner(b.high ? jaen('むらさきの箱は 高い！<br>左右を 長く押して 高くジャンプ', 'Purple boxes are high!<br>Hold both sides to jump higher', '紫色箱子很高！<br>左右一起长按，跳得更高')
              : jaen('？の箱は ジャンプで取る！<br>左右を 同時にタップ', 'Jump to grab the ? box!<br>Tap both sides at once', '跳起来拿？箱子！<br>左右同时按'));
            hintTimer = setTimeout(() => { ui.hint.style.opacity = 0; }, 2500);
          }
        }
        if (level <= 6) stage.obstacles.forEach((o, i) => {
          if (!hinted.has(i) && o.x - x < 2.6 && o.x - x > 0) {
            hinted.add(i); showBanner(jaen('左右を 同時にタップで ジャンプ！<br>長く押すと 高く飛ぶよ', 'Tap both sides at once to jump!<br>Hold longer to jump higher')); hintTimer = setTimeout(() => { ui.hint.style.opacity = 0; }, 3000);
          }
        });
      }
      if (S.status === 'play') { // 歩いたきょりの節目と、自己ベストをこえた瞬間
        const tot = runDist + Math.max(0, game.charX());
        if (!passedBest && curBest > 0 && tot > curBest) { passedBest = true; pop(mode === 'daily' ? jaen('今日のベスト こえた！', "Beat today's best!") : jaen('自己ベスト こえた！', 'New personal best!'), '#d48a00'); snd.play('best'); }
        if (tot >= nextMile) { pop(jaen(`${nextMile}m とっぱ！`, `${nextMile}m reached!`, `突破${nextMile}m！`), '#2f6fd6'); snd.play('checkpoint'); nextMile += 50; }
      }
      if (S.status === 'play') { if ((S.danger || 0) > 0.7) mst.shaky++; if (spdShown >= 2.3) mst.fast++; }
      if (S.status === 'play') pickupBoxes();
      tickMis();
      if (S.status === 'clear') deliver();
      if (gag) { const t = (now - gag.t0) / 1000; gag.dt = Math.min(0.05, Math.max(0, t - gag.t)); gag.t = t; if (!gag.pic && gag.t >= (gag.def.peak || 1)) { gag.pic = true; gag.wantPic = true; } }
      if (S.status === 'fallen' && (gag ? gag.t >= gag.def.dur || gag.skip : S.frame - S.fallFrame > 36)) {
        if (!shownEnd) { shownEnd = true; onFall(); }
      } else if (S.status === 'play') { shownEnd = false; gag = null; }
    }
    const onTitle = ui.title.classList.contains('show');
    zoom += ((gag ? gag.def.zoom || 1.3 : 1) - zoom) * 0.07; if (Math.abs(zoom - 1) < 0.002) zoom = 1; scale = baseScale * zoom;
    if (S.char) {
      const p = S.char.torso.getPosition();
      const gc = gag && gag.cam; // ころび芸のあいだは、芸が見やすい所を見る
      cam.x += ((gc ? gc[0] : p.x + (onTitle ? 1.0 : 0.6)) - cam.x) * 0.08; // タイトルでは家が見えるよう少し左に寄せる
      // 横長の画面：高く跳んだら少し上を見る（高い ？の箱 が上の札にかくれない・ジャンプ台で画面の外へ出ない）
      const hp = S.char.head.getPosition(), wide = W > H && !gc && S.status === 'play';
      const lift = wide ? Math.max(0, hp.y - game.groundHeightAt(hp.x) - 1.95) * 0.8 : 0;
      cam.y += ((gc ? gc[1] - 0.1 : game.groundHeightAt(p.x) + (onTitle ? 0.2 : 0.9) + lift) - cam.y) * (wide ? 0.1 : 0.05); // ボタンにかくれないよう地面を上げる
    }
    { const [at, ax] = ancTarget(); anc += (at - anc) * 0.12; if (Math.abs(at - anc) < 0.001) anc = at; ancX += (ax - ancX) * 0.12; if (Math.abs(ax - ancX) < 0.001) ancX = ax; }
    shakeA *= 0.86; if (shakeA < 0.3) shakeA = 0;
    const shx = shakeA ? (Math.random() - 0.5) * 2 * shakeA : 0, shy = shakeA ? (Math.random() - 0.5) * 2 * shakeA : 0;
    ctx.setTransform(DPR, 0, 0, DPR, shx * DPR, shy * DPR);
    drawBackground();
    drawGround();
    drawPrints();
    drawBoxes();
    drawWind();
    drawSpeedLines();
    if (onTitle && S.char) { // タイトルでは足もとを支点にヨロヨロゆれる
      const [fx, fy] = W2S(game.charX(), game.groundHeightAt(game.charX())), tt = performance.now() / 1000;
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(Math.sin(tt * 2.3) * 0.07 + Math.sin(tt * 5.1) * 0.015); ctx.translate(-fx, -fy);
      drawChar(); ctx.restore();
    } else if (!(gag && gag.hide)) drawChar();
    gagRun('draw');
    drawParts(false);
    if (!gag) drawDizzy();
    drawCharge();
    drawPops();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    gagRun('screen');
    if (gag && gag.wantPic) { gag.wantPic = false; gagPhoto(); }
    drawParts(true);
    updateHud();
    if (S.char && !ui.title.classList.contains('show')) {
      if (S.status === 'fallen') CLIP.stopAfter(gag ? gag.def.dur * 1000 + 300 : 1400, now); // 転んだあと（ころび芸がおわるまで）取って止める
      const tp = S.char.torso.getPosition(); const [px, py] = W2S(tp.x, tp.y);
      CLIP.capture(canvas, px, py, W, H, DPR, now);
    }
    const shownFace = ui.fail.classList.contains('show') ? ui.failFace : ui.goal.classList.contains('show') ? $('goalFace') : null;
    if (shownFace) {
      const fc = shownFace.getContext('2d'); fc.clearRect(0, 0, 240, 240);
      WT.drawFace(fc, waiter, faceNow, 120, 132, 82, (performance.now() - faceT0) / 1000);
    }
    if (S.char && !Number.isFinite(S.char.torso.getPosition().x)) throw new Error('body lost'); // 体の計算がこわれた
  }
  // 万一エラーが起きても画面を止めない。続けて起きるときは、そのステージを最初からやり直す（記録は消えない）
  let crashes = [];
  function recover(e) {
    console.warn('yoro recover', e);
    ctx = canvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; // ころび芸で別の紙にかいていた途中でも、元の画面にもどす
    gag = null; zoom = 1;
    const t = performance.now(); crashes = crashes.filter((x) => t - x < 3000); crashes.push(t);
    if (crashes.length >= 3 || (S.char && !Number.isFinite(S.char.torso.getPosition().x))) {
      crashes = [];
      try { restart(); } catch (e2) { try { showOnly(ui.title); } catch (e3) { /* これ以上は何もしない */ } }
    }
  }
  function frame(now) {
    try { frameBody(now); } catch (e) { recover(e); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 新しい版が出ていたら、タイトルにいるときに読み込み直す（スマホに古い画面が残らないように）
  async function checkVersion() {
    if (!window.BUILD || window.BUILD === 'dev' || window.BUILD === 'portal') return;
    try {
      const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) return;
      const v = (await r.json()).v;
      if (v && v !== window.BUILD && ui.title.classList.contains('show')) location.reload();
    } catch (e) { /* 電波がないときはそのまま遊べる */ }
  }
  checkVersion();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
  if (window.YP) YP.ready.then(() => YP.loaded()); // ゲームサイトに「読みこみ終わり」を知らせる
  // テスト用（自動操作で動作確認するため）
  window.__yoro = { get game() { return game; }, get boxes() { return boxes; }, get mode() { return mode; }, force, openCloset, closeCloset, openGacha, closeGacha, GA, start, retry, restart, nextStage, loadLevel, pause, resume, openZukan, closeZukan, recover, get mis() { return mis; }, get mst() { return mst; } };
})();
