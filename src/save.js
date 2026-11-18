// ヨロヨロおつかい — 記録の保存先（どのファイルも、ここを通して読み書きする）
// ・ふつうの公開版：この端末の中（localStorage）
// ・ゲームサイト（CrazyGames）版：サイトのアカウントに保存（portal.js が YS.use() で切りかえる）。
//   ログインしていない人はサイトが端末に保存し、ログインするとアカウントに移る。ほかの端末でも続きから遊べる
// 保存に失敗しても遊びは止めない（読めなければ null、書けなければ何もしない）
(function () {
  const local = {
    getItem(k) { return localStorage.getItem(k); },
    setItem(k, v) { localStorage.setItem(k, v); },
    removeItem(k) { localStorage.removeItem(k); },
  };
  let box = local;
  const YS = {
    get(k) { try { return box.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { box.setItem(k, String(v)); } catch (e) { /* 保存できなくても遊べる */ } },
    remove(k) { try { box.removeItem(k); } catch (e) { /* なくてよい */ } },
    get where() { return box === local ? 'local' : 'site'; },
    // サイトの保存先に切りかえる。はじめての切りかえのときは、この端末に残っている記録を移す
    use(site) {
      box = site;
      try {
        if (site.getItem('yoro.saveVer') != null) return;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('yoro.') && site.getItem(k) == null) site.setItem(k, localStorage.getItem(k));
        }
      } catch (e) { /* 移せなくても新しく始められる */ }
      try { site.setItem('yoro.saveVer', '1'); } catch (e) { /* 同上 */ }
    },
  };
  window.YS = YS;
})();
