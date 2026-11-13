// Skate-track energy engine shared by the Conservation and Friction sims.
// Physics: energy-based motion along y(x); g = 9.8 m/s^2; PE = 0 at ground (y = 0).
const TrackSim = (() => {
  const g = 9.8;
  const TRACKS = {
    bowl:   { name: 'Bowl', y: x => 0.12 * x * x, xmin: -8, xmax: 8 },
    valleys:{ name: 'Two valleys', y: x => 2.5 * ((x / 5) ** 4 - 2 * (x / 5) ** 2) + 2.5, xmin: -8, xmax: 8 },
  };
  const dydx = (f, x) => (f(x + 1e-4) - f(x - 1e-4)) / 2e-4;

  function init(opts) {
    const friction = !!opts.friction;
    const ctx = Sim.canvas('cv', 900, 470);
    // view: track region on the left
    const VX0 = 330, VY0 = 440, PX = 37;   // x=0 at VX0, y=0 at VY0
    const toPx = (x, y) => [VX0 + x * PX, VY0 - y * PX];

    let ready = false;
    const st = { x: -6, dir: 1, Emech: 0, Eth: 0, running: false, maxV: 0, minH: 99, started: false };
    const mS = Sim.slider('m', s => s + ' kg', resetState);
    const hS = Sim.slider('h', s => s + ' m', resetState);
    const muS = friction ? Sim.slider('mu', s => s === 0 ? 'none' : s.toFixed(2), resetState) : { value: 0 };
    const trackSel = document.getElementById('track');
    const slow = document.getElementById('slow');
    trackSel.addEventListener('change', resetState);
    const goBtn = document.getElementById('go');
    goBtn.onclick = () => {
      if (!st.started) { resetState(); st.started = true; st.running = true; }
      else st.running = !st.running;
      goBtn.textContent = st.running ? '❚❚ Pause' : '▶ Resume';
    };
    document.getElementById('reset').onclick = resetState;

    function T() { return TRACKS[trackSel.value]; }
    // find left-side x where y(x) = h (track rises toward the left end)
    function startX(h) {
      const t = T(); let a = t.xmin, b = trackSel.value === 'bowl' ? 0 : -5;
      for (let i = 0; i < 60; i++) { const m = (a + b) / 2; (t.y(m) > h) ? a = m : b = m; }
      return (a + b) / 2;
    }
    function resetState() {
      if (!ready) return;
      const h = hS.value, m = mS.value;
      st.x = startX(h); st.dir = 1; st.Emech = m * g * h; st.Eth = 0;
      st.running = false; st.started = false; st.maxV = 0;
      goBtn.textContent = '▶ Release';
      draw();
    }

    function energies() {
      const m = mS.value, y = T().y(st.x);
      const PE = m * g * y;
      const KE = Math.max(0, st.Emech - PE);
      return { m, y, PE, KE, v: Math.sqrt(2 * KE / m), Eth: st.Eth, total: KE + PE + st.Eth };
    }

    function step(dt) {
      const t = T(), m = mS.value, mu = muS.value;
      let remaining = dt;
      const sub = 0.002;
      while (remaining > 1e-9) {
        const h = Math.min(sub, remaining); remaining -= h;
        const y = t.y(st.x), slope = dydx(t.y, st.x);
        const v = Math.sqrt(Math.max(0, 2 * (st.Emech / m - g * y)));
        const ds = Math.max(v, 0.12) * h;
        const dx = st.dir * ds / Math.sqrt(1 + slope * slope);
        const nx = Math.max(t.xmin, Math.min(t.xmax, st.x + dx));
        const loss = friction ? mu * m * g * ds / Math.sqrt(1 + slope * slope) : 0;
        if (st.Emech - loss < m * g * t.y(nx)) {
          // can't reach the new point: turning point
          st.dir = -st.dir;
        } else {
          st.x = nx; st.Emech -= loss; st.Eth += loss;
        }
        // friction: come to rest in a valley
        if (friction && mu > 0) {
          const vNow = Math.sqrt(Math.max(0, 2 * (st.Emech / m - g * t.y(st.x))));
          const curv = dydx(t.y, st.x + 0.05) - dydx(t.y, st.x - 0.05);
          if (vNow < 0.25 && Math.abs(dydx(t.y, st.x)) < 0.12 && curv > 0) {
            const ke = st.Emech - m * g * t.y(st.x);
            st.Eth += Math.max(0, ke); st.Emech = m * g * t.y(st.x);
            st.running = false; goBtn.textContent = '▶ Resume';
            break;
          }
        }
      }
      const e = energies();
      st.maxV = Math.max(st.maxV, e.v);
    }

    function drawSkater(x) {
      const t = T(), [px, py] = toPx(x, t.y(x));
      const a = Math.atan(dydx(t.y, x));
      // board follows the track
      ctx.save(); ctx.translate(px, py); ctx.rotate(-a);
      ctx.fillStyle = '#333'; ctx.fillRect(-18, -6, 36, 5);
      ctx.beginPath(); ctx.arc(-11, -1, 3, 0, 7); ctx.arc(11, -1, 3, 0, 7); ctx.fill();
      ctx.restore();
      // rider stands upright on the board
      ctx.save(); ctx.translate(px, py - 5);
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(0, -16); ctx.lineTo(6, 0); ctx.moveTo(0, -16); ctx.lineTo(0, -32);
      ctx.moveTo(-11, -26); ctx.lineTo(11, -26); ctx.stroke();
      ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(0, -39, 7, 0, 7); ctx.fill();
      ctx.restore();
    }

    function draw() {
      const t = T(), W = ctx.W, e = energies();
      ctx.clearRect(0, 0, W, ctx.H);
      ctx.fillStyle = '#eef4fa'; ctx.fillRect(0, 0, 630, ctx.H);
      // height grid
      for (let k = 0; k <= 10; k++) {
        const [, gy] = toPx(0, k);
        ctx.strokeStyle = k === 0 ? '#1f2933' : '#dde3e8'; ctx.lineWidth = k === 0 ? 1.5 : 1;
        if (k === 0) ctx.setLineDash([7, 5]);
        ctx.beginPath(); ctx.moveTo(20, gy); ctx.lineTo(620, gy); ctx.stroke(); ctx.setLineDash([]);
        if (k <= 10 && gy > 20) Sim.text(ctx, k + ' m', 26, gy - 3, { size: 11, weight: 500, color: '#5b6770' });
      }
      Sim.text(ctx, 'PE = 0 level', 600, VY0 - 5, { size: 12, color: '#1f2933', align: 'right' });
      // track
      ctx.strokeStyle = '#5b6770'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath();
      for (let x = t.xmin; x <= t.xmax + 1e-9; x += 0.05) { const [px, py] = toPx(x, t.y(x)); x === t.xmin ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      ctx.stroke();
      // starting-height marker
      const [, hy] = toPx(0, hS.value);
      ctx.strokeStyle = Sim.C.tot; ctx.setLineDash([3, 6]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(20, hy); ctx.lineTo(620, hy); ctx.stroke(); ctx.setLineDash([]);
      Sim.text(ctx, 'start height', 600, hy - 5, { size: 12, color: Sim.C.tot, align: 'right' });
      drawSkater(st.x);
      // live numbers
      Sim.text(ctx, 'height = ' + Sim.fmt(e.y, 1) + ' m     speed = ' + Sim.fmt(e.v, 1) + ' m/s', 20, 28, { size: 17, weight: 700 });

      const list = [
        { label: 'KE', value: e.KE, color: Sim.C.ke },
        { label: 'PE', value: e.PE, color: Sim.C.pe },
      ];
      if (friction) list.push({ label: 'Thermal', value: e.Eth, color: Sim.C.th });
      list.push({ label: 'Total', value: e.total, color: Sim.C.tot });
      Sim.bars(ctx, 640, 20, 252, 430, list, 600, { title: 'ENERGY (J)  scale 0–600 J' });

      const q = id => document.getElementById(id);
      q('rh').textContent = Sim.fmt(e.y, 1) + ' m';
      q('rv').textContent = Sim.fmt(e.v, 1) + ' m/s';
      q('rmax').textContent = Sim.fmt(st.maxV, 1) + ' m/s';
      q('rKE').textContent = Sim.nice(e.KE) + ' J';
      q('rPE').textContent = Sim.nice(e.PE) + ' J';
      if (friction) q('rTh').textContent = Sim.nice(e.Eth) + ' J';
      q('rTot').textContent = Sim.nice(e.total) + ' J';
    }

    ready = true; resetState();
    Sim.loop(dt => { if (st.running) step(dt * (slow.checked ? 0.3 : 1)); draw(); });
  }
  return { init };
})();
