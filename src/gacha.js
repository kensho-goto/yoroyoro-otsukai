// ヨロヨロおつかい — ガチャ（道のおたから＝メダル。メダルでガチャを回すと、くつ・ぼうし・おぼん・すがたが出る）
// 出たものは見た目が変わり、ほんの少しだけ遊び方にも効く。このスマホの中だけに残す
(function () {
  const store = {
    get(k) { return YS.get(k); }, // 保存先は src/save.js
    set(k, v) { YS.set(k, v); },
  };
  const COST = 5; // 1回のメダル
  const DUP = 2; // ダブったら もどるメダル
  const RARITY = { N: { w: 60, name: jaen('ふつう', 'Common'), color: '#8fb3d9' }, R: { w: 28, name: jaen('レア', 'Rare'), color: '#4fb36b' }, SR: { w: 10, name: jaen('スーパーレア', 'Super Rare'), color: '#b46cf0' }, SSR: { w: 2, name: jaen('ウルトラレア', 'Ultra Rare'), color: '#ffb000' } };
  const SLOTS = YL.zh ? { shoe: '鞋子', hat: '帽子', tray: '托盘', skin: '造型' } : YL.en ? { shoe: 'Shoes', hat: 'Hat', tray: 'Tray', skin: 'Look' } : { shoe: 'くつ', hat: 'ぼうし', tray: 'おぼん', skin: 'すがた' };
  // fx（効き目）：jump=ジャンプの高さ×・wind=風の強さ×・speed=いちばん速い速さ＋・balance=体を立て直す力×・pudding=ぐらぐらのたまり方×
  const ITEMS = [
    { id: 'sneaker', slot: 'shoe', r: 'N', name: '赤いスニーカー', icon: 'g.sneaker', color: '#e8303a' },
    { id: 'boots', slot: 'shoe', r: 'N', name: '長ぐつ', icon: 'g.boots', color: '#3f9a3a' },
    { id: 'spring', slot: 'shoe', r: 'R', name: 'バネぐつ', icon: 'g.spring', color: '#8a8f99', fx: { jump: 1.08 }, say: 'ジャンプが少し高い' },
    { id: 'grip', slot: 'shoe', r: 'R', name: 'すべらないくつ', icon: 'g.grip', color: '#5a4636', fx: { wind: 0.6 }, say: '風におされにくい' },
    { id: 'rocket', slot: 'shoe', r: 'SR', name: 'ロケットぐつ', icon: 'g.rocket', color: '#d0d4dc', fx: { speed: 0.3 }, say: 'いちばん速い速さが少し上がる' },
    { id: 'goldshoe', slot: 'shoe', r: 'SSR', name: '金のくつ', icon: 'g.goldshoe', color: '#ffc61a', fx: { jump: 1.06, speed: 0.2 }, say: 'ジャンプも速さも少し上がる' },
    { id: 'straw', slot: 'hat', r: 'N', name: 'むぎわらぼうし', icon: 'g.straw' },
    { id: 'catears', slot: 'hat', r: 'N', name: 'ねこみみ', icon: 'g.catears' },
    { id: 'helmet', slot: 'hat', r: 'R', name: 'ヘルメット', icon: 'g.helmet', fx: { balance: 1.05 }, say: '体を立て直す力が少し強い' },
    { id: 'propeller', slot: 'hat', r: 'SR', name: 'プロペラぼうし', icon: 'g.propeller', fx: { jump: 1.1 }, say: 'ジャンプがふわっと高い' },
    { id: 'halo', slot: 'hat', r: 'SSR', name: '天使のわっか', icon: 'g.halo', fx: { balance: 1.08, pudding: 0.9 }, say: '体もプリンも少し安定する' },
    { id: 'redtray', slot: 'tray', r: 'N', name: '赤いおぼん', icon: 'g.redtray', color: '#d9534f' },
    { id: 'woodtray', slot: 'tray', r: 'R', name: 'すべり止めおぼん', icon: 'g.woodtray', color: '#4fb36b', fx: { pudding: 0.9 }, say: 'ぐらぐらが少したまりにくい' },
    { id: 'silvertray', slot: 'tray', r: 'SR', name: '銀のおぼん', icon: 'g.silvertray', color: '#c9ced8', fx: { pudding: 0.85 }, say: 'ぐらぐらがたまりにくい' },
    { id: 'robot', slot: 'skin', r: 'R', name: 'ロボット', icon: 'g.robot', skin: { face: '#c9ced8', arm: '#aab0bb', hair: '#6b7280', extra: 'antenna' } },
    { id: 'bear', slot: 'skin', r: 'SR', name: 'くま', icon: 'g.bear', skin: { face: '#c98a4b', arm: '#b97a3b', hair: '#8a5a35', extra: 'ears' } },
    { id: 'penguin', slot: 'skin', r: 'SR', name: 'ペンギン', icon: 'g.penguin', skin: { face: '#ffffff', arm: '#2b2b2b', hair: '#2b2b2b', extra: 'beak' } },
    { id: 'gold', slot: 'skin', r: 'SSR', name: 'ゴールド', icon: 'g.gold', skin: { face: '#ffd84d', arm: '#f0c020', hair: '#e0a800', extra: 'shine' }, fx: { speed: 0.1, jump: 1.03 }, say: 'ピカピカ。ほんの少し速くて高い' },
  ];
  // 英語の名前と説明（id でかさねる。並び・効き目は日本語と同じものを使う）
  const ITEMS_EN = {
    sneaker: { name: 'Red Sneakers' },
    boots: { name: 'Rain Boots' },
    spring: { name: 'Spring Shoes', say: 'Jump a bit higher' },
    grip: { name: 'Grippy Shoes', say: 'Wind pushes you less' },
    rocket: { name: 'Rocket Shoes', say: 'Top speed goes up a bit' },
    goldshoe: { name: 'Golden Shoes', say: 'A bit higher jumps and more speed' },
    straw: { name: 'Straw Hat' },
    catears: { name: 'Cat Ears' },
    helmet: { name: 'Helmet', say: 'Bounce back a bit better' },
    propeller: { name: 'Propeller Hat', say: 'Floaty high jumps' },
    halo: { name: 'Angel Halo', say: 'You and the pudding are a bit steadier' },
    redtray: { name: 'Red Tray' },
    woodtray: { name: 'Non-Slip Tray', say: 'Wobbles build up a bit slower' },
    silvertray: { name: 'Silver Tray', say: 'Wobbles build up slower' },
    robot: { name: 'Robot' },
    bear: { name: 'Bear' },
    penguin: { name: 'Penguin' },
    gold: { name: 'Gold', say: 'Shiny! A tiny bit faster and higher' },
  };
  if (YL.en) ITEMS.forEach((i) => Object.assign(i, YL.t(ITEMS_EN[i.id])));

  const read = (k, d) => { try { const v = JSON.parse(store.get(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  let medals = +read('yoro.medals', 0) || 0;
  let owned = read('yoro.owned', {}) || {};
  let equip = read('yoro.equip', {}) || {};
  const save = () => { store.set('yoro.medals', JSON.stringify(medals)); store.set('yoro.owned', JSON.stringify(owned)); store.set('yoro.equip', JSON.stringify(equip)); };

  function addMedals(n) { medals += n; save(); return medals; }
  const canPull = () => medals >= COST;
  // 1回まわす：{ item, isNew, back }
  function pull() {
    if (!canPull()) return null;
    medals -= COST;
    const sum = Object.values(RARITY).reduce((a, x) => a + x.w, 0);
    let r = Math.random() * sum, rar = 'N';
    for (const [k, x] of Object.entries(RARITY)) { r -= x.w; if (r <= 0) { rar = k; break; } }
    const pool = ITEMS.filter((i) => i.r === rar);
    const item = pool[Math.floor(Math.random() * pool.length)];
    const isNew = !owned[item.id];
    owned[item.id] = (owned[item.id] || 0) + 1;
    let back = 0;
    if (isNew) equip[item.slot] = item.id; // はじめて出たものは、すぐ身につける
    else { back = DUP; medals += DUP; }
    save();
    return { item, isNew, back };
  }
  function setEquip(slot, id) { if (id && !owned[id]) return; if (id) equip[slot] = id; else delete equip[slot]; save(); }
  const worn = () => Object.fromEntries(Object.keys(SLOTS).map((s) => [s, ITEMS.find((i) => i.id === equip[s] && owned[i.id]) || null]));
  // 身につけているものの効き目をあわせる
  function effects() {
    const fx = { jump: 1, wind: 1, speed: 0, balance: 1, pudding: 1 };
    for (const it of Object.values(worn())) {
      if (!it || !it.fx) continue;
      for (const [k, v] of Object.entries(it.fx)) { if (k === 'speed') fx.speed += v; else fx[k] *= v; }
    }
    // 重ねても効きすぎないように
    fx.jump = Math.min(fx.jump, 1.12); fx.speed = Math.min(fx.speed, 0.4); fx.balance = Math.min(fx.balance, 1.1); fx.pudding = Math.max(fx.pudding, 0.8);
    return fx;
  }

  // きせかえ画面に「ガチャで出たもの」の段をかく
  function renderEquip(el, onPick) {
    const w = worn();
    const html = Object.entries(SLOTS).map(([slot, label]) => {
      const list = ITEMS.filter((i) => i.slot === slot);
      const cards = [`<button type="button" class="cl${w[slot] ? '' : ' on'}" data-s="${slot}" data-id=""><b>${window.YoroIcon.html('x.none')}</b><span>${jaen('なし', 'None')}</span></button>`]
        .concat(list.map((i) => {
          const has = !!owned[i.id], on = w[slot] && w[slot].id === i.id;
          return `<button type="button" class="cl${on ? ' on' : ''}${has ? '' : ' no'}" data-s="${slot}" data-id="${i.id}" ${has ? '' : 'disabled'}>`
            + `<b>${has ? window.YoroIcon.html(i.icon) : jaen('？', '?')}</b><span>${has ? i.name : jaen('ガチャで出る', 'From Gacha')}</span><i style="color:${RARITY[i.r].color}">${RARITY[i.r].name}</i>${has && i.say ? `<i>${i.say}</i>` : ''}</button>`;
        })).join('');
      return `<h3>${jaen(`${label}（ガチャ）`, `${label} (Gacha)`, `${label}（扭蛋）`)}</h3><div class="clg">${cards}</div>`;
    }).join('');
    el.innerHTML = html;
    el.querySelectorAll('button.cl').forEach((b) => { b.onclick = () => { setEquip(b.dataset.s, b.dataset.id); renderEquip(el, onPick); if (onPick) onPick(); }; });
  }
  const has = (id) => !!owned[id];
  const count = () => ({ got: ITEMS.filter((i) => owned[i.id]).length, total: ITEMS.length });

  window.YoroGacha = { COST, DUP, RARITY, SLOTS, ITEMS, get medals() { return medals; }, addMedals, canPull, pull, worn, effects, renderEquip, count, has, setEquip };
})();
