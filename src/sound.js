// ヨロヨロおつかい — 音（ぜんぶその場で作るオリジナルの音。音のファイルは使わない）
(function () {
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても鳴らせる */ } },
  };
  let ctx = null, master = null, sfxBus = null, bgmBus = null;
  let on = store.get('yoro.sound') !== 'off';
  let bgmWanted = false, bgmTimer = null, bgmStep = 0, bgmNext = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    bgmBus = ctx.createGain(); bgmBus.gain.value = 0.22; bgmBus.connect(master);
    return true;
  }
  // 画面を最初にさわったときに音を使えるようにする（スマホは操作のあとでないと鳴らせない）
  const unlock = () => { ensure(); if (bgmWanted) startBgm(); };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  // ---- 音の部品 ----
  function tone(freq, t, dur, { type = 'triangle', vol = 0.3, to = null, bus = sfxBus, attack = 0.005 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(t, dur, { vol = 0.3, freq = 800, q = 1, type = 'lowpass' } = {}) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.02);
  }
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // 音の高さ（ドレミの番号→周波数）

  // ---- 効果音 ----
  let lastStep = 0, lastDanger = 0, stepFlip = false;
  const SFX = {
    step() { // トッ（左右で少し高さが変わる）
      const t = ctx.currentTime; if (t - lastStep < 0.06) return; lastStep = t;
      stepFlip = !stepFlip;
      tone(stepFlip ? 150 : 125, t, 0.09, { type: 'sine', vol: 0.35, to: 70 });
      noise(t, 0.05, { vol: 0.12, freq: 1200 });
    },
    jump(p = 0.5) { // ピョン
      const t = ctx.currentTime;
      tone(320, t, 0.22 + p * 0.1, { type: 'square', vol: 0.12, to: 760 + p * 300 });
      tone(640, t + 0.02, 0.18, { type: 'triangle', vol: 0.1, to: 1300 });
    },
    land() { // ドスン
      const t = ctx.currentTime;
      tone(110, t, 0.18, { type: 'sine', vol: 0.5, to: 50 });
      noise(t, 0.12, { vol: 0.25, freq: 500 });
    },
    fall() { // ヒュ〜…ドテッ
      const t = ctx.currentTime;
      tone(700, t, 0.35, { type: 'triangle', vol: 0.18, to: 180 });
      tone(90, t + 0.33, 0.25, { type: 'sine', vol: 0.55, to: 40 });
      noise(t + 0.33, 0.2, { vol: 0.35, freq: 400 });
    },
    pudding() { // プルルン…ヒューン
      const t = ctx.currentTime;
      for (let i = 0; i < 4; i++) tone(520 - i * 40, t + i * 0.06, 0.08, { type: 'sine', vol: 0.2, to: 380 - i * 30 });
      tone(500, t + 0.25, 0.6, { type: 'sine', vol: 0.2, to: 1600 });
      tone(1600, t + 0.85, 0.5, { type: 'sine', vol: 0.15, to: 300 });
    },
    checkpoint() { // ピンポン
      const t = ctx.currentTime;
      tone(N(84), t, 0.25, { type: 'sine', vol: 0.25 });
      tone(N(88), t + 0.12, 0.4, { type: 'sine', vol: 0.25 });
    },
    clear() { // パンパカパーン（オリジナル）
      const t = ctx.currentTime;
      [[72, 0], [76, 0.13], [79, 0.26], [84, 0.39], [79, 0.6], [84, 0.73]].forEach(([n, d], i) =>
        tone(N(n), t + d, i === 5 ? 0.8 : 0.16, { type: 'square', vol: 0.1 }));
      [[48, 0], [55, 0.39], [60, 0.73]].forEach(([n, d]) => tone(N(n), t + d, 0.4, { type: 'triangle', vol: 0.25 }));
    },
    start() { // タタタン
      const t = ctx.currentTime;
      [[67, 0], [72, 0.1], [76, 0.2]].forEach(([n, d]) => tone(N(n), t + d, 0.14, { type: 'triangle', vol: 0.22 }));
    },
    danger(d = 0.7) { // プルプル（ぐらぐらが多いほど速く高く）
      const t = ctx.currentTime; const gap = 0.32 - (d - 0.65) * 0.5;
      if (t - lastDanger < gap) return; lastDanger = t;
      tone(600 + d * 400, t, 0.07, { type: 'sine', vol: 0.12, to: 500 + d * 300 });
    },
    timeup() { // ブッブー
      const t = ctx.currentTime;
      tone(180, t, 0.28, { type: 'square', vol: 0.16 });
      tone(140, t + 0.32, 0.5, { type: 'square', vol: 0.16 });
    },
    tick(n = 5) { // のこり5秒からの ピッ
      const t = ctx.currentTime;
      tone(n <= 3 ? 1320 : 990, t, 0.09, { type: 'square', vol: 0.09 });
    },
    stumble(v) { // おっとっと
      const t = ctx.currentTime, b = Math.min(1.5, (v && v.bad) || 0.5);
      tone(420, t, 0.08, { type: 'triangle', vol: 0.12 + b * 0.08, to: 300 });
      tone(380, t + 0.09, 0.1, { type: 'triangle', vol: 0.12 + b * 0.08, to: 250 });
    },
    stop() { // ふにゃ〜
      const t = ctx.currentTime;
      tone(500, t, 0.5, { type: 'sawtooth', vol: 0.06, to: 150 });
    },
    boing() { // ビヨーン（ジャンプ台）
      const t = ctx.currentTime;
      tone(180, t, 0.45, { type: 'square', vol: 0.1, to: 900 });
      for (let i = 0; i < 5; i++) tone(700 - i * 60, t + 0.05 + i * 0.07, 0.07, { type: 'sine', vol: 0.12, to: 900 - i * 60 });
    },
    wobble() { // ふらふら〜
      const t = ctx.currentTime;
      tone(520, t, 0.25, { type: 'sine', vol: 0.12, to: 380 });
      tone(380, t + 0.22, 0.3, { type: 'sine', vol: 0.12, to: 520 });
    },
    combo(n) { // キラリン（リズムが続いた）
      const t = ctx.currentTime, up = Math.min(12, Math.floor((n || 10) / 10) * 2);
      [[84, 0], [88, 0.07], [91, 0.14]].forEach(([m, d]) => tone(N(m + up), t + d, 0.18, { type: 'triangle', vol: 0.14 }));
    },
    best() { // 自己ベストをこえた
      const t = ctx.currentTime;
      [[72, 0], [76, 0.08], [79, 0.16], [84, 0.24], [88, 0.36]].forEach(([m, d], i) => tone(N(m), t + d, i === 4 ? 0.5 : 0.12, { type: 'square', vol: 0.09 }));
    },
    tap() { const t = ctx.currentTime; tone(880, t, 0.06, { type: 'sine', vol: 0.15 }); },
  };

  // ---- BGM（のんびりしたオリジナルの曲。2小節×4のくり返し） ----
  const BPM = 112, STEP = 60 / BPM / 2; // 8分音符
  // メロディ（0=休み）・ベース（ドレミの番号）
  const MEL = [
    76, 0, 79, 76, 74, 0, 72, 0, 74, 0, 76, 74, 72, 0, 67, 0,
    69, 0, 72, 69, 67, 0, 64, 0, 67, 69, 67, 64, 62, 0, 0, 0,
    76, 0, 79, 76, 74, 0, 72, 0, 74, 76, 79, 81, 79, 0, 76, 0,
    74, 0, 72, 74, 76, 0, 74, 72, 67, 0, 69, 0, 72, 0, 0, 0,
  ];
  const BASS = [48, 55, 45, 52, 41, 48, 43, 50];
  function scheduleBgm() {
    if (!ctx) return;
    while (bgmNext < ctx.currentTime + 0.25) {
      const i = bgmStep % MEL.length, t = bgmNext;
      if (MEL[i]) tone(N(MEL[i]), t, STEP * 1.6, { type: 'triangle', vol: 0.32, bus: bgmBus, attack: 0.01 });
      if (i % 4 === 0) { // ベースは4分音符ごと、2拍ずつ同じ音
        const b = BASS[Math.floor(i / 8) % BASS.length];
        tone(N(b), t, STEP * 1.8, { type: 'sine', vol: 0.5, bus: bgmBus, attack: 0.01 });
      }
      if (i % 2 === 1) noise(t, 0.03, { vol: 0.04, freq: 6000, type: 'highpass' }); // チッ
      bgmStep++; bgmNext += STEP;
    }
  }
  function startBgm() {
    bgmWanted = true;
    if (!ctx || bgmTimer) return;
    bgmNext = ctx.currentTime + 0.1;
    bgmTimer = setInterval(scheduleBgm, 80);
  }
  function stopBgm() {
    bgmWanted = false;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  }

  window.YoroSound = {
    play(name, v) {
      if (!on || !ensure() || !SFX[name]) return;
      try { SFX[name](v); } catch (e) { console.warn("sound", name, e); /* 音が出なくても遊べる */ }
    },
    bgm(play) { if (play) { ensure(); startBgm(); } else stopBgm(); },
    get on() { return on; },
    sleep(s) { if (ctx) { if (s) ctx.suspend(); else ctx.resume(); } }, // アプリを離れたら音を止める
    toggle() {
      on = !on; store.set('yoro.sound', on ? 'on' : 'off');
      if (ensure()) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.02);
      return on;
    },
  };
})();
