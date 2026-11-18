// ヨロヨロおつかい — ゲームサイト（CrazyGames）につなぐ部分
// サイトの道具（SDK）が読みこまれていないとき（ふつうの公開版・手元）は、何もしない
// 広告のあいだは音を止める。サイトの「音を消す」設定にも従う
(function () {
  let sdk = null; let playing = false; let adOn = false; let siteMute = false;
  const safe = (fn) => { try { return fn(); } catch (e) { console.warn('portal', e); return undefined; } };
  const quiet = () => { if (window.YoroSound && YoroSound.hold) YoroSound.hold(adOn || siteMute); };

  async function init() {
    const C = window.CrazyGames && window.CrazyGames.SDK;
    if (!C) return false;
    try { await C.init(); } catch (e) { console.warn('portal init', e); return false; }
    if (C.environment === 'disabled') return false;
    sdk = C;
    safe(() => sdk.game.loadingStart());
    const readMute = () => { siteMute = !!safe(() => sdk.game.settings && sdk.game.settings.muteAudio); quiet(); };
    readMute();
    safe(() => sdk.game.addSettingsChangeListener(readMute));
    return true;
  }

  const YP = {
    ready: init(),
    get active() { return !!sdk; },
    get adShowing() { return adOn; },
    loaded() { if (sdk) safe(() => sdk.game.loadingStop()); },
    start() { if (!sdk || playing) return; playing = true; safe(() => sdk.game.gameplayStart()); },
    stop() { if (!sdk || !playing) return; playing = false; safe(() => sdk.game.gameplayStop()); },
    happy() { if (sdk) safe(() => sdk.game.happytime()); },
    // 区切りの広告（もう一回・つぎへ のとき）。広告が出なくても、終わったら done を1回だけ呼ぶ
    // 何回出すかはサイト側が決める（短い間に何度も頼んでも、出すぎない）
    breakAd(done) {
      let fin = false;
      const end = () => { if (fin) return; fin = true; done(); };
      if (!sdk) { end(); return; }
      YP.stop();
      const off = () => { adOn = false; quiet(); end(); };
      const r = safe(() => sdk.ad.requestAd('midgame', {
        adStarted: () => { adOn = true; quiet(); },
        adFinished: off,
        adError: off,
      }));
      if (r && r.catch) r.catch(off);
      setTimeout(() => { if (!adOn) end(); }, 6000); // 返事がないときも止まらない
    },
  };
  window.YP = YP;
})();
