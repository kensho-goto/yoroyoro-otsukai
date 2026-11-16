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
  };

  // コース（x: メートル, h: 高さメートル）
  const STAGES = [
    {
      name: 'ご近所の坂道',
      points: [[-8, 0], [8, 0], [14, 0.6], [19, 0.6], [19.4, 0.72], [21, 0.72], [21.4, 0.6], [26, 0.6], [32, 0], [50, 0]],
      checkpoints: [0, 10, 20, 30],
      goal: 40,
    },
  ];

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
    const T = Object.assign({}, TUNING, opts.tuning || {});
    const stage = STAGES[opts.stage || 0];
    const world = new World({ gravity: Vec2(0, -10) });

    const ground = world.createBody();
    ground.createFixture(Chain(stage.points.map(([x, h]) => Vec2(x, h))), { friction: 1.0, userData: 'ground' });
    ground.createFixture(Box(0.3, 3, Vec2(-2.2, 3), 0), { friction: 0.3, userData: 'wall' }); // スタートのお店（うしろの壁）

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
    };

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
        shin.createFixture(F(Box(0.15, 0.035, Vec2(0.06, -0.255), 0), 'foot', { friction: 1.5 }));
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
    }

    function fall(reason) {
      if (state.status !== 'play') return;
      state.status = 'fallen';
      state.fallReason = reason;
      state.fallFrame = state.frame;
    }

    world.on('begin-contact', (contact) => {
      if (state.status !== 'play' || state.settle > 0) return;
      const a = contact.getFixtureA().getUserData();
      const b = contact.getFixtureB().getUserData();
      const other = a === 'ground' ? b : b === 'ground' ? a : null;
      if (other === 'head' || other === 'torso') fall(other);
    });

    function drive(joint, target, speed, torque, on) {
      joint.setMaxMotorTorque(on ? torque : torque * 0.04);
      joint.setMotorSpeed(on ? speed * (target - joint.getJointAngle()) : 0);
    }

    function charX() {
      return state.char ? state.char.torso.getPosition().x : 0;
    }

    function step() {
      const c = state.char;
      if (c) {
        const alive = state.status === 'play' || state.status === 'clear';
        const idle = !state.input.left && !state.input.right;
        for (const [lg, on] of [[c.L, state.input.left], [c.R, state.input.right]]) {
          drive(lg.hip, on ? T.hipUp : idle ? T.hipIdle : T.hipDown, T.hipSpeed, T.hipTorque, alive);
          drive(lg.knee, on ? T.kneeUp : idle ? T.kneeIdle : T.kneeDown, T.kneeSpeed, T.kneeTorque, alive);
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
          state.danger += Math.max(0, acc - T.accSafe) * T.accGain + Math.max(0, spin - T.spinSafe) * T.spinGain
            + Math.max(0, tilt - T.tiltSafe) * T.tiltGain;
          state.danger = Math.max(0, state.danger - T.calm);
        }
        const jerk = acc / 60;
        state.wobble = Math.min(1, tilt * 2 + jerk * 2); // 見た目のぷるぷる
        if (state.danger >= 1) { state.danger = 1; launchPudding(); fall('pudding'); }
        const x = charX();
        if (x > state.bestX) state.bestX = x;
        if (x >= stage.goal) state.status = 'clear';
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

  const api = { create, STAGES, TUNING };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YoroCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
