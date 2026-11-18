// ヨロヨロおつかい — ミッション（ステージごとの小さなお題。ゴールまでに達成するとメダル）
// ・ステージが進むほど、出てくるお題の種類がふえる（from＝そのステージから出る。出たはじめてのステージでは必ずそれが出る）
// ・1ステージのお題の数も、進むとふえる（ステージ10から2つ、25から3つ）
// ・同じステージは、何回やり直しても同じお題（今日のコースは、その日みんな同じ）
// ・ふやすときは LIST に1行足すだけ。数えるもの（key）は main.js の st（この道での記録）にある
//   kind: 'count' … st[key] が n 以上になったら達成 / 'keep' … ゴールまで st[key] が 0 のままなら達成
//         'time'  … 時間制限の rate 倍以内にゴールしたら達成
(function () {
  const LIST = [
    { id: 'box1', from: 1, kind: 'count', key: 'boxes', n: 1, medal: 1, ja: '？の箱を 1こ とる', en: 'Grab a ? box', need: (c) => c.boxes >= 1 },
    { id: 'combo', from: 1, kind: 'count', key: 'combo', n: 1, medal: 2, ja: 'ナイスリズムを 出す', en: 'Get a Nice Rhythm' },
    { id: 'quick', from: 2, kind: 'time', rate: 0.6, medal: 2, ja: '{t}秒以内に ゴール', en: 'Reach home within {t}s' },
    { id: 'high', from: 2, kind: 'count', key: 'high', n: 1, medal: 2, ja: '高い箱を とる', en: 'Grab a high box', need: (c) => c.high >= 1 },
    { id: 'box2', from: 3, kind: 'count', key: 'boxes', n: 2, medal: 2, ja: '？の箱を 2こ とる', en: 'Grab 2 ? boxes', need: (c) => c.boxes >= 2 },
    { id: 'jump3', from: 3, kind: 'count', key: 'jumps', n: 3, medal: 1, ja: 'ジャンプを 3回', en: 'Jump 3 times' },
    { id: 'nooops', from: 3, kind: 'keep', key: 'stumble', medal: 2, ja: '「おっと」なしで ゴール', en: 'No "Whoops" all the way' },
    { id: 'calm', from: 4, kind: 'keep', key: 'shaky', medal: 2, ja: 'プリンを 赤にせず ゴール', en: "Don't let the pudding go red" },
    { id: 'nostop', from: 4, kind: 'keep', key: 'stop', medal: 1, ja: '一度も 止まらず ゴール', en: 'Never stop moving' },
    { id: 'fast', from: 5, kind: 'count', key: 'fast', n: 1, medal: 2, ja: '2.3m/秒で 走る', en: 'Hit 2.3m/s' },
    { id: 'nowobble', from: 5, kind: 'keep', key: 'wobble', medal: 2, ja: 'ふらふらに ならず ゴール', en: 'Never get wobbly' },
    { id: 'allbox', from: 6, kind: 'count', key: 'boxes', n: (c) => c.boxes, medal: 3, ja: '？の箱を ぜんぶ とる', en: 'Grab every ? box', need: (c) => c.boxes >= 2 },
    { id: 'spring', from: 7, kind: 'count', key: 'boing', n: 1, medal: 1, ja: 'ジャンプ台で ピョーン', en: 'Bounce on a springboard', need: (c) => c.springs >= 1 },
    { id: 'combo2', from: 8, kind: 'count', key: 'combo', n: 2, medal: 3, ja: 'ナイスリズムを 2回', en: 'Nice Rhythm twice' },
    { id: 'jump2', from: 9, kind: 'count', key: 'jump2', n: 1, medal: 2, ja: '2だんジャンプを する', en: 'Do a double jump' },
    { id: 'high2', from: 11, kind: 'count', key: 'high', n: 2, medal: 3, ja: '高い箱を 2こ とる', en: 'Grab 2 high boxes', need: (c) => c.high >= 2 },
    { id: 'quick2', from: 13, kind: 'time', rate: 0.45, medal: 3, ja: '{t}秒以内に ゴール', en: 'Reach home within {t}s' },
    { id: 'clean', from: 15, kind: 'keep', key: 'oops', medal: 4, ja: 'おっと・ふらふら・止まる なし', en: 'No whoops, wobbles or stops' },
  ];
  // 同じステージに いっしょに出さない組（同じものを数える）
  const SAME = { box1: 'box', box2: 'box', allbox: 'box', high: 'high', high2: 'high', quick: 'time', quick2: 'time', combo: 'combo', combo2: 'combo', clean: 'oops', nooops: 'oops', nostop: 'oops', nowobble: 'oops' };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても遊べる */ } },
  };
  function rec() { try { return Object.assign({ done: 0, seen: [] }, JSON.parse(store.get('yoro.missions') || '{}')); } catch (e) { return { done: 0, seen: [] }; } }
  const save = (r) => store.set('yoro.missions', JSON.stringify(r));

  const howMany = (n) => (n >= 25 ? 3 : n >= 10 ? 2 : 1);
  const textOf = (m, c) => jaen(m.ja, m.en).replace('{t}', Math.max(5, Math.round(c.timeLimit * (m.rate || 1))));
  const target = (m, c) => (typeof m.n === 'function' ? m.n(c) : m.n || 1);

  // そのステージのお題をえらぶ。c＝{ level, boxes, high, springs, timeLimit, seed }
  function pick(c) {
    let s = (c.level * 7919 + (c.seed || 0) * 31 + 17) % 2147483646 + 1;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const ok = LIST.filter((m) => m.from <= c.level && (!m.need || m.need(c)));
    const out = [];
    const take = (m) => { if (m && !out.includes(m) && !out.some((o) => SAME[o.id] && SAME[o.id] === SAME[m.id])) out.push(m); };
    take(ok.find((m) => m.from === c.level)); // はじめて出るお題は、そのステージで必ず
    for (let t = 0; out.length < howMany(c.level) && t < 40; t++) take(ok[Math.floor(rnd() * ok.length)]);
    const r = rec();
    return out.map((m) => {
      const isNew = !r.seen.includes(m.id);
      return { def: m, id: m.id, text: textOf(m, c), n: target(m, c), medal: m.medal, isNew, state: 'go' }; // go → ok（達成）/ ng（しっぱい）
    });
  }
  // 遊んでいるあいだ：st（この道での記録）と経った秒で、達成・しっぱいを決める。変わったものを返す
  function update(list, st, c) {
    const changed = [];
    for (const m of list) {
      if (m.state !== 'go') continue;
      const d = m.def;
      let to = null;
      if (d.kind === 'count' && (st[d.key] || 0) >= m.n) to = 'ok';
      if (d.kind === 'keep' && (st[d.key] || 0) > 0) to = 'ng';
      if (d.kind === 'time' && st.time > c.timeLimit * d.rate) to = 'ng';
      if (to) { m.state = to; changed.push(m); }
    }
    return changed;
  }
  // ゴールした：のこっている「keep」「time」は達成。もらえるメダルを返す
  function finish(list) {
    const r = rec();
    let medals = 0;
    for (const m of list) {
      if (m.state === 'go') m.state = m.def.kind === 'count' ? 'ng' : 'ok'; // 数えるお題は、ゴールまでにとどかなければ しっぱい
      if (m.state === 'ok') { medals += m.medal; r.done++; }
      if (!r.seen.includes(m.id)) r.seen.push(m.id);
    }
    save(r);
    return medals;
  }
  // 遊んでいる最中の進み（例：1/2）
  const progress = (m, st) => (m.def.kind === 'count' && m.n > 1 ? `${Math.min(m.n, st[m.def.key] || 0)}/${m.n}` : '');

  window.YoroMissions = { LIST, pick, update, finish, progress, done: () => rec().done, kinds: () => ({ seen: rec().seen.length, total: LIST.length }) };
})();
