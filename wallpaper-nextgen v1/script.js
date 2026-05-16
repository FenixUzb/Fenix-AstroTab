// Starfield Wallpaper Next-Gen — full plan: bloom, HDR/P3, black hole,
// real Yale BSC sky, WebGPU starfield, audio reactive, OffscreenCanvas worker.
// Helpers come from shared/aihub-canvas.js and shared/aihub-astro.js.

document.addEventListener("DOMContentLoaded", () => {
  // ===== Settings =====
  const SETTINGS_KEY = "wallpaperNextGenSettings";
  const CITY_KEY = "wallpaperNextGenCity";
  const COORDS_KEY = "wallpaperNextGenWeatherCoords";
  const SETTINGS_DEFAULTS = {
    aurora: true,
    constellations: true,
    dust: true,
    shooting: true,
    nebula: true,
    vignette: true,
    warp: false,
    cosmicDepth: true,
    threeStars: true,
    hdr: true,
    bloom: true,
    planet: true,
    cursorLens: true,
    blackHole: false,
    realSky: false,
    realSkyLat: null,
    realSkyLon: null,
    webgpuStars: false,
    workerStarfield: false,
    audioReactive: false,
    audioSource: "mic",
    scale: 1,
    bgDim: 0,
    starGlow: 1.7
  };

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      const merged = { ...SETTINGS_DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
      if (!saved || saved.starGlow === undefined) {
        merged.starGlow = SETTINGS_DEFAULTS.starGlow;
      }
      // Audio capture demands a fresh user gesture — never auto-resume on load.
      merged.audioReactive = false;
      merged.webgpuStarsActive = false;
      merged.workerStarfieldActive = false;
      return merged;
    } catch { return { ...SETTINGS_DEFAULTS }; }
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  function normalizeScale(value) {
    const scale = Number(value);
    if (!Number.isFinite(scale)) return SETTINGS_DEFAULTS.scale;
    return Math.min(1.15, Math.max(0.85, scale));
  }

  function applyUiScale(value) {
    const scale = normalizeScale(value);
    document.documentElement.style.setProperty("--ui-scale", String(scale));
    return scale;
  }

  const settings = loadSettings();
  settings.scale = applyUiScale(settings.scale);
  const body = document.body;

  // Apply initial settings
  if (!settings.nebula) body.classList.add("no-nebula");
  if (!settings.vignette) body.classList.add("no-vignette");
  if (settings.warp) body.classList.add("warp-mode");
  body.classList.toggle("hdr-on", settings.hdr !== false);
  aiHubSetCanvasBloomEnabled(settings.bloom !== false);
  const auroraEl = document.getElementById("aurora");
  if (!settings.aurora && auroraEl) auroraEl.classList.add("hidden");

  // Settings panel
  const settingsPanel = document.getElementById("settings-panel");
  const toggleSettingsBtn = document.getElementById("toggle-settings");
  if (settingsPanel) settingsPanel.classList.add("hidden");

  // Forward-declared so applySettingChange / setWarpMode can reach them
  // before the canvas-init block runs at end of DOMContentLoaded.
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let starfieldInstance = null;
  let warpInstance = null;
  let warpSkyInstance = null;
  let warpSkyCanvas = null;
  let threeStarfieldLayer = null;
  let cosmicDepthLayer = null;
  let realStarfieldLayer = null;
  let webgpuStarfieldLayer = null;
  let workerStarfieldLayer = null;
  let dustInstance = null;

  function updateHdrDebug() {
    const el = document.getElementById("hdr-debug");
    if (!el) return;
    const mainCanvas = document.getElementById("bg-canvas");
    const probe = document.createElement("canvas");
    let canvasP3 = false;
    let canvasSpace = "sRGB";
    try {
      const pCtx = probe.getContext("2d", { colorSpace: "display-p3" });
      const attrs = pCtx && pCtx.getContextAttributes && pCtx.getContextAttributes();
      canvasSpace = (attrs && attrs.colorSpace) || "sRGB";
      canvasP3 = canvasSpace === "display-p3";
    } catch (_) {}
    const gamutP3   = window.matchMedia && window.matchMedia("(color-gamut: p3)").matches;
    const gamutR2020 = window.matchMedia && window.matchMedia("(color-gamut: rec2020)").matches;
    const hdr       = window.matchMedia && window.matchMedia("(dynamic-range: high)").matches;
    const tag = (ok) => ok ? `<span class="hdr-ok">YES</span>` : `<span class="hdr-no">no</span>`;
    const gamut = gamutR2020 ? "rec2020" : gamutP3 ? "p3" : "srgb";
    const activeSpace = mainCanvas && mainCanvas.dataset.colorSpace ? mainCanvas.dataset.colorSpace : canvasSpace;
    const hdrSetting = settings.hdr !== false;
    el.innerHTML =
      `<span class="hdr-key">HDR/P3 toggle:</span> ${hdrSetting ? "on" : "off"} ${tag(hdrSetting)}\n` +
      `<span class="hdr-key">active canvas:</span> ${activeSpace} ${tag(activeSpace === "display-p3")}\n` +
      `<span class="hdr-key">P3 probe:</span> ${canvasSpace} ${tag(canvasP3)}\n` +
      `<span class="hdr-key">display gamut:</span> ${gamut} ${tag(gamutP3 || gamutR2020)}\n` +
      `<span class="hdr-key">HDR (dynamic-range):</span> ${hdr ? "high" : "standard"} ${tag(hdr)}\n` +
      `<span class="hdr-key">dpr:</span> ${window.devicePixelRatio || 1} <span class="hdr-key">·</span> ` +
      `<span class="hdr-key">bloom:</span> ${document.body.classList.contains("bloom-on") ? "on" : "off"} <span class="hdr-key">·</span> ` +
      `<span class="hdr-key">glow:</span> ${Math.round(normalizeStarGlow(settings.starGlow) * 100)}%`;
  }

  if (toggleSettingsBtn && settingsPanel) {
    toggleSettingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsPanel.classList.toggle("hidden");
      if (!settingsPanel.classList.contains("hidden")) updateHdrDebug();
    });
    settingsPanel.addEventListener("click", e => e.stopPropagation());
    document.addEventListener("click", () => {
      if (!settingsPanel.classList.contains("hidden")) {
        settingsPanel.classList.add("hidden");
      }
    });
  }

  // Wire up setting checkboxes
  const checkboxMap = {
    "set-aurora": "aurora",
    "set-constellations": "constellations",
    "set-dust": "dust",
    "set-shooting": "shooting",
    "set-nebula": "nebula",
    "set-cosmic-depth": "cosmicDepth",
    "set-hdr": "hdr",
    "set-bloom": "bloom",
    "set-planet": "planet",
    "set-cursor-lens": "cursorLens",
    "set-blackhole": "blackHole",
    "set-realsky": "realSky",
    "set-webgpu-stars": "webgpuStars",
    "set-worker-starfield": "workerStarfield",
    "set-audio-reactive": "audioReactive",
    "set-vignette": "vignette",
    "set-warp": "warp"
  };

  for (const [id, key] of Object.entries(checkboxMap)) {
    const cb = document.getElementById(id);
    if (!cb) continue;
    cb.checked = settings[key];
    cb.addEventListener("change", () => {
      settings[key] = cb.checked;
      saveSettings(settings);
      applySettingChange(key, cb.checked);
    });
  }

  // ===== Audio reactive UI =====
  const audioReactiveCheckbox = document.getElementById("set-audio-reactive");
  const audioSourceSelect = document.getElementById("set-audio-source");
  const audioStatusEl = document.getElementById("audio-reactive-status");
  if (audioSourceSelect) {
    audioSourceSelect.value = settings.audioSource === "system" ? "system" : "mic";
    audioSourceSelect.addEventListener("change", () => {
      settings.audioSource = audioSourceSelect.value === "system" ? "system" : "mic";
      saveSettings(settings);
      if (settings.audioReactive === true) void setAudioReactiveEnabled(true);
    });
  }

  function renderAudioReactiveStatus() {
    if (!audioStatusEl) return;
    const audio = window.aiHubAudio;
    const status = audio ? audio.status : "error";
    audioStatusEl.classList.toggle("is-active", status === "active");
    audioStatusEl.classList.toggle("is-error", status === "error" || status === "denied");
    if (!settings.audioReactive) {
      audioStatusEl.textContent = "";
    } else if (status === "active") {
      audioStatusEl.textContent = settings.audioSource === "system" ? "Системный звук активен" : "Микрофон активен";
    } else if (status === "starting") {
      audioStatusEl.textContent = "Ожидание разрешения";
    } else if (status === "denied") {
      audioStatusEl.textContent = "Доступ запрещён";
    } else if (status === "error") {
      audioStatusEl.textContent = "Источник недоступен";
    } else {
      audioStatusEl.textContent = "";
    }
  }

  async function setAudioReactiveEnabled(enabled) {
    const on = enabled === true;
    body.classList.toggle("audio-reactive-on", on);
    settings.audioReactive = on;
    if (!window.aiHubAudio) {
      settings.audioReactive = false;
      body.classList.remove("audio-reactive-on");
      if (audioReactiveCheckbox) audioReactiveCheckbox.checked = false;
      saveSettings(settings);
      renderAudioReactiveStatus();
      return;
    }
    if (!on) {
      await window.aiHubAudio.stop();
      saveSettings(settings);
      renderAudioReactiveStatus();
      return;
    }
    renderAudioReactiveStatus();
    const ok = await window.aiHubAudio.start(settings.audioSource === "system" ? "system" : "mic");
    if (!ok) {
      settings.audioReactive = false;
      body.classList.remove("audio-reactive-on");
      if (audioReactiveCheckbox) audioReactiveCheckbox.checked = false;
      saveSettings(settings);
    }
    renderAudioReactiveStatus();
  }

  if (window.aiHubAudio) window.aiHubAudio.onChange(renderAudioReactiveStatus);
  renderAudioReactiveStatus();

  // Darkness slider
  function normalizeBgDim(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(0.35, Math.max(0, n)) : 0;
  }
  function applyBgDim(value) {
    const v = normalizeBgDim(value);
    // Darkness is applied inside the starfield before stars are drawn,
    // so the slider deepens space without muting the stars.
    document.documentElement.style.setProperty("--bg-dim", "0");
    return v;
  }
  function syncDarknessControl(value) {
    const v = normalizeBgDim(value);
    const darknessInput = document.getElementById("set-darkness");
    const darknessValue = document.getElementById("set-darkness-value");
    if (darknessInput) darknessInput.value = String(v);
    if (darknessValue) darknessValue.textContent = `${Math.round(v * 100)}%`;
  }
  settings.bgDim = applyBgDim(settings.bgDim);
  syncDarknessControl(settings.bgDim);
  const darknessInput = document.getElementById("set-darkness");
  if (darknessInput) {
    darknessInput.addEventListener("input", () => {
      settings.bgDim = applyBgDim(darknessInput.value);
      if (starfieldInstance && starfieldInstance.settings) starfieldInstance.settings.bgDim = settings.bgDim;
      if (warpSkyInstance && warpSkyInstance.settings) warpSkyInstance.settings.bgDim = settings.bgDim;
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
      if (threeStarfieldLayer) threeStarfieldLayer.updateSettings(settings);
      if (workerStarfieldLayer) workerStarfieldLayer.updateSettings(settings);
      syncDarknessControl(settings.bgDim);
      saveSettings(settings);
    });
  }

  function normalizeStarGlow(value) {
    return aiHubNormalizeStarGlow(value, SETTINGS_DEFAULTS.starGlow);
  }
  function syncStarGlowControl(value) {
    const v = normalizeStarGlow(value);
    const starGlowInput = document.getElementById("set-star-glow");
    const starGlowValue = document.getElementById("set-star-glow-value");
    if (starGlowInput) starGlowInput.value = String(v);
    if (starGlowValue) starGlowValue.textContent = `${Math.round(v * 100)}%`;
  }
  settings.starGlow = normalizeStarGlow(settings.starGlow);
  aiHubApplyStarGlowStyle(settings.starGlow);
  syncStarGlowControl(settings.starGlow);
  const starGlowInput = document.getElementById("set-star-glow");
  if (starGlowInput) {
    starGlowInput.addEventListener("input", () => {
      settings.starGlow = normalizeStarGlow(starGlowInput.value);
      if (starfieldInstance && starfieldInstance.settings) starfieldInstance.settings.starGlow = settings.starGlow;
      if (warpSkyInstance && warpSkyInstance.settings) warpSkyInstance.settings.starGlow = settings.starGlow;
      if (warpInstance) warpInstance.starGlow = settings.starGlow;
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
      if (threeStarfieldLayer) threeStarfieldLayer.updateSettings(settings);
      if (realStarfieldLayer) realStarfieldLayer.setStarGlow(settings.starGlow);
      if (webgpuStarfieldLayer) webgpuStarfieldLayer.setStarGlow(settings.starGlow);
      if (workerStarfieldLayer) workerStarfieldLayer.updateSettings(settings);
      aiHubApplyStarGlowStyle(settings.starGlow);
      syncStarGlowControl(settings.starGlow);
      updateHdrDebug();
      saveSettings(settings);
    });
  }

  const scaleInput = document.getElementById("set-scale");
  const scaleValue = document.getElementById("set-scale-value");
  function syncScaleControl(value) {
    const scale = normalizeScale(value);
    if (scaleInput) scaleInput.value = String(scale);
    if (scaleValue) scaleValue.textContent = `${Math.round(scale * 100)}%`;
  }
  syncScaleControl(settings.scale);
  if (scaleInput) {
    scaleInput.addEventListener("input", () => {
      settings.scale = applyUiScale(scaleInput.value);
      syncScaleControl(settings.scale);
      saveSettings(settings);
    });
  }

  function applySettingChange(key, value) {
    if (key === "nebula") {
      body.classList.toggle("no-nebula", !value);
      if (starfieldInstance && starfieldInstance.settings) starfieldInstance.settings.nebula = value;
      if (warpSkyInstance && warpSkyInstance.settings) warpSkyInstance.settings.nebula = value;
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
      if (threeStarfieldLayer) threeStarfieldLayer.updateSettings(settings);
    } else if (key === "aurora") {
      if (auroraEl) auroraEl.classList.toggle("hidden", !value);
    } else if (key === "dust") {
      if (dustInstance) dustInstance.enabled = value;
    } else if (key === "shooting") {
      if (starfieldInstance) starfieldInstance.shootingEnabled = value;
    } else if (key === "constellations") {
      if (starfieldInstance) starfieldInstance.constellationsEnabled = value;
      if (warpSkyInstance) warpSkyInstance.constellationsEnabled = value;
    } else if (key === "vignette") {
      body.classList.toggle("no-vignette", !value);
    } else if (key === "hdr") {
      body.classList.toggle("hdr-on", value !== false);
      if (starfieldInstance && starfieldInstance.updateHdr) starfieldInstance.updateHdr(value);
      if (warpSkyInstance && warpSkyInstance.updateHdr) warpSkyInstance.updateHdr(value);
      if (warpInstance && warpInstance.updateHdr) warpInstance.updateHdr(value);
      if (dustInstance && dustInstance.updateHdr) dustInstance.updateHdr(value);
      if (realStarfieldLayer) realStarfieldLayer.setHDR(value);
      if (webgpuStarfieldLayer) webgpuStarfieldLayer.setHDR(value);
      if (workerStarfieldLayer) workerStarfieldLayer.updateHdr(value);
      updateHdrDebug();
    } else if (key === "cosmicDepth" || key === "bloom" || key === "planet" || key === "cursorLens") {
      if (key === "bloom") aiHubSetCanvasBloomEnabled(value !== false);
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
      if (threeStarfieldLayer) threeStarfieldLayer.updateSettings(settings);
      updateHdrDebug();
    } else if (key === "blackHole") {
      if (starfieldInstance && starfieldInstance.settings) starfieldInstance.settings.blackHole = value;
      if (warpInstance) warpInstance.blackHoleEnabled = value;
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
    } else if (key === "realSky") {
      body.classList.toggle("real-sky-on", value === true);
      if (realStarfieldLayer) realStarfieldLayer.setEnabled(value === true);
      if (starfieldInstance && starfieldInstance.settings) starfieldInstance.settings.realSky = value === true;
      if (warpSkyInstance && warpSkyInstance.settings) warpSkyInstance.settings.realSky = value === true;
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
      if (threeStarfieldLayer) threeStarfieldLayer.updateSettings(settings);
    } else if (key === "webgpuStars") {
      const active = value === true && !!(webgpuStarfieldLayer && webgpuStarfieldLayer.supported);
      body.classList.toggle("webgpu-stars-on", active);
      if (webgpuStarfieldLayer) webgpuStarfieldLayer.setEnabled(value === true);
      settings.webgpuStarsActive = active;
      if (starfieldInstance && starfieldInstance.settings) starfieldInstance.settings.webgpuStarsActive = active;
      if (warpSkyInstance && warpSkyInstance.settings) warpSkyInstance.settings.webgpuStarsActive = active;
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
      if (threeStarfieldLayer) threeStarfieldLayer.updateSettings(settings);
    } else if (key === "audioReactive") {
      if (starfieldInstance && starfieldInstance.settings) starfieldInstance.settings.audioReactive = value === true;
      if (warpSkyInstance && warpSkyInstance.settings) warpSkyInstance.settings.audioReactive = value === true;
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
      if (threeStarfieldLayer) threeStarfieldLayer.updateSettings(settings);
      void setAudioReactiveEnabled(value === true);
    } else if (key === "workerStarfield") {
      setWorkerStarfieldEnabled(value === true);
    } else if (key === "warp") {
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
      if (threeStarfieldLayer) threeStarfieldLayer.updateSettings(settings);
      setWarpMode(value);
    }
    if (workerStarfieldLayer) workerStarfieldLayer.updateSettings(settings);
  }

  // ===== Mode Toggle Button =====
  const toggleModeBtn = document.getElementById("toggle-mode");
  const modeIconStatic = document.getElementById("mode-icon-static");
  const modeIconWarp = document.getElementById("mode-icon-warp");

  function updateModeIcon(warp) {
    if (modeIconStatic) modeIconStatic.style.display = warp ? "none" : "";
    if (modeIconWarp) modeIconWarp.style.display = warp ? "" : "none";
    if (toggleModeBtn) {
      toggleModeBtn.classList.toggle("is-active", warp);
      toggleModeBtn.setAttribute("aria-pressed", String(warp));
    }
  }
  updateModeIcon(settings.warp);

  const WARP_TRANSITION_MS = 950;
  let warpTransitionTimer = null;

  function playWarpTransition(kind, sourceCanvas) {
    if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return;
    document.querySelectorAll(".warp-transition-layer").forEach(layer => layer.remove());

    const snapshot = document.createElement("canvas");
    snapshot.className = "warp-transition-layer";
    snapshot.width = sourceCanvas.width;
    snapshot.height = sourceCanvas.height;
    snapshot.style.width = "100vw";
    snapshot.style.height = "100vh";
    const ctx = aiHubGet2dContext(snapshot, settings.hdr);
    if (!ctx) return;
    ctx.drawImage(sourceCanvas, 0, 0);
    document.body.appendChild(snapshot);
    void snapshot.offsetWidth;

    body.classList.remove("warp-entering", "warp-exiting");
    body.classList.add(kind === "enter" ? "warp-entering" : "warp-exiting");
    clearTimeout(warpTransitionTimer);
    warpTransitionTimer = setTimeout(() => {
      body.classList.remove("warp-entering", "warp-exiting");
    }, WARP_TRANSITION_MS + 120);

    requestAnimationFrame(() => {
      snapshot.style.opacity = "0";
      setTimeout(() => snapshot.remove(), WARP_TRANSITION_MS + 140);
    });
  }

  function createWarpSkySettings() {
    return {
      ...settings,
      warpSkyOverlay: true,
      shooting: false,
      blackHole: false,
      threeStars: false,
      cosmicDepth: false
    };
  }

  function ensureWarpSkyOverlay() {
    if (!canvas || warpSkyInstance) return;
    if (!warpSkyCanvas) {
      warpSkyCanvas = document.createElement("canvas");
      warpSkyCanvas.className = "warp-sky-layer";
      warpSkyCanvas.setAttribute("aria-hidden", "true");
      canvas.insertAdjacentElement("afterend", warpSkyCanvas);
    }
    warpSkyInstance = new Starfield(warpSkyCanvas, createWarpSkySettings());
    warpSkyInstance.mouseX = mouseX;
    warpSkyInstance.mouseY = mouseY;
  }

  function stopWarpSkyOverlay() {
    if (warpSkyInstance) {
      warpSkyInstance.stop();
      warpSkyInstance = null;
    }
    if (warpSkyCanvas) {
      warpSkyCanvas.remove();
      warpSkyCanvas = null;
    }
  }

  if (toggleModeBtn) {
    toggleModeBtn.addEventListener("click", () => {
      settings.warp = !settings.warp;
      saveSettings(settings);
      setWarpMode(settings.warp);
      const cb = document.getElementById("set-warp");
      if (cb) cb.checked = settings.warp;
    });
  }

  function getWorkerStarfieldUrl() {
    return "shared/aihub-starfield-worker.js";
  }

  function setWorkerStarfieldActive(active) {
    settings.workerStarfieldActive = active === true;
    if (starfieldInstance && starfieldInstance.settings) starfieldInstance.settings.workerStarfieldActive = settings.workerStarfieldActive;
    if (warpSkyInstance && warpSkyInstance.settings) warpSkyInstance.settings.workerStarfieldActive = settings.workerStarfieldActive;
  }

  function stopPrimaryCanvasRenderer() {
    if (starfieldInstance) {
      starfieldInstance.stop();
      starfieldInstance = null;
    }
    if (warpInstance) {
      warpInstance.stop();
      warpInstance = null;
    }
  }

  function startPrimaryCanvasRenderer() {
    const bgCanvas = document.getElementById("bg-canvas");
    if (!bgCanvas) return;
    stopPrimaryCanvasRenderer();
    setWorkerStarfieldActive(false);
    if (settings.warp) {
      warpInstance = new WarpField(bgCanvas, { instant: true, blackHole: settings.blackHole, hdr: settings.hdr, starGlow: settings.starGlow });
      ensureWarpSkyOverlay();
    } else {
      stopWarpSkyOverlay();
      starfieldInstance = new Starfield(bgCanvas, settings);
      starfieldInstance.mouseX = mouseX;
      starfieldInstance.mouseY = mouseY;
    }
  }

  function createWorkerStarfieldLayer(bgCanvas) {
    if (!settings.workerStarfield || !bgCanvas || !window.AIHubWorkerStarfield) return null;
    let layer = null;
    layer = new window.AIHubWorkerStarfield(bgCanvas, {
      settings,
      mode: settings.warp ? "warp" : "static",
      workerUrl: getWorkerStarfieldUrl(),
      onReady: () => {
        if (workerStarfieldLayer !== layer) return;
        stopPrimaryCanvasRenderer();
        setWorkerStarfieldActive(true);
        if (settings.warp) ensureWarpSkyOverlay();
        else stopWarpSkyOverlay();
        if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
        if (threeStarfieldLayer) threeStarfieldLayer.updateSettings(settings);
      },
      onUnsupported: () => {
        if (workerStarfieldLayer !== layer) return;
        workerStarfieldLayer = null;
        setWorkerStarfieldActive(false);
        startPrimaryCanvasRenderer();
      }
    });
    if (!layer.supported) return null;
    return layer;
  }

  function setWorkerStarfieldEnabled(enabled) {
    const bgCanvas = document.getElementById("bg-canvas");
    settings.workerStarfield = enabled === true;
    if (!bgCanvas) return;
    if (!settings.workerStarfield) {
      if (workerStarfieldLayer) {
        workerStarfieldLayer.stop();
        workerStarfieldLayer = null;
      }
      startPrimaryCanvasRenderer();
      return;
    }
    if (workerStarfieldLayer) {
      workerStarfieldLayer.updateSettings(settings);
      workerStarfieldLayer.setMode(settings.warp ? "warp" : "static");
      return;
    }
    workerStarfieldLayer = createWorkerStarfieldLayer(bgCanvas);
    if (!workerStarfieldLayer) startPrimaryCanvasRenderer();
  }

  function setWarpMode(enabled) {
    const bgCanvas = document.getElementById("bg-canvas");
    const currentlyWarping = workerStarfieldLayer && workerStarfieldLayer.supported
      ? workerStarfieldLayer.mode === "warp"
      : Boolean(warpInstance);
    if (enabled !== currentlyWarping && bgCanvas) {
      playWarpTransition(enabled ? "enter" : "exit", bgCanvas);
    }

    body.classList.toggle("warp-mode", enabled);
    updateModeIcon(enabled);
    if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
    if (threeStarfieldLayer) threeStarfieldLayer.updateSettings(settings);

    if (workerStarfieldLayer && workerStarfieldLayer.supported) {
      stopPrimaryCanvasRenderer();
      workerStarfieldLayer.setMode(enabled ? "warp" : "static");
      workerStarfieldLayer.updateSettings(settings);
      if (enabled) ensureWarpSkyOverlay();
      else stopWarpSkyOverlay();
      return;
    }

    if (enabled) {
      if (starfieldInstance) { starfieldInstance.stop(); starfieldInstance = null; }
      if (!warpInstance) warpInstance = new WarpField(bgCanvas, { instant: false, blackHole: settings.blackHole, hdr: settings.hdr, starGlow: settings.starGlow });
      ensureWarpSkyOverlay();
    } else {
      if (warpInstance) { warpInstance.stop(); warpInstance = null; }
      stopWarpSkyOverlay();
      if (!starfieldInstance) {
        starfieldInstance = new Starfield(bgCanvas, settings);
        starfieldInstance.mouseX = mouseX;
        starfieldInstance.mouseY = mouseY;
      }
    }
  }

  // ===== Clock =====
  const DAYS   = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
  const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const timeEl = document.getElementById("clock-time");
  const dateEl = document.getElementById("clock-date");
  const greetEl = document.getElementById("greeting");
  const secFill = document.getElementById("clock-sec-fill");

  let hoursSpan, colonSpan, minutesSpan;
  if (timeEl) {
    hoursSpan = document.createElement("span");
    colonSpan = document.createElement("span");
    colonSpan.className = "colon";
    colonSpan.textContent = ":";
    minutesSpan = document.createElement("span");
    timeEl.textContent = "";
    timeEl.append(hoursSpan, colonSpan, minutesSpan);
  }

  function getGreeting(h) {
    if (h >= 5  && h < 12) return "Доброе утро";
    if (h >= 12 && h < 17) return "Добрый день";
    if (h >= 17 && h < 22) return "Добрый вечер";
    return "Доброй ночи";
  }

  let lastMinute = -1, lastDate = -1, lastGreetingHour = -1;
  function updateClock() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    if (timeEl) {
      if (m !== lastMinute) {
        hoursSpan.textContent = String(h).padStart(2, "0");
        minutesSpan.textContent = String(m).padStart(2, "0");
        lastMinute = m;
      }
      colonSpan.classList.toggle("colon-dim", s % 2 !== 0);
    }
    const d = now.getDate();
    if (dateEl && d !== lastDate) {
      dateEl.textContent = `${DAYS[now.getDay()]} · ${d} ${MONTHS[now.getMonth()]}`;
      lastDate = d;
    }
    if (greetEl && h !== lastGreetingHour) {
      greetEl.textContent = getGreeting(h);
      lastGreetingHour = h;
    }
    if (secFill) {
      if (s === 0) secFill.style.transition = "none";
      else if (s === 1) secFill.style.transition = "";
      secFill.style.width = ((s / 59) * 100) + "%";
    }
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ===== Moon Phase =====
  const moonEl = document.getElementById("moon-phase");
  if (moonEl) {
    const now = new Date();
    const knownNew = new Date(2000, 0, 6, 18, 14);
    const days = (now - knownNew) / 86400000;
    const phase = ((days % 29.53) + 29.53) % 29.53;
    const emojis = ["\u{1F311}","\u{1F312}","\u{1F313}","\u{1F314}","\u{1F315}","\u{1F316}","\u{1F317}","\u{1F318}"];
    const names  = ["Новолуние","Растущий серп","Первая четверть","Растущая луна","Полнолуние","Убывающая луна","Последняя четверть","Убывающий серп"];
    const idx = Math.round(phase / (29.53 / 8)) % 8;
    moonEl.textContent = `${emojis[idx]} ${names[idx]}`;
  }

  // ===== Day Progress =====
  const dayProgressEl = document.getElementById("day-progress");
  function updateDayProgress() {
    if (!dayProgressEl) return;
    const now = new Date();
    const pct = Math.round(((now.getHours() * 60 + now.getMinutes()) / 1440) * 100);
    dayProgressEl.textContent = `День: ${pct}%`;
  }
  updateDayProgress();

  // ===== Workday Progress Bar =====
  const workdayBar = document.getElementById("workday-bar");
  const workdayFill = document.getElementById("workday-fill");
  const workdayLabel = document.getElementById("workday-label");
  const WORK_START = 9 * 60, WORK_END = 18 * 60, WORK_DURATION = WORK_END - WORK_START;

  function updateWorkday() {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const day = now.getDay();
    if (day === 0 || day === 6 || mins < WORK_START || mins >= WORK_END) {
      if (workdayBar) workdayBar.classList.add("hidden");
      return;
    }
    if (workdayBar) workdayBar.classList.remove("hidden");
    const elapsed = mins - WORK_START;
    const pct = Math.min(100, Math.round((elapsed / WORK_DURATION) * 100));
    if (workdayFill) workdayFill.style.width = pct + "%";
    const hoursLeft = Math.floor((WORK_END - mins) / 60);
    const minsLeft = (WORK_END - mins) % 60;
    if (workdayLabel) {
      workdayLabel.textContent = hoursLeft > 0
        ? `${hoursLeft}ч ${minsLeft}м до конца`
        : `${minsLeft}м до конца`;
    }
  }
  updateWorkday();
  setInterval(() => { updateDayProgress(); updateWorkday(); }, 60000);

  // ===== Weather =====
  const weatherEl = document.getElementById("weather");
  const weatherSep = document.getElementById("weather-sep");

  function weatherEmoji(code) {
    if (code === 0) return "☀️";
    if (code <= 3)  return "⛅";
    if (code <= 48) return "🌫️";
    if (code <= 67) return "🌧️";
    if (code <= 77) return "🌨️";
    if (code <= 86) return "🌨️";
    if (code <= 99) return "⛈️";
    return "🌡️";
  }

  function hideWeather() {
    if (weatherEl) weatherEl.textContent = "";
    if (weatherSep) weatherSep.style.display = "none";
  }

  function clearWeatherCoords() {
    localStorage.removeItem(COORDS_KEY);
  }

  function hasValidCoords(coords) {
    return coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lon);
  }

  function showWeather(lat, lon) {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
      .then(r => r.json())
      .then(data => {
        if (data.current_weather && weatherEl) {
          weatherEl.textContent = `${weatherEmoji(data.current_weather.weathercode)} ${Math.round(data.current_weather.temperature)}°C`;
          if (weatherSep) weatherSep.style.display = "";
        }
      })
      .catch(hideWeather);
  }

  function fetchWeatherForCity(cityName) {
    if (!cityName || !cityName.trim()) { clearWeatherCoords(); hideWeather(); return; }
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName.trim())}&count=1&language=ru`)
      .then(r => {
        if (!r.ok) throw new Error("Weather geocoding failed");
        return r.json();
      })
      .then(data => {
        if (data.results && data.results.length > 0) {
          const loc = data.results[0];
          localStorage.setItem(COORDS_KEY, JSON.stringify({ lat: loc.latitude, lon: loc.longitude }));
          showWeather(loc.latitude, loc.longitude);
          if (realStarfieldLayer && !Number.isFinite(settings.realSkyLat)) {
            realStarfieldLayer.setLocation(loc.latitude, loc.longitude);
          }
        } else {
          clearWeatherCoords();
          hideWeather();
        }
      })
      .catch(() => {
        clearWeatherCoords();
        hideWeather();
      });
  }

  const savedCity = localStorage.getItem(CITY_KEY) || "";
  const cachedCoords = (() => { try { return JSON.parse(localStorage.getItem(COORDS_KEY)); } catch { return null; } })();

  if (hasValidCoords(cachedCoords)) {
    showWeather(cachedCoords.lat, cachedCoords.lon);
  } else if (savedCity) {
    fetchWeatherForCity(savedCity);
  } else {
    hideWeather();
  }

  const cityInput = document.getElementById("set-city");
  if (cityInput) {
    cityInput.value = savedCity;
    let cityTimeout = null;
    cityInput.addEventListener("input", () => {
      clearTimeout(cityTimeout);
      cityTimeout = setTimeout(() => {
        const city = cityInput.value.trim();
        localStorage.setItem(CITY_KEY, city);
        if (city) {
          fetchWeatherForCity(city);
        } else {
          localStorage.removeItem(COORDS_KEY);
          hideWeather();
        }
      }, 800);
    });
  }

  // ===== Mouse tracking + cursor auto-hide =====
  let cursorTimer = null;
  function showCursor() {
    body.style.cursor = "";
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => { body.style.cursor = "none"; }, 3000);
  }
  showCursor(); // start timer on load
  document.addEventListener("mousemove", e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    showCursor();
    if (starfieldInstance) {
      starfieldInstance.mouseX = e.clientX;
      starfieldInstance.mouseY = e.clientY;
    }
    if (workerStarfieldLayer) workerStarfieldLayer.setMouse(e.clientX, e.clientY);
  });

  // ===== Floating Dust =====
  dustInstance = new FloatingDust(settings.dust, settings.hdr);

  // ===== Canvas & Starfield/Warp init =====
  const canvas = document.getElementById("bg-canvas");
  const bloomCanvas = document.getElementById("bloom-canvas");
  const realSkyCanvas = document.getElementById("real-sky-canvas");
  const webgpuCanvas = document.getElementById("webgpu-stars-canvas");

  if (canvas) {
    workerStarfieldLayer = createWorkerStarfieldLayer(canvas);
    if (workerStarfieldLayer) {
      workerStarfieldLayer.setMouse(mouseX, mouseY);
      if (settings.warp) ensureWarpSkyOverlay();
    } else {
      startPrimaryCanvasRenderer();
    }
    if (bloomCanvas) new CanvasBloomLayer(canvas, bloomCanvas, settings);
    if (window.ThreeStaticStarfieldLayer) threeStarfieldLayer = new window.ThreeStaticStarfieldLayer(settings);
    if (window.CosmicDepthLayer) cosmicDepthLayer = new window.CosmicDepthLayer(settings);

    if (realSkyCanvas && window.AIHubRealStarfield) {
      const fromCache = (() => { try { return JSON.parse(localStorage.getItem(COORDS_KEY)); } catch { return null; } })();
      const initLat = Number.isFinite(settings.realSkyLat) ? settings.realSkyLat
        : (fromCache && Number.isFinite(fromCache.lat)) ? fromCache.lat : undefined;
      const initLon = Number.isFinite(settings.realSkyLon) ? settings.realSkyLon
        : (fromCache && Number.isFinite(fromCache.lon)) ? fromCache.lon : undefined;
      realStarfieldLayer = new window.AIHubRealStarfield(realSkyCanvas, {
        enabled: settings.realSky === true,
        hdr: settings.hdr !== false,
        starGlow: settings.starGlow,
        catalogUrl: "shared/yale-bsc.json",
        lat: initLat,
        lon: initLon
      });
      if (settings.realSky === true) body.classList.add("real-sky-on");
    }

    if (webgpuCanvas && window.AIHubWebGPUStarfield) {
      webgpuStarfieldLayer = new window.AIHubWebGPUStarfield(webgpuCanvas, {
        enabled: settings.webgpuStars === true,
        hdr: settings.hdr !== false,
        starGlow: settings.starGlow,
        count: 12000
      });
      if (settings.webgpuStars === true) {
        const trySync = () => {
          if (webgpuStarfieldLayer && webgpuStarfieldLayer.supported) {
            body.classList.add("webgpu-stars-on");
            settings.webgpuStarsActive = true;
            if (starfieldInstance && starfieldInstance.settings) starfieldInstance.settings.webgpuStarsActive = true;
            if (warpSkyInstance && warpSkyInstance.settings) warpSkyInstance.settings.webgpuStarsActive = true;
            if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
            return;
          }
          if (webgpuStarfieldLayer && !webgpuStarfieldLayer.disposed) setTimeout(trySync, 120);
        };
        trySync();
      }
    }
  }

});

// ============================================================
// CanvasBloomLayer — copies the star canvas into a blurred screen overlay
// ============================================================
class CanvasBloomLayer {
  constructor(sourceCanvas, bloomCanvas, settings = {}) {
    this.sourceCanvas = sourceCanvas;
    this.canvas = bloomCanvas;
    this.ctx = aiHubGet2dContext(this.canvas, settings.hdr);
    this.wasEnabled = false;
    this._render = this._render.bind(this);
    window.addEventListener("resize", () => this._resize());
    this._resize();
    this.rafId = requestAnimationFrame(this._render);
  }

  _resize() {
    const w = this.sourceCanvas.width || window.innerWidth;
    const h = this.sourceCanvas.height || window.innerHeight;
    if (!w || !h) return;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  _isEnabled() {
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return !reducedMotion && document.body.classList.contains("bloom-on");
  }

  _render() {
    const enabled = this._isEnabled();
    if (enabled && this.sourceCanvas.width && this.sourceCanvas.height) {
      this._resize();
      this.ctx.globalAlpha = 1;
      this.ctx.globalCompositeOperation = "copy";
      this.ctx.drawImage(this.sourceCanvas, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.globalCompositeOperation = "source-over";
      this.wasEnabled = true;
    } else if (this.wasEnabled) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.wasEnabled = false;
    }
    this.rafId = requestAnimationFrame(this._render);
  }
}

// ============================================================
// Floating Dust
// ============================================================
class FloatingDust {
  constructor(enabled, hdrEnabled = true) {
    this.enabled = enabled;
    this.hdrEnabled = hdrEnabled !== false;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1";
    document.body.appendChild(this.canvas);
    this.ctx = aiHubGet2dContext(this.canvas, this.hdrEnabled);
    this.motes = [];
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._init();
    this._loop();
  }

  _resize() {
    this.w = this.canvas.width = window.innerWidth;
    this.h = this.canvas.height = window.innerHeight;
  }

  _init() {
    this.motes = [];
    for (let i = 0; i < 40; i++) {
      const alpha = Math.random() * 0.15 + 0.03;
      this.motes.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        size: Math.random() * 1.5 + 0.5,
        alpha,
        fill: aiHubCanvasColor(200, 220, 255, alpha, this.hdrEnabled),
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.1 - 0.05,
        drift: Math.random() * Math.PI * 2
      });
    }
  }

  updateHdr(enabled) {
    this.hdrEnabled = enabled !== false;
    this.ctx = aiHubGet2dContext(this.canvas, this.hdrEnabled);
    for (const mote of this.motes) {
      mote.fill = aiHubCanvasColor(200, 220, 255, mote.alpha, this.hdrEnabled);
    }
  }

  _loop() {
    if (!this.enabled) {
      this.ctx.clearRect(0, 0, this.w, this.h);
      requestAnimationFrame(() => this._loop());
      return;
    }
    const ctx = this.ctx;
    const TAU = Math.PI * 2;
    ctx.clearRect(0, 0, this.w, this.h);
    for (const m of this.motes) {
      m.drift += 0.003;
      m.x += m.vx + Math.sin(m.drift) * 0.08;
      m.y += m.vy;
      if (m.x < -10) m.x = this.w + 10;
      if (m.x > this.w + 10) m.x = -10;
      if (m.y < -10) m.y = this.h + 10;
      if (m.y > this.h + 10) m.y = -10;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, TAU);
      ctx.fillStyle = m.fill;
      ctx.fill();
    }
    requestAnimationFrame(() => this._loop());
  }
}

// ============================================================
// WarpField — Realistic flight through space
// Clean render each frame, proper line trails, no overlay blur
// ============================================================
class WarpField {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.hdrEnabled = options.hdr !== false;
    this.ctx = aiHubGet2dContext(canvas, this.hdrEnabled);
    this.starGlow = aiHubNormalizeStarGlow(options.starGlow);
    this.stars = [];
    this.starCount = 400;       // fewer stars = more realistic empty space
    this.speed = 0.18;
    this.baseSpeed = 0.18;      // center of speed breathing
    this.speedBreathRange = 0.04;
    this.width = 0;
    this.height = 0;
    this.cx = 0;
    this.cy = 0;
    this.stopped = false;
    this.maxDepth = 2000;
    this.focalLength = 400;
    this.time = 0;
    this.entryProgress = options.instant ? 1 : 0;
    this.nextClosePass = 300 + Math.random() * 600; // frames until next close star (10-20s at 60fps)
    this.blackHoleEnabled = options.blackHole === true;

    // Realistic star colors (spectral classes)
    this.starColors = [
      { r: 255, g: 255, b: 255 },   // white (A-class)
      { r: 255, g: 255, b: 255 },   // white
      { r: 255, g: 255, b: 255 },   // white (most common visually)
      { r: 220, g: 235, b: 255 },   // blue-white (B-class)
      { r: 200, g: 220, b: 255 },   // blue-white
      { r: 255, g: 245, b: 230 },   // warm white (F-class)
      { r: 255, g: 235, b: 200 },   // yellow-white (G-class, like Sun)
      { r: 255, g: 210, b: 170 },   // orange (K-class)
      { r: 180, g: 210, b: 255 },   // pale blue
    ];

    this._resizeTimer = null;
    this._onResize = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this._resize(), 150);
    };
    window.addEventListener("resize", this._onResize);
    this._resize();
    this._initStars();
    this._animate();
  }

  _resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.cx = this.width / 2;
    this.cy = this.height / 2;
    const minDim = Math.min(this.width, this.height);
    this.lensCenterX = this.width * 0.65;
    this.lensCenterY = this.height * 0.4;
    this.lensOrbitRX = this.width * 0.18;
    this.lensOrbitRY = this.height * 0.22;
    this.lensX = this.lensCenterX;
    this.lensY = this.lensCenterY;
    this.eventR = Math.max(18, minDim * 0.025);
    this.einsteinR = this.eventR * 2.6;
    this.lensStrength = minDim * 1.5;
  }

  _initStars() {
    this.stars = [];
    for (let i = 0; i < this.starCount; i++) {
      this.stars.push(this._makeStar(true));
    }
  }

  _makeStar(randomZ) {
    const color = this.starColors[Math.floor(Math.random() * this.starColors.length)];
    const spread = Math.max(this.width, this.height) * 1.5;
    return {
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread,
      z: randomZ ? Math.random() * this.maxDepth + 1 : this.maxDepth + Math.random() * 500,
      r: color.r, g: color.g, b: color.b,
      color: aiHubCanvasColor(color.r, color.g, color.b, 1, this.hdrEnabled),
      brightness: Math.random() * 0.5 + 0.5
    };
  }

  updateHdr(enabled) {
    this.hdrEnabled = enabled !== false;
    this.ctx = aiHubGet2dContext(this.canvas, this.hdrEnabled);
    for (const star of this.stars) {
      star.color = aiHubCanvasColor(star.r, star.g, star.b, 1, this.hdrEnabled);
    }
  }

  stop() {
    this.stopped = true;
    window.removeEventListener("resize", this._onResize);
  }

  _animate() {
    if (this.stopped) return;
    const ctx = this.ctx;
    const w = this.width, h = this.height;
    const fl = this.focalLength;
    const maxD = this.maxDepth;
    const TAU = Math.PI * 2;
    this.time++;

    // Gentle auto-drift: vanishing point orbits in small circle (~30px radius, ~60s period)
    const orbitR = 30;
    const orbitPeriod = 3600; // frames (~60s at 60fps)
    const cx = (this.width / 2) + Math.cos(this.time / orbitPeriod * TAU) * orbitR;
    const cy = (this.height / 2) + Math.sin(this.time / orbitPeriod * TAU * 0.7) * orbitR * 0.6;

    // Speed breathing: slow sine oscillation around baseSpeed
    this.entryProgress = Math.min(1, this.entryProgress + 0.014);
    const ramp = this.entryProgress * this.entryProgress * (3 - 2 * this.entryProgress);
    const cruiseSpeed = this.baseSpeed + Math.sin(this.time * 0.008) * this.speedBreathRange;
    this.speed = 0.035 + (cruiseSpeed - 0.035) * ramp;
    const spd = this.speed;
    const dz = spd * 5.2;  // z-movement per frame

    // Occasional close-pass bright star
    this.nextClosePass--;
    if (this.nextClosePass <= 0) {
      this.nextClosePass = 600 + Math.random() * 600; // 10-20s
      // Spawn a star very close with high brightness
      const color = this.starColors[Math.floor(Math.random() * this.starColors.length)];
      const spread = Math.max(w, h) * 0.8;
      this.stars.push({
        x: (Math.random() - 0.5) * spread,
        y: (Math.random() - 0.5) * spread,
        z: 80 + Math.random() * 120, // very close!
        r: color.r, g: color.g, b: color.b,
        color: aiHubCanvasColor(color.r, color.g, color.b, 1, this.hdrEnabled),
        brightness: 1.0
      });
    }

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);

    // Set line caps once
    ctx.lineCap = "round";

    // Black hole drift (slow elliptical orbit)
    const blackHoleOn = this.blackHoleEnabled;
    if (blackHoleOn) {
      const t = this.time * (Math.PI * 2 / 7200);
      this.lensX = this.lensCenterX + Math.cos(t) * this.lensOrbitRX;
      this.lensY = this.lensCenterY + Math.sin(t * 0.83) * this.lensOrbitRY;
    }
    const lx = this.lensX, ly = this.lensY;
    const eventR = this.eventR, eventR2 = eventR * eventR;
    const lensK = this.lensStrength;

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];

      // Previous z (before moving)
      const prevZ = star.z;

      // Move toward viewer
      star.z -= dz;

      // Reset if past viewer
      if (star.z <= 1) {
        Object.assign(star, this._makeStar(false));
        continue;
      }

      // Current projected position
      const k = fl / star.z;
      let sx = cx + star.x * k;
      let sy = cy + star.y * k;

      // Off-screen? Reset
      if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) {
        Object.assign(star, this._makeStar(false));
        continue;
      }

      // Previous projected position (where the star WAS last frame)
      const prevK = fl / prevZ;
      let prevSx = cx + star.x * prevK;
      let prevSy = cy + star.y * prevK;

      // Gravitational lens deflection
      if (blackHoleOn) {
        const ldx = sx - lx, ldy = sy - ly;
        const lr2 = ldx * ldx + ldy * ldy;
        if (lr2 < eventR2) continue;
        const lr = Math.sqrt(lr2);
        const defl = lensK / lr;
        sx += (ldx / lr) * defl;
        sy += (ldy / lr) * defl;
        const pldx = prevSx - lx, pldy = prevSy - ly;
        const plr = Math.sqrt(pldx * pldx + pldy * pldy);
        if (plr > 0) {
          const pdefl = lensK / plr;
          prevSx += (pldx / plr) * pdefl;
          prevSy += (pldy / plr) * pdefl;
        }
      }

      // Depth-based properties
      const depthRatio = 1 - star.z / maxD;
      const glow = aiHubNormalizeStarGlow(this.starGlow);
      const lift = Math.max(0, glow - 1);
      const brightRank = Math.min(1, Math.pow(Math.max(0, depthRatio), 2.2) * (0.65 + star.brightness * 0.55));
      const boost = 1 + lift * brightRank * 1.6;
      const alpha = Math.max(0, Math.min(1, depthRatio * 1.35 * boost)) * star.brightness;
      const size = Math.max(0.15, depthRatio * 1.8 * (0.95 + brightRank * lift * 0.45));

      if (alpha < 0.01) continue;  // too dim, skip

      // --- Draw streak (line from previous to current position) ---
      // This is physically correct: the star moved from prevPos to curPos in one frame
      const dx = sx - prevSx;
      const dy = sy - prevSy;
      const streakLen = Math.sqrt(dx * dx + dy * dy);

      // Gate by motion alone — the previous `spd > 0.12` happened to equal baseSpeed,
      // so trails flickered on/off with every breath cycle.
      if (streakLen > 0.25) {
        // Gradient: transparent at tail -> solid at head. Subtle so flying stars read with motion, not streaks.
        const tailScale = 1.5 + spd * 1.5;
        const tailX = sx - dx * tailScale;
        const tailY = sy - dy * tailScale;
        const grad = ctx.createLinearGradient(tailX, tailY, sx, sy);
        grad.addColorStop(0, aiHubCanvasColor(star.r, star.g, star.b, 0, this.hdrEnabled));
        grad.addColorStop(1, aiHubCanvasColor(star.r, star.g, star.b, Math.min(1, alpha * (0.58 + brightRank * 0.22)), this.hdrEnabled));

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(0.35, size * 0.8);
        ctx.stroke();
      }

      // --- Draw star point at head ---
      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, TAU);
      ctx.fill();

      // Subtle glow only for very close stars
      if (size > 1.3 && alpha > 0.5) {
        ctx.globalAlpha = Math.min(0.34, alpha * brightRank * 0.12 * boost);
        ctx.beginPath();
        ctx.arc(sx, sy, size * 3, 0, TAU);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;

    if (blackHoleOn) this._drawBlackHole(ctx);

    requestAnimationFrame(() => this._animate());
  }

  _drawBlackHole(ctx) {
    aiHubDrawBlackHole(ctx, this.lensX, this.lensY, this.eventR, this.einsteinR, this.hdrEnabled, this.time * 0.018);
  }
}

// ============================================================
// Starfield (static sky — ported from main extension)
// ============================================================
class Starfield {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings || {};
    this.settings.starGlow = aiHubNormalizeStarGlow(this.settings.starGlow);
    this.hdrEnabled = this.settings.hdr !== false;
    this.ctx = aiHubGet2dContext(canvas, this.hdrEnabled);
    this.stars = [];
    this.shootingStars = [];
    this.afterglows = [];
    this.deathParticles = [];
    this.nextShootTime = Date.now() + this._shootInterval();
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.mouseX = this.width / 2;
    this.mouseY = this.height / 2;
    this.shootingEnabled = settings.shooting;
    this.constellationsEnabled = settings.constellations;
    this.starCount = 4200;
    this.colors = aiHubStarPalette(this.hdrEnabled);
    this.constellations = [];
    this.nextConstellTime = Date.now() + 5000;
    this.fallenCount = 0;
    this.stopped = false;
    // Slow parallax drift
    this.driftAngle = Math.random() * Math.PI * 2;
    this.driftSpeed = 0.0003; // very slow rotation of drift direction
    this.frame = 0;

    this._resizeTimer = null;
    this._onResize = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this._resize(), 150);
    };
    window.addEventListener("resize", this._onResize);
    this._resize();
    this._animate();
  }

  stop() {
    this.stopped = true;
    window.removeEventListener("resize", this._onResize);
  }

  updateHdr(enabled) {
    this.hdrEnabled = enabled !== false;
    this.colors = aiHubStarPalette(this.hdrEnabled);
    for (const star of this.stars) {
      star.color = this.colors[Math.floor(Math.random() * this.colors.length)];
    }
  }

  _shootInterval(lastType) {
    if (lastType === 'shower')   return Math.random() * 6000 + 12000;
    if (lastType === 'fireball') return Math.random() * 4000 + 7000;
    if (lastType === 'burst')    return Math.random() * 3000 + 5000;
    return Math.random() * 2500 + 3000;
  }

  _pickScenario() {
    const r = Math.random() * 100;
    if (r < 52) return { count: 1, type: 'single' };
    if (r < 75) return { count: 2, type: 'pair' };
    if (r < 88) return { count: 3, type: 'burst' };
    if (r < 95) return { count: 1, type: 'fireball' };
    return { count: Math.floor(Math.random() * 3) + 4, type: 'shower' };
  }

  _spawnConstellation() {
    const bright = this.stars.filter(s => s.size > 0.8);
    if (bright.length < 4) return;
    const seed = bright[Math.floor(Math.random() * bright.length)];
    const sorted = bright
      .filter(s => s !== seed)
      .map(s => ({ s, d: Math.hypot(s.x - seed.x, s.y - seed.y) }))
      .filter(o => o.d < 250)
      .sort((a, b) => a.d - b.d)
      .slice(0, Math.floor(Math.random() * 3) + 2);
    if (sorted.length < 2) return;
    const nodes = [seed, ...sorted.map(o => o.s)];
    const lines = [];
    for (let i = 0; i < nodes.length - 1; i++) lines.push([nodes[i], nodes[i + 1]]);
    this.constellations.push({
      lines, alpha: 0, maxAlpha: 0.12, age: 0,
      fadeInFrames: 90, fadeOutFrames: 90,
      lifespan: Math.floor(Math.random() * 300) + 300
    });
  }

  _detachStar() {
    if (this.fallenCount >= 5) return null;
    const cx = this.width / 2, cy = this.height / 2;
    const candidates = [];
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      if (s.size < 0.5 || s.fadeIn > 0) continue;
      if (s.y > this.height * 0.6) continue;
      const dx = s.x - cx, dy = s.y - cy;
      if (dx * dx + dy * dy < 90000) continue;
      candidates.push(i);
    }
    if (candidates.length === 0) return null;
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    const star = this.stars[idx];
    const origin = { x: star.x, y: star.y };
    this.stars.splice(idx, 1);
    this.fallenCount++;
    const delay = Math.random() * 10000 + 5000;
    setTimeout(() => this._respawnStar(), delay);
    return origin;
  }

  _respawnStar() {
    const x = Math.random() * this.width;
    const y = Math.random() * this.height;
    if (this.settings.warpSkyOverlay === true) {
      const star = this._createWarpSkyStar(x, y);
      star.fadeIn = 180;
      star.fadeDuration = 180;
      this.stars.push(star);
      this.fallenCount--;
      return;
    }
    const r = Math.random();
    let minS, maxS, alpha;
    if (r < 0.4) { minS = 0.12; maxS = 0.26; alpha = 0.26; }
    else if (r < 0.83) { minS = 0.2; maxS = 0.42; alpha = 0.44; }
    else if (r < 0.99) { minS = 0.34; maxS = 0.62; alpha = 0.58; }
    else { minS = 0.78; maxS = 1.0; alpha = 0.78; }
    const star = new Star(x, y, minS, maxS, alpha, this.colors);
    star.fadeIn = 180;
    star.fadeDuration = 180;
    this.stars.push(star);
    this.fallenCount--;
  }

  _resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this._createStars();
    this.fallenCount = 0;
    // Black hole geometry — scales with viewport
    const minDim = Math.min(this.width, this.height);
    this.lensCenterX = this.width * 0.65;
    this.lensCenterY = this.height * 0.4;
    this.lensOrbitRX = this.width * 0.18;
    this.lensOrbitRY = this.height * 0.22;
    this.lensX = this.lensCenterX;
    this.lensY = this.lensCenterY;
    this.eventR = Math.max(18, minDim * 0.025);
    this.einsteinR = this.eventR * 2.6;
    this.lensStrength = minDim * 1.5;
  }

  _createStars() {
    this.stars = [];
    const n = this.starCount;
    if (this.settings.warpSkyOverlay === true) {
      this._generateLayer(Math.floor(n * 0.45), 0.09, 0.2, 0.16, false);
      this._generateLayer(Math.floor(n * 0.27), 0.18, 0.42, 0.26, true);
      this._generateLayer(Math.floor(n * 0.16), 0.38, 0.72, 0.38, true);
      this._generateLayer(Math.floor(n * 0.09), 0.65, 1.05, 0.52, false);
      this._generateLayer(Math.floor(n * 0.03), 1.0, 1.35, 0.68, false);
      return;
    }
    this._generateLayer(Math.floor(n * 0.4), 0.12, 0.26, 0.26, false);
    this._generateLayer(Math.floor(n * 0.01), 0.78, 1.0, 0.78, false);
    this._generateLayer(Math.floor(n * 0.16), 0.34, 0.62, 0.58, true);
    this._generateLayer(Math.floor(n * 0.43), 0.2, 0.42, 0.44, true);
  }

  _generateLayer(count, minSize, maxSize, alpha, cluster) {
    const clusters = [];
    for (let i = 0; i < 5; i++) clusters.push({ x: Math.random() * this.width, y: Math.random() * this.height });
    for (let i = 0; i < count; i++) {
      let x, y;
      if (cluster && Math.random() > 0.5) {
        const c = clusters[Math.floor(Math.random() * clusters.length)];
        const disp = Math.min(this.width, this.height) * 0.4;
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * disp;
        x = c.x + Math.cos(a) * d;
        y = c.y + Math.sin(a) * d;
      } else {
        x = Math.random() * this.width;
        y = Math.random() * this.height;
      }
      this.stars.push(new Star(x, y, minSize, maxSize, alpha, this.colors));
    }
  }

  _createWarpSkyStar(x, y) {
    const r = Math.random();
    if (r < 0.45) return new Star(x, y, 0.09, 0.2, 0.16, this.colors);
    if (r < 0.72) return new Star(x, y, 0.18, 0.42, 0.26, this.colors);
    if (r < 0.88) return new Star(x, y, 0.38, 0.72, 0.38, this.colors);
    if (r < 0.97) return new Star(x, y, 0.65, 1.05, 0.52, this.colors);
    return new Star(x, y, 1.0, 1.35, 0.68, this.colors);
  }

  _animate() {
    if (this.stopped) return;
    const ctx = this.ctx;
    const overlay = this.settings.warpSkyOverlay === true;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!overlay) this._drawDeepSpace(ctx);
    const now = Date.now();
    this.frame++;

    // Slow parallax drift — different speeds per star size (depth)
    this.driftAngle += this.driftSpeed;
    const baseDX = Math.cos(this.driftAngle) * 0.015;
    const baseDY = Math.sin(this.driftAngle) * 0.01;
    for (const star of this.stars) {
      // Larger stars = closer = drift faster (parallax)
      const depthFactor = 0.3 + star.size * 0.7;
      star.x += baseDX * depthFactor;
      star.y += baseDY * depthFactor;
      // Wrap around screen edges with padding
      if (star.x < -5) star.x += this.width + 10;
      if (star.x > this.width + 5) star.x -= this.width + 10;
      if (star.y < -5) star.y += this.height + 10;
      if (star.y > this.height + 5) star.y -= this.height + 10;
    }

    // Shooting stars
    if (this.shootingEnabled && now >= this.nextShootTime) {
      const scenario = this._pickScenario();
      const stagger = scenario.type === 'shower' ? 120 :
                      scenario.type === 'burst'  ? 250 :
                      scenario.type === 'pair'   ? 350 : 0;
      for (let i = 0; i < scenario.count; i++) {
        setTimeout(() => {
          if (!this.shootingEnabled || this.stopped) return;
          let origin = null;
          if ((scenario.type === 'single' || scenario.type === 'pair') && Math.random() < 0.35) {
            origin = this._detachStar();
            if (origin) {
              for (let k = 0; k < 3; k++) this.deathParticles.push(new DeathParticle(origin.x, origin.y, 'detach'));
            }
          }
          this.shootingStars.push(new ShootingStar(this.width, this.height, scenario.type, origin));
        }, i * (Math.random() * stagger + 60));
      }
      this.nextShootTime = now + this._shootInterval(scenario.type);
    }

    // Constellations
    if (this.constellationsEnabled) {
      if (now >= this.nextConstellTime && this.constellations.length < 2) {
        this._spawnConstellation();
        this.nextConstellTime = now + Math.random() * 15000 + 10000;
      }
      let ci = this.constellations.length;
      while (ci--) { if (this.constellations[ci].age >= this.constellations[ci].lifespan) this.constellations.splice(ci, 1); }
      for (const c of this.constellations) {
        c.age++;
        if (c.age < c.fadeInFrames) c.alpha = (c.age / c.fadeInFrames) * c.maxAlpha;
        else if (c.age > c.lifespan - c.fadeOutFrames) c.alpha = ((c.lifespan - c.age) / c.fadeOutFrames) * c.maxAlpha;
        else c.alpha = c.maxAlpha;
        ctx.save();
        ctx.strokeStyle = aiHubCanvasColor(147, 197, 253, c.alpha, this.hdrEnabled);
        ctx.lineWidth = 0.5;
        for (const [a, b] of c.lines) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Black hole drift (slow elliptical orbit)
    const blackHoleOn = !overlay && this.settings.blackHole === true;
    if (blackHoleOn) {
      const t = this.frame * (Math.PI * 2 / 7200);
      this.lensX = this.lensCenterX + Math.cos(t) * this.lensOrbitRX;
      this.lensY = this.lensCenterY + Math.sin(t * 0.83) * this.lensOrbitRY;
    }
    const lx = this.lensX, ly = this.lensY;
    const eventR = this.eventR, eventR2 = eventR * eventR;
    const lensK = this.lensStrength;

    // Stars with cursor repulsion (+ optional gravitational lens deflection)
    const repulseR = overlay ? 0 : 50, repulseR2 = repulseR * repulseR;
    const mx = this.mouseX, my = this.mouseY;
    const TAU = Math.PI * 2;
    const drawCanvasStars = overlay || !(this.settings.threeStars !== false && this.settings.cosmicDepth !== false && window.THREE);
    const bloomOn = !overlay && this.settings.bloom !== false;
    const starGlow = aiHubNormalizeStarGlow(this.settings.starGlow);

    for (const star of this.stars) {
      star.update();
      if (!drawCanvasStars) continue;
      if (!overlay && star.hasShadow) continue;
      const dx = star.x - mx, dy = star.y - my;
      const dist2 = dx * dx + dy * dy;
      let sx = star.x, sy = star.y;
      if (dist2 < repulseR2 && dist2 > 0) {
        const dist = Math.sqrt(dist2);
        sx += (dx / dist) * (1 - dist / repulseR) * 8;
        sy += (dy / dist) * (1 - dist / repulseR) * 8;
      }
      if (blackHoleOn) {
        const ldx = sx - lx, ldy = sy - ly;
        const lr2 = ldx * ldx + ldy * ldy;
        if (lr2 < eventR2) continue;
        const lr = Math.sqrt(lr2);
        const defl = lensK / lr;
        sx += (ldx / lr) * defl;
        sy += (ldy / lr) * defl;
      }
      const rank = typeof star.luminosity === "number" ? star.luminosity : aiHubStarRankFromSize(star.size);
      const overlayDepth = overlay ? 0.72 + rank * 0.28 : 1;
      const alphaBoost = overlay ? overlayDepth : aiHubGlowBoost(starGlow, rank, 0.18);
      const radius = overlay ? Math.min(1.7, Math.max(0.1, star.size * (0.95 + rank * 0.5))) : star.size;
      ctx.fillStyle = star.color;
      if (overlay && rank > 0.36) {
        ctx.globalAlpha = Math.min(0.16, star.alpha * rank * 0.2);
        ctx.beginPath();
        ctx.arc(sx, sy, radius * (1.7 + rank * 0.7), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = Math.min(1, star.alpha * alphaBoost);
      ctx.beginPath(); ctx.arc(sx, sy, radius, 0, TAU); ctx.fill();
    }

    if (drawCanvasStars && !overlay) {
      ctx.save();
      ctx.shadowBlur = bloomOn ? 4 : 3;
      ctx.shadowColor = bloomOn
        ? aiHubCanvasColor(210, 230, 255, 0.35, this.hdrEnabled)
        : aiHubCanvasColor(255, 255, 255, 0.42, this.hdrEnabled);
      for (const star of this.stars) {
        if (!star.hasShadow) continue;
        const dx = star.x - mx, dy = star.y - my;
        const dist2 = dx * dx + dy * dy;
        let sx = star.x, sy = star.y;
        if (dist2 < repulseR2 && dist2 > 0) {
          const dist = Math.sqrt(dist2);
          sx += (dx / dist) * (1 - dist / repulseR) * 8;
          sy += (dy / dist) * (1 - dist / repulseR) * 8;
        }
        if (blackHoleOn) {
          const ldx = sx - lx, ldy = sy - ly;
          const lr2 = ldx * ldx + ldy * ldy;
          if (lr2 < eventR2) continue;
          const lr = Math.sqrt(lr2);
          const defl = lensK / lr;
          sx += (ldx / lr) * defl;
          sy += (ldy / lr) * defl;
        }
        const rank = typeof star.luminosity === "number" ? star.luminosity : aiHubStarRankFromSize(star.size);
        const boost = aiHubGlowBoost(starGlow, rank, 1.45);
        ctx.shadowBlur = bloomOn ? 4 + rank * (8 + starGlow * 5) : 3;
        ctx.shadowColor = bloomOn
          ? aiHubCanvasColor(210, 230, 255, 0.35 + rank * 0.55, this.hdrEnabled)
          : aiHubCanvasColor(255, 255, 255, 0.42, this.hdrEnabled);
        if (bloomOn) {
          const haloR = Math.max(4, star.size * (8 + rank * (12 + starGlow * 5)));
          const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, haloR);
          const haloA = Math.min(0.9, star.alpha * rank * 0.38 * boost);
          halo.addColorStop(0, aiHubCanvasColor(255, 255, 255, Math.min(0.95, haloA * 1.6), this.hdrEnabled));
          halo.addColorStop(0.10, aiHubCanvasColor(255, 255, 255, haloA * 0.85, this.hdrEnabled));
          halo.addColorStop(0.40, aiHubCanvasColor(150, 205, 255, haloA * 0.18, this.hdrEnabled));
          halo.addColorStop(1, aiHubCanvasColor(150, 205, 255, 0, this.hdrEnabled));
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = 1;
          ctx.fillStyle = halo;
          ctx.beginPath(); ctx.arc(sx, sy, haloR, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.globalAlpha = Math.min(1, star.alpha * (0.92 + rank * (boost - 1)));
        ctx.fillStyle = star.color;
        ctx.beginPath(); ctx.arc(sx, sy, star.size, 0, TAU); ctx.fill();
        const coreR = Math.max(0.7, star.size * 0.55);
        ctx.globalAlpha = Math.min(1, star.alpha * (0.78 + rank * 0.45));
        ctx.fillStyle = aiHubCanvasColor(255, 255, 255, 1, this.hdrEnabled);
        ctx.beginPath(); ctx.arc(sx, sy, coreR, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (blackHoleOn) this._drawBlackHole(ctx);

    // Shooting stars
    let i = this.shootingStars.length;
    while (i--) {
      const s = this.shootingStars[i];
      s.update();
      if (s.dead) {
        const cnt = s.type === 'fireball' ? 12 : 5;
        for (let j = 0; j < cnt; j++) this.deathParticles.push(new DeathParticle(s.x, s.y, s.type));
        if (s.type === 'fireball') {
          this.afterglows.push({ x1: s.tailX, y1: s.tailY, x2: s.x, y2: s.y, alpha: 0.3, decay: 0.003 });
        }
        this.shootingStars.splice(i, 1);
      } else {
        s.draw(ctx, this.hdrEnabled);
      }
    }

    // Afterglows
    i = this.afterglows.length;
    while (i--) {
      const a = this.afterglows[i];
      a.alpha -= a.decay;
      if (a.alpha <= 0.01) { this.afterglows.splice(i, 1); continue; }
      ctx.save();
      ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2);
      ctx.strokeStyle = aiHubCanvasColor(255, 200, 100, a.alpha, this.hdrEnabled);
      ctx.lineWidth = 1; ctx.lineCap = "round"; ctx.stroke();
      ctx.restore();
    }

    // Death particles
    i = this.deathParticles.length;
    while (i--) {
      const p = this.deathParticles[i];
      p.update();
      if (p.alpha <= 0.01) { this.deathParticles.splice(i, 1); continue; }
      p.draw(ctx, this.hdrEnabled);
    }

    requestAnimationFrame(() => this._animate());
  }

  _drawDeepSpace(ctx) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.width, this.height);
  }

  _drawBlackHole(ctx) {
    aiHubDrawBlackHole(ctx, this.lensX, this.lensY, this.eventR, this.einsteinR, this.hdrEnabled, this.frame * 0.018);
  }
}

// ============================================================
// Star
// ============================================================
class Star {
  constructor(x, y, minSize, maxSize, baseAlpha, colors) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * (maxSize - minSize) + minSize;
    this.baseAlpha = baseAlpha;
    this.alpha = baseAlpha * (Math.random() * 0.4 + 0.6);
    this.alphaChange = (Math.random() - 0.5) * 0.005;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.luminosity = aiHubStarRankFromSize(this.size);
    this.hasShadow = this.luminosity > 0.48;
    this.minAlpha = baseAlpha * 0.4;
    this.maxAlpha = Math.min(1, baseAlpha * 1.3);
    this.fadeIn = 0;
    this.fadeDuration = 0;
  }

  update() {
    this.alpha += this.alphaChange;
    if (this.alpha <= this.minAlpha) { this.alpha = this.minAlpha; this.alphaChange = Math.abs(this.alphaChange); }
    else if (this.alpha >= this.maxAlpha) { this.alpha = this.maxAlpha; this.alphaChange = -Math.abs(this.alphaChange); }
    if (this.fadeIn > 0) {
      this.alpha *= (1 - this.fadeIn / this.fadeDuration);
      this.fadeIn--;
    }
  }
}

// ============================================================
// ShootingStar
// ============================================================
class ShootingStar {
  constructor(width, height, type = 'single', origin = null) {
    this.width = width;
    this.height = height;
    this.type = type;

    if (origin) {
      this.x = origin.x;
      this.y = origin.y;
    } else {
      this.x = Math.random() * width * 1.2 - width * 0.1;
      this.y = Math.random() * height * 0.38 - 20;
    }

    const angleMin = type === 'shower' ? 32 : (origin ? 35 : 22);
    const angleMax = type === 'shower' ? 46 : (origin ? 55 : 58);
    const angle = (Math.random() * (angleMax - angleMin) + angleMin) * Math.PI / 180;

    if (type === 'fireball') {
      const speed = Math.random() * 8 + 14;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.trailLen = Math.random() * 160 + 200;
      this.size = Math.random() * 1.2 + 2.2;
      this.fadeSpeed = Math.random() * 0.005 + 0.004;
    } else if (type === 'shower') {
      const speed = Math.random() * 7 + 9;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.trailLen = Math.random() * 70 + 50;
      this.size = Math.random() * 0.7 + 0.4;
      this.fadeSpeed = Math.random() * 0.015 + 0.012;
    } else {
      const speed = Math.random() * 9 + 7;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.trailLen = origin ? Math.random() * 80 + 50 : Math.random() * 130 + 70;
      this.size = origin ? Math.random() * 0.8 + 0.5 : Math.random() * 1.2 + 0.5;
      this.fadeSpeed = Math.random() * 0.012 + 0.008;
    }

    this.alpha = 0;
    this.fadeIn = true;
    this.dead = false;
    this.tailX = this.x;
    this.tailY = this.y;
    this.traveled = 0;
    this.speed = Math.hypot(this.vx, this.vy);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.traveled += this.speed;
    if (this.traveled > this.trailLen) {
      this.tailX += this.vx;
      this.tailY += this.vy;
    }
    if (this.fadeIn) {
      this.alpha = Math.min(1, this.alpha + 0.08);
      if (this.alpha >= 1) this.fadeIn = false;
    } else {
      this.alpha -= this.fadeSpeed;
    }
    if (this.alpha <= 0 || this.x > this.width + 150 || this.y > this.height + 150) {
      this.dead = true;
    }
  }

  draw(ctx, hdrEnabled = true) {
    if (this.alpha <= 0) return;
    const fb = this.type === 'fireball';
    const grad = ctx.createLinearGradient(this.tailX, this.tailY, this.x, this.y);
    grad.addColorStop(0, aiHubCanvasColor(255, 255, 255, 0, hdrEnabled));
    grad.addColorStop(0.55, fb
      ? aiHubCanvasColor(255, 230, 180, this.alpha * 0.5, hdrEnabled)
      : aiHubCanvasColor(200, 225, 255, this.alpha * 0.35, hdrEnabled));
    grad.addColorStop(1, fb
      ? aiHubCanvasColor(255, 245, 220, this.alpha, hdrEnabled)
      : aiHubCanvasColor(255, 255, 255, this.alpha, hdrEnabled));
    ctx.save();
    ctx.beginPath(); ctx.moveTo(this.tailX, this.tailY); ctx.lineTo(this.x, this.y);
    ctx.strokeStyle = grad; ctx.lineWidth = this.size; ctx.lineCap = "round"; ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * (fb ? 2.5 : 1.8), 0, Math.PI * 2);
    ctx.fillStyle = fb
      ? aiHubCanvasColor(255, 240, 200, this.alpha * 0.85, hdrEnabled)
      : aiHubCanvasColor(255, 255, 255, this.alpha * 0.7, hdrEnabled);
    ctx.shadowBlur = fb ? 18 : 8;
    ctx.shadowColor = fb
      ? aiHubCanvasColor(255, 200, 100, this.alpha, hdrEnabled)
      : aiHubCanvasColor(180, 215, 255, this.alpha, hdrEnabled);
    ctx.fill();
    ctx.restore();
  }
}

// ============================================================
// DeathParticle
// ============================================================
class DeathParticle {
  constructor(x, y, parentType) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    this.isFireball = parentType === 'fireball';
    this.isDetach = parentType === 'detach';
    if (this.isDetach) {
      const speed = Math.random() * 0.8 + 0.2;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.alpha = 0.7;
      this.decay = Math.random() * 0.015 + 0.01;
      this.size = Math.random() * 0.6 + 0.3;
    } else {
      const speed = Math.random() * 2 + 0.5;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.alpha = this.isFireball ? 0.9 : 0.6;
      this.decay = Math.random() * 0.02 + 0.015;
      this.size = this.isFireball ? Math.random() * 1.5 + 0.8 : Math.random() * 0.8 + 0.3;
    }
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.03;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.alpha -= this.decay;
  }

  draw(ctx, hdrEnabled = true) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    if (this.isDetach) {
      ctx.fillStyle = aiHubCanvasColor(220, 235, 255, this.alpha, hdrEnabled);
      ctx.shadowBlur = 4;
      ctx.shadowColor = aiHubCanvasColor(200, 220, 255, this.alpha, hdrEnabled);
    } else if (this.isFireball) {
      ctx.fillStyle = aiHubCanvasColor(255, 220, 130, this.alpha, hdrEnabled);
      ctx.shadowBlur = 6;
      ctx.shadowColor = aiHubCanvasColor(255, 180, 80, this.alpha, hdrEnabled);
    } else {
      ctx.fillStyle = aiHubCanvasColor(200, 220, 255, this.alpha, hdrEnabled);
      ctx.shadowBlur = 3;
      ctx.shadowColor = aiHubCanvasColor(180, 210, 255, this.alpha, hdrEnabled);
    }
    ctx.fill();
    ctx.restore();
  }
}
