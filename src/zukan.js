// ヨロヨロおつかい — ずかん（ころび方・待っている人の顔・おたから・できごとを集める。このスマホの中だけに残す）
(function () {
  const KEY = 'yoro.zukan';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても遊べる */ } },
  };
  // ころび方（見ていないものはヒントだけ出す）
  const FALLS = [
    { id: 'pudding', name: 'プリン飛ばし', icon: 'f.pudding', hint: 'ガクガク歩くと…' },
    { id: 'hole', name: '穴ポチャ', icon: 'f.hole', hint: '穴のところで…' },
    { id: 'timeup', name: '時間切れ', icon: 'f.timeup', hint: 'のんびりしすぎると…' },
    { id: 'rhythm', name: '足もつれ', icon: 'f.rhythm', hint: 'リズムがばらばらだと…' },
    { id: 'stop', name: '立ち止まり', icon: 'f.stop', hint: '押すのをやめると…' },
    { id: 'head', name: '頭からゴツン', icon: 'f.head', hint: '前にたおれこむと…' },
    { id: 'torso', name: 'おなかからドテッ', icon: 'f.torso', hint: 'うつぶせに…' },
    { id: 'knee', name: 'ひざカックン', icon: 'f.knee', hint: 'ひざから くずれると…' },
    { id: 'down', name: 'しりもち', icon: 'f.down', hint: 'うしろに すわりこむと…' },
  ];
  // おたから（w が大きいほど出やすい）
  const TREASURES = [
    { id: 'candy', name: 'あめ玉', icon: 't.candy', w: 30 },
    { id: 'cookie', name: 'クッキー', icon: 't.cookie', w: 25 },
    { id: 'acorn', name: 'どんぐり', icon: 't.acorn', w: 20 },
    { id: 'marble', name: 'ビー玉', icon: 't.marble', w: 12 },
    { id: 'shell', name: '貝がら', icon: 't.shell', w: 10 },
    { id: 'clover', name: '四つ葉', icon: 't.clover', w: 6 },
    { id: 'ribbon', name: 'リボン', icon: 't.ribbon', w: 5 },
    { id: 'gem', name: 'ほうせき', icon: 't.gem', w: 2.5 },
    { id: 'goldpudding', name: '金のプリン', icon: 't.goldpudding', w: 1 },
    { id: 'crown', name: '王かん', icon: 't.crown', w: 0.5 },
  ];
  // たまに起きる出来事
  const EVENTS = [
    { id: 'headwind', name: '向かい風', icon: 'e.headwind', hint: 'たまに風が…' },
    { id: 'tailwind', name: '追い風', icon: 'e.tailwind', hint: 'たまに風が…' },
    { id: 'goldday', name: '金のプリンの日', icon: 'e.goldday', hint: 'ごくたまに…' },
    { id: 'rare', name: 'めずらしい お客さん', icon: 'e.rare', hint: 'ごくたまに…' },
  ];
  const MOOD_NAMES = { sad: 'しょんぼり', sigh: 'あきれ', sulk: 'すね', shock: 'びっくり', angry: 'おこり', cry: 'なき', happy: 'にっこり' };

  function load() {
    try {
      const o = JSON.parse(store.get(KEY) || '{}');
      return { fall: o.fall || {}, face: o.face || {}, treasure: o.treasure || {}, event: o.event || {} };
    } catch (e) { return { fall: {}, face: {}, treasure: {}, event: {} }; }
  }
  let data = load();
  const save = () => store.set(KEY, JSON.stringify(data));
  // 集めた印をつける。はじめてなら true
  function mark(kind, key) {
    if (!data[kind]) return false;
    const isNew = !data[kind][key];
    data[kind][key] = (data[kind][key] || 0) + 1;
    save();
    return isNew;
  }
  const has = (kind, key) => !!(data[kind] && data[kind][key]);
  function people() { const WT = window.YoroWaiter; return WT ? WT.WAITERS.concat(WT.RARE || []) : []; }
  const FACE_KEYS = () => (window.YoroWaiter ? window.YoroWaiter.MOOD_KEYS : []).concat(['happy']);
  function count() {
    const faces = people().length * FACE_KEYS().length;
    const total = FALLS.length + faces + TREASURES.length + EVENTS.length;
    const got = FALLS.filter((f) => has('fall', f.id)).length + Object.keys(data.face).length
      + TREASURES.filter((t) => has('treasure', t.id)).length + EVENTS.filter((e) => has('event', e.id)).length;
    return { got, total };
  }
  function pickTreasure() {
    const sum = TREASURES.reduce((a, t) => a + t.w, 0);
    let r = Math.random() * sum;
    for (const t of TREASURES) { r -= t.w; if (r <= 0) return t; }
    return TREASURES[0];
  }
  const rareOf = (t) => t.w < 7; // めずらしいおたから

  // ずかんの中身をかく（el の中に）
  function render(el) {
    const WT = window.YoroWaiter;
    const c = count();
    const sec = (title, got, all, body) => `<h3>${title} <small>${got}/${all}</small></h3>${body}`;
    const cell = (ok, icon, name, hint) => `<div class="zk${ok ? '' : ' no'}"><b>${ok ? window.YoroIcon.html(icon) : '？'}</b><span>${ok ? name : hint || '？？？'}</span></div>`;
    const falls = FALLS.map((f) => cell(has('fall', f.id), f.icon, f.name, f.hint)).join('');
    const trs = TREASURES.map((t) => cell(has('treasure', t.id), t.icon, t.name, t.w < 3 ? 'とても めずらしい' : '')).join('');
    const evs = EVENTS.map((e) => cell(has('event', e.id), e.icon, e.name, e.hint)).join('');
    const ppl = people();
    const fk = FACE_KEYS();
    const faceGot = Object.keys(data.face).length;
    const rows = ppl.map((w) => {
      const any = fk.some((m) => data.face[`${w.id}.${m}`]);
      const cells = fk.map((m) => `<canvas class="zf" width="72" height="72" data-w="${w.id}" data-m="${m}" title="${MOOD_NAMES[m]}"></canvas>`).join('');
      return `<div class="zrow"><div class="zn">${any || !w.rare ? w.name : '？？？'}</div><div class="zfs">${cells}</div></div>`;
    }).join('');
    el.innerHTML = `<p class="zt">あつめた数 <b>${c.got}</b> / ${c.total}</p>`
      + sec('ころび方', FALLS.filter((f) => has('fall', f.id)).length, FALLS.length, `<div class="zg">${falls}</div>`)
      + sec('おたから', TREASURES.filter((t) => has('treasure', t.id)).length, TREASURES.length, `<div class="zg">${trs}</div>`)
      + sec('できごと', EVENTS.filter((e) => has('event', e.id)).length, EVENTS.length, `<div class="zg">${evs}</div>`)
      + sec('待っている人の顔', faceGot, ppl.length * fk.length, `<p class="zs">左から しょんぼり・あきれ・すね・びっくり・おこり・なき・にっこり</p>${rows}`);
    // 顔は絵でかく（まだ見ていない顔は「？」）
    el.querySelectorAll('canvas.zf').forEach((cv) => {
      const w = ppl.find((p) => p.id === cv.dataset.w), m = cv.dataset.m, g = cv.getContext('2d');
      if (data.face[`${w.id}.${m}`]) WT.drawFace(g, w, m, 36, 40, 22, 0.3);
      else {
        g.fillStyle = '#e6dccb'; g.beginPath(); g.arc(36, 38, 24, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#a89880'; g.font = '900 24px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('？', 36, 39);
      }
    });
  }

  window.YoroZukan = { FALLS, TREASURES, EVENTS, MOOD_NAMES, mark, has, count, pickTreasure, rareOf, render };
})();
