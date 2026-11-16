// ヨロヨロおつかい — みんなのランキング（遊んだ人の「歩いたきょり」を自動で集めて、上位を出す）
// 記録は Google スプレッドシートに集める（server/ の Apps Script）。つながらないときは何も出さずに遊べる。
(function () {
  const ENDPOINT = ''; // server/ を公開したときの URL（https://script.google.com/macros/s/…/exec）
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても遊べる */ } },
  };
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  // 自分の番号（ランキングで自分を見分けるため。名前とは別）
  let id = store.get('yoro.pid');
  if (!/^[a-z0-9]{12,32}$/.test(id || '')) {
    id = Array.from({ length: 16 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
    store.set('yoro.pid', id);
  }
  // 名前は最初に自動でつける（あとで変えられる）
  const ADJ = ['ふらふら', 'のんびり', 'あわてんぼうの', 'はやあしの', 'ねむたい', 'げんきな', 'こわがりの', 'くいしんぼうの', 'まじめな', 'ドジな', 'よろよろ', 'おっとりした'];
  const WHO = ['カメ', 'ペンギン', 'タヌキ', 'ネコ', 'イヌ', 'ウサギ', 'カエル', 'パンダ', 'コアラ', 'アヒル', 'ヒヨコ', 'クマ'];
  let name = store.get('yoro.name');
  if (!name) { name = `${rnd(ADJ)}${rnd(WHO)}${10 + Math.floor(Math.random() * 90)}`; store.set('yoro.name', name); }
  const clean = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14);

  async function call(params) {
    if (!ENDPOINT) throw new Error('no endpoint');
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(`${ENDPOINT}?${new URLSearchParams(params)}`, { signal: ctl.signal, redirect: 'follow' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'ng');
      return j;
    } finally { clearTimeout(t); }
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ランキングの表を el に描く
  function render(el, data, opts = {}) {
    if (!el) return;
    if (!data) { el.hidden = true; return; }
    const rows = (data.top || []).map((r, i) => `<li class="${r.me ? 'me' : ''}"><span class="n">${i + 1}位</span><span class="nm">${esc(r.name)}</span><span class="d">${Number(r.d).toFixed(1)}m</span></li>`).join('');
    const mine = data.rank ? `あなたは ${data.count}人中 ${data.rank}位（${Number(data.best).toFixed(1)}m）` : `${data.count || 0}人が遊んでいます`;
    el.innerHTML = `<h3>🏆 みんなのランキング</h3><ol>${rows || '<li>まだ記録がありません</li>'}</ol>`
      + `<div class="who-me">${mine}<br>名前：${esc(name)}<button type="button" data-rename>かえる</button></div>`;
    el.querySelector('[data-rename]').onclick = (ev) => { ev.stopPropagation(); rename(); if (opts.onRename) opts.onRename(); };
    el.hidden = false;
  }
  function loading(el) { if (el && ENDPOINT) { el.innerHTML = '<h3>🏆 みんなのランキング</h3><div class="who-me">よみこみ中…</div>'; el.hidden = false; } }

  function rename() {
    const v = clean(window.prompt('ランキングに出る名前（14文字まで）', name));
    if (v) { name = v; store.set('yoro.name', name); call({ a: 'name', id, name }).catch(() => {}); }
  }

  window.YoroRank = {
    get ready() { return !!ENDPOINT; },
    get name() { return name; },
    submit(d) { return call({ a: 'add', id, name, d: d.toFixed(1) }); }, // 歩いたきょりを送る（自分の一番いい記録だけ残る）
    top() { return call({ a: 'top', id }); },
    render, loading, rename,
  };
})();
