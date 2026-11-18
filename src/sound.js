// ヨロヨロおつかい — 音（ぜんぶその場で作るオリジナルの音。音のファイルは使わない）
(function () {
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても鳴らせる */ } },
  };
  let ctx = null, master = null, sfxBus = null, bgmBus = null, comp = null;
  let on = store.get('yoro.sound') !== 'off';
  let bgmWanted = false, bgmTimer = null, bgmStep = 0, bgmNext = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = on ? 0.9 : 0;
    comp = ctx.createDynamicsCompressor(); // たくさん重なっても音が割れないように
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
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
  function noise(t, dur, { vol = 0.3, freq = 800, q = 1, type = 'lowpass', bus = sfxBus } = {}) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.02);
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
    jump2() { // 2段ジャンプ：ピョピョン
      const t = ctx.currentTime;
      tone(520, t, 0.16, { type: 'square', vol: 0.1, to: 1100 });
      tone(780, t + 0.07, 0.16, { type: 'triangle', vol: 0.1, to: 1600 });
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
    treasure(rare) { // おたからを拾った（めずらしいほど長く光る）
      const t = ctx.currentTime, k = rare ? 6 : 3;
      for (let i = 0; i < k; i++) tone(N(86 + i * 3), t + i * 0.06, 0.14, { type: 'sine', vol: 0.13 });
      noise(t, 0.12, { vol: 0.05, freq: 6000, type: 'highpass' });
    },
    event() { // 何かが起きた（風・めずらしい人・金のプリン）
      const t = ctx.currentTime;
      [[79, 0], [83, 0.1], [86, 0.2], [91, 0.3]].forEach(([m, d]) => tone(N(m), t + d, 0.22, { type: 'triangle', vol: 0.12 }));
    },
    voice(v = {}) {
      const t0 = ctx.currentTime + (v.delay || 0), kind = v.kind || 'human', mood = v.mood || 'happy';
      const n = Math.max(3, Math.min(9, Math.round((v.len || 12) / 2.2)));
      const up = mood === 'happy', down = mood === 'sad' || mood === 'cry' || mood === 'sigh' || mood === 'sulk', mad = mood === 'angry' || mood === 'shock';
      if (kind === 'cat') { // ニャーオ
        for (let k = 0; k < (mad ? 2 : 1); k++) {
          const t = t0 + k * 0.42, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(up ? 900 : 760, t + 0.12); o.frequency.linearRampToValueAtTime(down ? 380 : 560, t + 0.38);
          f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(2200, t + 0.14); f.frequency.linearRampToValueAtTime(1000, t + 0.38);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
          o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.42);
        }
        return;
      }
      if (kind === 'dog') { // ワンワン
        for (let k = 0; k < (down ? 1 : 2); k++) {
          const t = t0 + k * 0.22;
          tone(down ? 300 : 420, t, 0.16, { type: 'square', vol: 0.16, to: down ? 160 : 230 });
          noise(t, 0.06, { vol: 0.12, freq: 1500, q: 2, type: 'bandpass' });
        }
        return;
      }
      if (kind === 'ghost') { // ひゅ〜ゆ〜
        const o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), d = 0.9;
        o.type = 'sine'; o.frequency.setValueAtTime(up ? 500 : 700, t0); o.frequency.linearRampToValueAtTime(up ? 760 : 380, t0 + d);
        l.frequency.value = 7; lg.gain.value = 30; l.connect(lg); lg.connect(o.frequency);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        o.connect(g); g.connect(sfxBus); o.start(t0); l.start(t0); o.stop(t0 + d + 0.02); l.stop(t0 + d + 0.02);
        return;
      }
      const base = v.pitch || 300, step = mad ? 0.075 : down ? 0.11 : 0.09;
      for (let i = 0; i < n; i++) {
        const t = t0 + i * step, last = i === n - 1;
        let f = base * (1 + (Math.random() - 0.5) * 0.25);
        if (up) f *= 1 + (i / n) * 0.25 + (last ? 0.2 : 0);
        if (down) f *= 1 - (i / n) * 0.25;
        if (kind === 'alien') f = base * [1, 1.5, 0.75, 2, 1.25][Math.floor(Math.random() * 5)];
        const dur = last ? step * 1.8 : step * 0.8;
        tone(f, t, dur, { type: kind === 'alien' ? 'square' : mad ? 'square' : 'triangle', vol: kind === 'alien' ? 0.13 : mad ? 0.17 : 0.2, to: last ? f * (up ? 1.25 : 0.8) : f * 0.92 });
        if (v.shaky) tone(f * 1.02, t, dur, { type: 'sine', vol: 0.06 }); // おばあちゃんの ふるえ声
      }
    },
    gust() { const t = ctx.currentTime; noise(t, 0.9, { vol: 0.16, freq: 500, q: 0.7, type: 'bandpass' }); },
    tap() { const t = ctx.currentTime; tone(880, t, 0.06, { type: 'sine', vol: 0.15 }); },
    g(n) { const f = GAG[n]; if (f) f(ctx.currentTime); }, // ころび芸の音
  };
  // ころび芸の音（どれもその場で作る）
  function wob(t, { type = 'sine', f0, f1, lfo, depth, vol, dur }) { // ゆれる音（たましい・おなら・UFO）
    const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur);
    l.frequency.value = lfo; lg.gain.value = depth; l.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); l.start(t); o.stop(t + dur + 0.05); l.stop(t + dur + 0.05);
  }
  const GAG = {
    clang(t) { [523, 787, 1046, 1410].forEach((f, i) => tone(f, t, 1.4 - i * 0.2, { type: 'sine', vol: 0.16 - i * 0.025 })); tone(900, t, 0.5, { type: 'square', vol: 0.04, to: 870 }); noise(t, 0.08, { vol: 0.3, freq: 3000, type: 'highpass' }); },
    thud(t) { tone(70, t, 0.45, { type: 'sine', vol: 0.7, to: 30 }); noise(t, 0.3, { vol: 0.5, freq: 260 }); },
    bonk(t) { tone(900, t, 0.12, { type: 'square', vol: 0.12, to: 300 }); tone(160, t, 0.15, { type: 'sine', vol: 0.4, to: 80 }); },
    splat(t) { noise(t, 0.25, { vol: 0.5, freq: 900, q: 0.8, type: 'bandpass' }); tone(220, t, 0.18, { type: 'sine', vol: 0.3, to: 90 }); },
    piano(t) { [36, 43, 48, 52, 55, 61, 66].forEach((m, i) => tone(N(m), t + i * 0.008, 1.6, { type: 'triangle', vol: 0.09 })); noise(t, 0.3, { vol: 0.4, freq: 300 }); },
    crash(t) { for (let i = 0; i < 7; i++) tone(2000 + Math.random() * 3000, t + i * 0.025, 0.25, { type: 'sine', vol: 0.07 }); noise(t, 0.5, { vol: 0.45, freq: 4000, type: 'highpass' }); },
    crunch(t) { for (let i = 0; i < 5; i++) noise(t + i * 0.04, 0.05, { vol: 0.35, freq: 1500 + i * 300, q: 2, type: 'bandpass' }); },
    blocks(t) { for (let i = 0; i < 8; i++) tone(300 + Math.random() * 500, t + i * 0.05, 0.06, { type: 'square', vol: 0.06 }); },
    stone(t) { noise(t, 0.6, { vol: 0.4, freq: 200, q: 1.5, type: 'bandpass' }); tone(90, t, 0.6, { type: 'sawtooth', vol: 0.06, to: 60 }); },
    crack(t) { tone(2400, t, 0.08, { type: 'square', vol: 0.06, to: 1800 }); noise(t, 0.06, { vol: 0.3, freq: 3500, type: 'highpass' }); },
    whoosh(t) { noise(t, 0.6, { vol: 0.3, freq: 1200, q: 0.8, type: 'bandpass' }); tone(300, t, 0.5, { type: 'sine', vol: 0.12, to: 1400 }); },
    twinkle(t) { [96, 100, 103, 108].forEach((m, i) => tone(N(m), t + i * 0.06, 0.35, { type: 'sine', vol: 0.12 })); },
    screen(t) { tone(140, t, 0.2, { type: 'sine', vol: 0.5, to: 60 }); noise(t, 0.2, { vol: 0.5, freq: 700 }); tone(1300, t + 0.02, 0.15, { type: 'square', vol: 0.05, to: 1100 }); },
    squeak(t) { for (let i = 0; i < 4; i++) tone(1500 + i * 90, t + i * 0.18, 0.12, { type: 'sine', vol: 0.06, to: 1900 }); },
    freeze(t) { for (let i = 0; i < 6; i++) tone(N(88 + i * 3), t + i * 0.04, 0.5, { type: 'sine', vol: 0.06 }); noise(t, 0.4, { vol: 0.15, freq: 6000, type: 'highpass' }); },
    slide(t) { noise(t, 1.1, { vol: 0.12, freq: 2500, q: 0.6, type: 'bandpass' }); },
    melt(t) { tone(600, t, 1.2, { type: 'sine', vol: 0.12, to: 120 }); for (let i = 0; i < 4; i++) tone(900 - i * 120, t + 0.3 + i * 0.22, 0.1, { type: 'sine', vol: 0.1, to: 400 }); },
    soul(t) { wob(t, { f0: 500, f1: 900, lfo: 7, depth: 30, vol: 0.12, dur: 1.3 }); },
    back(t) { tone(1200, t, 0.18, { type: 'sine', vol: 0.15, to: 200 }); },
    zap(t) { for (let i = 0; i < 10; i++) tone(80 + Math.random() * 60, t + i * 0.035, 0.04, { type: 'sawtooth', vol: 0.12 }); noise(t, 0.5, { vol: 0.3, freq: 3000, type: 'highpass' }); tone(60, t + 0.35, 0.4, { type: 'sine', vol: 0.5, to: 30 }); },
    flap(t) { for (let i = 0; i < 4; i++) noise(t + i * 0.16, 0.09, { vol: 0.3, freq: 600, q: 1, type: 'bandpass' }); },
    kaa(t) { tone(700, t, 0.3, { type: 'sawtooth', vol: 0.08, to: 520 }); tone(700, t + 0.38, 0.3, { type: 'sawtooth', vol: 0.08, to: 520 }); },
    inflate(t) { tone(200, t, 0.6, { type: 'square', vol: 0.07, to: 700 }); noise(t, 0.6, { vol: 0.12, freq: 2000, type: 'highpass' }); },
    pfff(t) { tone(900, t, 1.0, { type: 'sawtooth', vol: 0.05, to: 300 }); noise(t, 1.0, { vol: 0.25, freq: 2500, q: 0.5, type: 'bandpass' }); },
    boing(t) { tone(150, t, 0.35, { type: 'sine', vol: 0.35, to: 600 }); },
    boing2(t) { tone(220, t, 0.35, { type: 'sine', vol: 0.35, to: 900 }); },
    boing3(t) { tone(300, t, 0.4, { type: 'sine', vol: 0.35, to: 1300 }); },
    drill(t) { tone(90, t, 1.2, { type: 'sawtooth', vol: 0.08, to: 140 }); noise(t, 1.2, { vol: 0.2, freq: 400, q: 2, type: 'bandpass' }); },
    puha(t) { noise(t, 0.12, { vol: 0.3, freq: 1500 }); tone(500, t, 0.15, { type: 'triangle', vol: 0.15, to: 900 }); },
    boyon(t) { for (let i = 0; i < 4; i++) tone(140 - i * 10, t + i * 0.13, 0.13, { type: 'sine', vol: 0.4 - i * 0.07, to: 90 }); },
    fart(t) { wob(t, { type: 'sawtooth', f0: 95, f1: 70, lfo: 23, depth: 25, vol: 0.2, dur: 0.65 }); },
    trap(t) { tone(200, t, 0.15, { type: 'square', vol: 0.08, to: 120 }); tone(1200, t + 0.15, 0.9, { type: 'sine', vol: 0.13, to: 200 }); },
    shut(t) { tone(160, t, 0.12, { type: 'square', vol: 0.15, to: 90 }); noise(t, 0.1, { vol: 0.3, freq: 800 }); },
    snore(t) { noise(t, 0.6, { vol: 0.14, freq: 300, q: 2, type: 'bandpass' }); noise(t + 0.8, 0.6, { vol: 0.08, freq: 900, q: 2, type: 'bandpass' }); },
    pop(t) { tone(1400, t, 0.06, { type: 'square', vol: 0.12, to: 400 }); noise(t, 0.05, { vol: 0.3, freq: 3000, type: 'highpass' }); },
    ufo(t) { wob(t, { f0: 700, f1: 760, lfo: 9, depth: 200, vol: 0.09, dur: 2 }); },
    meow(t) { const f = 600 + Math.random() * 300; tone(f, t, 0.3, { type: 'sawtooth', vol: 0.05, to: f * 1.3 }); tone(f * 1.3, t + 0.15, 0.25, { type: 'triangle', vol: 0.08, to: f * 0.8 }); },
    wind(t) { noise(t, 1.8, { vol: 0.3, freq: 600, q: 0.6, type: 'bandpass' }); tone(200, t, 1.6, { type: 'sine', vol: 0.06, to: 500 }); },
    bloom(t) { [72, 76, 79, 84, 88].forEach((m, i) => tone(N(m), t + i * 0.07, 0.3, { type: 'triangle', vol: 0.12 })); },
    shrink(t) { tone(1000, t, 0.55, { type: 'square', vol: 0.06, to: 2400 }); },
    pip(t) { tone(1900, t, 0.05, { type: 'sine', vol: 0.08 }); },
    poof(t) { noise(t, 0.45, { vol: 0.45, freq: 900 }); tone(300, t, 0.2, { type: 'triangle', vol: 0.15, to: 150 }); },
    roll(t) { for (let i = 0; i < 10; i++) tone(70 + (i % 2) * 15, t + i * 0.12, 0.1, { type: 'sine', vol: 0.25 }); },
    paper(t) { for (let i = 0; i < 3; i++) noise(t + i * 0.07, 0.08, { vol: 0.25, freq: 5000, type: 'highpass' }); },
    sink(t) { for (let i = 0; i < 6; i++) tone(300 - i * 30, t + i * 0.12, 0.1, { type: 'sine', vol: 0.15, to: 180 - i * 20 }); },
    snow(t) { noise(t, 1.2, { vol: 0.12, freq: 1800, q: 0.4, type: 'bandpass' }); },
  };

  // ---- BGM（のんびりしたオリジナルの曲。2小節×4のくり返し） ----
  // 朝＝ふつう／昼＝速くにぎやか／夕方＝ゆっくり少しさみしい（短調）／夜＝オルゴール
  const MOODS = [
    { bpm: 112, mel: 'triangle', vol: 0.32, hat: 1, kick: 0 },
    { bpm: 128, mel: 'square', vol: 0.14, hat: 1, kick: 1 },
    { bpm: 96, mel: 'triangle', vol: 0.3, hat: 0, kick: 0, minor: 1 },
    { bpm: 84, mel: 'sine', vol: 0.36, hat: 0, kick: 0, bell: 1 },
  ];
  let mood = MOODS[0];
  const MINOR = { 4: 3, 9: 8, 11: 10 }; // ミ・ラ・シを半音下げる
  const key = (n) => (mood.minor && MINOR[n % 12] != null ? n - (n % 12) + MINOR[n % 12] : n);
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
      const i = bgmStep % MEL.length, t = bgmNext, STEP = 60 / mood.bpm / 2; // 8分音符
      if (MEL[i]) {
        if (mood.bell) { tone(N(key(MEL[i]) + 12), t, STEP * 3, { type: 'sine', vol: mood.vol, bus: bgmBus, attack: 0.003 }); tone(N(key(MEL[i]) + 24), t, STEP, { type: 'sine', vol: mood.vol * 0.25, bus: bgmBus, attack: 0.003 }); }
        else tone(N(key(MEL[i])), t, STEP * 1.6, { type: mood.mel, vol: mood.vol, bus: bgmBus, attack: 0.01 });
      }
      if (i % 4 === 0) { // ベースは4分音符ごと、2拍ずつ同じ音
        const b = key(BASS[Math.floor(i / 8) % BASS.length]);
        tone(N(b), t, STEP * 1.8, { type: 'sine', vol: mood.bell ? 0.3 : 0.5, bus: bgmBus, attack: 0.01 });
        if (mood.kick) tone(120, t, 0.12, { type: 'sine', vol: 0.45, to: 45, bus: bgmBus });
      }
      if (mood.hat && i % 2 === 1) noise(t, 0.03, { vol: 0.04, freq: 6000, type: 'highpass', bus: bgmBus }); // チッ
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
    mood(i) { mood = MOODS[((i % MOODS.length) + MOODS.length) % MOODS.length]; }, // 朝・昼・夕方・夜
    get _ctx() { return ctx; }, get _out() { return comp; }, // 確かめ用
    get on() { return on; },
    sleep(s) { if (ctx) { if (s) ctx.suspend(); else ctx.resume(); } }, // アプリを離れたら音を止める
    toggle() {
      on = !on; store.set('yoro.sound', on ? 'on' : 'off');
      if (ensure()) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.02);
      return on;
    },
  };
})();
