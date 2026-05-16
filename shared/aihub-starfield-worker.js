// Dedicated worker for the primary canvas starfield.
// Owns an OffscreenCanvas and transfers ImageBitmap frames to the page.

const TWO_PI = Math.PI * 2;
const STAR_FLIGHT_SPEED_DEFAULT = 9;
const STAR_FLIGHT_SPEED_MIN = 1;
const STAR_FLIGHT_SPEED_MAX = 15;
const STAR_FLIGHT_STAR_COUNT_DEFAULT = 520;
const STAR_FLIGHT_STAR_COUNT_MIN = 100;
const STAR_FLIGHT_STAR_COUNT_MAX = 2000;

const state = {
  canvas: null,
  ctx: null,
  width: 1,
  height: 1,
  cssWidth: 1,
  cssHeight: 1,
  dpr: 1,
  mode: "static",
  settings: {},
  reducedMotion: false,
  stars: [],
  warpStars: [],
  shooting: [],
  constellations: [],
  mouseX: 0,
  mouseY: 0,
  audio: { bass: 0, mid: 0, high: 0, level: 0, beat: 0 },
  lastAt: 0,
  nextShootAt: 0,
  nextConstellationAt: 0,
  framePending: false,
  stopped: false
};

function clamp(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

function normalizeFlightSpeed(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return STAR_FLIGHT_SPEED_DEFAULT;
  return Math.min(STAR_FLIGHT_SPEED_MAX, Math.max(STAR_FLIGHT_SPEED_MIN, n));
}

function normalizeFlightStarCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return STAR_FLIGHT_STAR_COUNT_DEFAULT;
  return Math.min(STAR_FLIGHT_STAR_COUNT_MAX, Math.max(STAR_FLIGHT_STAR_COUNT_MIN, Math.round(n)));
}

function rgba(r, g, b, a = 1) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${clamp(a, 0, 1).toFixed(4)})`;
}

function normalizeGlow(value) {
  return clamp(value, 0.8, 4) || 1.7;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function createCanvas(width, height, hdrEnabled) {
  state.canvas = new OffscreenCanvas(width, height);
  try {
    state.ctx = state.canvas.getContext("2d", hdrEnabled === false ? undefined : { colorSpace: "display-p3" });
  } catch {
    state.ctx = state.canvas.getContext("2d");
  }
  if (!state.ctx) throw new Error("offscreen-2d-unavailable");
}

function resize(width, height, cssWidth, cssHeight, dpr) {
  state.width = Math.max(1, Math.round(width || 1));
  state.height = Math.max(1, Math.round(height || 1));
  state.cssWidth = Math.max(1, Number(cssWidth) || state.width);
  state.cssHeight = Math.max(1, Number(cssHeight) || state.height);
  state.dpr = Math.max(0.5, Number(dpr) || 1);
  if (!state.canvas) createCanvas(state.width, state.height, state.settings.hdr);
  if (state.canvas.width !== state.width) state.canvas.width = state.width;
  if (state.canvas.height !== state.height) state.canvas.height = state.height;
  buildStars();
  buildWarpStars();
}

function buildStars() {
  const target = state.reducedMotion ? 2400 : 4800;
  if (state.stars.length === target) return;
  state.stars = [];
  for (let i = 0; i < target; i++) {
    const rank = Math.pow(Math.random(), 3.4);
    const warm = Math.random() < 0.46;
    const tint = rank * 0.32;
    state.stars.push({
      x: Math.random() * state.width,
      y: Math.random() * state.height,
      vx: rand(-0.012, 0.012) * state.dpr,
      vy: rand(0.010, 0.035) * state.dpr,
      size: (0.35 + rank * 1.6) * state.dpr,
      alpha: 0.05 + rank * 0.72,
      rank,
      phase: Math.random() * TWO_PI,
      twinkle: rand(0.4, 1.7),
      r: 245 + (warm ? 10 : -18) * tint,
      g: 248 + (warm ? -12 : 0) * tint,
      b: 255 + (warm ? -35 : 0) * tint
    });
  }
}

function buildWarpStars() {
  const requested = normalizeFlightStarCount(state.settings.flightStarCount);
  const target = state.reducedMotion ? Math.max(80, Math.round(requested * 0.46)) : requested;
  while (state.warpStars.length < target) state.warpStars.push(makeWarpStar(true));
  if (state.warpStars.length > target) state.warpStars.length = target;
}

function makeWarpStar(anywhere = false) {
  const angle = Math.random() * TWO_PI;
  const radius = anywhere ? Math.random() : 0.02 + Math.random() * 0.06;
  return {
    angle,
    radius,
    speed: rand(0.18, 0.9),
    size: rand(0.6, 1.7) * state.dpr,
    hue: Math.random()
  };
}

function drawBackground(ctx, now) {
  const settings = state.settings;
  const bgDim = clamp(settings.bgDim, 0, 0.35);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = rgba(1, 5, 18, 1);
  ctx.fillRect(0, 0, state.width, state.height);

  if (settings.nebula !== false) {
    const glow = normalizeGlow(settings.starGlow);
    const bass = settings.audioReactive ? state.audio.bass : 0;
    const t = now * 0.00004;
    ctx.globalCompositeOperation = "screen";
    const g1 = ctx.createRadialGradient(
      state.width * (0.26 + Math.sin(t) * 0.03), state.height * 0.36, 0,
      state.width * 0.28, state.height * 0.38, Math.max(state.width, state.height) * 0.56
    );
    g1.addColorStop(0, rgba(96, 118, 255, (0.10 + bass * 0.05) * glow / 1.7));
    g1.addColorStop(0.45, rgba(56, 190, 210, 0.05));
    g1.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, state.width, state.height);

    const g2 = ctx.createRadialGradient(
      state.width * 0.76, state.height * (0.64 + Math.cos(t * 1.4) * 0.025), 0,
      state.width * 0.72, state.height * 0.66, Math.max(state.width, state.height) * 0.42
    );
    g2.addColorStop(0, rgba(255, 120, 184, (0.055 + bass * 0.035) * glow / 1.7));
    g2.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  if (bgDim > 0) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = rgba(0, 0, 0, bgDim);
    ctx.fillRect(0, 0, state.width, state.height);
  }
}

function drawBlackHole(ctx, now) {
  if (state.settings.blackHole !== true) return;
  const cx = state.width * (0.68 + Math.sin(now * 0.00012) * 0.05);
  const cy = state.height * (0.36 + Math.cos(now * 0.0001) * 0.04);
  const base = Math.min(state.width, state.height) * 0.045;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const aura = ctx.createRadialGradient(cx, cy, base * 0.8, cx, cy, base * 6);
  aura.addColorStop(0, rgba(255, 215, 160, 0.22));
  aura.addColorStop(0.34, rgba(255, 160, 90, 0.08));
  aura.addColorStop(1, rgba(80, 130, 255, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, base * 6, 0, TWO_PI);
  ctx.fill();

  ctx.translate(cx, cy);
  ctx.rotate(-0.22 + Math.sin(now * 0.0007) * 0.04);
  ctx.scale(1, 0.28);
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, base * 0.24);
  ctx.strokeStyle = rgba(255, 176, 82, 0.34);
  ctx.beginPath();
  ctx.arc(0, 0, base * 2.2, 0, TWO_PI);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = rgba(0, 0, 0, 0.95);
  ctx.beginPath();
  ctx.arc(cx, cy, base * 1.15, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
}

function drawStaticStars(ctx, dt, now) {
  const settings = state.settings;
  const hideStars = settings.realSky === true || settings.webgpuStarsActive === true;
  const audio = settings.audioReactive ? state.audio : { bass: 0, high: 0, beat: 0 };
  const glow = normalizeGlow(settings.starGlow);
  const lift = Math.max(0, glow - 1);
  const mx = state.mouseX * state.dpr;
  const my = state.mouseY * state.dpr;
  const repulse = 70 * state.dpr;
  const repulse2 = repulse * repulse;
  const motion = state.reducedMotion ? 0 : 1;

  if (!hideStars) {
    ctx.globalCompositeOperation = "screen";
    // Pass 1 — all stars (dim ones, no shadow cost)
    for (const star of state.stars) {
      star.x += star.vx * dt * 60 * motion;
      star.y += star.vy * dt * 60 * motion;
      if (star.x < -4) star.x += state.width + 8;
      if (star.x > state.width + 4) star.x -= state.width + 8;
      if (star.y > state.height + 4) star.y -= state.height + 8;

      let sx = star.x;
      let sy = star.y;
      const dx = sx - mx;
      const dy = sy - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < repulse2 && d2 > 0.01 && settings.cursorLens !== false) {
        const d = Math.sqrt(d2);
        const f = (1 - d / repulse) * 18 * state.dpr;
        sx += dx / d * f;
        sy += dy / d * f;
      }
      // Cache resolved screen coords for the bright-star pass below
      star._sx = sx;
      star._sy = sy;

      if (star.rank > 0.55) continue; // drawn in bright pass with glow

      // Brighter stars pulse with larger amplitude (corrected direction)
      const twinkleAmp = 0.04 + star.rank * 0.32;
      const twinkle = 1 + Math.sin(now * 0.001 * star.twinkle + star.phase) * twinkleAmp;
      const rank = star.rank;
      const alpha = Math.min(1, star.alpha * twinkle * (1 + lift * rank * 0.5 + audio.high * rank * 0.16));
      const size = star.size * (1 + audio.bass * rank * 0.12 + audio.beat * rank * 0.08);
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(star.r, star.g, star.b, alpha);
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, TWO_PI);
      ctx.fill();
    }

    // Pass 2 — bright stars with real glow + diffraction spikes
    ctx.save();
    ctx.lineCap = "round";
    for (const star of state.stars) {
      if (star.rank <= 0.55) continue;
      const sx = star._sx;
      const sy = star._sy;
      const rank = star.rank;
      const twinkleAmp = 0.04 + rank * 0.32;
      const pulseSin = Math.sin(now * 0.001 * star.twinkle + star.phase);
      const twinkle = 1 + pulseSin * twinkleAmp;
      const pulseFactor = 0.72 + pulseSin * 0.28;
      const alpha = Math.min(1, star.alpha * twinkle * (1 + lift * rank * 0.5 + audio.high * rank * 0.16));
      const size = star.size * (1 + audio.bass * rank * 0.12 + audio.beat * rank * 0.08);

      // Diffraction spikes for the top-rank stars
      if (rank > 0.75) {
        const spikeLen = size * (3.5 + rank * 5.5);
        ctx.shadowBlur = size * 5 * pulseFactor;
        ctx.shadowColor = rgba(star.r, star.g, star.b, 1);
        ctx.strokeStyle = rgba(star.r, star.g, star.b, 1);
        ctx.lineWidth = Math.max(0.4, size * 0.45);
        ctx.globalAlpha = alpha * 0.45 * pulseFactor;
        ctx.beginPath();
        ctx.moveTo(sx - spikeLen, sy);
        ctx.lineTo(sx + spikeLen, sy);
        ctx.moveTo(sx, sy - spikeLen * 0.78);
        ctx.lineTo(sx, sy + spikeLen * 0.78);
        ctx.stroke();
      }

      // Core disc with pulse-synced glow
      ctx.shadowBlur = size * (3 + rank * 7) * pulseFactor;
      ctx.shadowColor = rgba(star.r, star.g, star.b, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = rgba(star.r, star.g, star.b, alpha);
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawShootingStars(ctx, dt, now, hideStars);
  drawConstellations(ctx, dt, now, hideStars);
}

function drawShootingStars(ctx, dt, now, hideStars) {
  const settings = state.settings;
  if (hideStars || settings.shooting === false || state.reducedMotion) return;
  if (now >= state.nextShootAt) {
    state.shooting.push({
      x: rand(-state.width * 0.1, state.width * 0.9),
      y: rand(state.height * 0.05, state.height * 0.45),
      vx: rand(580, 980) * state.dpr,
      vy: rand(220, 420) * state.dpr,
      age: 0,
      life: rand(0.65, 1.15)
    });
    state.nextShootAt = now + rand(6000, 14000);
  }
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = state.shooting.length - 1; i >= 0; i--) {
    const s = state.shooting[i];
    s.age += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const p = s.age / s.life;
    if (p >= 1) {
      state.shooting.splice(i, 1);
      continue;
    }
    const alpha = Math.sin(p * Math.PI) * 0.8;
    const tx = s.x - s.vx * 0.08;
    const ty = s.y - s.vy * 0.08;
    const grad = ctx.createLinearGradient(s.x, s.y, tx, ty);
    grad.addColorStop(0, rgba(255, 255, 255, alpha));
    grad.addColorStop(1, rgba(160, 200, 255, 0));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6 * state.dpr;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }
  ctx.restore();
}

function drawConstellations(ctx, dt, now, hideStars) {
  const settings = state.settings;
  if (hideStars || settings.constellations === false) return;
  if (now >= state.nextConstellationAt && state.constellations.length < 2) {
    const points = [];
    const count = Math.floor(rand(4, 7));
    const x = rand(state.width * 0.12, state.width * 0.74);
    const y = rand(state.height * 0.16, state.height * 0.62);
    for (let i = 0; i < count; i++) points.push({ x: x + rand(-80, 110) * state.dpr + i * 32 * state.dpr, y: y + rand(-55, 55) * state.dpr });
    state.constellations.push({ points, age: 0, life: 7 });
    state.nextConstellationAt = now + rand(11000, 22000);
  }
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = state.constellations.length - 1; i >= 0; i--) {
    const c = state.constellations[i];
    c.age += dt;
    const p = c.age / c.life;
    if (p >= 1) {
      state.constellations.splice(i, 1);
      continue;
    }
    const alpha = Math.min(0.28, Math.sin(p * Math.PI) * 0.28);
    ctx.strokeStyle = rgba(145, 205, 255, alpha);
    ctx.lineWidth = 1 * state.dpr;
    ctx.beginPath();
    c.points.forEach((pt, index) => index ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y));
    ctx.stroke();
    ctx.fillStyle = rgba(230, 246, 255, alpha + 0.18);
    for (const pt of c.points) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.4 * state.dpr, 0, TWO_PI);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawWarp(ctx, dt, now) {
  const settings = state.settings;
  const audio = settings.audioReactive ? state.audio : { bass: 0, high: 0, beat: 0 };
  const cx = state.width / 2;
  const cy = state.height / 2;
  const maxR = Math.hypot(cx, cy);
  const speed = (state.reducedMotion ? 0.08 : 0.56) * normalizeFlightSpeed(settings.flightSpeed) * (1 + audio.bass * 0.65 + audio.beat * 0.35);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const star of state.warpStars) {
    star.radius += star.speed * speed * dt;
    if (star.radius > 1.08) Object.assign(star, makeWarpStar(false));
    const r = star.radius * maxR;
    const tail = Math.max(8 * state.dpr, r * (0.028 + audio.high * 0.015));
    const x = cx + Math.cos(star.angle) * r;
    const y = cy + Math.sin(star.angle) * r;
    const px = cx + Math.cos(star.angle) * Math.max(0, r - tail);
    const py = cy + Math.sin(star.angle) * Math.max(0, r - tail);
    const alpha = Math.min(1, 0.08 + star.radius * 0.75);
    const grad = ctx.createLinearGradient(px, py, x, y);
    grad.addColorStop(0, rgba(120, 175, 255, 0));
    grad.addColorStop(0.8, rgba(190, 225, 255, alpha * 0.65));
    grad.addColorStop(1, rgba(255, 255, 255, alpha));
    ctx.strokeStyle = grad;
    ctx.lineWidth = star.size * (0.65 + star.radius * 1.6);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.36);
  core.addColorStop(0, rgba(120, 185, 255, 0.20 + audio.bass * 0.10));
  core.addColorStop(1, rgba(0, 0, 0, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();
}

function render() {
  if (state.stopped || !state.ctx || !state.canvas) return;
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0.001, (now - (state.lastAt || now)) / 1000));
  state.lastAt = now;
  const ctx = state.ctx;

  drawBackground(ctx, now);
  if (state.mode === "warp") drawWarp(ctx, dt, now);
  else drawStaticStars(ctx, dt, now);
  drawBlackHole(ctx, now);

  if (!state.framePending) {
    try {
      const bitmap = state.canvas.transferToImageBitmap();
      state.framePending = true;
      self.postMessage({ type: "frame", bitmap }, [bitmap]);
    } catch (error) {
      self.postMessage({ type: "error", error: error && error.message ? error.message : "transferToImageBitmap failed" });
      return;
    }
  }
  setTimeout(render, state.reducedMotion ? 1000 / 30 : 1000 / 60);
}

self.onmessage = event => {
  const message = event.data || {};
  try {
    if (message.type === "init") {
      state.settings = { ...(message.settings || {}) };
      state.mode = message.mode === "warp" ? "warp" : "static";
      state.reducedMotion = Boolean(message.reducedMotion);
      state.stopped = false;
      if (!state.canvas) createCanvas(state.width, state.height, state.settings.hdr);
      buildStars();
      buildWarpStars();
      self.postMessage({ type: "ready" });
      if (!state.lastAt) {
        state.lastAt = performance.now();
        render();
      }
    } else if (message.type === "resize") {
      state.reducedMotion = Boolean(message.reducedMotion);
      resize(message.width, message.height, message.cssWidth, message.cssHeight, message.dpr);
    } else if (message.type === "settings") {
      state.settings = { ...state.settings, ...(message.settings || {}) };
      buildWarpStars();
    } else if (message.type === "mode") {
      state.mode = message.mode === "warp" ? "warp" : "static";
    } else if (message.type === "mouse") {
      state.mouseX = Number(message.x) || 0;
      state.mouseY = Number(message.y) || 0;
    } else if (message.type === "audio") {
      state.audio = { ...state.audio, ...(message.levels || {}) };
    } else if (message.type === "ack") {
      state.framePending = false;
    } else if (message.type === "stop") {
      state.stopped = true;
    }
  } catch (error) {
    self.postMessage({ type: "error", error: error && error.message ? error.message : String(error) });
  }
};
