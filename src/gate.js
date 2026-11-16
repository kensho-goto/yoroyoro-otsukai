// 合言葉の画面（メンバー用の試作版なので、URLが外にもれてもすぐ遊べないようにする目印）
(function () {
  const HASH = 'b55d3a637fdb0049a78a39710a973f722debd1cb7c23e9c2820d0f7ad9f406e0'; // 合言葉（ぷりん）を変換した値
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
    if (t === 'purin' || t === 'pudding') t = 'ぷりん';
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
