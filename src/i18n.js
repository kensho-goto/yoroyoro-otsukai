// ヨロヨロおつかい — ことばの切りかえ（日本語 / 英語 / 中国語＝簡体字）
// きめかた：URL の ?lang=ja|en|zh → 前に選んだもの → 端末のことば（日本語・中国語以外は英語）
// つかいかた：jaen('ころんだ', 'You fell') … 英語のときは2つめを返す
//   中国語は英語の文を src/zh.js の表（window.ZH）で置きかえる。表にない文は英語のまま出る
//   数や名前が入る文は、3つめに中国語を書く：jaen(`${n}軒目`, `House ${n}`, `第${n}户`)
//   英語の並び（YL.en ? [...] : [...]）は YL.t() に通すと、中国語のときに中身の文が置きかわる
// HTML は data-en（中身）・data-en-ph（入力欄のうすい字）・data-en-aria（読み上げ名）に英語を書いておく
//   中国語は表から引く。長い文は data-zh に直接書いてよい
// YL.en  … 日本語以外（英語・中国語）。英語の並びを使うかどうか
// YL.zh  … 中国語
// YL.latin … 英語だけ（単語で折り返す・文字を小さくする、など見た目の調整用）
(function () {
  const LANGS = ['ja', 'en', 'zh'];
  const ok = (l) => LANGS.includes(l);
  let q = null;
  try { q = new URLSearchParams(location.search).get('lang'); } catch (e) { /* なくてよい */ }
  const saved = YS.get('yoro.lang');
  if (ok(q)) YS.set('yoro.lang', q);
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'ja';
  const fromNav = /^ja\b/i.test(nav) ? 'ja' : /^zh\b/i.test(nav) ? 'zh' : 'en';
  const lang = ok(q) ? q : ok(saved) ? saved : fromNav;
  const zh = lang === 'zh';
  const en = lang !== 'ja';
  const ZH = window.ZH || {};
  // 中国語に置きかえる（表になければそのまま）
  const tr = (s) => (zh && typeof s === 'string' && Object.prototype.hasOwnProperty.call(ZH, s) ? ZH[s] : s);
  // 並び・ものの中の文をまとめて置きかえる（id・色・アイコンなどの名前は置きかえない）
  const KEEP = new Set(['id', 'icon', 'hat', 'face', 'style', 'slot', 'r', 'color', 'shirt', 'apron', 'pants', 'shoe', 'stripe', 'treasure', 'kind', 'key', 'mood', 'type']);
  function deep(x, k) {
    if (typeof x === 'string') return KEEP.has(k) ? x : tr(x);
    if (Array.isArray(x)) return x.map((v) => deep(v));
    if (x && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
      const o = {};
      for (const key of Object.keys(x)) o[key] = deep(x[key], key);
      return o;
    }
    return x;
  }
  function set(l) {
    if (!ok(l) || l === lang) return;
    YS.set('yoro.lang', l);
    const u = new URL(location.href); u.searchParams.delete('lang'); location.replace(u.toString());
  }
  const NAMES = { ja: '日本語', en: 'English', zh: '中文' };
  window.YL = { lang, en, zh, latin: lang === 'en', set, t: (x) => (zh ? deep(x) : x), tr, LANGS, NAMES };
  window.jaen = (ja, e, z) => (zh ? (z != null ? z : tr(e)) : en ? e : ja);
  document.documentElement.lang = zh ? 'zh-CN' : lang;
  if (zh) { // 中国語の太い字（ロゴ・数字）。読めなくても、端末の字で遊べる
    try {
      const l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=ZCOOL+QingKe+HuangYou&display=swap';
      document.head.appendChild(l);
    } catch (e) { /* なくてよい */ }
  }
  function applyDom(root) {
    if (!en) return;
    const r = root || document;
    r.querySelectorAll('[data-en]').forEach((el) => { el.innerHTML = zh && el.hasAttribute('data-zh') ? el.getAttribute('data-zh') : tr(el.getAttribute('data-en')); });
    r.querySelectorAll('[data-en-ph]').forEach((el) => { el.setAttribute('placeholder', tr(el.getAttribute('data-en-ph'))); });
    r.querySelectorAll('[data-en-aria]').forEach((el) => { el.setAttribute('aria-label', tr(el.getAttribute('data-en-aria'))); });
    document.title = zh ? '摇摇晃晃去跑腿' : 'Yoroyoro Errand';
  }
  YL.applyDom = applyDom;
  applyDom();
})();
