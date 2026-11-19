// ヨロヨロおつかい — ずかん（ころび方・待っている人の顔・おたから・できごとを集める。このスマホの中だけに残す）
(function () {
  const KEY = 'yoro.zukan';
  const store = {
    get(k) { return YS.get(k); }, // 保存先は src/save.js
    set(k, v) { YS.set(k, v); },
  };
  // ころび方（見ていないものはヒントだけ出す）
  const FALLS = YL.t(YL.en ? [
    { id: 'pudding', name: 'Pudding Launch', icon: 'f.pudding', hint: 'Walk all wobbly and…' },
    { id: 'hole', name: 'Hole in One', icon: 'f.hole', hint: 'Near a hole…' },
    { id: 'timeup', name: "Time's Up", icon: 'f.timeup', hint: 'Take it too easy and…' },
    { id: 'rhythm', name: 'Tangled Feet', icon: 'f.rhythm', hint: 'Lose the rhythm and…' },
    { id: 'stop', name: 'Standstill', icon: 'f.stop', hint: 'Stop tapping and…' },
    { id: 'head', name: 'Head Bonk', icon: 'f.head', hint: 'Lean way forward and…' },
    { id: 'torso', name: 'Belly Flop', icon: 'f.torso', hint: 'Face-down…' },
    { id: 'knee', name: 'Knee Buckle', icon: 'f.knee', hint: 'Go weak at the knees…' },
    { id: 'down', name: 'Butt Plop', icon: 'f.down', hint: 'Sit down backward…' },
  ] : [
    { id: 'pudding', name: 'プリン飛ばし', icon: 'f.pudding', hint: 'ガクガク歩くと…' },
    { id: 'hole', name: '穴ポチャ', icon: 'f.hole', hint: '穴のところで…' },
    { id: 'timeup', name: '時間切れ', icon: 'f.timeup', hint: 'のんびりしすぎると…' },
    { id: 'rhythm', name: '足もつれ', icon: 'f.rhythm', hint: 'リズムがばらばらだと…' },
    { id: 'stop', name: '立ち止まり', icon: 'f.stop', hint: '押すのをやめると…' },
    { id: 'head', name: '頭からゴツン', icon: 'f.head', hint: '前にたおれこむと…' },
    { id: 'torso', name: 'おなかからドテッ', icon: 'f.torso', hint: 'うつぶせに…' },
    { id: 'knee', name: 'ひざカックン', icon: 'f.knee', hint: 'ひざから くずれると…' },
    { id: 'down', name: 'しりもち', icon: 'f.down', hint: 'うしろに すわりこむと…' },
  ]);
  // おたから（w が大きいほど出やすい）
  const TREASURES = YL.t(YL.en ? [
    { id: 'candy', name: 'Candy', icon: 't.candy', w: 30 },
    { id: 'cookie', name: 'Cookie', icon: 't.cookie', w: 25 },
    { id: 'acorn', name: 'Acorn', icon: 't.acorn', w: 20 },
    { id: 'marble', name: 'Marble', icon: 't.marble', w: 12 },
    { id: 'shell', name: 'Seashell', icon: 't.shell', w: 10 },
    { id: 'clover', name: 'Lucky Clover', icon: 't.clover', w: 6 },
    { id: 'ribbon', name: 'Ribbon', icon: 't.ribbon', w: 5 },
    { id: 'gem', name: 'Gem', icon: 't.gem', w: 2.5 },
    { id: 'goldpudding', name: 'Golden Pudding', icon: 't.goldpudding', w: 1 },
    { id: 'crown', name: 'Crown', icon: 't.crown', w: 0.5 },
  ] : [
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
  ]);
  // たまに起きる出来事
  const EVENTS = YL.t(YL.en ? [
    { id: 'headwind', name: 'Headwind', icon: 'e.headwind', hint: 'Sometimes the wind…' },
    { id: 'tailwind', name: 'Tailwind', icon: 'e.tailwind', hint: 'Sometimes the wind…' },
    { id: 'goldday', name: 'Golden Pudding Day', icon: 'e.goldday', hint: 'Once in a blue moon…' },
    { id: 'rare', name: 'Rare Visitor', icon: 'e.rare', hint: 'Once in a blue moon…' },
  ] : [
    { id: 'headwind', name: '向かい風', icon: 'e.headwind', hint: 'たまに風が…' },
    { id: 'tailwind', name: '追い風', icon: 'e.tailwind', hint: 'たまに風が…' },
    { id: 'goldday', name: '金のプリンの日', icon: 'e.goldday', hint: 'ごくたまに…' },
    { id: 'rare', name: 'めずらしい お客さん', icon: 'e.rare', hint: 'ごくたまに…' },
  ]);
  const MOOD_NAMES = YL.t(YL.en ? { sad: 'Sad', sigh: 'Fed Up', sulk: 'Sulky', shock: 'Shocked', angry: 'Angry', cry: 'Crying', happy: 'Happy' }
    : { sad: 'しょんぼり', sigh: 'あきれ', sulk: 'すね', shock: 'びっくり', angry: 'おこり', cry: 'なき', happy: 'にっこり' });

  function load() {
    try {
      const o = JSON.parse(store.get(KEY) || '{}');
      return { fall: o.fall || {}, face: o.face || {}, treasure: o.treasure || {}, event: o.event || {}, gag: o.gag || {}, gagv: o.gagv || {} };
    } catch (e) { return { fall: {}, face: {}, treasure: {}, event: {}, gag: {}, gagv: {} }; }
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
  // ころび芸の写真（いちばんおもしろいところ。このスマホの中だけ）
  const PKEY = 'yoro.gagpic';
  let pics = null;
  const loadPics = () => { if (!pics) { try { pics = JSON.parse(store.get(PKEY) || '{}'); } catch (e) { pics = {}; } } return pics; };
  function gagPic(id, url) { loadPics()[id] = url; store.set(PKEY, JSON.stringify(pics)); }
  const GAGS = () => (window.YoroGags ? window.YoroGags.LIST : []);
  function people() { const WT = window.YoroWaiter; return WT ? WT.WAITERS.concat(WT.RARE || []) : []; }
  const FACE_KEYS = () => (window.YoroWaiter ? window.YoroWaiter.MOOD_KEYS : []).concat(['happy']);
  function count() {
    const faces = people().length * FACE_KEYS().length;
    const total = FALLS.length + faces + TREASURES.length + EVENTS.length + GAGS().length;
    const got = FALLS.filter((f) => has('fall', f.id)).length + Object.keys(data.face).length + GAGS().filter((d) => has('gag', d.id)).length
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
    const cell = (ok, icon, name, hint) => `<div class="zk${ok ? '' : ' no'}"><b>${ok ? window.YoroIcon.html(icon) : jaen('？', '?')}</b><span>${ok ? name : hint || jaen('？？？', '???')}</span></div>`;
    const falls = FALLS.map((f) => cell(has('fall', f.id), f.icon, f.name, f.hint)).join('');
    const trs = TREASURES.map((t) => cell(has('treasure', t.id), t.icon, t.name, t.w < 3 ? jaen('とても めずらしい', 'Super rare') : '')).join('');
    const evs = EVENTS.map((e) => cell(has('event', e.id), e.icon, e.name, e.hint)).join('');
    const ppl = people();
    const fk = FACE_KEYS();
    const faceGot = Object.keys(data.face).length;
    const rows = ppl.map((w) => {
      const any = fk.some((m) => data.face[`${w.id}.${m}`]);
      const cells = fk.map((m) => `<canvas class="zf" width="72" height="72" data-w="${w.id}" data-m="${m}" title="${MOOD_NAMES[m]}"></canvas>`).join('');
      return `<div class="zrow"><div class="zn">${any || !w.rare ? w.name : jaen('？？？', '???')}</div><div class="zfs">${cells}</div></div>`;
    }).join('');
    const gs = GAGS(), pc = loadPics();
    const gcell = (d) => { const ok = has('gag', d.id), nv = d.vs ? d.vs.filter((v) => has('gagv', `${d.id}.${v.id}`)).length : 0;
      return `<div class="zk zg2${ok ? '' : ' no'}"><b>${ok && pc[d.id] ? `<img src="${pc[d.id]}" alt="">` : ok ? '★' : jaen('？', '?')}</b><span>${ok ? d.name : d.hint}${ok && d.vs ? `<small>${jaen(`${nv}/${d.vs.length}しゅるい`, `${nv}/${d.vs.length} found`, `发现${nv}/${d.vs.length}种`)}</small>` : ''}</span></div>`; };
    el.innerHTML = jaen(`<p class="zt">あつめた数 <b>${c.got}</b> / ${c.total}</p>`, `<p class="zt">Collected <b>${c.got}</b> / ${c.total}</p>`, `<p class="zt">已收集 <b>${c.got}</b> / ${c.total}</p>`)
      + sec(jaen('ころび芸', 'Wipeouts'), gs.filter((d) => has('gag', d.id)).length, gs.length, `<p class="zs">${jaen('ころぶと、毎回ちがう芸が出るよ。写真は いちばん おもしろいところ', 'Every fall is a different wipeout. The photo is the funniest moment!')}</p><div class="zg">${gs.map(gcell).join('')}</div>`)
      + sec(jaen('ころび方', 'Ways to Fall'), FALLS.filter((f) => has('fall', f.id)).length, FALLS.length, `<div class="zg">${falls}</div>`)
      + sec(jaen('おたから', 'Treasures'), TREASURES.filter((t) => has('treasure', t.id)).length, TREASURES.length, `<div class="zg">${trs}</div>`)
      + sec(jaen('できごと', 'Events'), EVENTS.filter((e) => has('event', e.id)).length, EVENTS.length, `<div class="zg">${evs}</div>`)
      + sec(jaen('待っている人の顔', 'Faces at the Door'), faceGot, ppl.length * fk.length, `<p class="zs">${jaen('左から しょんぼり・あきれ・すね・びっくり・おこり・なき・にっこり', 'Left to right: sad, fed up, sulky, shocked, angry, crying, happy')}</p>${rows}`);
    // 顔は絵でかく（まだ見ていない顔は「？」）
    el.querySelectorAll('canvas.zf').forEach((cv) => {
      const w = ppl.find((p) => p.id === cv.dataset.w), m = cv.dataset.m, g = cv.getContext('2d');
      if (data.face[`${w.id}.${m}`]) WT.drawFace(g, w, m, 36, 40, 22, 0.3);
      else {
        g.fillStyle = '#e6dccb'; g.beginPath(); g.arc(36, 38, 24, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#a89880'; g.font = '900 24px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(jaen('？', '?'), 36, 39);
      }
    });
  }

  window.YoroZukan = { FALLS, TREASURES, EVENTS, MOOD_NAMES, mark, has, count, pickTreasure, rareOf, render, gagPic };
})();
