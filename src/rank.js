// ヨロヨロおつかい — じぶんの記録ランキング（ゲームオーバーまでに歩いたきょりの上位10回を、このスマホの中だけに残す）
(function () {
  const KEY = 'yoro.runs';
  const store = {
    get(k) { return YS.get(k); }, // 保存先は src/save.js
    set(k, v) { YS.set(k, v); },
  };
  function list() {
    try {
      const a = JSON.parse(store.get(KEY) || '[]');
      return Array.isArray(a) ? a.filter((r) => r && Number.isFinite(r.d)).slice(0, 10) : [];
    } catch (e) { return []; }
  }
  // 記録を足して上位10回だけ残す。今回の記録が何位か（入らなければ -1）も返す
  function add(d) {
    const now = Date.now();
    const a = list();
    a.push({ d: Math.round(d * 10) / 10, t: now });
    a.sort((x, y) => y.d - x.d || x.t - y.t);
    const top = a.slice(0, 10);
    store.set(KEY, JSON.stringify(top));
    return { list: top, idx: top.findIndex((r) => r.t === now) };
  }
  const day = (t) => { const x = new Date(t); return `${x.getMonth() + 1}/${x.getDate()}`; };
  function render(el, data) {
    if (!el) return;
    if (!data || !data.list.length) { el.hidden = true; return; }
    const rows = data.list.map((r, i) => `<li class="${i === data.idx ? 'me' : ''}"><span class="n">${jaen(`${i + 1}位`, `#${i + 1}`)}</span><span class="nm">${day(r.t)}${i === data.idx ? jaen('　いまの記録！', ' New!') : ''}</span><span class="d">${r.d.toFixed(1)}m</span></li>`).join('');
    el.innerHTML = `<h3>${jaen('じぶんの記録', 'My Best Runs')}</h3><ol>${rows}</ol>`;
    el.hidden = false;
  }
  window.YoroRank = { list, add, render };
})();
