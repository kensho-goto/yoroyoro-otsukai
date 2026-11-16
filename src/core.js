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
    '商店街', 'となり町', '峠のおばあちゃん家', '山の上の神社', '雲の上のおうち'];
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
    let seed = n * 9301 + 49297;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const goal = Math.min(60, 12 + (n - 1) * 4);
    const maxSlope = Math.min(0.13, 0.05 + n * 0.006); // 坂の急さ（高さ÷長さ）
    const bumpH = Math.min(0.14, 0.05 + n * 0.006); // 段差の高さ
    const obChance = n < 3 ? 0 : Math.min(0.32, 0.12 + (n - 3) * 0.025); // 障害物の出やすさ
    const obH = Math.min(0.46, 0.3 + n * 0.01); // 障害物の高さ
    const points = [[-8, 0], [3, 0]];
    const obstacles = [];
    let x = 3, h = 0;
    const add = (dx, dh) => { x += dx; h += dh; points.push([+x.toFixed(2), +h.toFixed(3)]); };
    const nearCheckpoint = (ox) => Math.abs(ox - Math.round(ox / 10) * 10) < 1.6;
    while (x < goal - 3) {
      const r = rnd();
      const room = goal - 2 - x;
      const wantOb = (n === 3 && obstacles.length === 0) || r < obChance;
      if (wantOb && room > 5) { // 障害物（平らな場所に置く。ジャンプで越える）
        const t = OBSTACLES[Math.floor(rnd() * OBSTACLES.length)];
        let ox = x + 2.2;
        if (nearCheckpoint(ox)) ox = x + 3.4;
        if (!nearCheckpoint(ox)) obstacles.push({ x: +ox.toFixed(2), y: h, w: t.w, h: +(obH * t.h).toFixed(3), kind: t.kind });
        add(5, 0);
      } else if (n === 1 || r < obChance + 0.3) add(Math.min(room, 2 + rnd() * 3), 0); // 平ら
      else if (n >= 4 && r < obChance + 0.5 && room > 2) { // 段差（ブロック）
        const bh = bumpH * (0.7 + rnd() * 0.3), w = 0.8 + rnd() * 0.8;
        add(0.25, bh); add(w, 0); add(0.25, -bh); add(Math.min(room, 1.5), 0);
      } else { // 坂
        const len = Math.min(room, 3 + rnd() * 3);
        let dir = rnd() < 0.6 ? 1 : -1;
        if (n < 5) dir = h > 0.3 ? -1 : 1; // はじめのうちは上り中心
        if (h + dir * len * maxSlope < -0.3 || h + dir * len * maxSlope > 2) dir = -dir;
        add(len, dir * len * maxSlope * (0.6 + rnd() * 0.4));
      }
    }
    // ゴールの前後は平らに（おうちを置く）
    add(goal - x + 0.01 > 0 ? goal - x + 0.01 : 0.01, 0);
    add(14, 0);
    const checkpoints = [0];
    for (let c = 10; c < goal - 2; c += 10) checkpoints.push(c);
    const name = LEVEL_NAMES[n - 1] || `${PLACES[Math.floor(rnd() * PLACES.length)]}の${DESTS[Math.floor(rnd() * DESTS.length)]}`;
    return {
      level: n, name, points, checkpoints, goal, obstacles,
      tuning: {
        // むずかしさは途中で頭打ちにして、上のレベルもずっと遊べるようにする（変化は障害物・道で出す）
        balance: lerp(30, 15, 1 - Math.exp(-(n - 1) / 8)), // 体を起こす手助けがだんだん弱く
        accSafe: 13.5 + 6.5 * Math.exp(-(n - 1) / 3), // プリンが揺れにだんだん敏感に（少しの差で大きく効くので、ゆっくり）
        spinSafe: lerp(2.3, 1.4, d),
        calm: lerp(0.013, 0.007, d),
      },
    };
  }

  function groundHeightAt(stage, x) {
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

    function spawn(cpIndex) {
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
    }

    function fall(reason) {
      if (state.status !== 'play') return;
      state.status = 'fallen';
      state.fallReason = reason;
      state.fallFrame = state.frame;
      emit(reason === 'pudding' ? 'pudding' : 'fall');
    }

    const isFloor = (u) => u === 'ground' || u === 'obstacle';
    function footContact(contact, delta) {
      const a = contact.getFixtureA().getUserData();
      const b = contact.getFixtureB().getUserData();
      const other = isFloor(a) ? b : isFloor(b) ? a : null;
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
        const idle = !state.input.left && !state.input.right;
        for (const [lg, on] of [[c.L, state.input.left], [c.R, state.input.right]]) {
          let hip = on ? T.hipUp : idle ? T.hipIdle : T.hipDown;
          let knee = on ? T.kneeUp : idle ? T.kneeIdle : T.kneeDown;
          if (J.phase === 'crouch') { hip = T.crouchHip; knee = T.crouchKnee; }
          else if (J.phase === 'air') { // 空中：ひざをたたんで、あとで着地の形に
            if (J.air < 14) { hip = 1.1; knee = -1.7; } else { hip = 0.35; knee = -0.35; }
          }
          drive(lg.hip, hip, T.hipSpeed, T.hipTorque, alive);
          drive(lg.knee, knee, T.kneeSpeed, T.kneeTorque, alive);
        }
        drive(c.neck, 0, 6, 4, alive);
        // 腕：おぼんを水平に（世界に対して）
        c.arms.setMaxMotorTorque(alive ? T.armTorque : 0.3);
        c.arms.setMotorSpeed(alive ? -T.armSpeed * c.tray.getAngle() : 0);
        if (alive) {
          const tq = -T.balance * (c.torso.getAngle() - T.lean) - T.balanceDamp * c.torso.getAngularVelocity();
          c.torso.applyTorque(tq * c.torso.getMass());
        }
      }
      world.step(DT, 8, 3);
      state.frame++;
      if (state.settle > 0) state.settle--;
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
      setInput(left, right) { state.input.left = !!left; state.input.right = !!right; },
      groundHeightAt: (x) => groundHeightAt(stage, x),
    };
  }

  const api = { create, makeLevel, TUNING };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YoroCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
