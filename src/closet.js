// ヨロヨロおつかい — きせかえ（運ぶもの・服）。遊ぶほど使えるものが増える。このスマホの中だけに残す
(function () {
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても遊べる */ } },
  };
  // 使えるようになる条件：total=合計で歩いたきょり・best=自己ベスト・runs=遊んだ回数・zukan=ずかんの数・streak=れんぞく日数・treasure=おたから
  const CARRY = [
    { id: 'pudding', name: 'プリン', icon: 'c.pudding' },
    { id: 'dango', name: 'おだんご', icon: 'c.dango', need: { total: 100 } },
    { id: 'cake', name: 'ショートケーキ', icon: 'c.cake', need: { best: 40 } },
    { id: 'egg', name: '目玉焼き', icon: 'c.egg', need: { zukan: 25 } },
    { id: 'suika', name: 'スイカ', icon: 'c.suika', need: { total: 500 } },
    { id: 'goldfish', name: '金魚ばち', icon: 'c.goldfish', need: { best: 120 } },
    { id: 'goldpudding', name: '金のプリン', icon: 'c.goldpudding', need: { treasure: 'goldpudding' } },
  ];
  const OUTFITS = [
    { id: 'normal', name: 'いつもの', shirt: '#ff9f43', apron: '#fff', pants: '#3f639a', shoe: '#d4493a' },
    { id: 'jersey', name: '赤ジャージ', shirt: '#e8303a', apron: null, pants: '#e8303a', shoe: '#ffffff', stripe: '#fff', need: { runs: 10 } },
    { id: 'rain', name: '黄色カッパ', shirt: '#ffd23a', apron: null, pants: '#3f639a', shoe: '#ffd23a', hat: 'hood', need: { total: 250 } },
    { id: 'pajama', name: 'パジャマ', shirt: '#8ec5ff', apron: null, pants: '#8ec5ff', shoe: '#ff9ec7', hat: 'nightcap', dots: true, need: { streak: 3 } },
    { id: 'ninja', name: 'にんじゃ', shirt: '#39405a', apron: null, pants: '#39405a', shoe: '#22222a', hat: 'band', need: { best: 80 } },
    { id: 'chef', name: 'コックさん', shirt: '#ffffff', apron: '#ffffff', pants: '#3b3b3b', shoe: '#3b3b3b', hat: 'chef', need: { zukan: 50 } },
    { id: 'prince', name: '王子さま', shirt: '#7a5af8', apron: null, pants: '#ffffff', shoe: '#7a5af8', hat: 'crown', need: { treasure: 'crown' } },
  ];
  const TREASURE_NAME = { goldpudding: '金のプリン', crown: '王かん' };

  // 遊んだ記録（合計きょり・回数）
  function stats() {
    try { const o = JSON.parse(store.get('yoro.stats') || '{}'); return { total: +o.total || 0, runs: +o.runs || 0 }; } catch (e) { return { total: 0, runs: 0 }; }
  }
  function addRun(dist) { const s = stats(); s.total += Math.max(0, dist); s.runs++; store.set('yoro.stats', JSON.stringify(s)); return s; }

  // 条件の文と、あとどれくらいか
  function needText(n, ctx) {
    if (!n) return '';
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
        + `<b>${can ? icon : window.YoroIcon.html('x.lock', 'dim')}</b><span>${x.name}</span>${can ? (on ? '<i>つかっている</i>' : '') : `<i>${needText(x.need, ctx)}</i>`}</button>`;
    };
    const sw = (o) => `<span class="sw" style="background:linear-gradient(${o.shirt} 0 55%, ${o.pants} 55% 100%)"></span>`;
    el.innerHTML = `<h3>運ぶもの</h3><div class="clg">${CARRY.map((x) => card('carry', x, window.YoroIcon.html(x.icon))).join('')}</div>`
      + `<h3>服</h3><div class="clg">${OUTFITS.map((x) => card('outfit', x, sw(x))).join('')}</div>`;
    el.querySelectorAll('button.cl').forEach((b) => { b.onclick = () => { choose(b.dataset.k, b.dataset.id); render(el, ctx, onPick); if (onPick) onPick(); }; });
  }

  window.YoroCloset = { CARRY, OUTFITS, stats, addRun, ok, needText, unlockedIds, newly, chosen, choose, current, render };
})();
