// Shared helpers for Mr. Drury's physics simulations
const Sim = (() => {
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const C = {
    get ink() { return css('--ink'); }, get muted() { return css('--muted'); },
    get ke() { return css('--ke'); }, get pe() { return css('--pe'); },
    get th() { return css('--th'); }, get tot() { return css('--tot'); },
    get work() { return css('--work'); }, get line() { return css('--line'); },
    get accent() { return css('--accent'); },
  };

  // Tabs: buttons with data-tab="id" toggle .tab-panel#id
  function setupTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(b => b.addEventListener('click', () => {
      btns.forEach(x => x.classList.toggle('active', x === b));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === b.dataset.tab));
      window.dispatchEvent(new Event('resize'));
    }));
  }

  // Slider binding: <input type=range id=..> and <span class=val id=..-val>
  function slider(id, format, onChange) {
    const el = document.getElementById(id);
    const out = document.getElementById(id + '-val');
    const update = () => { if (out) out.textContent = format(parseFloat(el.value)); if (onChange) onChange(parseFloat(el.value)); };
    el.addEventListener('input', update);
    update();
    return { get value() { return parseFloat(el.value); }, set value(v) { el.value = v; update(); }, el };
  }

  // HiDPI canvas with fixed logical size; returns ctx scaled to logical units
  function canvas(id, w, h) {
    const cv = document.getElementById(id);
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.aspectRatio = `${w} / ${h}`;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.W = w; ctx.H = h;
    return ctx;
  }

  const fmt = (v, dp = 1) => {
    const r = Number(v).toFixed(dp);
    return r === '-' + (0).toFixed(dp) ? (0).toFixed(dp) : r;
  };
  // Whole numbers show no decimals; others show one decimal
  const nice = (v) => { const r = Math.round(v * 10) / 10; return Math.abs(r - Math.round(r)) < 1e-9 ? fmt(r, 0) : fmt(r, 1); };
  const deg = (r) => r * 180 / Math.PI, rad = (d) => d * Math.PI / 180;

  function arrow(ctx, x1, y1, x2, y2, color, width = 4, label = '', labelPos = 'end') {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 2) return;
    const a = Math.atan2(y2 - y1, x2 - x1), head = Math.min(16, len * 0.45);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - head * 0.8 * Math.cos(a), y2 - head * 0.8 * Math.sin(a)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(a - 0.4), y2 - head * Math.sin(a - 0.4));
    ctx.lineTo(x2 - head * Math.cos(a + 0.4), y2 - head * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
    if (label) {
      ctx.font = '600 16px Segoe UI, Roboto, Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lx = labelPos === 'mid' ? (x1 + x2) / 2 : x2 + 18 * Math.cos(a);
      const ly = labelPos === 'mid' ? (y1 + y2) / 2 - 14 : y2 + 18 * Math.sin(a);
      ctx.fillText(label, lx, ly);
    }
    ctx.restore();
  }

  // Bar chart. bars: [{label, value, color}], maxAbs = scale; handles negatives.
  function bars(ctx, x, y, w, h, list, maxAbs, opts = {}) {
    const hasNeg = list.some(b => b.value < -1e-9) || opts.allowNeg;
    const baseY = hasNeg ? y + h * 0.55 : y + h - 26;
    const posH = hasNeg ? h * 0.55 - 26 : h - 52;
    const negH = hasNeg ? h * 0.45 - 30 : 0;
    const n = list.length, gap = 14, bw = (w - gap * (n + 1)) / n;
    ctx.save();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 10) : ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
    if (opts.title) {
      ctx.fillStyle = C.muted; ctx.font = '600 13px Segoe UI, Roboto, Arial, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(opts.title, x + 10, y + 8);
    }
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 8, baseY); ctx.lineTo(x + w - 8, baseY); ctx.stroke();
    list.forEach((b, i) => {
      const bx = x + gap + i * (bw + gap);
      const scale = maxAbs > 0 ? b.value / maxAbs : 0;
      let bh = Math.max(-1, Math.min(1, scale)) * (b.value >= 0 ? posH : negH);
      ctx.fillStyle = b.color;
      ctx.fillRect(bx, b.value >= 0 ? baseY - bh : baseY, bw, Math.abs(bh));
      if (Math.abs(scale) > 1) { // overflow marker
        ctx.fillStyle = C.ink; ctx.font = '700 14px Segoe UI, Arial'; ctx.textAlign = 'center';
        ctx.fillText('▲ off scale', bx + bw / 2, y + 30);
      }
      ctx.fillStyle = C.ink; ctx.font = '600 14px Segoe UI, Roboto, Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(b.label, bx + bw / 2, hasNeg ? y + h - 22 : baseY + 6);
      ctx.textBaseline = 'bottom'; ctx.font = '700 14px Segoe UI, Roboto, Arial, sans-serif';
      const ty = b.value >= 0 ? Math.max(y + 40, baseY - Math.abs(bh) - 4) : Math.min(y + h - 26, baseY + Math.abs(bh) + 18);
      if (opts.showValues !== false) ctx.fillText((opts.dp === undefined ? nice(b.value) : fmt(b.value, opts.dp)) + (opts.unit ?? ' J'), bx + bw / 2, ty);
    });
    ctx.restore();
  }

  function text(ctx, s, x, y, { size = 16, weight = 600, color = C.ink, align = 'left', base = 'alphabetic' } = {}) {
    ctx.save(); ctx.fillStyle = color; ctx.font = `${weight} ${size}px Segoe UI, Roboto, Arial, sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y); ctx.restore();
  }

  function loop(step) {
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      step(dt); requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  return { C, setupTabs, slider, canvas, fmt, nice, deg, rad, arrow, bars, text, loop };
})();
