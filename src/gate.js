// 合言葉の画面（メンバー用の試作版なので、URLが外にもれてもすぐ遊べないようにする目印）
(function () {
  const HASH = 'c6ba94d4d25addaa53479c5f0b3044386e5ac9da7214fea34476dcbb27d9f3f5'; // 合言葉（いいんじゃ）を変換した値
  const KEY = 'yoro.member';
  const gate = document.getElementById('gate');
  const input = document.getElementById('gateInput');
  const msg = document.getElementById('gateMsg');
  let ok = false;
  try { ok = localStorage.getItem(KEY) === HASH; } catch (e) { /* 保存できない環境では毎回聞く */ }
  if (location.hostname === 'localhost' || location.hostname.endsWith('claude.ai') || location.hostname.endsWith('claudeusercontent.com')) ok = true;
  if (ok) return;
  gate.hidden = false;
  // ローマ字・カタカナでも通るように、ひらがなにそろえる
  function normalize(t) {
    t = t.trim().toLowerCase().replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
    t = t.replace(/\s+/g, '');
    if (t === 'einja' || t === 'iinja' || t === 'iinjya' || t === 'einjya') t = 'いいんじゃ';
    return t;
  }
  async function sha256(t) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function check() {
    if ((await sha256(normalize(input.value))) === HASH) {
      try { localStorage.setItem(KEY, HASH); } catch (e) { /* 保存できなくても入れる */ }
      gate.hidden = true;
    } else {
      msg.textContent = '合言葉がちがいます';
      input.select();
    }
  }
  document.getElementById('gateBtn').onclick = check;
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') check(); });
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
})();
