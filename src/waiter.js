// ヨロヨロおつかい — おうちで待っている人（失敗したときの反応を、組み合わせで毎回ちがうものにする）
(function () {
  // 待っている人（レベルごとに決まる）
  const WAITERS = [
    { id: 'mom', name: 'お母さん', call: 'あんた', hair: '#6b3e26', skin: '#ffd9b8', style: 'long' },
    { id: 'grandma', name: 'おばあちゃん', call: 'ぼうや', hair: '#d8d8d8', skin: '#ffe0c4', style: 'bun', glasses: true },
    { id: 'grandpa', name: 'おじいちゃん', call: 'おまえ', hair: '#e6e6e6', skin: '#f6d2b0', style: 'bald', glasses: true },
    { id: 'dad', name: 'お父さん', call: 'おまえ', hair: '#2b2b2b', skin: '#f3c9a4', style: 'short', beard: true },
    { id: 'sister', name: '妹', call: 'おにいちゃん', hair: '#3b2a1e', skin: '#ffdcc0', style: 'twin' },
    { id: 'brother', name: '弟', call: 'にいちゃん', hair: '#1f1f1f', skin: '#ffd6b5', style: 'spiky' },
    { id: 'aunt', name: 'となりのおばさん', call: 'ぼく', hair: '#8a4b8f', skin: '#ffd9b8', style: 'perm' },
    { id: 'uncle', name: '親せきのおじさん', call: 'きみ', hair: '#4a3020', skin: '#f0c49c', style: 'short', beard: true },
    { id: 'friend', name: 'となりの家のケンタ', call: 'おまえ', hair: '#2e5aa8', skin: '#ffd6b5', style: 'cap' },
    { id: 'teacher', name: 'ピアノの先生', call: 'あなた', hair: '#2b2b2b', skin: '#ffe0c8', style: 'long', glasses: true },
    { id: 'cat', name: 'ねこのタマ', call: 'にゃ', hair: '#f0a85a', skin: '#f0a85a', style: 'cat', animal: true },
    { id: 'dog', name: '犬のコロ', call: 'ワン', hair: '#c98a4b', skin: '#e8c08a', style: 'dog', animal: true },
  ];
  const TREATS = ['プリン', 'とっておきのプリン', '3時のおやつのプリン', '楽しみにしてたプリン', 'ごほうびのプリン', 'お祝いのプリン',
    '1日10個かぎりのプリン', 'カラメルたっぷりのプリン', '冷蔵庫で冷やすはずだったプリン', 'みんなで分けるはずのプリン'];
  const REASON = { pudding: ['プリンを落とした', 'プリンを飛ばした', 'プリンを宙に舞わせた'], other: ['ころんだ', 'すってんころりんした', '地面とごあいさつした'],
    timeup: ['間に合わなかった', 'おそすぎた', '道草をくった'] };
  // 時間切れのときだけのセリフ（気持ちごと）
  const LATE = {
    sad: ['もう、おやつの時間すぎちゃった…', '{treat}、ぬるくなっちゃうね…', '時計ばっかり見てたよ…', '{call}、まだかなって…ずっと…', 'お茶、さめちゃった…'],
    sigh: ['どこで道草くってたの？', 'あと{left}を、何分かけるつもり？', 'カメのほうが早いよ…', '立ち止まってたら着かないよ？', 'のんびりにも ほどがあるよ'],
    sulk: ['もう晩ごはんの時間だもん', 'まちくたびれて、ねちゃいそう', 'おそい人とは口きかない', 'もう{treat}いらないもん（いる）', 'ふーん、寄り道してたんだ'],
    shock: ['えっ、まだそこ！？', 'え、日がくれちゃうよ！？', 'あと{left}もあるの！？', 'もしかして、止まってた！？', '時計、こわれてないよね！？'],
    angry: ['おそーい！ 何時だと思ってるの！', '寄り道したでしょ！', '{treat}が待ちくたびれてる！', '{call}！ 時間はまもりなさい！', 'おやつの時間はとっくにすぎてます！'],
    cry: ['うわーん！ おやつの時間おわっちゃったー！', 'まってたのにー！ おそいー！', 'もう来ないかと思ったー！', 'ずっと げんかんにいたのにー！'],
  };

  // 気持ち（失敗の回数が多いほど、強い気持ちになりやすい）
  const MOODS = {
    sad: {
      face: 'sad', title: ['しょんぼり…', 'がっかり…', 'しーん…'],
      say: ['{treat}…たのしみにしてたのに…', 'そっか…{reason}んだね…', 'ううん、いいの…（よくない）', '{call}が無事なら…プリンは…うん…',
        'スプーン、もう出しちゃってたんだけどな…', 'お皿、2まい並べて待ってたんだよ…', 'あと{left}だったのに…', 'きょうはプリンの日だと思ってたのにな…'],
    },
    sigh: {
      face: 'sigh', title: ['はぁ〜…', 'あきれた…', 'また？'],
      say: ['また{reason}の？', 'これで{n}回目だよ…', '{call}ねえ…足は2本しかないんだよ？', 'ふつうに歩くだけでいいのに…',
        '左、右、左、右。それだけ。', 'もう自分で買いに行こうかな…', 'プリンの気持ちになってみて', 'おぼんは水平。おぼんは水平。'],
    },
    sulk: {
      face: 'sulk', title: ['ぷいっ', 'すねちゃった', 'ふーんだ'],
      say: ['べつに待ってないし', 'プリンなんか好きじゃないもん（大好き）', '{call}とは もう口きかない', 'ふーん。{reason}んだ。ふーん。',
        'ぜったい ゆるさない…{treat}…', 'わたしのプリン、返して', 'いいもん、ひとりでおせんべい食べるもん'],
    },
    shock: {
      face: 'shock', title: ['ええっ！？', 'うそでしょ！？', 'がーん！'],
      say: ['いま、{treat}が飛んでいかなかった！？', '{reason}！？ あと{left}で！？', 'え、どうやったらそうなるの！？', 'プリンって空を飛べたんだ…',
        'まって、いま何が起きたの…', 'ニュースで見るやつだ…'],
    },
    angry: {
      face: 'angry', title: ['ぷんぷん！', 'カミナリ！', 'おこった！'],
      say: ['{call}！ {treat}はどうしたの！', '{n}回目！ {n}回目だよ！', 'もう！ ゆっくり歩きなさいって言ったでしょ！', 'おつかいくらいちゃんとして！',
        '今夜のおかず、1品へらします！', 'おこづかい、プリン代だけひきます！', 'つぎ落としたら、おふろそうじ1週間！', '{treat}のうらみは こわいよ！'],
    },
    cry: {
      face: 'cry', title: ['えーん！', 'なみだ…', 'うわーん！'],
      say: ['うわーん！ {treat}がー！', 'ずっと…ずっと待ってたのにー！', 'プリンのない人生なんてー！', '{call}のばかー！ うえーん！',
        'あしたも…あさっても…プリンないのー！？', 'ひっく…ひっく…'],
    },
  };
  const ACTIONS = {
    sad: ['ひざをかかえている', 'スプーンをにぎったまま固まっている', '窓の外をぼんやり見ている', '空っぽのお皿を見つめている', 'ため息で窓がくもっている'],
    sigh: ['頭をかかえている', 'カレンダーに「×」をつけた', '腕を組んで首をふっている', 'お茶をすすっている', '天井を見上げている'],
    sulk: ['ふとんにもぐった', '背中を向けて座っている', 'ほっぺをふくらませている', 'クッションをぎゅっとしている', '部屋のすみで体育座りしている'],
    shock: ['口が開いたまま', 'スプーンを落とした', '目をまんまるにしている', 'その場で固まっている', '二度見した'],
    angry: ['湯気を出している', '足をドンドンしている', 'おたまを持って立っている', '顔がまっ赤', '腕まくりをした'],
    cry: ['ハンカチをしぼっている', 'なみだで小さな池ができた', 'ティッシュの箱が空になった', '声が近所までひびいている', '鼻水が出ている'],
  };
  const ANIMAL_SAY = { cat: ['にゃ…にゃーん…', 'にゃっ！？', 'フシャーッ！', 'にゃ（プリン…）', 'にゃーーん！（泣）', 'にゃにゃっ！ にゃー！'],
    dog: ['くぅーん…', 'ワン！？', 'ガルルル…！', 'ワフ…（プリン…）', 'キャイーン！', 'ワンワンワン！'] };
  const HAPPY = ['{treat}きたー！ ありがとう！', 'すごい！ ちゃんと届いた！', 'さすが{call}！', 'プリン、ぷるぷるのまま！ 天才！', 'いっしょに食べよう！',
    'ごくろうさま！ スプーン用意してあるよ！', 'まってました！'];

  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function forLevel(n) { return WAITERS[((n - 1) * 5) % WAITERS.length]; } // 12レベルで全員が1回ずつ出る
  function fill(t, ctx) {
    return t.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] != null ? ctx[k] : ''));
  }
  // 失敗したときの反応をつくる（fails = このレベルで何回目の失敗か）
  function reaction(w, { reason, fails, left }) {
    const pool = fails <= 1 ? ['sad', 'sad', 'shock', 'sigh'] : fails <= 3 ? ['sigh', 'sulk', 'shock', 'sad', 'angry'] : ['angry', 'cry', 'sulk', 'sigh', 'angry', 'cry'];
    const mood = pick(pool);
    const M = MOODS[mood];
    const ctx = { treat: pick(TREATS), reason: pick(REASON[reason] || REASON.other), call: w.call, n: fails, left: `${left.toFixed(1)}m` };
    const lines = reason === 'timeup' ? LATE[mood] // 時間切れは「おそい」話
      : reason === 'pudding' ? M.say : M.say.filter((l) => !l.includes('飛')); // ころんだときは「飛んだ」話をしない
    let say = fill(pick(lines), ctx);
    if (w.animal) say = pick(ANIMAL_SAY[w.style]) + (Math.random() < 0.5 ? `\n（たぶん「${say}」と言っている）` : '');
    return { mood, face: M.face, title: pick(M.title), say, action: `${w.name}は ${pick(ACTIONS[mood])}。` };
  }
  function happy(w) {
    let say = fill(pick(HAPPY), { treat: pick(TREATS), call: w.call });
    if (w.animal) say = (w.style === 'cat' ? 'にゃーん♪' : 'ワンワン♪') + `\n（たぶん「${say}」と言っている）`;
    return { face: 'happy', say };
  }

  // 顔をかく（c = canvas 2D、中心 x,y・大きさ r）
  function drawFace(c, w, face, x, y, r, t = 0) {
    c.save(); c.translate(x, y); c.lineWidth = Math.max(2, r * 0.06); c.strokeStyle = '#3b2a1e'; c.lineJoin = 'round'; c.lineCap = 'round';
    const shake = face === 'angry' ? Math.sin(t * 40) * r * 0.03 : 0; c.translate(shake, 0);
    // うしろの髪・耳
    c.fillStyle = w.hair;
    if (w.style === 'long') { c.beginPath(); c.ellipse(0, r * 0.15, r * 1.08, r * 1.15, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
    if (w.style === 'twin') for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * r * 1.05, r * 0.25, r * 0.28, r * 0.5, s * 0.3, 0, Math.PI * 2); c.fill(); c.stroke(); }
    if (w.style === 'bun') { c.beginPath(); c.arc(0, -r * 1.05, r * 0.38, 0, Math.PI * 2); c.fill(); c.stroke(); }
    if (w.style === 'cat') for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * r * 0.85, -r * 0.4); c.lineTo(s * r * 0.75, -r * 1.2); c.lineTo(s * r * 0.2, -r * 0.85); c.closePath(); c.fill(); c.stroke(); }
    if (w.style === 'dog') for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * r * 0.95, -r * 0.05, r * 0.28, r * 0.6, s * -0.3, 0, Math.PI * 2); c.fillStyle = '#8a5a35'; c.fill(); c.stroke(); }
    // 顔
    c.fillStyle = face === 'angry' ? '#ffb8a0' : w.skin;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
    // 前の髪
    c.fillStyle = w.hair;
    if (w.style === 'long' || w.style === 'twin' || w.style === 'perm' || w.style === 'bun') {
      c.beginPath(); c.arc(0, -r * 0.1, r * 1.0, Math.PI * 1.05, Math.PI * 1.95); c.quadraticCurveTo(0, -r * 0.45, -r * 0.95, -r * 0.35); c.fill(); c.stroke();
    }
    if (w.style === 'perm') for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * r * 0.4, -r * 0.85 + Math.abs(i) * r * 0.12, r * 0.28, 0, Math.PI * 2); c.fill(); c.stroke(); }
    if (w.style === 'short') { c.beginPath(); c.arc(0, -r * 0.15, r * 0.98, Math.PI * 1.1, Math.PI * 1.9); c.lineTo(r * 0.6, -r * 0.55); c.lineTo(-r * 0.6, -r * 0.55); c.closePath(); c.fill(); c.stroke(); }
    if (w.style === 'spiky') {
      c.beginPath(); c.arc(0, -r * 0.15, r * 0.98, Math.PI * 1.1, Math.PI * 1.9); c.lineTo(r * 0.6, -r * 0.5); c.lineTo(-r * 0.6, -r * 0.5); c.closePath(); c.fill(); c.stroke();
      for (const dx of [-0.45, 0, 0.45]) { c.beginPath(); c.moveTo((dx - 0.2) * r, -r * 0.95 + Math.abs(dx) * r * 0.2); c.lineTo(dx * r + r * 0.05, -r * 1.35 + Math.abs(dx) * r * 0.3); c.lineTo((dx + 0.2) * r, -r * 0.95 + Math.abs(dx) * r * 0.2); c.closePath(); c.fill(); c.stroke(); }
    }
    if (w.style === 'cap') { c.fillStyle = '#2e5aa8'; c.beginPath(); c.arc(0, -r * 0.2, r * 0.98, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); c.fillRect(0, -r * 0.3, r * 1.3, r * 0.15); c.strokeRect(0, -r * 0.3, r * 1.3, r * 0.15); }
    if (w.style === 'bald') { c.beginPath(); c.ellipse(-r * 0.92, -r * 0.05, r * 0.18, r * 0.35, 0, 0, Math.PI * 2); c.ellipse(r * 0.92, -r * 0.05, r * 0.18, r * 0.35, 0, 0, Math.PI * 2); c.fill(); }
    // ほっぺ
    c.fillStyle = face === 'angry' ? 'rgba(230,40,40,.55)' : 'rgba(255,120,120,.45)';
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * r * 0.55, r * 0.3, r * 0.17, r * 0.11, 0, 0, Math.PI * 2); c.fill(); }
    // まゆ
    c.beginPath();
    const ex = r * 0.36, ey = -r * 0.12;
    if (face === 'angry') { c.moveTo(-ex - r * 0.2, ey - r * 0.3); c.lineTo(-ex + r * 0.18, ey - r * 0.16); c.moveTo(ex + r * 0.2, ey - r * 0.3); c.lineTo(ex - r * 0.18, ey - r * 0.16); }
    else if (face === 'sad' || face === 'cry') { c.moveTo(-ex - r * 0.2, ey - r * 0.16); c.lineTo(-ex + r * 0.15, ey - r * 0.3); c.moveTo(ex + r * 0.2, ey - r * 0.16); c.lineTo(ex - r * 0.15, ey - r * 0.3); }
    else if (face === 'shock') { c.arc(-ex, ey - r * 0.3, r * 0.15, Math.PI * 1.15, Math.PI * 1.85); c.moveTo(ex + r * 0.13, ey - r * 0.37); c.arc(ex, ey - r * 0.3, r * 0.15, Math.PI * 1.15, Math.PI * 1.85); }
    else if (face !== 'happy') { c.moveTo(-ex - r * 0.18, ey - r * 0.24); c.lineTo(-ex + r * 0.18, ey - r * 0.24); c.moveTo(ex - r * 0.18, ey - r * 0.24); c.lineTo(ex + r * 0.18, ey - r * 0.24); }
    c.stroke();
    // 目
    c.fillStyle = '#3b2a1e';
    for (const s of [-1, 1]) {
      const X = s * ex;
      c.beginPath();
      if (face === 'happy') { c.arc(X, ey + r * 0.05, r * 0.13, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
      else if (face === 'cry') { c.moveTo(X - r * 0.13, ey); c.lineTo(X + r * 0.13, ey + r * 0.04); c.stroke(); }
      else if (face === 'sigh') { c.moveTo(X - r * 0.13, ey + r * 0.02); c.lineTo(X + r * 0.13, ey + r * 0.02); c.stroke(); c.beginPath(); c.arc(X, ey + r * 0.03, r * 0.07, 0, Math.PI); c.fill(); }
      else if (face === 'sulk') { c.arc(X + r * 0.06, ey, r * 0.07, 0, Math.PI * 2); c.fill(); }
      else if (face === 'shock') { c.fillStyle = '#fff'; c.arc(X, ey, r * 0.15, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#3b2a1e'; c.beginPath(); c.arc(X, ey, r * 0.05, 0, Math.PI * 2); c.fill(); }
      else { c.arc(X, ey, r * 0.08, 0, Math.PI * 2); c.fill(); }
    }
    if (w.glasses) { c.lineWidth = Math.max(1.5, r * 0.04); for (const s of [-1, 1]) { c.beginPath(); c.arc(s * ex, ey, r * 0.22, 0, Math.PI * 2); c.stroke(); } c.beginPath(); c.moveTo(-ex + r * 0.22, ey); c.lineTo(ex - r * 0.22, ey); c.stroke(); c.lineWidth = Math.max(2, r * 0.06); }
    // 口
    const my = r * 0.45;
    if (w.beard) { c.fillStyle = w.hair; c.beginPath(); c.ellipse(0, my - r * 0.1, r * 0.3, r * 0.08, 0, 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.fillStyle = '#7a2a2a';
    if (face === 'happy') { c.arc(0, my - r * 0.08, r * 0.25, 0.1, Math.PI - 0.1); c.closePath(); c.fill(); c.stroke(); }
    else if (face === 'sad') { c.arc(0, my + r * 0.12, r * 0.2, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    else if (face === 'cry') { c.ellipse(0, my, r * 0.25, r * 0.18 + Math.abs(Math.sin(t * 8)) * r * 0.06, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
    else if (face === 'shock') { c.ellipse(0, my, r * 0.13, r * 0.2, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
    else if (face === 'angry') { c.moveTo(-r * 0.25, my + r * 0.05); c.lineTo(-r * 0.12, my - r * 0.04); c.lineTo(0, my + r * 0.05); c.lineTo(r * 0.12, my - r * 0.04); c.lineTo(r * 0.25, my + r * 0.05); c.stroke(); }
    else if (face === 'sulk') { c.moveTo(-r * 0.12, my); c.quadraticCurveTo(0, my - r * 0.12, r * 0.12, my); c.stroke(); }
    else { c.moveTo(-r * 0.18, my); c.lineTo(r * 0.18, my); c.stroke(); }
    if (w.animal) { c.fillStyle = '#3b2a1e'; c.beginPath(); c.ellipse(0, r * 0.22, r * 0.09, r * 0.06, 0, 0, Math.PI * 2); c.fill(); }
    // 気持ちのしるし
    if (face === 'cry') { c.fillStyle = '#6cc5ff'; for (const s of [-1, 1]) { const k = (t * 1.5) % 1; c.beginPath(); c.ellipse(s * ex, ey + r * 0.2 + k * r * 0.7, r * 0.07, r * 0.12, 0, 0, Math.PI * 2); c.fill(); } }
    if (face === 'sad') { c.fillStyle = '#6cc5ff'; c.beginPath(); c.ellipse(ex + r * 0.05, ey + r * 0.25, r * 0.06, r * 0.1, 0, 0, Math.PI * 2); c.fill(); }
    if (face === 'angry') { // いかりマークと湯気
      c.strokeStyle = '#e8303a'; c.lineWidth = r * 0.07; const ax = r * 0.75, ay = -r * 0.75;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.beginPath(); c.moveTo(ax + dx * r * 0.06, ay + dy * r * 0.2); c.quadraticCurveTo(ax + dx * r * 0.06, ay + dy * r * 0.06, ax + dx * r * 0.2, ay + dy * r * 0.06); c.stroke(); }
      c.strokeStyle = 'rgba(160,160,160,.9)'; c.lineWidth = r * 0.06;
      for (const s of [-1, 1]) { const k = (t * 2) % 1; c.beginPath(); c.arc(s * r * 0.6, -r * 1.15 - k * r * 0.4, r * 0.12, 0, Math.PI * 2); c.stroke(); }
    }
    if (face === 'sigh') { c.fillStyle = 'rgba(200,220,255,.9)'; c.strokeStyle = '#3b2a1e'; c.lineWidth = r * 0.04; const k = (t * 0.8) % 1; c.beginPath(); c.ellipse(r * 0.7 + k * r * 0.4, my - k * r * 0.3, r * 0.22, r * 0.14, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
    if (face === 'sulk') { c.strokeStyle = '#3b2a1e'; c.lineWidth = r * 0.05; c.beginPath(); c.moveTo(r * 0.75, -r * 0.6); c.lineTo(r * 1.0, -r * 0.8); c.moveTo(r * 0.85, -r * 0.45); c.lineTo(r * 1.15, -r * 0.5); c.stroke(); }
    c.restore();
  }

  window.YoroWaiter = { forLevel, reaction, happy, drawFace, WAITERS };
})();
