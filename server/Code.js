// ヨロヨロおつかい — みんなのランキング（Google スプレッドシートに記録を集める Web アプリ）
// 1人1行（id ごとに一番いい記録だけ残す）。ゲームから ?a=add / ?a=top / ?a=name で呼ぶ。
const SHEET_NAME = 'ランキング';
const HEAD = ['id', '名前', '歩いたきょり(m)', '記録した日時', '遊んだ回数'];
const MAX_D = 100000; // これより長い記録はおかしいので受け付けない

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function cleanName_(s) {
  s = String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14);
  s = s.replace(/^[=+\-@]+/, ''); // 表の計算式にならないように
  return s || 'ななし';
}
function rows_(sh) {
  const n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  return sh.getRange(2, 1, n, HEAD.length).getValues().map((r, i) => ({ row: i + 2, id: String(r[0]), name: String(r[1]), d: Number(r[2]) || 0, plays: Number(r[4]) || 0 }));
}
function board_(rows, id) {
  const sorted = rows.slice().sort((a, b) => b.d - a.d);
  const top = sorted.slice(0, 10).map((r) => ({ name: r.name, d: r.d, me: r.id === id }));
  const idx = sorted.findIndex((r) => r.id === id);
  return { ok: true, top, count: sorted.length, rank: idx >= 0 ? idx + 1 : null, best: idx >= 0 ? sorted[idx].d : null };
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const id = String(p.id || '');
  const validId = /^[a-z0-9]{12,32}$/.test(id);
  try {
    if (p.a === 'top') return out_(board_(rows_(sheet_()), validId ? id : ''));
    if (!validId) return out_({ ok: false, error: 'bad id' });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sh = sheet_();
      const rows = rows_(sh);
      const mine = rows.find((r) => r.id === id);
      const name = cleanName_(p.name);
      if (p.a === 'name') {
        if (mine) { sh.getRange(mine.row, 2).setValue(name); mine.name = name; }
        return out_(board_(rows, id));
      }
      if (p.a === 'add') {
        const d = Math.round(Number(p.d) * 10) / 10;
        if (!(d >= 0 && d <= MAX_D)) return out_({ ok: false, error: 'bad d' });
        const now = new Date();
        if (mine) {
          mine.plays += 1; mine.name = name;
          const best = Math.max(mine.d, d);
          sh.getRange(mine.row, 2, 1, 4).setValues([[name, best, d > mine.d ? now : sh.getRange(mine.row, 4).getValue(), mine.plays]]);
          mine.d = best;
        } else {
          sh.appendRow([id, name, d, now, 1]);
          rows.push({ row: sh.getLastRow(), id, name, d, plays: 1 });
        }
        return out_(board_(rows, id));
      }
      return out_({ ok: false, error: 'bad a' });
    } finally { lock.releaseLock(); }
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}
