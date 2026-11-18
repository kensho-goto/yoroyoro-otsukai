// ヨロヨロおつかい — 転ぶ動画（さいごの4秒を小さく取っておき、転んだあとに動画にして送れるようにする）
(function () {
  const FPS = 15, SEC = 4, N = FPS * SEC; // 取っておくコマ数
  const CW = 270, CH = 300; // 1コマの大きさ
  const ring = []; let head = 0, count = 0, lastT = 0, stopAt = 0, frozen = false;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // 毎フレーム呼ぶ。src は画面のキャンバス、(x, y) は主人公の画面の位置（CSS px）、dpr は画面の細かさ
  function capture(src, x, y, W, H, dpr, now) {
    if (frozen) return;
    if (stopAt && now > stopAt) { frozen = true; return; }
    if (now - lastT < 1000 / FPS - 2) return;
    lastT = now;
    const w = Math.min(W, 380), h = w * CH / CW;
    const sx = Math.max(0, Math.min(W - w, x - w * 0.5)), sy = Math.max(0, Math.min(H - h, y - h * 0.55));
    if (!ring[head]) ring[head] = mk(CW, CH);
    const g = ring[head].getContext('2d');
    try { g.drawImage(src, sx * dpr, sy * dpr, w * dpr, h * dpr, 0, 0, CW, CH); } catch (e) { return; }
    head = (head + 1) % N; count = Math.min(N, count + 1);
  }
  function reset() { head = 0; count = 0; stopAt = 0; frozen = false; lastT = 0; }
  function stopAfter(ms, now) { if (!stopAt) stopAt = now + ms; } // 転んだあと少しだけ取って止める
  const frames = () => { const a = []; for (let i = 0; i < count; i++) a.push(ring[(head - count + i + N) % N]); return a; };
  const ready = () => count >= FPS; // 1秒以上たまっている

  function pickType() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
    for (const t of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
      try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (e) { /* つぎをためす */ }
    }
    return null;
  }
  const canVideo = () => !!pickType();

  // 動画をつくる（できないスマホでは、さいごのコマの画像）。info = { dist, title, say, tag }
  function make(info, onProgress) {
    const fr = frames();
    const OW = 360, OH = 480, VH = 400;
    const out = mk(OW, OH), g = out.getContext('2d');
    const font = '"Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif';
    function caption(sub) {
      g.fillStyle = '#fff7e6'; g.fillRect(0, VH, OW, OH - VH);
      g.fillStyle = '#3b2a1e'; g.fillRect(0, VH, OW, 4);
      g.textAlign = 'center'; g.fillStyle = '#d9531a'; g.font = `900 ${YL.en ? 20 : 22}px ${font}`;
      g.fillText(jaen(`ヨロヨロおつかい ${info.dist}`, `Yoroyoro Errand ${info.dist}`), OW / 2, VH + 32);
      g.fillStyle = '#3b2a1e'; g.font = `800 15px ${font}`;
      const st = sub || info.tag || '';
      if (YL.en) { let fs = 15; while (fs > 11 && g.measureText(st).width > OW - 20) { fs -= 1; g.font = `800 ${fs}px ${font}`; } } // 英語ははみ出すときだけ小さく
      g.fillText(st, OW / 2, VH + 60);
    }
    function frame(c, label) {
      g.drawImage(c, 0, 0, OW, VH);
      if (label) { g.fillStyle = 'rgba(59,42,30,.75)'; g.fillRect(8, 8, 96, 30); g.fillStyle = '#fff'; g.font = `900 16px ${font}`; g.textAlign = 'center'; g.fillText(label, 56, 29); }
    }
    // 英語：単語の切れ目で折り返す（はばに入るだけ並べる）
    function wrapWords(t, maxW) {
      const out = []; let cur = '';
      for (const w of t.split(/\s+/).filter(Boolean)) {
        const next = cur ? `${cur} ${w}` : w;
        if (cur && g.measureText(next).width > maxW) { out.push(cur); cur = w; } else cur = next;
      }
      if (cur) out.push(cur);
      return out;
    }
    function endCard(k) {
      const z = 1 + Math.min(1, (k || 0) / 6) * 0.04; // ぽんっと少し大きく
      g.save(); g.translate(OW / 2, 90); g.scale(z, z); g.translate(-OW / 2, -90);
      g.fillStyle = 'rgba(255,247,230,.92)'; g.fillRect(20, 18, OW - 40, 140);
      g.strokeStyle = '#3b2a1e'; g.lineWidth = 4; g.strokeRect(20, 18, OW - 40, 140);
      g.textAlign = 'center'; g.fillStyle = '#3b2a1e'; g.font = `900 30px ${font}`;
      const title = info.title || jaen('ゲームオーバー', 'Game Over');
      if (YL.en) { let fs = 30; while (fs > 16 && g.measureText(title).width > OW - 60) { fs -= 2; g.font = `900 ${fs}px ${font}`; } } // 英語は長いので、はみ出すときは小さく
      g.fillText(title, OW / 2, 60);
      g.font = `800 16px ${font}`;
      const say = (info.say || '').replace(/\n.*/s, '');
      const lines = YL.en ? wrapWords(say, OW - 60) : say.match(/.{1,17}/g) || [];
      lines.slice(0, 3).forEach((l, i) => g.fillText(l, OW / 2, 94 + i * 24));
      g.restore();
    }
    // 並べ方：ふつう → さいごの1.6秒をスローでもう一回 → おしまいのカード
    const slowN = Math.min(fr.length, Math.round(FPS * 1.6));
    const plan = fr.map((c) => ({ c, d: 1000 / FPS }))
      .concat(fr.slice(fr.length - slowN).map((c) => ({ c, d: 2400 / FPS, label: jaen('スロー', 'Slo-mo') })))
      .concat(Array.from({ length: 24 }, (_, k) => ({ end: true, k, d: 75 }))); // 止まった絵は記録されにくいので、少しずつ動かす
    const lastC = fr[fr.length - 1];
    const type = pickType();
    if (!type || !fr.length) { // 動画が作れない：画像にする
      if (lastC) frame(lastC); caption(); endCard();
      return new Promise((res) => out.toBlob((b) => res(b ? new File([b], 'yoroyoro.png', { type: 'image/png' }) : null), 'image/png'));
    }
    return new Promise((resolve) => {
      const stream = out.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 1500000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        const base = type.split(';')[0], ext = base === 'video/mp4' ? 'mp4' : 'webm';
        resolve(chunks.length ? new File(chunks, `yoroyoro.${ext}`, { type: base }) : null);
      };
      const total = plan.reduce((a, p) => a + p.d, 0);
      let i = 0, t = 0;
      const draw = () => { const p = plan[i]; if (p.end) { frame(lastC); caption(); endCard(p.k); } else { frame(p.c, p.label); caption(); } };
      draw(); rec.start();
      const tick = () => {
        t += plan[i].d; i++;
        if (onProgress) onProgress(Math.min(1, t / total));
        if (i >= plan.length) { setTimeout(() => rec.stop(), 150); return; }
        draw(); setTimeout(tick, plan[i].d);
      };
      setTimeout(tick, plan[0].d);
    });
  }

  window.YoroClip = { capture, reset, stopAfter, ready, make, canVideo };
})();
