// Shared canvas helpers for AI Hub (newtab + wallpaper).
// HDR/P3 colors, bloom sync, black hole draw routine, glow normalization.

function aiHubSupportsDisplayP3Color() {
  try {
    return typeof CSS !== "undefined" && CSS.supports && CSS.supports("color", "color(display-p3 1 1 1)");
  } catch {
    return false;
  }
}

function aiHubClamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function aiHubFormatAlpha(alpha) {
  return Number(aiHubClamp(alpha, 0, 1).toFixed(4));
}

function aiHubCanvasColor(r, g, b, alpha = 1, hdrEnabled = true) {
  const rr = aiHubClamp(r, 0, 255);
  const gg = aiHubClamp(g, 0, 255);
  const bb = aiHubClamp(b, 0, 255);
  const a = aiHubFormatAlpha(alpha);
  if (hdrEnabled !== false && aiHubSupportsDisplayP3Color()) {
    return `color(display-p3 ${(rr / 255).toFixed(4)} ${(gg / 255).toFixed(4)} ${(bb / 255).toFixed(4)} / ${a})`;
  }
  return `rgba(${Math.round(rr)}, ${Math.round(gg)}, ${Math.round(bb)}, ${a})`;
}

function aiHubCanvasColorSpace(ctx) {
  try {
    const attrs = ctx && ctx.getContextAttributes && ctx.getContextAttributes();
    return attrs && attrs.colorSpace ? attrs.colorSpace : "srgb";
  } catch {
    return "srgb";
  }
}

function aiHubGet2dContext(canvas, hdrEnabled = true) {
  if (!canvas) return null;
  const wantsP3 = hdrEnabled !== false;
  let ctx = null;
  if (wantsP3) {
    try {
      ctx = canvas.getContext("2d", { colorSpace: "display-p3" });
    } catch {}
  }
  if (!ctx) ctx = canvas.getContext("2d");
  if (ctx && canvas.dataset) {
    canvas.dataset.hdr = wantsP3 ? "on" : "off";
    canvas.dataset.colorSpace = aiHubCanvasColorSpace(ctx);
  }
  return ctx;
}

function aiHubStarPalette(hdrEnabled = true) {
  return [
    aiHubCanvasColor(255, 255, 255, 1, hdrEnabled),
    aiHubCanvasColor(255, 255, 255, 1, hdrEnabled),
    aiHubCanvasColor(255, 246, 224, 1, hdrEnabled),
    aiHubCanvasColor(224, 238, 255, 1, hdrEnabled),
    aiHubCanvasColor(190, 220, 255, 1, hdrEnabled)
  ];
}

function aiHubNormalizeStarGlow(value, fallback = 1.7) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(4, Math.max(0.8, n)) : fallback;
}

function aiHubApplyStarGlowStyle(value) {
  const glow = aiHubNormalizeStarGlow(value);
  const lift = Math.max(0, glow - 1);
  const brightness = 1 + lift * 0.18;
  const canvasBrightness = 1 + lift * 0.08;
  const saturation = 1 + lift * 0.1;
  document.documentElement.style.setProperty("--star-layer-brightness", brightness.toFixed(2));
  document.documentElement.style.setProperty("--canvas-star-brightness", canvasBrightness.toFixed(2));
  document.documentElement.style.setProperty("--star-layer-saturation", saturation.toFixed(2));
  document.documentElement.style.setProperty("--canvas-bloom-radius", "0");
  document.documentElement.style.setProperty("--canvas-bloom-opacity", "0");
  document.documentElement.style.setProperty("--canvas-bloom-overlay-opacity", "0");
  aiHubSyncCanvasBloomFilter();
}

function aiHubSyncCanvasBloomFilter(enabled = null) {
  const root = document.documentElement;
  const bloomEnabled = enabled === null
    ? Boolean(document.body && document.body.classList.contains("bloom-on"))
    : enabled !== false;

  const styles = getComputedStyle(root);
  const radius = Math.min(4, Math.max(0, Number(styles.getPropertyValue("--canvas-bloom-radius")) || 0));
  const opacity = Math.min(1, Math.max(0, Number(styles.getPropertyValue("--canvas-bloom-opacity")) || 0));
  const blur = document.getElementById("aihub-star-bloom-blur");
  const lift = document.getElementById("aihub-star-bloom-lift");
  if (blur) blur.setAttribute("stdDeviation", "0");
  if (lift) {
    lift.setAttribute("values", [
      "1.16 0 0 0 0",
      "0 1.10 0 0 0",
      "0 0 1.30 0 0",
      `0 0 0 ${bloomEnabled ? opacity.toFixed(2) : "0"} 0`
    ].join(" "));
  }

  const canvas = document.getElementById("bg-canvas");
  if (canvas) canvas.style.filter = "";
}

function aiHubSetCanvasBloomEnabled(enabled) {
  if (document.body) document.body.classList.toggle("bloom-on", enabled !== false);
  aiHubSyncCanvasBloomFilter(enabled);
}

function aiHubStarRankFromSize(size) {
  const n = Math.min(1, Math.max(0, (Number(size) - 0.08) / 1.10));
  return Math.pow(n, 1.85);
}

function aiHubGlowBoost(glow, rank, strength = 1) {
  return 1 + Math.max(0, glow - 1) * Math.min(1, Math.max(0, rank)) * strength;
}

function aiHubDrawBlackHole(ctx, lx, ly, evR, eiR, hdrEnabled = true, spin = 0) {
  const TAU = Math.PI * 2;
  ctx.save();

  ctx.globalCompositeOperation = "screen";
  const aura = ctx.createRadialGradient(lx, ly, evR * 0.85, lx, ly, eiR * 2.65);
  aura.addColorStop(0, aiHubCanvasColor(255, 220, 170, 0.22, hdrEnabled));
  aura.addColorStop(0.34, aiHubCanvasColor(255, 178, 96, 0.10, hdrEnabled));
  aura.addColorStop(1, aiHubCanvasColor(92, 150, 255, 0, hdrEnabled));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(lx, ly, eiR * 2.65, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(-0.22 + Math.sin(spin * 0.31) * 0.025);
  ctx.scale(1, 0.28);
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, evR * 0.18);
  ctx.strokeStyle = aiHubCanvasColor(255, 176, 82, 0.28, hdrEnabled);
  ctx.beginPath();
  ctx.arc(0, 0, eiR * 1.16, Math.PI * 0.04, Math.PI * 1.96);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.2, evR * 0.09);
  ctx.strokeStyle = aiHubCanvasColor(132, 186, 255, 0.16, hdrEnabled);
  ctx.beginPath();
  ctx.arc(0, 0, eiR * 1.34, Math.PI * 1.03, Math.PI * 1.91);
  ctx.stroke();
  ctx.restore();

  const photon = ctx.createRadialGradient(lx, ly, evR * 0.95, lx, ly, eiR * 1.45);
  photon.addColorStop(0, aiHubCanvasColor(255, 220, 170, 0.46, hdrEnabled));
  photon.addColorStop(0.52, aiHubCanvasColor(255, 205, 135, 0.16, hdrEnabled));
  photon.addColorStop(1, aiHubCanvasColor(255, 200, 140, 0, hdrEnabled));
  ctx.fillStyle = photon;
  ctx.beginPath();
  ctx.arc(lx, ly, eiR * 1.45, 0, TAU);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  const shadow = ctx.createRadialGradient(lx, ly, evR * 0.15, lx, ly, evR * 2.15);
  shadow.addColorStop(0, "rgba(0, 0, 0, 0.98)");
  shadow.addColorStop(0.55, "rgba(0, 0, 0, 0.76)");
  shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(lx, ly, evR * 2.15, 0, TAU);
  ctx.fill();

  ctx.lineWidth = Math.max(1.2, evR * 0.07);
  ctx.strokeStyle = aiHubCanvasColor(255, 245, 215, 0.9, hdrEnabled);
  ctx.beginPath();
  ctx.arc(lx, ly, eiR, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(lx, ly, evR, 0, TAU);
  ctx.fill();
  ctx.restore();
}
