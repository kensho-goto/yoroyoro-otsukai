// ヨロヨロおつかい — ことばの切りかえ（日本語 / 英語）
// きめかた：URL の ?lang=ja|en → 前に選んだもの → 端末のことば（日本語以外は英語）
// つかいかた：jaen('ころんだ', 'You fell') … 英語のときは2つめを返す
// HTML は data-en（中身）・data-en-ph（入力欄のうすい字）・data-en-aria（読み上げ名）に英語を書いておく
(function () {
  const ok = (l) => l === 'ja' || l === 'en';
  let q = null; let saved = null;
  try { q = new URLSearchParams(location.search).get('lang'); } catch (e) { /* なくてよい */ }
  try { saved = localStorage.getItem('yoro.lang'); } catch (e) { /* 保存できなくても遊べる */ }
  if (ok(q)) { try { localStorage.setItem('yoro.lang', q); } catch (e) { /* 同上 */ } }
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'ja';
  const lang = ok(q) ? q : ok(saved) ? saved : /^ja\b/i.test(nav) ? 'ja' : 'en';
  const en = lang === 'en';
  function set(l) {
    if (!ok(l) || l === lang) return;
    try { localStorage.setItem('yoro.lang', l); } catch (e) { /* 同上 */ }
    const u = new URL(location.href); u.searchParams.delete('lang'); location.replace(u.toString());
  }
  window.YL = { lang, en, set };
  window.jaen = (ja, e) => (en ? e : ja);
  document.documentElement.lang = lang;
  function applyDom(root) {
    if (!en) return;
    const r = root || document;
    r.querySelectorAll('[data-en]').forEach((el) => { el.innerHTML = el.getAttribute('data-en'); });
    r.querySelectorAll('[data-en-ph]').forEach((el) => { el.setAttribute('placeholder', el.getAttribute('data-en-ph')); });
    r.querySelectorAll('[data-en-aria]').forEach((el) => { el.setAttribute('aria-label', el.getAttribute('data-en-aria')); });
    document.title = 'Yoroyoro Errand';
  }
  YL.applyDom = applyDom;
  applyDom();
})();
