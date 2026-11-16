// ヨロヨロおつかい — ゲームの中身（体・コース・判定）。画面の描画とは分けてある。
// 単位はメートル・上向きがプラス。ブラウザでは window.YoroCore、Node では require で使う。
(function (root) {
  const DT = 1 / 60;

  // 調整用の数値（難しさはここで変える）
  const TUNING = {
    hipUp: 1.35, // 押している足：ももを前へ（ラジアン）
    hipDown: -0.81, // はなしている足：ももを後ろへ
    kneeUp: -1.65, // 押している足：ひざを曲げる
    kneeDown: -0.22, // はなしている足：ひざをのばす
    hipSpeed: 4.0, // 目標へ向かう速さ
    kneeSpeed: 10.8,
    hipTorque: 119, // 足の力
    kneeTorque: 200,
    hipIdle: -0.1, // 両方はなしている：その場でふんばる
    kneeIdle: -0.05,
    balance: 18, // 体を起こす見えない手助け（大きいほどやさしい）
    balanceDamp: 0.7,
    lean: 0, // 体を起こす目標の角度（マイナスで前かがみ）
    armTorque: 6, // おぼんを水平に保つ腕の力
    armSpeed: 8,
    tiltSafe: 0.3, // この角度まではおぼんが傾いても平気
    tiltGain: 0.08,
    accSafe: 14, // このくらいの揺れまでは平気
    accGain: 0.004,
    spinSafe: 1.4, // このくらいのぐらつきまでは平気
    spinGain: 0.01,
    calm: 0.008, // 落ち着いているときに下がる速さ
    stopLimit: 50, // これだけ（コマ）新しく足を出さないと、止まって転ぶ
    firstStopLimit: 100, // 出てすぐ、最初の1歩までの待ち時間
    rhythmFree: 1.35, // 前の1歩とくらべて、この倍率までの間かくのずれはOK
    rhythmKick: 5.5, // リズムがくずれたときに体をゆらす強さ
    sameFootKick: 1.0, // 同じ足を続けて出したときの重さ（くずれ量）
    crouchHip: 0.75, // 両足を押している：しゃがむ
    crouchKnee: -1.35,
    jumpMinFrames: 6, // これ以上ためるとジャンプ
    jumpFullFrames: 24, // これだけためると一番高く飛ぶ
    jumpVx: [1.0, 2.6], // ジャンプの前向きの速さ（ためなし〜ためきり）
    jumpVy: [2.6, 4.3], // ジャンプの上向きの速さ
    jumpAccScale: 0.15, // ジャンプ中と着地直後は揺れの影響を小さく
  };

  // レベルごとのコースと難しさ（x: メートル, h: 高さメートル）。レベルに上限はない
  const LEVEL_NAMES = ['はじめてのおつかい', 'ちょっと遠くへ', 'はじめての障害物', 'でこぼこ道', '上って下って',
    '最初の難関・商店街', 'ジャンプ台のある道', 'となり町', 'はじめての穴', '穴だらけの空き地'];
  const PLACES = ['川むこう', '駅前', '港', '森のおく', '丘の上', '線路ぞい', '公園の先', '団地', '田んぼ道', '坂の上',
    '海ぞい', '橋のむこう', '温泉街', '山のふもと', '空き地のおく', '学校のうら', '星のよく見える丘'];
  const DESTS = ['おばあちゃん家', '友だちの家', 'パン屋さん', '先生の家', 'おじさんの家', 'ねこの集会所', 'おうち', '親せきの家'];
  const lerp = (a, b, t) => a + (b - a) * t;
  // 障害物の種類（w: 幅, h: 高さの倍率）
  const OBSTACLES = [
    { kind: 'box', w: 0.5, h: 1.0 }, // 段ボール
    { kind: 'pot', w: 0.36, h: 0.9 }, // 植木鉢
    { kind: 'cone', w: 0.32, h: 1.1 }, // コーン
    { kind: 'cat', w: 0.55, h: 0.75 }, // ねむっているねこ
  ];

  function makeLevel(n) {
    n = Math.max(1, Math.floor(n));
    const d = 1 - Math.exp(-(n - 1) / 4.5); // 0（レベル1）から 1 に近づいていく
    const e = Math.log1p(Math.max(0, n - 20) / 20); // レベル20より先：ゆっくり、でも終わりなく増える（40で0.7、100で1.6、400で3）
    let seed = n * 9301 + 49297;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const goal = Math.min(60, 12 + (n - 1) * 4);
    const maxSlope = Math.min(0.18, Math.min(0.13, 0.05 + n * 0.006) + 0.007 * e); // 坂の急さ（高さ÷長さ）
    const bumpH = Math.min(0.2, Math.min(0.14, 0.05 + n * 0.006) + 0.008 * e); // 段差の高さ
    // 新しいしかけは決まったレベルで1つずつ登場：3 じゃまな物 / 4 段差 / 5 下り坂 / 7 ジャンプ台 / 9 穴
    // 6・16・26…は「難関」：しかけの出方だけ4レベル先の強さにする
    const hard = n % 10 === 6;
    const m = hard ? n + 4 : n % 10 === 7 && n > 7 ? n - 3 : n; // 難関のすぐあとは、ひと休み
    const obChance = n < 3 ? 0 : Math.min(0.45, Math.min(0.3, 0.12 + (m - 3) * 0.02) + 0.035 * e); // じゃまな物の出やすさ
    const pitChance = n < 9 ? 0 : Math.min(0.32, 0.1 + (m - 9) * 0.015 + 0.03 * e); // 穴の出やすさ
    const springChance = n < 7 ? 0 : Math.min(0.14, 0.06 + (m - 7) * 0.006); // ジャンプ台の出やすさ
    const obH = Math.min(0.55, Math.min(0.46, 0.3 + m * 0.01) + 0.03 * e); // じゃまな物の高さ
    const pitW = Math.min(1.3, 0.75 + (m - 9) * 0.03 + 0.05 * e); // 穴の幅（ジャンプで越える）
    const points = [[-8, 0], [3, 0]];
    const obstacles = [], pits = [], springs = [];
    let x = 3, h = 0;
    const add = (dx, dh) => { x += dx; h += dh; points.push([+x.toFixed(2), +h.toFixed(3)]); };
    const flat = (len) => add(len, 0);
    const pit = (w, bySpring) => { // 地面に深い穴をあける
      const x0 = x; points.push([+(x + 0.01).toFixed(2), +(h - 4).toFixed(3)]); x += w; points.push([+(x - 0.01).toFixed(2), +(h - 4).toFixed(3)]); points.push([+x.toFixed(2), +h.toFixed(3)]);
      pits.push({ x0: +x0.toFixed(2), x1: +x.toFixed(2), h: +h.toFixed(3), bySpring: !!bySpring });
    };
    const spring = () => { springs.push({ x: +(x + 0.35).toFixed(2), y: h, w: 0.7 }); flat(0.7); };
    const nearCheckpoint = (ox) => Math.abs(ox - Math.round(ox / 10) * 10) < 1.6;
    const firsts = { 3: 'ob', 7: 'spring', 9: 'pit' }; // そのレベルで初めて出るしかけは、かならず1つ出す
    let first = firsts[n];
    while (x < goal - 3) {
      const r = rnd();
      const room = goal - 2 - x;
      let kind;
      if (first && room > 7) { kind = first; first = null; }
      else if (r < pitChance) kind = 'pit';
      else if (r < pitChance + springChance) kind = 'spring';
      else if (r < pitChance + springChance + obChance) kind = 'ob';
      else kind = 'road';
      if (kind === 'pit' && room > 6) { // 穴：手前に助走、むこうに着地の平ら。ジャンプ台つきの広い穴もある
        const withSpring = n >= 11 && rnd() < 0.35;
        flat(2.2);
        if (withSpring) { spring(); flat(0.3); pit(Math.min(1.9, 1.4 + 0.03 * (m - 11)) * (0.9 + rnd() * 0.12), true); }
        else pit(pitW * (0.85 + rnd() * 0.3));
        flat(2.6);
      } else if (kind === 'spring' && room > 5) { // ジャンプ台だけ（乗るとピョーン）
        flat(1.5); spring(); flat(3.2);
      } else if (kind === 'ob' && room > 5) { // じゃまな物（平らな場所に置く。ジャンプで越える）
        const t = OBSTACLES[Math.floor(rnd() * OBSTACLES.length)];
        const ox = [2.2, 3.4, 1.2].map((d) => x + d).find((v) => !nearCheckpoint(v));
        if (ox !== undefined) obstacles.push({ x: +ox.toFixed(2), y: h, w: t.w, h: +(obH * t.h).toFixed(3), kind: t.kind });
        flat(5);
      } else if (n <= 2 || rnd() < 0.45) flat(Math.min(room, 2 + rnd() * 3)); // 平ら（レベル2は少しだけ上り）
      else if (n >= 4 && rnd() < 0.45 && room > 2) { // 段差（ブロック）
        const bh = bumpH * (0.7 + rnd() * 0.3), w = 0.8 + rnd() * 0.8;
        add(0.25, bh); add(w, 0); add(0.25, -bh); flat(Math.min(room, 1.5));
      } else { // 坂
        const len = Math.min(room, 3 + rnd() * 3);
        let dir = rnd() < 0.6 ? 1 : -1;
        if (n < 5) dir = h > 0.3 ? -1 : 1; // 下り坂はレベル5から
        if (h + dir * len * maxSlope < -0.3 || h + dir * len * maxSlope > 2) dir = -dir;
        add(len, dir * len * maxSlope * (0.6 + rnd() * 0.4));
      }
    }
    // ゴールの前後は平らに（おうちを置く）
    add(goal - x + 0.01 > 0 ? goal - x + 0.01 : 0.01, 0);
    add(14, 0);
    const checkpoints = [0];
    for (let c = 10; c < goal - 2; c += 10) checkpoints.push(c);
    const name = LEVEL_NAMES[n - 1] || `${hard ? '難関・' : ''}${PLACES[Math.floor(rnd() * PLACES.length)]}の${DESTS[Math.floor(rnd() * DESTS.length)]}`;
    // 時間制限：はじめはゆっくりでも間に合い、レベルが上がると少しずつきびしく（5秒きざみ）
    const needSpeed = Math.min(1.15, lerp(0.6, 0.85, 1 - Math.exp(-(n - 1) / 10)) + 0.05 * e); // 必要な速さ（m/秒）
    const timeLimit = Math.ceil(goal / needSpeed / 5) * 5;
    return {
      level: n, timeLimit, name, points, checkpoints, goal, obstacles, pits, springs, hard,
      // 自動テスト用：ジャンプが必要な場所（左はし）
      hazards: [...obstacles.map((o) => ({ x: o.x - o.w / 2, kind: 'ob' })), ...pits.filter((p) => !p.bySpring).map((p) => ({ x: p.x0, kind: 'pit' }))].sort((a, b) => a.x - b.x),
      tuning: {
        // むずかしさは途中で頭打ちにして、上のレベルもずっと遊べるようにする（変化は障害物・道で出す）
        balance: Math.max(12, lerp(26, 15, 1 - Math.exp(-(n - 1) / 8)) - 0.6 * e), // 体を起こす手助けがだんだん弱く
        accSafe: Math.max(11, 13.5 + 6.5 * Math.exp(-(n - 1) / 3) - 0.5 * e), // プリンが揺れにだんだん敏感に（少しの差で大きく効くので、ゆっくり）
        spinSafe: lerp(2.3, 1.4, d),
        calm: lerp(0.013, 0.007, d),
        rhythmFree: Math.max(1.08, lerp(1.45, 1.22, d) - 0.03 * e), // リズムのずれの許し：だんだんきびしく
        rhythmKick: lerp(4.5, 6.5, d) + 0.35 * e, // リズムがずれたときのゆれ：だんだん大きく
      },
    };
  }

  function groundHeightAt(stage, x) {
    for (const q of stage.pits || []) if (x > q.x0 && x < q.x1) return q.h; // 穴の上は、ふちの高さ
    const p = stage.points;
    for (let i = 0; i < p.length - 1; i++) {
      if (x >= p[i][0] && x <= p[i + 1][0]) {
        const t = (x - p[i][0]) / (p[i + 1][0] - p[i][0]);
        return p[i][1] + (p[i + 1][1] - p[i][1]) * t;
      }
    }
    return 0;
  }

  function create(planck, opts) {
    opts = opts || {};
    const { World, Vec2, Box, Circle, Polygon, Chain, RevoluteJoint } = planck;
    const stage = makeLevel(opts.level || 1);
    const T = Object.assign({}, TUNING, stage.tuning, opts.tuning || {});
    const world = new World({ gravity: Vec2(0, -10) });

    const ground = world.createBody();
    ground.createFixture(Chain(stage.points.map(([x, h]) => Vec2(x, h))), { friction: 1.0, userData: 'ground' });
    ground.createFixture(Box(0.3, 3, Vec2(-2.2, 3), 0), { friction: 0.3, userData: 'wall' }); // スタートのお店（うしろの壁）
    for (const q of stage.springs) { // ジャンプ台（乗るとピョーン）
      ground.createFixture(Box(q.w / 2, 0.06, Vec2(q.x, q.y + 0.06), 0), { friction: 0.9, userData: 'spring' });
    }
    for (const o of stage.obstacles) { // 障害物（ジャンプで越える）
      ground.createFixture(Box(o.w / 2, o.h / 2, Vec2(o.x, o.y + o.h / 2), 0), { friction: 0.8, userData: 'obstacle' });
    }

    const state = {
      stage, tuning: T, world,
      status: 'ready', // ready / play / fallen / clear
      fallReason: null,
      checkpointIndex: 0,
      frame: 0,
      fallFrame: 0,
      bestX: 0,
      char: null,
      input: { left: false, right: false },
      events: [], // 音を鳴らす合図（画面側が取り出す）
      feet: { L: 0, R: 0 }, // 足が地面についている数
    };
    const emit = (type, v) => { if (state.events.length < 100) state.events.push({ type, v }); };

    function buildChar(x0) {
      const gy = groundHeightAt(stage, x0);
      const F = (shape, data, extra) => Object.assign({ shape, density: 10, friction: 0.9, filterGroupIndex: -1, userData: data }, extra || {});
      const mk = (x, y) => world.createDynamicBody({ position: Vec2(x0 + x, gy + y), angularDamping: 0.5 });

      const torso = mk(0, 1.24);
      torso.createFixture(F(Box(0.15, 0.31), 'torso'));

      // おぼん：腕で水平に保とうとする（急な揺れには追いつかない）
      const tray = mk(0.55, 1.33);
      tray.createFixture(F(Box(0.33, 0.025), 'tray', { density: 2 }));
      tray.createFixture(F(Box(0.02, 0.045, Vec2(-0.325, 0.06), 0), 'tray', { density: 2 }));
      tray.createFixture(F(Box(0.02, 0.045, Vec2(0.325, 0.06), 0), 'tray', { density: 2 }));
      const arms = world.createJoint(RevoluteJoint({
        enableLimit: true, lowerAngle: -0.9, upperAngle: 0.9, enableMotor: true, maxMotorTorque: T.armTorque,
      }, torso, tray, Vec2(x0 + 0.4, gy + 1.33)));

      const head = mk(0.01, 1.77);
      head.createFixture(F(Circle(0.2), 'head', { density: 6 }));

      function leg(side) {
        const thigh = mk(0, 0.73);
        thigh.createFixture(F(Box(0.075, 0.22), 'thigh'));
        const shin = mk(0, 0.29);
        shin.createFixture(F(Box(0.065, 0.22), 'shin'));
        shin.createFixture(F(Box(0.15, 0.035, Vec2(0.06, -0.255), 0), 'foot' + side, { friction: 1.5 }));
        const hip = world.createJoint(RevoluteJoint({
          enableLimit: true, lowerAngle: -1.0, upperAngle: 1.7, enableMotor: true, maxMotorTorque: T.hipTorque,
        }, torso, thigh, Vec2(x0, gy + 0.95)));
        const knee = world.createJoint(RevoluteJoint({
          enableLimit: true, lowerAngle: -2.3, upperAngle: 0.02, enableMotor: true, maxMotorTorque: T.kneeTorque,
        }, thigh, shin, Vec2(x0, gy + 0.51)));
        return { side, thigh, shin, hip, knee };
      }
      const L = leg('L');
      const R = leg('R');
      const neck = world.createJoint(RevoluteJoint({
        enableLimit: true, lowerAngle: -0.5, upperAngle: 0.5, enableMotor: true, maxMotorTorque: 4,
      }, torso, head, Vec2(x0, gy + 1.56)));

      return { torso, tray, arms, head, L, R, neck, pudding: null, bodies: [torso, tray, head, L.thigh, L.shin, R.thigh, R.shin] };
    }

    // プリンを物理の世界に放り出す（満タンになったとき）
    function launchPudding() {
      const c = state.char;
      const p = c.tray.getWorldPoint(Vec2(0, 0.125));
      const v = c.tray.getLinearVelocity();
      const pud = world.createDynamicBody({ position: p, angle: c.tray.getAngle(), bullet: true });
      pud.createFixture({
        shape: Polygon([Vec2(-0.13, -0.1), Vec2(0.13, -0.1), Vec2(0.09, 0.1), Vec2(-0.09, 0.1)]),
        density: 3, friction: 0.6, restitution: 0.3, userData: 'pudding',
      });
      pud.setLinearVelocity(Vec2(v.x + 1.5 + Math.random() * 1.5, v.y + 3 + Math.random() * 1.5));
      pud.setAngularVelocity(-6 + Math.random() * 12);
      c.pudding = pud;
      c.bodies.push(pud);
    }

    function removeChar() {
      if (!state.char) return;
      for (const b of state.char.bodies) world.destroyBody(b);
      state.char = null;
    }

    // つぎのおうちへ続けるとき：前のレベルの体の形と動きを、そのまま新しい道の最初にうつす
    function snapshot() {
      const c = state.char, gx = stage.goal, gy = groundHeightAt(stage, gx);
      return {
        bodies: [c.torso, c.tray, c.head, c.L.thigh, c.L.shin, c.R.thigh, c.R.shin].map((b) => {
          const p = b.getPosition(), v = b.getLinearVelocity();
          return { x: p.x - gx, y: p.y - gy, a: b.getAngle(), vx: v.x, vy: v.y, w: b.getAngularVelocity() };
        }),
        jump: Object.assign({}, state.jump), stumble: state.stumble, input: Object.assign({}, state.input),
        rhythm: Object.assign({}, state.rhythm, { prev: Object.assign({}, state.rhythm.prev), first: false }),
      };
    }
    function applyCarry(carry) {
      const c = state.char, gy = groundHeightAt(stage, 0);
      [c.torso, c.tray, c.head, c.L.thigh, c.L.shin, c.R.thigh, c.R.shin].forEach((b, i) => {
        const q = carry.bodies[i];
        b.setTransform(Vec2(q.x, q.y + gy), q.a); b.setLinearVelocity(Vec2(q.vx, q.vy)); b.setAngularVelocity(q.w);
      });
      state.settle = 0;
      state.jump = carry.jump; state.stumble = carry.stumble; state.rhythm = carry.rhythm;
      state.input = carry.input;
    }

    function spawn(cpIndex, carry) {
      removeChar();
      state.checkpointIndex = cpIndex;
      state.char = buildChar(stage.checkpoints[cpIndex]);
      state.status = 'play';
      state.fallReason = null;
      state.frame = 0;
      state.settle = 20; // 出てすぐは転んだ判定をしない
      state.danger = 0; // ぐらぐらメーター（1で落ちる）
      state.trayV = null;
      state.feet = { L: 0, R: 0 };
      state.jump = { phase: 'none', crouch: 0, air: 0, grace: 0 };
      state.cpReached = cpIndex;
      state.downFrames = 0;
      state.springHit = false;
      state.stumble = 0; // リズムのくずれ（だんだん戻る）
      state.topple = 0; // 止まって転んでいる途中なら 0より大きい
      state.lastStumble = -999;
      state.rhythm = { prev: { left: false, right: false }, lastSide: null, lastInterval: 0, sinceStep: 0, first: true };
      state.playFrames = 0; // 遊んでいる時間（コマ数）
      if (carry) applyCarry(carry);
    }

    function fall(reason) {
      if (state.status !== 'play') return;
      state.status = 'fallen';
      const c = state.char;
      if (c && reason !== 'timeup' && reason !== 'pudding') { // 穴のところで転んだ・足が穴にはまった → 穴に落ちた
        const tx = c.torso.getPosition().x;
        const fx = [c.L.shin, c.R.shin].map((b) => b.getPosition());
        if (stage.pits.some((q) => (tx > q.x0 - 0.3 && tx < q.x1 + 0.3) || fx.some((p) => p.x > q.x0 - 0.1 && p.x < q.x1 + 0.1 && p.y < q.h + 0.25))) reason = 'hole';
      }
      if (reason !== 'timeup' && reason !== 'hole' && state.topple > 0) reason = 'stop'; // 止まったせい
      else if (reason !== 'pudding' && reason !== 'timeup' && reason !== 'hole') {
        if (state.frame - state.lastStumble < 90) reason = 'rhythm'; // リズムのせい
      }
      state.fallReason = reason;
      state.fallFrame = state.frame;
      emit(reason === 'pudding' ? 'pudding' : reason === 'timeup' ? 'timeup' : 'fall');
    }

    const isFloor = (u) => u === 'ground' || u === 'obstacle' || u === 'spring';
    function footContact(contact, delta) {
      const a = contact.getFixtureA().getUserData();
      const b = contact.getFixtureB().getUserData();
      const other = isFloor(a) ? b : isFloor(b) ? a : null;
      if (other === 'thigh' && delta > 0 && (a === 'ground' || b === 'ground') && state.settle <= 0) fall('knee'); // ひざをついた
      if ((other === 'footL' || other === 'footR') && delta > 0 && (a === 'spring' || b === 'spring') && state.status === 'play' && state.jump.phase !== 'air') state.springHit = true;
      if (other === 'footL' || other === 'footR') {
        const side = other.slice(-1);
        state.feet[side] = Math.max(0, state.feet[side] + delta);
        if (delta > 0 && state.status === 'play' && state.settle <= 0) emit('step', side);
      }
      return other;
    }
    world.on('begin-contact', (contact) => {
      const other = footContact(contact, 1);
      if (state.status !== 'play' || state.settle > 0) return;
      if (other === 'head' || other === 'torso') fall(other);
    });
    world.on('end-contact', (contact) => { footContact(contact, -1); });
    const grounded = () => state.feet.L + state.feet.R > 0;

    function drive(joint, target, speed, torque, on) {
      joint.setMaxMotorTorque(on ? torque : torque * 0.04);
      joint.setMotorSpeed(on ? speed * (target - joint.getJointAngle()) : 0);
    }

    // リズム：足を出す（押す）たびに、前の足・前の間かくとくらべる
    function rhythm(c, J) {
      const R = state.rhythm, inp = state.input, prev = R.prev;
      const pressedL = inp.left && !prev.left, pressedR = inp.right && !prev.right;
      R.prev = { left: inp.left, right: inp.right };
      if (J.phase === 'air') { R.lastSide = null; R.lastInterval = 0; R.sinceStep = 0; return; } // ジャンプ中は数えない
      for (const [pressed, side, other] of [[pressedL, 'L', inp.right], [pressedR, 'R', inp.left]]) {
        if (!pressed) continue;
        R.first = false;
        const interval = R.sinceStep;
        R.sinceStep = 0;
        if (other) { R.lastSide = null; continue; } // 両足（ジャンプのため）は数えない
        let bad = 0, why = '';
        if (R.lastSide === side) { bad = T.sameFootKick; why = 'same'; }
        else if (R.lastSide && interval < 7) { bad = 0.7; why = 'fast'; }
        else if (R.lastSide && R.lastInterval > 0) {
          const ratio = Math.abs(Math.log(interval / R.lastInterval));
          bad = Math.max(0, ratio - Math.log(T.rhythmFree)) * 1.6;
          why = interval > R.lastInterval ? 'slow' : 'fast';
        }
        if (bad > 0.08 && state.settle <= 0) { // 出てすぐの落ち着くまでは数えない
          state.stumble += bad;
          const dir = why === 'slow' ? -1 : why === 'fast' ? 1 : (side === 'L' ? 1 : -1); // おそすぎ→前へ、早すぎ→うしろへ
          c.torso.applyAngularImpulse(-dir * T.rhythmKick * Math.min(1.5, bad) * c.torso.getInertia());
          state.lastStumble = state.frame;
          emit('stumble', { bad, why });
        }
        R.lastInterval = R.lastSide && R.lastSide !== side ? interval : 0; // 最初の1歩・ジャンプのあとは、くらべる相手なし
        R.lastSide = side;
      }
      R.sinceStep++;
      const limit = R.first ? T.firstStopLimit : T.stopLimit;
      if (J.phase === 'none' && R.sinceStep > limit && state.topple === 0) { state.topple = 0.01; emit('stop'); }
    }

    // ジャンプ台：体ぜんぶを前と上へ飛ばす（ジャンプと同じあつかい）
    function bounce() {
      const c = state.char, J = state.jump;
      for (const b of [c.torso, c.tray, c.head, c.L.thigh, c.L.shin, c.R.thigh, c.R.shin]) {
        const v = b.getLinearVelocity();
        b.setLinearVelocity(Vec2(v.x * 0.5 + 3.3, 4.9));
      }
      J.phase = 'air'; J.air = 0; J.crouch = 0;
      state.rhythm.lastSide = null; state.rhythm.lastInterval = 0;
      emit('boing');
    }

    // ジャンプ：ためた分だけ高く遠くへ（体ぜんぶに同じ速さを足す）
    function launch() {
      const c = state.char, J = state.jump;
      const p = Math.min(1, (J.crouch - T.jumpMinFrames) / (T.jumpFullFrames - T.jumpMinFrames));
      const vx = lerp(T.jumpVx[0], T.jumpVx[1], p), vy = lerp(T.jumpVy[0], T.jumpVy[1], p);
      for (const b of [c.torso, c.tray, c.head, c.L.thigh, c.L.shin, c.R.thigh, c.R.shin]) {
        const v = b.getLinearVelocity();
        b.setLinearVelocity(Vec2(v.x * 0.5 + vx, Math.max(0, v.y) + vy));
      }
      J.phase = 'air'; J.air = 0;
      emit('jump', p);
    }

    function charX() {
      return state.char ? state.char.torso.getPosition().x : 0;
    }

    function step() {
      const c = state.char;
      if (c) {
        const alive = state.status === 'play' || state.status === 'clear';
        const J = state.jump;
        const both = state.input.left && state.input.right;
        if (state.status === 'play') {
          J.ground = grounded() ? 0 : (J.ground || 0) + 1; // 足が地面からはなれてからのコマ数
          const onGround = J.ground < 8;
          if (J.phase === 'none' && both && onGround) { J.phase = 'crouch'; J.crouch = 0; }
          if (J.phase === 'crouch') {
            if (both) J.crouch++;
            else if (!state.input.left && !state.input.right && J.crouch >= T.jumpMinFrames && onGround) launch();
            else J.phase = 'none'; // 片足だけはなした：ふつうの歩きにもどる
          } else if (J.phase === 'air') {
            J.air++;
            if (J.air > 8 && grounded()) { J.phase = 'none'; J.grace = 25; emit('land'); }
          }
          if (J.grace > 0) J.grace--;
        }
        if (state.springHit && state.status === 'play') bounce();
        state.springHit = false;
        if (state.status === 'play') rhythm(c, J);
        const limp = state.topple > 0; // 止まって転びはじめた：足の力がぬける
        const idle = !state.input.left && !state.input.right;
        for (const [lg, on] of [[c.L, state.input.left], [c.R, state.input.right]]) {
          let hip = on ? T.hipUp : idle ? T.hipIdle : T.hipDown;
          let knee = on ? T.kneeUp : idle ? T.kneeIdle : T.kneeDown;
          if (J.phase === 'crouch') { hip = T.crouchHip; knee = T.crouchKnee; }
          else if (J.phase === 'air') { // 空中：ひざをたたんで、あとで着地の形に
            if (J.air < 14) { hip = 1.1; knee = -1.7; } else { hip = 0.35; knee = -0.35; }
          }
          drive(lg.hip, hip, T.hipSpeed, T.hipTorque, alive && !limp);
          drive(lg.knee, knee, T.kneeSpeed, T.kneeTorque, alive && !limp);
        }
        drive(c.neck, 0, 6, 4, alive);
        // 腕：おぼんを水平に（世界に対して）
        c.arms.setMaxMotorTorque(alive ? T.armTorque : 0.3);
        c.arms.setMotorSpeed(alive ? -T.armSpeed * c.tray.getAngle() : 0);
        if (alive && !limp) {
          const k = 1 / (1 + state.stumble * 2.5); // リズムがくずれているほど、体を立て直す力が弱い
          const tq = -T.balance * k * (c.torso.getAngle() - T.lean) - T.balanceDamp * c.torso.getAngularVelocity();
          c.torso.applyTorque(tq * c.torso.getMass());
        } else if (limp && state.status === 'play') {
          c.torso.applyTorque(-25 * state.topple * c.torso.getMass()); // 前へ、ぐにゃっと
          state.topple = Math.min(1, state.topple + 0.05);
        }
        state.stumble *= 0.985;
      }
      world.step(DT, 8, 3);
      state.frame++;
      if (state.status === 'play' && ++state.playFrames >= stage.timeLimit * 60) fall('timeup'); // 時間切れ
      if (state.settle > 0) state.settle--;
      else if (state.status === 'play' && c) { // しりもち・大きく倒れたまま → 転んだ
        const tp = c.torso.getPosition();
        for (const q of stage.pits) if (tp.x > q.x0 - 0.15 && tp.x < q.x1 + 0.15 && tp.y < q.h + 0.5) fall('hole'); // 穴に落ちた
        const low = tp.y - groundHeightAt(stage, tp.x) < 0.82 || Math.abs(c.torso.getAngle()) > 1.25;
        state.downFrames = low && state.jump.phase !== 'air' ? state.downFrames + 1 : 0;
        if (state.downFrames > 12) fall('down');
      }
      if (c && state.status === 'play') {
        // ぐらぐらメーター：おぼんの傾きとガクッとした揺れでたまり、落ち着くと下がる
        const v = c.tray.getLinearVelocity();
        const e = state.trayV || { x: v.x, y: v.y };
        const ne = { x: e.x * 0.8 + v.x * 0.2, y: e.y * 0.8 + v.y * 0.2 };
        const acc = Math.hypot(ne.x - e.x, ne.y - e.y) * 60; // ならしたおぼんの揺れ
        state.trayV = ne;
        const tilt = Math.abs(c.tray.getAngle());
        const spin = Math.abs(c.torso.getAngularVelocity()); // 体のぐらつき
        if (state.settle <= 0) {
          const js = state.jump.phase !== 'none' || state.jump.grace > 0 ? T.jumpAccScale : 1;
          state.danger += Math.max(0, acc - T.accSafe) * T.accGain * js + Math.max(0, spin - T.spinSafe) * T.spinGain * js
            + Math.max(0, tilt - T.tiltSafe) * T.tiltGain;
          state.danger = Math.max(0, state.danger - T.calm);
        }
        const jerk = acc / 60;
        state.wobble = Math.min(1, tilt * 2 + jerk * 2); // 見た目のぷるぷる
        if (state.danger >= 1) { state.danger = 1; launchPudding(); fall('pudding'); }
        const x = charX();
        if (x > state.bestX) state.bestX = x;
        if (x >= stage.goal) { state.status = 'clear'; emit('clear'); }
        for (let i = state.cpReached + 1; i < stage.checkpoints.length; i++) {
          if (x >= stage.checkpoints[i] + 0.3) { state.cpReached = i; emit('checkpoint', i); }
        }
        if (state.danger > 0.65) emit('danger', state.danger);
      }
    }

    function passedCheckpoint() {
      const x = charX();
      let idx = 0;
      stage.checkpoints.forEach((cx, i) => { if (x >= cx + 0.3) idx = i; });
      return Math.max(idx, state.checkpointIndex);
    }

    return {
      state, stage, spawn, step, charX, passedCheckpoint,
      snapshot,
      setInput(left, right) { state.input.left = !!left; state.input.right = !!right; },
      groundHeightAt: (x) => groundHeightAt(stage, x),
    };
  }

  const api = { create, makeLevel, TUNING };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YoroCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
