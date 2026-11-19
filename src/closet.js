// ヨロヨロおつかい — きせかえ（服は自分で選ぶ・運ぶものは届け先の人が毎回ランダムで頼む）。遊ぶほど使えるものが増える。このスマホの中だけに残す
(function () {
  const store = {
    get(k) { return YS.get(k); }, // 保存先は src/save.js
    set(k, v) { YS.set(k, v); },
  };
  // 使えるようになる条件：total=合計で歩いたきょり・best=自己ベスト・runs=遊んだ回数・zukan=ずかんの数・streak=れんぞく日数・treasure=おたから
  // 英語の運ぶもの名は文の中に入る（「プリン」の代わり）ので小文字の名詞。最初は必ず 'pudding'
  const CARRY = YL.t(YL.en ? [
    { id: 'pudding', name: 'pudding', icon: 'c.pudding', shake: 1, bonus: 0, w: 4 },
    { id: 'dango', name: 'dango', icon: 'c.dango', shake: 0.92, bonus: 0, w: 3, need: { total: 100 } },
    { id: 'cake', name: 'shortcake', icon: 'c.cake', shake: 1.05, bonus: 1, w: 3, need: { best: 40 } },
    { id: 'egg', name: 'fried egg', icon: 'c.egg', shake: 1.1, bonus: 1, w: 3, need: { zukan: 25 } },
    { id: 'suika', name: 'watermelon', icon: 'c.suika', shake: 1.1, bonus: 1, w: 2, need: { total: 500 } },
    { id: 'goldfish', name: 'goldfish bowl', icon: 'c.goldfish', shake: 1.18, bonus: 2, w: 2, need: { best: 120 } },
    { id: 'goldpudding', name: 'golden pudding', icon: 'c.goldpudding', shake: 1, bonus: 3, w: 0.6, need: { treasure: 'goldpudding' } },
  ] : [
    { id: 'pudding', name: 'プリン', icon: 'c.pudding', shake: 1, bonus: 0, w: 4 },
    { id: 'dango', name: 'おだんご', icon: 'c.dango', shake: 0.92, bonus: 0, w: 3, need: { total: 100 } },
    { id: 'cake', name: 'ショートケーキ', icon: 'c.cake', shake: 1.05, bonus: 1, w: 3, need: { best: 40 } },
    { id: 'egg', name: '目玉焼き', icon: 'c.egg', shake: 1.1, bonus: 1, w: 3, need: { zukan: 25 } },
    { id: 'suika', name: 'スイカ', icon: 'c.suika', shake: 1.1, bonus: 1, w: 2, need: { total: 500 } },
    { id: 'goldfish', name: '金魚ばち', icon: 'c.goldfish', shake: 1.18, bonus: 2, w: 2, need: { best: 120 } },
    { id: 'goldpudding', name: '金のプリン', icon: 'c.goldpudding', shake: 1, bonus: 3, w: 0.6, need: { treasure: 'goldpudding' } },
  ]);
  const OUTFITS = YL.t(YL.en ? [
    { id: 'normal', name: 'Usual', shirt: '#ff9f43', apron: '#fff', pants: '#3f639a', shoe: '#d4493a' },
    { id: 'jersey', name: 'Red Tracksuit', shirt: '#e8303a', apron: null, pants: '#e8303a', shoe: '#ffffff', stripe: '#fff', need: { runs: 10 } },
    { id: 'rain', name: 'Yellow Raincoat', shirt: '#ffd23a', apron: null, pants: '#3f639a', shoe: '#ffd23a', hat: 'hood', need: { total: 250 } },
    { id: 'pajama', name: 'Pajamas', shirt: '#8ec5ff', apron: null, pants: '#8ec5ff', shoe: '#ff9ec7', hat: 'nightcap', dots: true, need: { streak: 3 } },
    { id: 'ninja', name: 'Ninja', shirt: '#39405a', apron: null, pants: '#39405a', shoe: '#22222a', hat: 'band', need: { best: 80 } },
    { id: 'chef', name: 'Chef', shirt: '#ffffff', apron: '#ffffff', pants: '#3b3b3b', shoe: '#3b3b3b', hat: 'chef', need: { zukan: 50 } },
    { id: 'prince', name: 'Prince', shirt: '#7a5af8', apron: null, pants: '#ffffff', shoe: '#7a5af8', hat: 'crown', need: { treasure: 'crown' } },
  ] : [
    { id: 'normal', name: 'いつもの', shirt: '#ff9f43', apron: '#fff', pants: '#3f639a', shoe: '#d4493a' },
    { id: 'jersey', name: '赤ジャージ', shirt: '#e8303a', apron: null, pants: '#e8303a', shoe: '#ffffff', stripe: '#fff', need: { runs: 10 } },
    { id: 'rain', name: '黄色カッパ', shirt: '#ffd23a', apron: null, pants: '#3f639a', shoe: '#ffd23a', hat: 'hood', need: { total: 250 } },
    { id: 'pajama', name: 'パジャマ', shirt: '#8ec5ff', apron: null, pants: '#8ec5ff', shoe: '#ff9ec7', hat: 'nightcap', dots: true, need: { streak: 3 } },
    { id: 'ninja', name: 'にんじゃ', shirt: '#39405a', apron: null, pants: '#39405a', shoe: '#22222a', hat: 'band', need: { best: 80 } },
    { id: 'chef', name: 'コックさん', shirt: '#ffffff', apron: '#ffffff', pants: '#3b3b3b', shoe: '#3b3b3b', hat: 'chef', need: { zukan: 50 } },
    { id: 'prince', name: '王子さま', shirt: '#7a5af8', apron: null, pants: '#ffffff', shoe: '#7a5af8', hat: 'crown', need: { treasure: 'crown' } },
  ]);
  // 運ぶものは、届け先の人が決める（ランダム）。人ごとに頼みやすいものがある（出やすさ×4）
  const LIKES = { grandma: 'dango', grandpa: 'dango', sister: 'cake', teacher: 'cake', mom: 'egg', dog: 'egg', aunt: 'dango',
    dad: 'suika', uncle: 'suika', friend: 'suika', brother: 'cake', cat: 'goldfish', alien: 'goldfish', ghost: 'dango', king: 'goldpudding' };
  function pickCarry(ctx, whoId, R, prevId) {
    R = R || Math.random;
    const pool = CARRY.filter((x) => ok(x, ctx));
    const wt = (x) => x.w * (LIKES[whoId] === x.id ? 4 : 1) * (x.id === prevId && pool.length > 1 ? 0.15 : 1); // 前と同じものは出にくく
    let r = R() * pool.reduce((a, x) => a + wt(x), 0);
    for (const x of pool) { r -= wt(x); if (r <= 0) return x; }
    return pool[0];
  }
  const likeOf = (whoId) => CARRY.find((x) => x.id === LIKES[whoId]);
  // 届けた回数（きせかえ画面に出す）
  function delivered() { try { return JSON.parse(store.get('yoro.carried') || '{}'); } catch (e) { return {}; } }
  function addDelivered(id) { const d = delivered(); d[id] = (d[id] || 0) + 1; store.set('yoro.carried', JSON.stringify(d)); return d[id]; }
  const TREASURE_NAME = YL.t(YL.en ? { goldpudding: 'Golden Pudding', crown: 'Crown' } : { goldpudding: '金のプリン', crown: '王かん' });

  // 遊んだ記録（合計きょり・回数）
  function stats() {
    try { const o = JSON.parse(store.get('yoro.stats') || '{}'); return { total: +o.total || 0, runs: +o.runs || 0 }; } catch (e) { return { total: 0, runs: 0 }; }
  }
  function addRun(dist) { const s = stats(); s.total += Math.max(0, dist); s.runs++; store.set('yoro.stats', JSON.stringify(s)); return s; }

  // 条件の文と、あとどれくらいか
  function needText(n, ctx) {
    if (!n) return '';
    if (YL.zh) {
      if (n.total != null) return `累计走 ${n.total}m（还差 ${Math.max(0, n.total - ctx.total).toFixed(0)}m）`;
      if (n.best != null) return `一次走 ${n.best}m（最佳 ${ctx.best.toFixed(1)}m）`;
      if (n.runs != null) return `玩 ${n.runs} 次（还差 ${Math.max(0, n.runs - ctx.runs)} 次）`;
      if (n.zukan != null) return `图鉴收集 ${n.zukan} 个（现在 ${ctx.zukan}）`;
      if (n.streak != null) return `连续玩 ${n.streak} 天（现在 ${ctx.streak}）`;
      if (n.treasure) return `找到宝物「${TREASURE_NAME[n.treasure] || '?'}」`;
      return '';
    }
    if (YL.en) {
      if (n.total != null) return `Walk ${n.total}m total (${Math.max(0, n.total - ctx.total).toFixed(0)}m to go)`;
      if (n.best != null) return `Walk ${n.best}m in one run (best ${ctx.best.toFixed(1)}m)`;
      if (n.runs != null) return `Play ${n.runs} times (${Math.max(0, n.runs - ctx.runs)} to go)`;
      if (n.zukan != null) return `Collect ${n.zukan} in the Album (now ${ctx.zukan})`;
      if (n.streak != null) return `Get a ${n.streak}-day streak (now ${ctx.streak})`;
      if (n.treasure) return `Find the ${TREASURE_NAME[n.treasure] || '?'} treasure`;
      return '';
    }
    if (n.total != null) return `合計 ${n.total}m 歩く（あと ${Math.max(0, n.total - ctx.total).toFixed(0)}m）`;
    if (n.best != null) return `1回で ${n.best}m 歩く（ベスト ${ctx.best.toFixed(1)}m）`;
    if (n.runs != null) return `${n.runs}回 遊ぶ（あと ${Math.max(0, n.runs - ctx.runs)}回）`;
    if (n.zukan != null) return `ずかんを ${n.zukan}こ 集める（いま ${ctx.zukan}こ）`;
    if (n.streak != null) return `${n.streak}日 れんぞくで遊ぶ（いま ${ctx.streak}日）`;
    if (n.treasure) return `おたから「${TREASURE_NAME[n.treasure] || '？'}」を見つける`;
    return '';
  }
  function ok(item, ctx) {
    const n = item.need; if (!n) return true;
    if (n.total != null) return ctx.total >= n.total;
    if (n.best != null) return ctx.best >= n.best;
    if (n.runs != null) return ctx.runs >= n.runs;
    if (n.zukan != null) return ctx.zukan >= n.zukan;
    if (n.streak != null) return ctx.streak >= n.streak;
    if (n.treasure) return !!(ctx.has && ctx.has('treasure', n.treasure));
    return false;
  }
  const unlockedIds = (ctx) => CARRY.filter((x) => ok(x, ctx)).map((x) => 'c.' + x.id).concat(OUTFITS.filter((x) => ok(x, ctx)).map((x) => 'o.' + x.id));
  // 前の状態から新しく使えるようになったもの
  function newly(before, ctx) {
    const b = new Set(before);
    return unlockedIds(ctx).filter((k) => !b.has(k)).map((k) => (k[0] === 'c' ? CARRY.find((x) => 'c.' + x.id === k) : OUTFITS.find((x) => 'o.' + x.id === k)));
  }

  // いま選んでいるもの
  function chosen() {
    try { const o = JSON.parse(store.get('yoro.style') || '{}'); return { carry: o.carry || 'pudding', outfit: o.outfit || 'normal' }; } catch (e) { return { carry: 'pudding', outfit: 'normal' }; }
  }
  function choose(kind, id) { const c = chosen(); c[kind] = id; store.set('yoro.style', JSON.stringify(c)); }
  function current(ctx) {
    const c = chosen();
    const carry = CARRY.find((x) => x.id === c.carry && ok(x, ctx)) || CARRY[0];
    const outfit = OUTFITS.find((x) => x.id === c.outfit && ok(x, ctx)) || OUTFITS[0];
    return { carry, outfit };
  }

  // きせかえ画面（el の中にかく。選んだら onPick）
  function render(el, ctx, onPick) {
    const cur = current(ctx);
    const card = (kind, x, icon) => {
      const can = ok(x, ctx), on = (kind === 'carry' ? cur.carry : cur.outfit).id === x.id;
      return `<button type="button" class="cl${on ? ' on' : ''}${can ? '' : ' no'}" data-k="${kind}" data-id="${x.id}" ${can ? '' : 'disabled'}>`
        + `<b>${can ? icon : window.YoroIcon.html('x.lock', 'dim')}</b><span>${x.name}</span>${can ? (on ? `<i>${jaen('つかっている', 'Selected')}</i>` : '') : `<i>${needText(x.need, ctx)}</i>`}</button>`;
    };
    const sw = (o) => `<span class="sw" style="background:linear-gradient(${o.shirt} 0 55%, ${o.pants} 55% 100%)"></span>`;
    const dv = delivered();
    const carryCard = (x) => {
      const can = ok(x, ctx);
      const stars = '★'.repeat(x.shake < 1 ? 1 : x.shake < 1.04 ? 2 : x.shake < 1.15 ? 3 : 4);
      return `<div class="cl${can ? '' : ' no'}"><b>${can ? window.YoroIcon.html(x.icon) : window.YoroIcon.html('x.lock', 'dim')}</b><span>${x.name}</span>`
        + (can ? `<i>${jaen('ぐらぐら', 'Wobble')} ${stars}${x.bonus ? ` · <em><span class="coin"></span>+${x.bonus}</em>` : ''}<br>${jaen(`届けた ${dv[x.id] || 0}回`, `Delivered ${dv[x.id] || 0}×`, `送达 ${dv[x.id] || 0} 次`)}</i>` : `<i>${needText(x.need, ctx)}</i>`) + '</div>';
    };
    el.innerHTML = `<h3>${jaen('運ぶもの', 'Carry')}</h3><p class="clnote">${jaen('届け先の人が、毎回えらびます。運びにくいものほど、ゴールでメダルが多め', 'The person you deliver to picks it each time. Harder to carry = more medals at the goal')}</p><div class="clg">${CARRY.map(carryCard).join('')}</div>`
      + `<h3>${jaen('服', 'Clothes')}</h3><div class="clg">${OUTFITS.map((x) => card('outfit', x, sw(x))).join('')}</div>`;
    el.querySelectorAll('button.cl').forEach((b) => { b.onclick = () => { choose(b.dataset.k, b.dataset.id); render(el, ctx, onPick); if (onPick) onPick(); }; });
  }

  window.YoroCloset = { CARRY, OUTFITS, stats, addRun, ok, needText, unlockedIds, newly, chosen, choose, current, render, pickCarry, likeOf, delivered, addDelivered };
})();
