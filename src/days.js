// ヨロヨロおつかい — 今日のコース（日付でコースが変わる。その日はみんな同じ）と、れんぞくで遊んだ日数
(function () {
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても遊べる */ } },
  };
  const read = (k, d) => { try { return Object.assign({}, d, JSON.parse(store.get(k) || '{}')); } catch (e) { return Object.assign({}, d); } };
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (t) => { const x = new Date(t); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
  const today = () => ymd(Date.now());
  const yesterday = () => { const x = new Date(); x.setDate(x.getDate() - 1); return ymd(x); };
  const seed = () => +today().replace(/-/g, ''); // 例：20261117
  const label = () => { const x = new Date(); return `${x.getMonth() + 1}/${x.getDate()}`; };

  // 今日のコースの記録（日がかわったらリセット）
  function daily() {
    const d = read('yoro.daily', { date: '', best: 0, tries: 0 });
    return d.date === today() ? d : { date: today(), best: 0, tries: 0 };
  }
  function addDaily(dist) {
    const d = daily(); d.tries++;
    const isBest = dist > d.best + 0.05;
    if (isBest) d.best = Math.round(dist * 10) / 10;
    store.set('yoro.daily', JSON.stringify(d));
    return { d, isBest };
  }

  // れんぞく日数（遊んで1回ゲームオーバーになったら、その日は遊んだことにする）
  function streak() {
    const s = read('yoro.streak', { last: '', n: 0 });
    const alive = s.last === today() || s.last === yesterday();
    return { n: alive ? s.n : 0, playedToday: s.last === today(), last: s.last };
  }
  function touch() {
    const s = read('yoro.streak', { last: '', n: 0 });
    if (s.last === today()) return { n: s.n, up: false };
    s.n = s.last === yesterday() ? s.n + 1 : 1; s.last = today();
    store.set('yoro.streak', JSON.stringify(s));
    return { n: s.n, up: true };
  }
  // 日付で決まる乱数（今日のコースの風・箱の場所などをみんな同じにする）
  function rng(k) { let x = (seed() * 31 + k * 7919) % 2147483646 + 1; return () => ((x = (x * 16807) % 2147483647) / 2147483647); }

  window.YoroDays = { today, seed, label, daily, addDaily, streak, touch, rng };
})();
