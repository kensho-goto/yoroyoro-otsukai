// ヨロヨロおつかい — ゲームサイト（CrazyGames）につなぐ部分
// サイトの道具（SDK）が読みこまれていないとき（ふつうの公開版・手元）は、何もしない
// 広告のあいだは音を止める。サイトの「音を消す」設定にも従う。記録はサイトのアカウントに保存する（src/save.js）
// ゲームの本体は、サイトの準備（と記録の読みこみ）が終わってから読みこむ（tools/build-portal.py が順番を作る）
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
    // 記録はサイトのアカウントに保存する（申しこみで「進み具合を保存」を選んでいないと使えないので、そのときは端末に保存）
    try { C.data.getItem('yoro.saveVer'); if (window.YS) YS.use(C.data); } catch (e) { console.warn('portal data', e); }
    const readMute = () => { siteMute = !!safe(() => sdk.game.settings && sdk.game.settings.muteAudio); quiet(); };
    readMute();
    safe(() => sdk.game.addSettingsChangeListener(readMute));
    return true;
  }

  // サイトの返事がなくても、6秒でゲームを始める（読みこみで止まらない）
  const ready = Promise.race([init().catch(() => false), new Promise((r) => setTimeout(() => r(false), 6000))]);
  const YP = {
    ready,
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
