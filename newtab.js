// AI New Tab - Starfield & Logic

const STAR_FLIGHT_SPEED_DEFAULT = 9;
const STAR_FLIGHT_SPEED_MIN = 1;
const STAR_FLIGHT_SPEED_MAX = 15;
const STAR_FLIGHT_STAR_COUNT_DEFAULT = 520;
const STAR_FLIGHT_STAR_COUNT_MIN = 100;
const STAR_FLIGHT_STAR_COUNT_MAX = 2000;
const WARP_SKY_STAR_COUNT_RATIO = 1.8;
const WARP_SKY_STAR_COUNT_MIN = 180;
const WARP_SKY_STAR_COUNT_MAX = 3600;

function normalizeFlightSpeed(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return STAR_FLIGHT_SPEED_DEFAULT;
  return Math.min(STAR_FLIGHT_SPEED_MAX, Math.max(STAR_FLIGHT_SPEED_MIN, n));
}

function formatFlightSpeed(value) {
  return `${normalizeFlightSpeed(value).toFixed(1).replace(/\.0$/, "")}x`;
}

function normalizeFlightStarCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return STAR_FLIGHT_STAR_COUNT_DEFAULT;
  return Math.min(STAR_FLIGHT_STAR_COUNT_MAX, Math.max(STAR_FLIGHT_STAR_COUNT_MIN, Math.round(n)));
}

function normalizeWarpSkyStarCount(value) {
  const base = normalizeFlightStarCount(value);
  return Math.min(WARP_SKY_STAR_COUNT_MAX, Math.max(WARP_SKY_STAR_COUNT_MIN, Math.round(base * WARP_SKY_STAR_COUNT_RATIO)));
}

document.addEventListener("DOMContentLoaded", () => {
  // ===== Settings =====
  const AI_TOOLS = [
    { id: "chatgpt",    label: "ChatGPT",    visible: true },
    { id: "gemini",     label: "Gemini",     visible: true },
    { id: "claude",     label: "Claude",     visible: true },
    { id: "perplexity", label: "Perplexity", visible: false },
    { id: "grok",       label: "Grok",       visible: false },
    { id: "qwen",       label: "Qwen",       visible: false },
    { id: "deepseek",   label: "DeepSeek",   visible: false },
    { id: "copilot",    label: "Copilot",    visible: false },
    { id: "mistral",    label: "Mistral",    visible: false }
  ];

  const AI_TOOL_DEFAULTS = Object.fromEntries(AI_TOOLS.map(tool => [tool.id, tool.visible]));
  const SHORTCUT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const NEWTAB_STARRY_RESTORE_KEY = "aiHubStarryRestoreV1";

  const SETTINGS_DEFAULTS = {
    aurora: true,
    constellations: true,
    dust: true,
    shooting: true,
    shootingSpeed: 1.0,
    flightSpeed: STAR_FLIGHT_SPEED_DEFAULT,
    flightStarCount: STAR_FLIGHT_STAR_COUNT_DEFAULT,
    flightForeground: true,
    nebula: true,
    warp: false,
    cosmicDepth: true,
    threeStars: true,
    hdr: true,
    bloom: true,
    planet: true,
    cursorLens: true,
    realSky: false,
    realSkyLat: null,
    realSkyLon: null,
    webgpuStars: false,
    workerStarfield: false,
    audioReactive: false,
    audioSource: "mic",
    acrylic: true,
    refraction: true,
    rain: false,
    scale: 1,
    clockOffsetY: 0,
    clockBloom: 1,
    bgDim: 0,
    starGlow: 1.7,
    searchWidth: 460,
    aiTools: { ...AI_TOOL_DEFAULTS },
    customTools: []
  };

  function normalizeAiTools(value) {
    const normalized = {
      ...AI_TOOL_DEFAULTS,
      ...(value && typeof value === "object" ? value : {})
    };
    if (!AI_TOOLS.some(tool => normalized[tool.id] !== false)) {
      const firstDefault = AI_TOOLS.find(tool => tool.visible) || AI_TOOLS[0];
      if (firstDefault) normalized[firstDefault.id] = true;
    }
    return normalized;
  }

  function normalizeUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(withScheme);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function normalizeCustomTools(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((tool, index) => {
        const name = String(tool && tool.name || "").trim().slice(0, 24);
        const url = normalizeUrl(tool && tool.url);
        if (!name || !url) return null;
        return {
          id: String(tool.id || `custom-${Date.now()}-${index}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48),
          name,
          url
        };
      })
      .filter(Boolean)
      .slice(0, 6);
  }

  function getDefaultSettings() {
    return {
      ...SETTINGS_DEFAULTS,
      aiTools: { ...AI_TOOL_DEFAULTS },
      customTools: []
    };
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem("aiHubSettings"));
      const merged = { ...getDefaultSettings(), ...(saved && typeof saved === "object" ? saved : {}) };
      if (!saved || saved.starGlow === undefined || Number(saved.starGlow) === 1.35 || Number(saved.starGlow) === 2) {
        merged.starGlow = SETTINGS_DEFAULTS.starGlow;
      }
      if (localStorage.getItem(NEWTAB_STARRY_RESTORE_KEY) !== "done") {
        merged.warp = false;
        merged.realSky = false;
        merged.webgpuStars = false;
        merged.workerStarfield = false;
        merged.starGlow = SETTINGS_DEFAULTS.starGlow;
        localStorage.setItem(NEWTAB_STARRY_RESTORE_KEY, "done");
      }
      merged.audioReactive = false;
      merged.webgpuStarsActive = false;
      merged.workerStarfieldActive = false;
      merged.aiTools = normalizeAiTools(saved && saved.aiTools);
      merged.customTools = normalizeCustomTools(saved && saved.customTools);
      return merged;
    } catch { return getDefaultSettings(); }
  }

  function saveSettings(s) {
    localStorage.setItem("aiHubSettings", JSON.stringify(s));
  }

  function normalizeScale(value) {
    const scale = Number(value);
    if (!Number.isFinite(scale)) return SETTINGS_DEFAULTS.scale;
    return Math.min(1.15, Math.max(0.5, scale));
  }

  function normalizeClockOffsetY(value) {
    const offset = Number(value);
    if (!Number.isFinite(offset)) return SETTINGS_DEFAULTS.clockOffsetY;
    return Math.min(260, Math.max(-260, Math.round(offset)));
  }

  function normalizeClockBloom(value) {
    const bloom = Number(value);
    if (!Number.isFinite(bloom)) return SETTINGS_DEFAULTS.clockBloom;
    return Math.min(2, Math.max(0, bloom));
  }

  function formatCssNumber(value, digits = 3) {
    return String(Number(value.toFixed(digits)));
  }

  function applyUiScale(value) {
    const scale = normalizeScale(value);
    document.documentElement.style.setProperty("--ui-scale", String(scale));
    return scale;
  }

  function applyClockOffsetY(value) {
    const offset = normalizeClockOffsetY(value);
    document.documentElement.style.setProperty("--clock-offset-y", `${offset}px`);
    return offset;
  }

  function formatClockOffsetY(value) {
    const offset = normalizeClockOffsetY(value);
    return `${offset > 0 ? "+" : ""}${offset}px`;
  }

  function applyClockBloom(value) {
    const bloom = normalizeClockBloom(value);
    const style = document.documentElement.style;
    const setPx = (name, base) => style.setProperty(name, `${formatCssNumber(base * bloom, 1)}px`);
    const setAlpha = (name, base) => style.setProperty(name, formatCssNumber(Math.min(0.95, base * bloom)));

    style.setProperty("--clock-bloom", formatCssNumber(bloom, 2));
    setPx("--clock-bloom-filter-radius-1", 5);
    setPx("--clock-bloom-filter-radius-2", 16);
    setPx("--clock-bloom-filter-radius-3", 34);
    setAlpha("--clock-bloom-filter-alpha-1", 0.44);
    setAlpha("--clock-bloom-filter-alpha-2", 0.28);
    setAlpha("--clock-bloom-filter-alpha-3", 0.14);
    setPx("--clock-bloom-text-radius-1", 5);
    setPx("--clock-bloom-text-radius-2", 14);
    setPx("--clock-bloom-text-radius-3", 34);
    setAlpha("--clock-bloom-text-alpha-1", 0.36);
    setAlpha("--clock-bloom-text-alpha-2", 0.28);
    setAlpha("--clock-bloom-text-alpha-3", 0.12);
    setPx("--clock-bloom-text-peak-radius-1", 7);
    setPx("--clock-bloom-text-peak-radius-2", 20);
    setPx("--clock-bloom-text-peak-radius-3", 46);
    setAlpha("--clock-bloom-text-peak-alpha-1", 0.52);
    setAlpha("--clock-bloom-text-peak-alpha-2", 0.38);
    setAlpha("--clock-bloom-text-peak-alpha-3", 0.18);
    return bloom;
  }

  function formatClockBloom(value) {
    return `${Math.round(normalizeClockBloom(value) * 100)}%`;
  }

  const settings = loadSettings();
  settings.scale = applyUiScale(settings.scale);
  settings.clockOffsetY = applyClockOffsetY(settings.clockOffsetY);
  settings.clockBloom = applyClockBloom(settings.clockBloom);
  const body = document.body;
  const toastEl = document.getElementById("focus-toast");
  let toastTimer = null;

  function releaseInitialPaint() {
    requestAnimationFrame(() => {
      if (typeof window.aiHubReleaseBoot === "function") {
        window.aiHubReleaseBoot();
        return;
      }
      document.documentElement.classList.remove("aihub-booting");
      document.documentElement.classList.add("aihub-ready");
    });
  }

  function showToast(text, duration = 3200) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("visible"), duration);
  }

  // Apply initial settings
  if (!settings.nebula) body.classList.add("no-nebula");
  if (!settings.acrylic) body.classList.add("no-acrylic");
  if (settings.warp) body.classList.add("warp-mode");
  if (settings.rain) body.classList.add("rain-enabled");
  body.classList.toggle("hdr-on", settings.hdr !== false);
  aiHubSetCanvasBloomEnabled(settings.bloom !== false);
  const auroraEl = document.getElementById("aurora");
  if (!settings.aurora && auroraEl) auroraEl.classList.add("hidden");

  // Settings panel
  const settingsPanel = document.getElementById("settings-panel");
  const toggleSettingsBtn = document.getElementById("toggle-settings");
  if (settingsPanel) settingsPanel.classList.add("hidden");

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
      `<span class="hdr-key">glow:</span> ${Math.round(aiHubNormalizeStarGlow(settings.starGlow) * 100)}%`;
  }

  if (toggleSettingsBtn && settingsPanel) {
    toggleSettingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsPanel.classList.toggle("hidden");
      if (!settingsPanel.classList.contains("hidden")) updateHdrDebug();
    });
    // Close settings when clicking outside
    settingsPanel.addEventListener("click", e => e.stopPropagation());
    document.addEventListener("click", () => {
      if (!settingsPanel.classList.contains("hidden")) {
        settingsPanel.classList.add("hidden");
      }
    });
  }

  // ===== Search Bar =====
  const SEARCH_ENGINES = [
    { id: "google",     label: "Google",     url: "https://www.google.com/search?q=", iconId: "search-icon-google",     color: "#4285F4" },
    { id: "youtube",    label: "YouTube",    url: "https://www.youtube.com/results?search_query=", iconId: "search-icon-youtube", color: "#ff3333" },
    { id: "duckduckgo", label: "DuckDuckGo", url: "https://duckduckgo.com/?q=", iconId: "search-icon-duckduckgo", color: "#de5833" }
  ];
  let searchEngineIndex = parseInt(localStorage.getItem("aiHubSearchEngine") || "0", 10);
  if (searchEngineIndex < 0 || searchEngineIndex >= SEARCH_ENGINES.length) searchEngineIndex = 0;

  const searchForm      = document.getElementById("search-form");
  const searchInput     = document.getElementById("search-input");
  const searchClear     = document.getElementById("search-clear");
  const searchEngineBtn = document.getElementById("search-engine-btn");
  const searchBtn       = document.getElementById("search-btn");
  const searchOpensEl   = document.getElementById("search-opens");
  const calcChip        = document.getElementById("search-calc");
  const calcValueEl     = document.getElementById("search-calc-value");
  const SEARCH_HISTORY_KEY = "aiHubSearchHistory";
  const SEARCH_COMMANDS = {
    g: "google",
    google: "google",
    yt: "youtube",
    y: "youtube",
    youtube: "youtube",
    ddg: "duckduckgo",
    duck: "duckduckgo",
    d: "duckduckgo"
  };

  let searchHistoryPanel = null;
  if (searchForm && searchForm.parentElement) {
    searchHistoryPanel = document.createElement("div");
    searchHistoryPanel.className = "search-history-panel";
    searchHistoryPanel.setAttribute("aria-hidden", "true");
    searchForm.parentElement.appendChild(searchHistoryPanel);
  }

  // ===== Inline Calculator =====
  // Allowed input: digits, operators (+ - * / ^ %), parens, dots/commas, spaces.
  // No eval/Function: Chrome extension pages block string evaluation by CSP.
  // Requires at least one operator beyond the first character.
  function tryEvalMath(input) {
    const s = (input || "").trim().replace(/(\d),(\d)/g, "$1.$2");
    if (!s) return null;
    if (!/[+\-*/^%]/.test(s.slice(1))) return null;
    if (s.length > 140) return null;
    if (!/^[\d+\-*/^%().,\s]+$/.test(s)) return null;

    let pos = 0;
    const peek = () => s[pos];
    const skipSpaces = () => {
      while (/\s/.test(peek())) pos++;
    };
    const consume = (ch) => {
      skipSpaces();
      if (s[pos] !== ch) return false;
      pos++;
      return true;
    };
    const shouldUsePostfixPercent = () => {
      let i = pos + 1;
      while (/\s/.test(s[i])) i++;
      return i >= s.length || "+-*/^%)".includes(s[i]);
    };
    const makeValue = (value, percent = false) => ({ value, percent });

    function parseNumber() {
      skipSpaces();
      const start = pos;
      let seenDigit = false;
      let seenDot = false;
      while (pos < s.length) {
        const ch = s[pos];
        if (ch >= "0" && ch <= "9") {
          seenDigit = true;
          pos++;
        } else if (ch === "." && !seenDot) {
          seenDot = true;
          pos++;
        } else {
          break;
        }
      }
      if (!seenDigit) throw new Error("Expected number");
      return makeValue(Number(s.slice(start, pos)));
    }

    function parsePrimary() {
      skipSpaces();
      let value;
      if (consume("(")) {
        value = parseExpression();
        if (!consume(")")) throw new Error("Expected closing paren");
      } else {
        value = parseNumber();
      }
      while (true) {
        const beforePercent = pos;
        skipSpaces();
        if (s[pos] !== "%" || !shouldUsePostfixPercent()) {
          pos = beforePercent;
          break;
        }
        pos++;
        value = makeValue(value.value / 100, true);
      }
      return value;
    }

    function parseSignedPower() {
      skipSpaces();
      if (consume("+")) return parseSignedPower();
      if (consume("-")) {
        const value = parseSignedPower();
        return makeValue(-value.value, value.percent);
      }
      return parsePower();
    }

    function parsePower() {
      let left = parsePrimary();
      skipSpaces();
      if (consume("^")) {
        left = makeValue(left.value ** parseSignedPower().value);
      } else if (s[pos] === "*" && s[pos + 1] === "*") {
        pos += 2;
        left = makeValue(left.value ** parseSignedPower().value);
      }
      return left;
    }

    function parseTerm() {
      let left = parseSignedPower();
      while (true) {
        skipSpaces();
        if (s[pos] === "*" && s[pos + 1] === "*") break;
        if (consume("*")) {
          left = makeValue(left.value * parseSignedPower().value);
        } else if (consume("/")) {
          left = makeValue(left.value / parseSignedPower().value);
        } else if (consume("%")) {
          left = makeValue(left.value % parseSignedPower().value);
        } else {
          break;
        }
      }
      return left;
    }

    function parseExpression() {
      let left = parseTerm();
      while (true) {
        if (consume("+")) {
          const right = parseTerm();
          left = makeValue(left.value + (right.percent ? left.value * right.value : right.value));
        } else if (consume("-")) {
          const right = parseTerm();
          left = makeValue(left.value - (right.percent ? left.value * right.value : right.value));
        } else {
          break;
        }
      }
      return left;
    }

    try {
      const result = parseExpression();
      skipSpaces();
      if (pos !== s.length) return null;
      if (!Number.isFinite(result.value)) return null;
      return result.value;
    } catch {
      return null;
    }
  }
  function formatMathResult(n) {
    if (Number.isInteger(n)) return String(n);
    return String(Number(n.toFixed(8)));
  }
  function getFormattedMathResult(input) {
    const result = tryEvalMath(input);
    return result === null ? null : formatMathResult(result);
  }
  function updateCalc() {
    if (!calcChip || !searchInput) return;
    const formatted = getFormattedMathResult(searchInput.value);
    if (formatted === null) {
      calcChip.style.display = "none";
      delete calcChip.dataset.value;
      return;
    }
    if (calcValueEl) calcValueEl.textContent = "= " + formatted;
    calcChip.style.display = "";
    calcChip.dataset.value = formatted;
  }
  let calcCopiedTimer = null;
  function copyTextFallback(value) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }
  async function writeClipboard(value) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {}
    return copyTextFallback(value);
  }
  async function copyCalcResult(nextValue = null) {
    const valueToCopy = nextValue || (calcChip && calcChip.dataset.value) || "";
    if (!valueToCopy) return false;
    if (calcChip && valueToCopy) {
      calcChip.style.display = "";
      calcChip.dataset.value = valueToCopy;
    }
    const copied = await writeClipboard(valueToCopy);
    if (calcChip) {
      calcChip.classList.toggle("copied", copied);
      calcChip.classList.toggle("failed", !copied);
    }
    if (calcValueEl) calcValueEl.textContent = copied ? "Скопировано" : "Не скопировано";
    clearTimeout(calcCopiedTimer);
    calcCopiedTimer = setTimeout(() => {
      if (calcChip) {
        calcChip.classList.remove("copied");
        calcChip.classList.remove("failed");
      }
      updateCalc();
    }, 1100);
    return copied;
  }
  function isCalcActive() {
    return Boolean(calcChip && calcChip.style.display !== "none" && calcChip.dataset.value);
  }
  if (calcChip) {
    calcChip.addEventListener("click", (e) => {
      e.stopPropagation();
      copyCalcResult();
    });
  }

  function formatRuCount(count, one, few, many) {
    const n = Math.abs(Number(count) || 0);
    const lastTwo = n % 100;
    const last = n % 10;
    const word = lastTwo >= 11 && lastTwo <= 14
      ? many
      : last === 1
        ? one
        : last >= 2 && last <= 4
          ? few
          : many;
    return `${count} ${word}`;
  }

  function formatSearchCount(count) {
    return formatRuCount(count, "поиск", "поиска", "поисков");
  }

  function formatOpenCount(count) {
    return formatRuCount(count, "открытие", "открытия", "открытий");
  }

  function getSearchEngineById(id) {
    return SEARCH_ENGINES.find(engine => engine.id === id) || SEARCH_ENGINES[searchEngineIndex] || SEARCH_ENGINES[0];
  }

  function loadSearchHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY));
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(item => ({
          query: String(item && item.query || "").trim(),
          engineId: getSearchEngineById(item && item.engineId).id,
          ts: Number(item && item.ts) || 0
        }))
        .filter(item => item.query)
        .slice(0, 10);
    } catch {
      return [];
    }
  }

  let searchHistory = loadSearchHistory();

  function saveSearchHistory() {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
  }

  function addSearchHistory(query, engineId) {
    const q = String(query || "").trim();
    if (!q) return;
    const normalizedEngineId = getSearchEngineById(engineId).id;
    searchHistory = searchHistory.filter(item =>
      item.query.toLowerCase() !== q.toLowerCase() || item.engineId !== normalizedEngineId
    );
    searchHistory.unshift({ query: q, engineId: normalizedEngineId, ts: Date.now() });
    searchHistory = searchHistory.slice(0, 10);
    saveSearchHistory();
  }

  function parseSearchIntent(rawQuery, forcedEngineId = null) {
    const raw = String(rawQuery || "").trim();
    if (!raw) return null;
    if (forcedEngineId) {
      return { query: raw, engine: getSearchEngineById(forcedEngineId), command: null };
    }

    const match = raw.match(/^([a-z]+)\s+(.+)$/i);
    if (match) {
      const engineId = SEARCH_COMMANDS[match[1].toLowerCase()];
      const query = match[2].trim();
      if (engineId && query) return { query, engine: getSearchEngineById(engineId), command: match[1].toLowerCase() };
    }

    return { query: raw, engine: SEARCH_ENGINES[searchEngineIndex], command: null };
  }

  function hideSearchHistory() {
    if (!searchHistoryPanel) return;
    searchHistoryPanel.classList.remove("visible");
    searchHistoryPanel.setAttribute("aria-hidden", "true");
    searchHistoryPanel.textContent = "";
  }

  function renderSearchHistory() {
    if (!searchHistoryPanel || !searchInput || document.activeElement !== searchInput) return;
    const raw = searchInput.value.trim();
    if (raw && getFormattedMathResult(raw) !== null) {
      hideSearchHistory();
      return;
    }

    const needle = raw.toLowerCase();
    const rows = searchHistory
      .filter(item => !needle || item.query.toLowerCase().includes(needle))
      .slice(0, 6);

    if (!rows.length) {
      hideSearchHistory();
      return;
    }

    searchHistoryPanel.textContent = "";
    rows.forEach(item => {
      const engine = getSearchEngineById(item.engineId);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "search-history-item";
      row.style.setProperty("--history-color", engine.color);
      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
        if (searchInput) {
          searchInput.value = item.query;
          searchInput.focus();
        }
        updateSearchInputState();
        runSearch(item.query, item.engineId);
      });

      const queryText = document.createElement("span");
      queryText.className = "search-history-query";
      queryText.textContent = item.query;
      const engineText = document.createElement("span");
      engineText.className = "search-history-engine";
      engineText.textContent = engine.label;
      row.append(queryText, engineText);
      searchHistoryPanel.appendChild(row);
    });

    searchHistoryPanel.classList.add("visible");
    searchHistoryPanel.setAttribute("aria-hidden", "false");
  }

  function updateSearchInputState() {
    if (!searchInput) return;
    const hasText = Boolean(searchInput.value);
    if (searchClear) searchClear.style.display = hasText ? "" : "none";
    if (searchForm) searchForm.classList.toggle("has-text", hasText);
    updateCalc();
    renderSearchHistory();
  }

  let searchCount = parseInt(localStorage.getItem("aiHubSearchCount") || "0", 10);
  function renderSearchCount() {
    if (!searchOpensEl) return;
    searchOpensEl.textContent = searchCount > 0 ? formatSearchCount(searchCount) : "";
  }
  renderSearchCount();

  function runSearch(query, forcedEngineId = null) {
    const intent = parseSearchIntent(query, forcedEngineId);
    if (!intent || !intent.query) return;
    searchCount++;
    localStorage.setItem("aiHubSearchCount", String(searchCount));
    renderSearchCount();
    addSearchHistory(intent.query, intent.engine.id);
    hideSearchHistory();
    window.location.href = intent.engine.url + encodeURIComponent(intent.query);
  }

  async function handleSearchEnter() {
    const q = searchInput ? searchInput.value.trim() : "";
    if (!q) return;
    const calcResult = getFormattedMathResult(q);
    if (calcResult !== null) {
      await copyCalcResult(calcResult);
      return;
    }
    runSearch(q);
  }

  function applySearchEngine(idx) {
    const prevIdx = searchEngineIndex;
    searchEngineIndex = idx;
    localStorage.setItem("aiHubSearchEngine", String(idx));
    SEARCH_ENGINES.forEach((eng, i) => {
      const el = document.getElementById(eng.iconId);
      if (!el) return;
      if (i === idx) {
        el.style.display = "";
        if (prevIdx !== idx) {
          el.classList.remove("swap-in");
          void el.offsetWidth; // restart animation
          el.classList.add("swap-in");
        }
      } else {
        el.style.display = "none";
      }
    });
    document.documentElement.style.setProperty("--search-color", SEARCH_ENGINES[idx].color);
  }
  applySearchEngine(searchEngineIndex);

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      updateSearchInputState();
    });
    searchInput.addEventListener("focus", () => {
      renderSearchHistory();
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideSearchHistory();
        return;
      }
      if (e.key !== "Enter" || e.isComposing) return;
      e.preventDefault();
      handleSearchEnter();
    });
  }
  if (searchClear) {
    searchClear.addEventListener("click", () => {
      if (searchInput) { searchInput.value = ""; searchInput.focus(); }
      updateSearchInputState();
    });
  }
  if (searchForm) {
    searchForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleSearchEnter();
    });
  }
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      runSearch(searchInput ? searchInput.value : "");
    });
  }

  // Engine picker tooltip
  let engineTooltip = null;
  function buildEngineTooltip() {
    if (engineTooltip) return;
    engineTooltip = document.createElement("div");
    engineTooltip.className = "search-engine-tooltip";
    SEARCH_ENGINES.forEach((eng, i) => {
      const opt = document.createElement("div");
      opt.className = "search-engine-opt" + (i === searchEngineIndex ? " active" : "");
      opt.dataset.idx = String(i);
      const srcEl = document.getElementById(eng.iconId);
      if (srcEl) {
        const clone = srcEl.cloneNode(true);
        clone.removeAttribute("id");
        clone.style.display = "";
        opt.appendChild(clone);
      }
      const label = document.createElement("span");
      label.textContent = eng.label;
      opt.appendChild(label);
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        applySearchEngine(i);
        engineTooltip.querySelectorAll(".search-engine-opt").forEach((o, j) => {
          o.classList.toggle("active", j === i);
        });
        hideEngineTooltip();
        if (searchInput) searchInput.focus();
      });
      engineTooltip.appendChild(opt);
    });
    const form = document.getElementById("search-form");
    if (form) form.appendChild(engineTooltip);
  }

  function showEngineTooltip() {
    buildEngineTooltip();
    engineTooltip.classList.add("visible");
  }
  function hideEngineTooltip() {
    if (engineTooltip) engineTooltip.classList.remove("visible");
  }

  if (searchEngineBtn) {
    searchEngineBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!engineTooltip || !engineTooltip.classList.contains("visible")) {
        showEngineTooltip();
      } else {
        hideEngineTooltip();
      }
    });
  }
  document.addEventListener("click", hideEngineTooltip);
  document.addEventListener("click", hideSearchHistory);
  if (searchForm) searchForm.addEventListener("click", e => e.stopPropagation());
  if (searchHistoryPanel) searchHistoryPanel.addEventListener("click", e => e.stopPropagation());

  // Wire up setting checkboxes
  const checkboxMap = {
    "set-aurora": "aurora",
    "set-constellations": "constellations",
    "set-dust": "dust",
    "set-shooting": "shooting",
    "set-nebula": "nebula",
    "set-flight-foreground": "flightForeground",
    "set-cosmic-depth": "cosmicDepth",
    "set-hdr": "hdr",
    "set-bloom": "bloom",
    "set-planet": "planet",
    "set-cursor-lens": "cursorLens",
    "set-realsky": "realSky",
    "set-webgpu-stars": "webgpuStars",
    "set-worker-starfield": "workerStarfield",
    "set-audio-reactive": "audioReactive",
    "set-acrylic": "acrylic",
    "set-refraction": "refraction",
    "set-warp": "warp",
    "set-rain": "rain"
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

  settings.aiTools = normalizeAiTools(settings.aiTools);
  settings.customTools = normalizeCustomTools(settings.customTools);
  const aiToolSettingsList = document.getElementById("ai-tool-settings-list");
  const aiToolsCoreBtn = document.getElementById("ai-tools-core");
  const aiToolsAllBtn = document.getElementById("ai-tools-all");
  const customToolNameInput = document.getElementById("custom-tool-name");
  const customToolUrlInput = document.getElementById("custom-tool-url");
  const customToolAddBtn = document.getElementById("custom-tool-add");
  const customToolsList = document.getElementById("custom-tools-list");

  function getVisibleAiToolCount(nextTools = settings.aiTools) {
    return AI_TOOLS.reduce((count, tool) => count + (nextTools[tool.id] !== false ? 1 : 0), 0);
  }

  function renderAiToolSettings() {
    if (!aiToolSettingsList) return;
    aiToolSettingsList.textContent = "";
    AI_TOOLS.forEach(tool => {
      const label = document.createElement("label");
      label.className = "settings-toggle";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.aiToolToggle = tool.id;
      input.checked = settings.aiTools[tool.id] !== false;

      const text = document.createElement("span");
      text.textContent = tool.label;

      input.addEventListener("change", () => {
        const wasVisible = settings.aiTools[tool.id] !== false;
        if (wasVisible && !input.checked && getVisibleAiToolCount() <= 1) {
          input.checked = true;
          showToast("Оставьте хотя бы одну нейросеть");
          return;
        }
        settings.aiTools[tool.id] = input.checked;
        saveSettings(settings);
        applyAiToolVisibility();
      });

      label.append(input, text);
      aiToolSettingsList.appendChild(label);
    });
  }

  function applyAiToolPreset(mode) {
    AI_TOOLS.forEach(tool => {
      settings.aiTools[tool.id] = mode === "all" ? true : tool.visible;
    });
    settings.aiTools = normalizeAiTools(settings.aiTools);
    saveSettings(settings);
    renderAiToolSettings();
    applyAiToolVisibility();
  }

  if (aiToolsCoreBtn) aiToolsCoreBtn.addEventListener("click", () => applyAiToolPreset("core"));
  if (aiToolsAllBtn) aiToolsAllBtn.addEventListener("click", () => applyAiToolPreset("all"));
  renderAiToolSettings();

  function renderCustomToolsList() {
    if (!customToolsList) return;
    customToolsList.textContent = "";
    settings.customTools.forEach(tool => {
      const item = document.createElement("div");
      item.className = "custom-tool-item";

      const name = document.createElement("span");
      name.textContent = tool.name;
      name.title = tool.url;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "x";
      remove.setAttribute("aria-label", `Удалить ${tool.name}`);
      remove.addEventListener("click", () => {
        settings.customTools = settings.customTools.filter(t => t.id !== tool.id);
        saveSettings(settings);
        renderCustomToolsList();
        renderCustomToolButtons();
      });

      item.append(name, remove);
      customToolsList.appendChild(item);
    });
  }

  function addCustomTool() {
    if (!customToolNameInput || !customToolUrlInput) return;
    const name = customToolNameInput.value.trim().slice(0, 24);
    const url = normalizeUrl(customToolUrlInput.value);
    if (!name || !url) {
      showToast("Введите название и ссылку");
      return;
    }
    if (settings.customTools.length >= 6) {
      showToast("Максимум 6 своих ссылок");
      return;
    }
    settings.customTools.push({
      id: `custom-${Date.now().toString(36)}`,
      name,
      url
    });
    settings.customTools = normalizeCustomTools(settings.customTools);
    saveSettings(settings);
    customToolNameInput.value = "";
    customToolUrlInput.value = "";
    renderCustomToolsList();
    renderCustomToolButtons();
  }

  if (customToolAddBtn) customToolAddBtn.addEventListener("click", addCustomTool);
  [customToolNameInput, customToolUrlInput].forEach(input => {
    if (!input) return;
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      addCustomTool();
    });
  });
  renderCustomToolsList();

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

  function syncStarGlowControl(value) {
    const v = aiHubNormalizeStarGlow(value);
    const starGlowInput = document.getElementById("set-star-glow");
    const starGlowValue = document.getElementById("set-star-glow-value");
    if (starGlowInput) starGlowInput.value = String(v);
    if (starGlowValue) starGlowValue.textContent = `${Math.round(v * 100)}%`;
  }
  settings.starGlow = aiHubNormalizeStarGlow(settings.starGlow);
  aiHubApplyStarGlowStyle(settings.starGlow);
  syncStarGlowControl(settings.starGlow);
  const starGlowInput = document.getElementById("set-star-glow");
  if (starGlowInput) {
    starGlowInput.addEventListener("input", () => {
      settings.starGlow = aiHubNormalizeStarGlow(starGlowInput.value);
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

  const clockOffsetYInput = document.getElementById("set-clock-offset-y");
  const clockOffsetYValue = document.getElementById("set-clock-offset-y-value");
  function syncClockOffsetYControl(value) {
    const offset = normalizeClockOffsetY(value);
    if (clockOffsetYInput) clockOffsetYInput.value = String(offset);
    if (clockOffsetYValue) clockOffsetYValue.textContent = formatClockOffsetY(offset);
  }
  syncClockOffsetYControl(settings.clockOffsetY);
  if (clockOffsetYInput) {
    clockOffsetYInput.addEventListener("input", () => {
      settings.clockOffsetY = applyClockOffsetY(clockOffsetYInput.value);
      syncClockOffsetYControl(settings.clockOffsetY);
      saveSettings(settings);
    });
  }

  const clockBloomInput = document.getElementById("set-clock-bloom");
  const clockBloomValue = document.getElementById("set-clock-bloom-value");
  function syncClockBloomControl(value) {
    const bloom = normalizeClockBloom(value);
    if (clockBloomInput) clockBloomInput.value = String(bloom);
    if (clockBloomValue) clockBloomValue.textContent = formatClockBloom(bloom);
  }
  syncClockBloomControl(settings.clockBloom);
  if (clockBloomInput) {
    clockBloomInput.addEventListener("input", () => {
      settings.clockBloom = applyClockBloom(clockBloomInput.value);
      syncClockBloomControl(settings.clockBloom);
      saveSettings(settings);
    });
  }

  // Search width slider
  function normalizeSearchWidth(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return SETTINGS_DEFAULTS.searchWidth;
    return Math.min(800, Math.max(320, Math.round(n)));
  }
  function applySearchWidth(value) {
    const w = normalizeSearchWidth(value);
    document.documentElement.style.setProperty("--search-width", w + "px");
    return w;
  }
  const searchWidthInput = document.getElementById("set-search-width");
  const searchWidthValue = document.getElementById("set-search-width-value");
  function syncSearchWidthControl(value) {
    const w = normalizeSearchWidth(value);
    if (searchWidthInput) searchWidthInput.value = String(w);
    if (searchWidthValue) searchWidthValue.textContent = `${w}px`;
  }
  settings.searchWidth = applySearchWidth(settings.searchWidth);
  syncSearchWidthControl(settings.searchWidth);
  if (searchWidthInput) {
    searchWidthInput.addEventListener("input", () => {
      settings.searchWidth = applySearchWidth(searchWidthInput.value);
      syncSearchWidthControl(settings.searchWidth);
      saveSettings(settings);
    });
  }

  // Shooting speed slider
  function normalizeShootingSpeed(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return SETTINGS_DEFAULTS.shootingSpeed;
    return Math.min(3, Math.max(0, n));
  }
  const shootingSpeedInput = document.getElementById("set-shooting-speed");
  const shootingSpeedValue = document.getElementById("set-shooting-speed-value");
  function syncShootingSpeedControl(value) {
    const v = normalizeShootingSpeed(value);
    if (shootingSpeedInput) shootingSpeedInput.value = String(v);
    if (shootingSpeedValue) {
      if (v === 0) {
        shootingSpeedValue.textContent = "Стоп";
      } else {
        shootingSpeedValue.textContent = `${Math.round(v * 100)}%`;
      }
    }
  }
  settings.shootingSpeed = normalizeShootingSpeed(settings.shootingSpeed);
  syncShootingSpeedControl(settings.shootingSpeed);
  if (shootingSpeedInput) {
    shootingSpeedInput.addEventListener("input", () => {
      settings.shootingSpeed = normalizeShootingSpeed(shootingSpeedInput.value);
      if (starfieldInstance && starfieldInstance.settings) {
        starfieldInstance.settings.shootingSpeed = settings.shootingSpeed;
        if (settings.shootingSpeed > 0) starfieldInstance.nextShootTime = 0;
      }
      if (warpSkyInstance && warpSkyInstance.settings) {
        warpSkyInstance.settings.shootingSpeed = settings.shootingSpeed;
        if (settings.shootingSpeed > 0) warpSkyInstance.nextShootTime = 0;
      }
      syncShootingSpeedControl(settings.shootingSpeed);
      saveSettings(settings);
    });
  }

  const flightSpeedInput = document.getElementById("set-flight-speed");
  const flightSpeedValue = document.getElementById("set-flight-speed-value");
  function syncFlightSpeedControl(value) {
    const v = normalizeFlightSpeed(value);
    if (flightSpeedInput) flightSpeedInput.value = String(v);
    if (flightSpeedValue) flightSpeedValue.textContent = formatFlightSpeed(v);
  }
  settings.flightSpeed = normalizeFlightSpeed(settings.flightSpeed);
  syncFlightSpeedControl(settings.flightSpeed);
  if (flightSpeedInput) {
    flightSpeedInput.addEventListener("input", () => {
      settings.flightSpeed = normalizeFlightSpeed(flightSpeedInput.value);
      if (warpInstance) warpInstance.setFlightSpeed(settings.flightSpeed);
      if (warpSkyInstance) warpSkyInstance.setFlightSpeed(settings.flightSpeed);
      if (workerStarfieldLayer) workerStarfieldLayer.updateSettings(settings);
      syncFlightSpeedControl(settings.flightSpeed);
      saveSettings(settings);
    });
  }

  const flightStarCountInput = document.getElementById("set-flight-star-count");
  const flightStarCountValue = document.getElementById("set-flight-star-count-value");
  function syncFlightStarCountControl(value) {
    const count = normalizeFlightStarCount(value);
    if (flightStarCountInput) flightStarCountInput.value = String(count);
    if (flightStarCountValue) flightStarCountValue.textContent = String(count);
  }
  settings.flightStarCount = normalizeFlightStarCount(settings.flightStarCount);
  syncFlightStarCountControl(settings.flightStarCount);
  if (flightStarCountInput) {
    flightStarCountInput.addEventListener("input", () => {
      settings.flightStarCount = normalizeFlightStarCount(flightStarCountInput.value);
      if (warpInstance) warpInstance.setStarCount(settings.flightStarCount);
      if (warpSkyInstance) warpSkyInstance.setFlightStarCount(settings.flightStarCount);
      if (workerStarfieldLayer) workerStarfieldLayer.updateSettings(settings);
      syncFlightStarCountControl(settings.flightStarCount);
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
    } else if (key === "hdr") {
      body.classList.toggle("hdr-on", value !== false);
      if (starfieldInstance && starfieldInstance.updateHdr) starfieldInstance.updateHdr(value);
      if (warpSkyInstance && warpSkyInstance.updateHdr) warpSkyInstance.updateHdr(value);
      if (warpInstance && warpInstance.updateHdr) warpInstance.updateHdr(value);
      if (dustInstance && dustInstance.updateHdr) dustInstance.updateHdr(value);
      if (realStarfieldLayer) realStarfieldLayer.setHDR(value);
      if (realConstellationLayer) realConstellationLayer.setHDR(value);
      if (webgpuStarfieldLayer) webgpuStarfieldLayer.setHDR(value);
      if (workerStarfieldLayer) workerStarfieldLayer.updateHdr(value);
      updateHdrDebug();
    } else if (key === "flightForeground") {
      if (warpInstance && warpInstance.setFlightForeground) warpInstance.setFlightForeground(value);
      if (warpSkyInstance && warpSkyInstance.setFlightForeground) warpSkyInstance.setFlightForeground(value);
    } else if (key === "cosmicDepth" || key === "bloom" || key === "planet" || key === "cursorLens") {
      if (key === "bloom") aiHubSetCanvasBloomEnabled(value !== false);
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
      if (threeStarfieldLayer) threeStarfieldLayer.updateSettings(settings);
      updateHdrDebug();
    } else if (key === "realSky") {
      body.classList.toggle("real-sky-on", value === true);
      if (realStarfieldLayer) realStarfieldLayer.setEnabled(value === true);
      if (starfieldInstance && starfieldInstance.settings) starfieldInstance.settings.realSky = value === true;
      if (warpSkyInstance && warpSkyInstance.settings) warpSkyInstance.settings.realSky = value === true;
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
    } else if (key === "webgpuStars") {
      const active = value === true && !!(webgpuStarfieldLayer && webgpuStarfieldLayer.supported);
      body.classList.toggle("webgpu-stars-on", active);
      if (webgpuStarfieldLayer) webgpuStarfieldLayer.setEnabled(value === true);
      settings.webgpuStarsActive = active;
      if (starfieldInstance && starfieldInstance.settings) starfieldInstance.settings.webgpuStarsActive = active;
      if (warpSkyInstance && warpSkyInstance.settings) warpSkyInstance.settings.webgpuStarsActive = active;
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
    } else if (key === "audioReactive") {
      if (starfieldInstance && starfieldInstance.settings) starfieldInstance.settings.audioReactive = value === true;
      if (warpSkyInstance && warpSkyInstance.settings) warpSkyInstance.settings.audioReactive = value === true;
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
      if (threeStarfieldLayer) threeStarfieldLayer.updateSettings(settings);
      void setAudioReactiveEnabled(value === true);
    } else if (key === "workerStarfield") {
      setWorkerStarfieldEnabled(value === true);
    } else if (key === "acrylic") {
      body.classList.toggle("no-acrylic", !value);
      if (glassRefractionLayer) glassRefractionLayer.updateSettings(settings);
    } else if (key === "refraction") {
      if (glassRefractionLayer) glassRefractionLayer.updateSettings(settings);
    } else if (key === "rain") {
      setRainEnabled(value === true);
    } else if (key === "warp") {
      if (cosmicDepthLayer) cosmicDepthLayer.updateSettings(settings);
      if (threeStarfieldLayer) threeStarfieldLayer.updateSettings(settings);
      setWarpMode(value);
    }
    if (realConstellationLayer) realConstellationLayer.updateSettings(settings);
    if (workerStarfieldLayer) workerStarfieldLayer.updateSettings(settings);
  }

  // ===== Mode Toggle (Static / Warp) =====
  const toggleModeBtn = document.getElementById("toggle-mode");
  const modeIconStatic = document.getElementById("mode-icon-static");
  const modeIconWarp = document.getElementById("mode-icon-warp");
  let warpInstance = null;
  let warpSkyInstance = null;
  let warpSkyCanvas = null;

  function updateModeIcon(warp) {
    if (modeIconStatic) modeIconStatic.style.display = warp ? "none" : "";
    if (modeIconWarp) modeIconWarp.style.display = warp ? "" : "none";
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
      threeStars: false,
      cosmicDepth: false
    };
  }

  function ensureWarpSkyOverlay() {
    const canvas = document.getElementById("bg-canvas");
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

  function getWorkerStarfieldUrl() {
    return (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL("shared/aihub-starfield-worker.js")
      : "shared/aihub-starfield-worker.js";
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
      warpInstance = new WarpField(bgCanvas, { instant: true, hdr: settings.hdr, starGlow: settings.starGlow, flightSpeed: settings.flightSpeed, flightStarCount: settings.flightStarCount, flightForeground: settings.flightForeground });
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

  if (toggleModeBtn) {
    toggleModeBtn.addEventListener("click", () => {
      settings.warp = !settings.warp;
      saveSettings(settings);
      setWarpMode(settings.warp);
      const cb = document.getElementById("set-warp");
      if (cb) cb.checked = settings.warp;
    });
  }

  function setWarpMode(enabled) {
    const canvas = document.getElementById("bg-canvas");
    const currentlyWarping = workerStarfieldLayer && workerStarfieldLayer.supported
      ? workerStarfieldLayer.mode === "warp"
      : Boolean(warpInstance);
    if (enabled !== currentlyWarping && canvas) {
      playWarpTransition(enabled ? "enter" : "exit", canvas);
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
      if (!warpInstance && canvas) warpInstance = new WarpField(canvas, { instant: false, hdr: settings.hdr, starGlow: settings.starGlow, flightSpeed: settings.flightSpeed, flightStarCount: settings.flightStarCount, flightForeground: settings.flightForeground });
      ensureWarpSkyOverlay();
    } else {
      if (warpInstance) { warpInstance.stop(); warpInstance = null; }
      stopWarpSkyOverlay();
      if (!starfieldInstance && canvas) {
        starfieldInstance = new Starfield(canvas, settings);
        starfieldInstance.mouseX = mouseX;
        starfieldInstance.mouseY = mouseY;
      }
    }
  }

  // ===== Focus / Pomodoro =====
  const FOCUS_KEY = "aiHubFocusState";
  const FOCUS_SCHEDULE_MSG = "aihub_focus_schedule";
  const FOCUS_CANCEL_MSG = "aihub_focus_cancel";
  const FOCUS_DURATIONS = {
    focus: 25 * 60 * 1000,
    short: 5 * 60 * 1000,
    long: 15 * 60 * 1000
  };
  const FOCUS_LABELS = {
    focus: "Фокус",
    short: "Перерыв",
    long: "Длинный перерыв"
  };

  function loadFocusState() {
    try {
      const saved = JSON.parse(localStorage.getItem(FOCUS_KEY));
      const mode = FOCUS_DURATIONS[saved && saved.mode] ? saved.mode : "focus";
      return {
        enabled: Boolean(saved && saved.enabled),
        mode,
        running: Boolean(saved && saved.running),
        remainingMs: Number.isFinite(saved && saved.remainingMs) ? saved.remainingMs : FOCUS_DURATIONS[mode],
        endAt: Number.isFinite(saved && saved.endAt) ? saved.endAt : null,
        completed: Number.isFinite(saved && saved.completed) ? saved.completed : 0
      };
    } catch {
      return { enabled: false, mode: "focus", running: false, remainingMs: FOCUS_DURATIONS.focus, endAt: null, completed: 0 };
    }
  }

  function saveFocusState() {
    localStorage.setItem(FOCUS_KEY, JSON.stringify(focusState));
  }

  function sendFocusMessage(type, payload = {}) {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
    try {
      chrome.runtime.sendMessage({ type, ...payload }, () => {
        if (chrome.runtime.lastError) {}
      });
    } catch {}
  }

  function scheduleFocusAlarm() {
    if (!focusState.running || !focusState.endAt) return;
    sendFocusMessage(FOCUS_SCHEDULE_MSG, {
      mode: focusState.mode,
      endAt: focusState.endAt
    });
  }

  function cancelFocusAlarm() {
    sendFocusMessage(FOCUS_CANCEL_MSG);
  }

  function formatFocusTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function getNextFocusMode() {
    if (focusState.mode === "focus") {
      return focusState.completed > 0 && focusState.completed % 4 === 0 ? "long" : "short";
    }
    return "focus";
  }

  function setFocusMode(mode) {
    if (!FOCUS_DURATIONS[mode]) return;
    focusState.mode = mode;
    focusState.running = false;
    focusState.endAt = null;
    focusState.remainingMs = FOCUS_DURATIONS[mode];
    cancelFocusAlarm();
    saveFocusState();
    renderFocus();
  }

  function setFocusEnabled(enabled) {
    focusState.enabled = enabled;
    body.classList.toggle("focus-active", enabled);
    if (toggleFocusBtn) {
      toggleFocusBtn.classList.toggle("is-active", enabled);
      toggleFocusBtn.setAttribute("aria-pressed", String(enabled));
    }
    saveFocusState();
  }

  function playFocusChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      gain.connect(ctx.destination);
      [660, 880].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start(ctx.currentTime + index * 0.14);
        osc.stop(ctx.currentTime + 0.75 + index * 0.14);
      });
      setTimeout(() => ctx.close(), 1300);
    } catch {}
  }

  function showFocusToast(text) {
    showToast(text, 4200);
  }

  const focusState = loadFocusState();
  const toggleFocusBtn = document.getElementById("toggle-focus");
  const focusPanel = document.getElementById("focus-panel");
  const focusTime = document.getElementById("focus-time");
  const focusStatus = document.getElementById("focus-status");
  const focusProgressFill = document.getElementById("focus-progress-fill");
  const focusStartPause = document.getElementById("focus-start-pause");
  const focusReset = document.getElementById("focus-reset");
  const focusNext = document.getElementById("focus-next");
  const focusIconPlay = document.getElementById("focus-icon-play");
  const focusIconPause = document.getElementById("focus-icon-pause");
  const focusModeButtons = document.querySelectorAll("[data-focus-mode]");

  function renderFocus() {
    const duration = FOCUS_DURATIONS[focusState.mode];
    const remaining = focusState.running && focusState.endAt
      ? Math.max(0, focusState.endAt - Date.now())
      : Math.max(0, focusState.remainingMs);
    const progress = duration > 0 ? Math.min(100, Math.max(0, ((duration - remaining) / duration) * 100)) : 0;

    if (focusTime) focusTime.textContent = formatFocusTime(remaining);
    if (focusProgressFill) focusProgressFill.style.width = `${progress}%`;
    if (focusStatus) {
      focusStatus.textContent = focusState.running
        ? `${FOCUS_LABELS[focusState.mode]} идёт`
        : `${FOCUS_LABELS[focusState.mode]} готов`;
    }
    if (focusIconPlay) focusIconPlay.style.display = focusState.running ? "none" : "";
    if (focusIconPause) focusIconPause.style.display = focusState.running ? "" : "none";
    if (focusPanel) focusPanel.dataset.mode = focusState.mode;
    focusModeButtons.forEach(btn => {
      const active = btn.dataset.focusMode === focusState.mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
  }

  function completeFocusCycle(fromRestore = false) {
    const completedMode = focusState.mode;
    if (completedMode === "focus") focusState.completed += 1;
    focusState.mode = getNextFocusMode();
    focusState.running = false;
    focusState.endAt = null;
    focusState.remainingMs = FOCUS_DURATIONS[focusState.mode];
    saveFocusState();
    renderFocus();
    if (!fromRestore) {
      playFocusChime();
      showFocusToast(`${FOCUS_LABELS[completedMode]} завершён`);
    }
  }

  function updateFocusTick() {
    if (!focusState.running || !focusState.endAt) {
      renderFocus();
      return;
    }
    focusState.remainingMs = Math.max(0, focusState.endAt - Date.now());
    if (focusState.remainingMs <= 0) {
      completeFocusCycle(false);
      return;
    }
    saveFocusState();
    renderFocus();
  }

  function startFocusTimer() {
    focusState.remainingMs = Math.max(1000, focusState.remainingMs || FOCUS_DURATIONS[focusState.mode]);
    focusState.endAt = Date.now() + focusState.remainingMs;
    focusState.running = true;
    scheduleFocusAlarm();
    saveFocusState();
    renderFocus();
  }

  function pauseFocusTimer() {
    if (focusState.running && focusState.endAt) {
      focusState.remainingMs = Math.max(0, focusState.endAt - Date.now());
    }
    focusState.running = false;
    focusState.endAt = null;
    cancelFocusAlarm();
    saveFocusState();
    renderFocus();
  }

  if (focusState.running && focusState.endAt) {
    focusState.remainingMs = Math.max(0, focusState.endAt - Date.now());
    if (focusState.remainingMs <= 0) {
      completeFocusCycle(true);
    } else {
      scheduleFocusAlarm();
    }
  }
  setFocusEnabled(focusState.enabled);
  renderFocus();
  setInterval(updateFocusTick, 1000);

  if (toggleFocusBtn) {
    toggleFocusBtn.addEventListener("click", () => {
      setFocusEnabled(!focusState.enabled);
    });
  }
  if (focusStartPause) {
    focusStartPause.addEventListener("click", () => {
      if (!focusState.enabled) setFocusEnabled(true);
      if (focusState.running) pauseFocusTimer();
      else startFocusTimer();
    });
  }
  if (focusReset) {
    focusReset.addEventListener("click", () => {
      focusState.running = false;
      focusState.endAt = null;
      focusState.remainingMs = FOCUS_DURATIONS[focusState.mode];
      cancelFocusAlarm();
      saveFocusState();
      renderFocus();
    });
  }
  if (focusNext) {
    focusNext.addEventListener("click", () => setFocusMode(getNextFocusMode()));
  }
  focusModeButtons.forEach(btn => {
    btn.addEventListener("click", () => setFocusMode(btn.dataset.focusMode));
  });

  // ===== Per-button open counters =====
  function getOpenCounts() {
    try { return JSON.parse(localStorage.getItem("aiHubOpenCounts") || "{}"); } catch { return {}; }
  }
  function saveOpenCounts(counts) {
    localStorage.setItem("aiHubOpenCounts", JSON.stringify(counts));
  }
  const openCounts = getOpenCounts();

  // ===== Navigation with Ripple =====
  const aiToolsRow = document.getElementById("ai-tools-row");
  const aiToolsGroup = aiToolsRow ? aiToolsRow.closest(".btn-group") : null;
  let buttons = [];
  let shortcutMap = {};
  let tooltipDiv = null;

  function getVisibleButton(btn) {
    const wrapper = btn.closest(".btn-wrap");
    return !(wrapper ? wrapper.classList.contains("hidden") : btn.hidden);
  }

  function refreshShortcutMap() {
    shortcutMap = {};
    buttons = buttons.filter(btn => btn.isConnected);
    buttons.filter(getVisibleButton).forEach((btn, index) => {
      const key = SHORTCUT_KEYS[index] || "";
      const hint = btn.querySelector(".kbd-hint");
      if (key) {
        btn.dataset.key = key;
        if (hint) {
          hint.textContent = key;
          hint.style.display = "";
        }
        shortcutMap[key] = btn.dataset.url;
      } else {
        delete btn.dataset.key;
        if (hint) hint.style.display = "none";
      }
    });
  }

  let cascadeDone = false;
  function syncToolsDensity() {
    const visibleAiRowCount = aiToolsRow
      ? [...aiToolsRow.querySelectorAll(".button")].filter(getVisibleButton).length
      : 0;
    const visibleLaunchCount = document.querySelectorAll(".buttons .btn-wrap:not(.hidden)").length;
    if (aiToolsGroup) aiToolsGroup.classList.toggle("tools-group-dense", visibleAiRowCount > 5);
    body.classList.toggle("layout-scroll", visibleLaunchCount > 10);
  }

  function applyAiToolVisibility() {
    buttons.forEach(btn => {
      const key = btn.dataset.aiTool;
      if (!key) return;
      const visible = settings.aiTools[key] !== false;
      const wrapper = btn.closest(".btn-wrap");
      const target = wrapper || btn;
      target.classList.toggle("hidden", !visible);
      btn.tabIndex = visible ? 0 : -1;
      btn.setAttribute("aria-hidden", String(!visible));
    });
    document.getElementById("aihub-preload-tool-visibility")?.remove();
    syncToolsDensity();
    refreshShortcutMap();
    if (!cascadeDone) {
      const visibleWraps = document.querySelectorAll(".buttons .btn-wrap:not(.hidden)");
      const base = 0.40, step = 0.12;
      visibleWraps.forEach((wrap, i) => {
        wrap.style.animationDelay = `${(base + i * step).toFixed(2)}s`;
      });
      const last = visibleWraps[visibleWraps.length - 1];
      if (last) {
        const total = (base + (visibleWraps.length - 1) * step + 0.5) * 1000;
        setTimeout(() => {
          cascadeDone = true;
          document.querySelectorAll(".buttons .btn-wrap").forEach(w => { w.style.animation = "none"; });
        }, total + 100);
      } else {
        cascadeDone = true;
      }
    }
  }

  function getCustomToolButtonId(tool) {
    return `open-${tool.id}`;
  }

  function getCustomToolInitials(name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join("") || "+";
  }

  function getCustomToolColor(tool) {
    const colors = ["#93c5fd", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#22d3ee"];
    const seed = `${tool.name}${tool.url}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    return colors[Math.abs(hash) % colors.length];
  }

  function getHostName(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  function createCustomToolButton(tool) {
    const btn = document.createElement("button");
    btn.id = getCustomToolButtonId(tool);
    btn.className = "button custom-tool-button";
    btn.dataset.customTool = tool.id;
    btn.dataset.url = tool.url;
    btn.dataset.tooltip = `Открыть ${tool.name}`;
    btn.style.setProperty("--brand-color", getCustomToolColor(tool));

    const hint = document.createElement("span");
    hint.className = "kbd-hint";

    const glow = document.createElement("div");
    glow.className = "icon-glow";

    const icon = document.createElement("span");
    icon.className = "custom-tool-icon";
    icon.textContent = getCustomToolInitials(tool.name);

    const name = document.createElement("span");
    name.className = "btn-name";
    name.textContent = tool.name;

    const url = document.createElement("span");
    url.className = "btn-url";
    url.textContent = getHostName(tool.url);

    btn.append(hint, glow, icon, name, url);
    return btn;
  }

  function renderCustomToolButtons() {
    document.querySelectorAll("[data-custom-tool]").forEach(btn => {
      const wrapper = btn.closest(".btn-wrap");
      if (wrapper) wrapper.remove();
      else btn.remove();
    });
    if (!aiToolsRow) return;
    settings.customTools.forEach(tool => {
      const btn = createCustomToolButton(tool);
      aiToolsRow.appendChild(btn);
      registerButton(btn);
    });
    syncToolsDensity();
    refreshShortcutMap();
  }

  function registerButton(btn) {
    if (!btn || buttons.includes(btn)) return;
    buttons.push(btn);
    attachButtonTooltip(btn);
    const btnId = btn.id;

    // Wrap button + counter in a flex column container
    const wrapper = document.createElement("div");
    wrapper.className = "btn-wrap";
    btn.parentElement.insertBefore(wrapper, btn);
    wrapper.appendChild(btn);

    const countSpan = document.createElement("span");
    countSpan.className = "btn-opens";
    const cnt = openCounts[btnId] || 0;
    countSpan.textContent = cnt > 0 ? formatOpenCount(cnt) : "";
    wrapper.appendChild(countSpan);

    btn.addEventListener("click", (e) => {
      openCounts[btnId] = (openCounts[btnId] || 0) + 1;
      saveOpenCounts(openCounts);
      countSpan.textContent = formatOpenCount(openCounts[btnId]);

      // Ripple effect
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      const size = Math.max(rect.width, rect.height) * 2;
      ripple.style.width = ripple.style.height = size + "px";
      ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
      ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
      btn.appendChild(ripple);
      const url = btn.dataset.url;
      if (!url) {
        ripple.remove();
        return;
      }
      setTimeout(() => {
        ripple.remove();
        location.assign(url);
      }, 350);
    });
  }

  document.querySelectorAll(".buttons .button").forEach(registerButton);
  renderCustomToolButtons();
  applyAiToolVisibility();

  // ===== Clock (no innerHTML per tick — colon element created once) =====
  const DAYS   = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
  const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const timeEl = document.getElementById("clock-time");
  const dateEl = document.getElementById("clock-date");
  const greetEl = document.getElementById("greeting");
  const secFill = document.getElementById("clock-sec-fill");

  // Build clock DOM once: <span>HH</span><span class="colon">:</span><span>MM</span>
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

  let lastMinute = -1;
  let lastDate = -1;
  let lastGreetingHour = -1;
  function updateClock() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();

    if (timeEl) {
      if (m !== lastMinute) {
        hoursSpan.textContent = String(h).padStart(2, "0");
        minutesSpan.textContent = String(m).padStart(2, "0");
        lastMinute = m;
      }
      colonSpan.classList.toggle("colon-dim", s % 2 !== 0);
    }
    // Date changes once per day
    const d = now.getDate();
    if (dateEl && d !== lastDate) {
      dateEl.textContent = `${DAYS[now.getDay()]} · ${d} ${MONTHS[now.getMonth()]}`;
      lastDate = d;
    }
    // Greeting changes at hour boundaries
    if (greetEl && h !== lastGreetingHour) {
      greetEl.textContent = getGreeting(h);
      lastGreetingHour = h;
    }
    // Seconds bar — disable transition at 0 to prevent backwards animation
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
    const days = (now - knownNew) / 86400000; // ms per day
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

  // ===== Workday Progress Bar (9:00–18:00) =====
  const workdayBar = document.getElementById("workday-bar");
  const workdayFill = document.getElementById("workday-fill");
  const workdayLabel = document.getElementById("workday-label");
  const WORK_START = 9 * 60;  // 9:00 in minutes
  const WORK_END = 18 * 60;   // 18:00 in minutes
  const WORK_DURATION = WORK_END - WORK_START;

  function updateWorkday() {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const day = now.getDay(); // 0=Sun, 6=Sat

    if (day === 0 || day === 6 || mins < WORK_START || mins >= WORK_END) {
      // Weekend or outside work hours
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

  // Unified minute-tick: update day progress + workday every 60s (instead of 2 separate setIntervals)
  setInterval(() => { updateDayProgress(); updateWorkday(); }, 60000);

  // ===== Weather (Open-Meteo, no API key) =====
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
    localStorage.removeItem("aiHubWeatherCoords");
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

  // City-based weather: read saved city from localStorage, geocode via Open-Meteo, then fetch weather
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
          localStorage.setItem("aiHubWeatherCoords", JSON.stringify({ lat: loc.latitude, lon: loc.longitude }));
          showWeather(loc.latitude, loc.longitude);
          if (realStarfieldLayer && !Number.isFinite(settings.realSkyLat)) {
            realStarfieldLayer.setLocation(loc.latitude, loc.longitude);
          }
          if (realConstellationLayer && !Number.isFinite(settings.realSkyLat)) {
            realConstellationLayer.setLocation(loc.latitude, loc.longitude);
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

  // On load: use cached coords for instant weather, or geocode saved city
  const savedCity = localStorage.getItem("aiHubCity") || "";
  const cachedCoords = (() => { try { return JSON.parse(localStorage.getItem("aiHubWeatherCoords")); } catch { return null; } })();

  if (hasValidCoords(cachedCoords)) {
    showWeather(cachedCoords.lat, cachedCoords.lon);
  } else if (savedCity) {
    fetchWeatherForCity(savedCity);
  } else {
    hideWeather();
  }

  // City input in settings
  const cityInput = document.getElementById("set-city");
  if (cityInput) {
    cityInput.value = savedCity;
    let cityTimeout = null;
    cityInput.addEventListener("input", () => {
      clearTimeout(cityTimeout);
      cityTimeout = setTimeout(() => {
        const city = cityInput.value.trim();
        localStorage.setItem("aiHubCity", city);
        if (city) {
          fetchWeatherForCity(city);
        } else {
          localStorage.removeItem("aiHubWeatherCoords");
          hideWeather();
        }
      }, 800); // debounce 800ms
    });
  }

  // ===== Typewriter Subtitle =====
  const subtitleEl = document.getElementById("subtitle");
  if (subtitleEl) {
    const text = "Your AI Workspace";
    let i = 0;
    subtitleEl.classList.add("typing-cursor");
    const typeInterval = setInterval(() => {
      subtitleEl.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(typeInterval);
        setTimeout(() => subtitleEl.classList.remove("typing-cursor"), 1500);
      }
    }, 70);
  }

  // ===== Tooltip =====
  tooltipDiv = document.createElement("div");
  tooltipDiv.className = "tooltip";
  document.body.appendChild(tooltipDiv);

  function attachButtonTooltip(btn) {
    if (!btn || btn.dataset.tooltipBound === "true") return;
    const tip = btn.dataset.tooltip;
    if (!tip) return;
    btn.dataset.tooltipBound = "true";
    btn.addEventListener("mouseenter", () => {
      if (!tooltipDiv) return;
      tooltipDiv.textContent = tip;
      const rect = btn.getBoundingClientRect();
      tooltipDiv.style.left = (rect.left + rect.width / 2) + "px";
      tooltipDiv.style.top = (rect.bottom + 10) + "px";
      tooltipDiv.classList.add("visible");
    });
    btn.addEventListener("mouseleave", () => {
      if (tooltipDiv) tooltipDiv.classList.remove("visible");
    });
  }

  buttons.forEach(attachButtonTooltip);

  // ===== Cursor Spotlight + Starfield mouse (single listener) =====
  const spotlight = document.getElementById("spotlight");
  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;

  document.addEventListener("mousemove", e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (spotlight) {
      spotlight.style.left = e.clientX + "px";
      spotlight.style.top  = e.clientY + "px";
    }
    if (starfieldInstance) {
      starfieldInstance.mouseX = e.clientX;
      starfieldInstance.mouseY = e.clientY;
    }
    if (workerStarfieldLayer) workerStarfieldLayer.setMouse(e.clientX, e.clientY);
  });

  // ===== Keyboard (shortcuts + Konami — single listener) =====
  const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
  let konamiIdx = 0;

  // Keep shortcut map aligned with visible buttons.
  refreshShortcutMap();

  document.addEventListener("keydown", e => {
    // Ignore shortcuts when typing in inputs
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    // "/" focuses search bar
    if (e.key === "/" && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (searchInput) { e.preventDefault(); searchInput.focus(); searchInput.select(); }
      return;
    }
    // Shortcuts for visible launch buttons
    if (!e.altKey && !e.ctrlKey && !e.metaKey) {
      const url = shortcutMap[e.key];
      if (url) { location.assign(url); return; }
    }
    // Konami Code
    if (e.key === KONAMI[konamiIdx]) {
      konamiIdx++;
      if (konamiIdx === KONAMI.length) {
        konamiIdx = 0;
        body.classList.add("matrix-mode");
        setTimeout(() => body.classList.remove("matrix-mode"), 5000);
      }
    } else {
      konamiIdx = e.key === KONAMI[0] ? 1 : 0;
    }
  });

  // ===== Floating Dust =====
  const dustInstance = new FloatingDust(settings.dust, settings.hdr);

  let rainEffectInstance = null;
  function setRainEnabled(enabled) {
    const rCanvas = document.getElementById("rain-glass-canvas");
    if (!rCanvas) return;
    if (enabled) {
      body.classList.add("rain-enabled");
      if (!rainEffectInstance) {
        rainEffectInstance = new RainEffect(rCanvas);
      }
      rainEffectInstance.start();
    } else {
      body.classList.remove("rain-enabled");
      if (rainEffectInstance) {
        rainEffectInstance.stop();
      }
    }
  }

  // ===== Starfield / Warp init =====
  let starfieldInstance = null;
  let threeStarfieldLayer = null;
  let cosmicDepthLayer = null;
  let glassRefractionLayer = null;
  let realStarfieldLayer = null;
  let realConstellationLayer = null;
  let webgpuStarfieldLayer = null;
  let workerStarfieldLayer = null;
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
    if (window.ThreeStaticStarfieldLayer) {
      threeStarfieldLayer = new window.ThreeStaticStarfieldLayer(settings);
      window.threeStarfieldLayer = threeStarfieldLayer;
    }
    if (window.CosmicDepthLayer) cosmicDepthLayer = new window.CosmicDepthLayer(settings);
    glassRefractionLayer = new GlassRefractionLayer(canvas, settings);
    setRainEnabled(settings.rain === true);
    const fromCache = (() => { try { return JSON.parse(localStorage.getItem("aiHubWeatherCoords")); } catch { return null; } })();
    const initLat = Number.isFinite(settings.realSkyLat) ? settings.realSkyLat
      : (fromCache && Number.isFinite(fromCache.lat)) ? fromCache.lat : undefined;
    const initLon = Number.isFinite(settings.realSkyLon) ? settings.realSkyLon
      : (fromCache && Number.isFinite(fromCache.lon)) ? fromCache.lon : undefined;
    if (realSkyCanvas && window.AIHubRealStarfield) {
      realStarfieldLayer = new window.AIHubRealStarfield(realSkyCanvas, {
        enabled: settings.realSky === true,
        hdr: settings.hdr !== false,
        starGlow: settings.starGlow,
        catalogUrl: (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL)
          ? chrome.runtime.getURL("shared/yale-bsc.json")
          : "shared/yale-bsc.json",
        lat: initLat,
        lon: initLon
      });
      if (settings.realSky === true) body.classList.add("real-sky-on");
    }
    if (window.AIHubRealConstellationLayer) {
      realConstellationLayer = new window.AIHubRealConstellationLayer({
        enabled: settings.constellations !== false,
        hdr: settings.hdr !== false,
        settings,
        lat: initLat,
        lon: initLon
      });
    }
    if (webgpuCanvas && window.AIHubWebGPUStarfield) {
      webgpuStarfieldLayer = new window.AIHubWebGPUStarfield(webgpuCanvas, {
        enabled: settings.webgpuStars === true,
        hdr: settings.hdr !== false,
        starGlow: settings.starGlow,
        count: 12000
      });
      if (settings.webgpuStars === true) {
        // Async init may flip supported a few frames later; sync class + suppression flag once it does.
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

  releaseInitialPaint();

});

// ============================================================
// CanvasBloomLayer is kept for compatibility, but disabled for crisp stars.
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
    return false;
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
// GlassRefractionLayer — Three.js WebGL lenses under glass UI
// ============================================================
class GlassRefractionLayer {
  constructor(sourceCanvas, settings) {
    this.sourceCanvas = sourceCanvas;
    this.settings = settings || {};
    this.targets = [
      ".search-form",
      ".buttons .button",
      ".focus-mode-tabs",
      ".focus-action",
      ".settings-panel",
      ".focus-toast.visible",
      ".tooltip.visible",
      ".bottom-buttons .icon-button"
    ];
    this.layers = [];
    this.time = 0;
    this.lastW = 0;
    this.lastH = 0;
    this.enabled = Boolean(window.THREE && sourceCanvas);
    if (!this.enabled) return;

    try {
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(
        window.innerWidth / -2,
        window.innerWidth / 2,
        window.innerHeight / 2,
        window.innerHeight / -2,
        -10,
        10
      );
      this.camera.position.z = 1;
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
        powerPreference: "low-power",
        preserveDrawingBuffer: false
      });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.view = this.renderer.domElement;
      this.view.className = "glass-refraction-layer";
      document.body.appendChild(this.view);

      this.texture = new THREE.CanvasTexture(this.sourceCanvas);
      this.texture.flipY = false;
      this.texture.generateMipmaps = false;
      this.texture.minFilter = THREE.LinearFilter;
      this.texture.magFilter = THREE.LinearFilter;
      this.texture.wrapS = THREE.ClampToEdgeWrapping;
      this.texture.wrapT = THREE.ClampToEdgeWrapping;

      this.geometry = new THREE.PlaneGeometry(1, 1);
      this._render = this._render.bind(this);
      this.rafId = requestAnimationFrame(this._render);
    } catch {
      this.enabled = false;
    }
  }

  _createLayer() {
    const uniforms = {
      uTexture: { value: this.texture },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uPanelSize: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: 10 },
      uStrength: { value: new THREE.Vector2(12, 9) },
      uTime: { value: 0 },
      uOpacity: { value: 0.9 }
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uTexture;
        uniform vec2 uResolution;
        uniform vec2 uPanelSize;
        uniform vec2 uStrength;
        uniform float uRadius;
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;

        float roundedBox(vec2 p, vec2 b, float r) {
          vec2 q = abs(p) - b + r;
          return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        }

        void main() {
          vec2 localPx = (vUv - 0.5) * uPanelSize;
          float sdf = roundedBox(localPx, uPanelSize * 0.5, uRadius);
          
          // Маска панели со сглаживанием края
          float mask = 1.0 - smoothstep(-1.0, 1.5, sdf);
          if (mask <= 0.001) discard;

          // Физическое преломление на скосах краев (bevel refraction)
          // Сила преломления пикует на расстоянии 0-14px от края панели
          float distToEdge = abs(sdf);
          float edgeWeight = smoothstep(14.0, 0.0, distToEdge);
          
          // Направление преломления (нормаль к краю панели)
          vec2 edgeNormal = normalize(localPx + 0.0001);
          
          // Волна света, бегущая по стеклу
          float wave = sin((localPx.x - localPx.y) * 0.02 + uTime * 0.8) * 0.05;
          
          // Общий вектор сдвига координат
          vec2 bend = edgeNormal * (edgeWeight * 1.85 + wave * edgeWeight);
          vec2 offset = bend * uStrength / uResolution;

          // Координаты на экране
          vec2 screenUv = vec2(gl_FragCoord.x / uResolution.x, 1.0 - gl_FragCoord.y / uResolution.y);
          
          // Хроматическая абберация (интенсивное расщепление каналов на скосе)
          vec4 centerSample = texture2D(uTexture, screenUv + offset);
          vec4 redSample = texture2D(uTexture, screenUv + offset * 1.95);
          vec4 blueSample = texture2D(uTexture, screenUv - offset * 1.25);
          
          vec3 color = vec3(redSample.r, centerSample.g, blueSample.b);
          
          // Подсветка фаски (световой блик на краю стекла)
          float edgeHighlight = smoothstep(2.5, 0.0, distToEdge) * 0.28;
          color += vec3(edgeHighlight * 1.1, edgeHighlight * 1.2, edgeHighlight * 1.4);
          
          // Легкое затемнение внутри стекла для объема
          color *= mix(1.0, 0.78, smoothstep(0.0, 30.0, distToEdge));

          // Прозрачность панели
          float luma = max(max(color.r, color.g), color.b);
          float alpha = mask * (0.16 + edgeHighlight + smoothstep(0.02, 0.42, luma) * 0.42) * uOpacity;
          
          gl_FragColor = vec4(color, alpha);
        }
      `
    });

    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return { mesh, material, uniforms };
  }

  _getVisibleTargets() {
    const nodes = [];
    const seen = new Set();
    this.targets.forEach(selector => {
      document.querySelectorAll(selector).forEach(node => {
        if (seen.has(node)) return;
        seen.add(node);
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return;
        const rect = node.getBoundingClientRect();
        if (rect.width < 16 || rect.height < 16) return;
        if (rect.right < 0 || rect.bottom < 0 || rect.left > window.innerWidth || rect.top > window.innerHeight) return;
        nodes.push({ node, rect });
      });
    });
    return nodes.slice(0, 28);
  }

  _resizeIfNeeded() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === this.lastW && h === this.lastH) return;
    this.lastW = w;
    this.lastH = h;
    this.renderer.setSize(w, h, false);
    this.camera.left = w / -2;
    this.camera.right = w / 2;
    this.camera.top = h / 2;
    this.camera.bottom = h / -2;
    this.camera.updateProjectionMatrix();
  }

  updateSettings(settings) {
    this.settings = settings || this.settings;
  }

  _render() {
    if (!this.enabled || !this.renderer || !this.texture) return;
    const active = this.settings.refraction !== false && this.settings.acrylic !== false;
    this.view.classList.toggle("hidden", !active);
    if (!active) {
      this.rafId = requestAnimationFrame(this._render);
      return;
    }

    this.time += 0.016;
    this._resizeIfNeeded();

    let activeSource = this.sourceCanvas;
    const tsl = window.threeStarfieldLayer;
    if (tsl && tsl.enabled && tsl.settings.threeStars !== false && tsl.settings.cosmicDepth !== false) {
      if (tsl.renderer && tsl.renderer.domElement) {
        activeSource = tsl.renderer.domElement;
      }
    }
    if (this.texture.image !== activeSource) {
      this.texture.image = activeSource;
    }
    this.texture.needsUpdate = true;

    const targets = this._getVisibleTargets();
    while (this.layers.length < targets.length) {
      this.layers.push(this._createLayer());
    }

    this.layers.forEach((layer, index) => {
      const target = targets[index];
      if (!target) {
        layer.mesh.visible = false;
        return;
      }

      const rect = target.rect;
      const radius = target.node.classList.contains("button") ? 10 : Math.min(16, Math.max(8, rect.height * 0.22));
      layer.mesh.visible = true;
      layer.mesh.position.set(
        rect.left + rect.width / 2 - window.innerWidth / 2,
        window.innerHeight / 2 - rect.top - rect.height / 2,
        0
      );
      layer.mesh.scale.set(rect.width, rect.height, 1);

      layer.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
      layer.uniforms.uPanelSize.value.set(rect.width, rect.height);
      layer.uniforms.uRadius.value = radius;
      layer.uniforms.uTime.value = this.time + index * 0.7;
      layer.uniforms.uOpacity.value = target.node.classList.contains("button") ? 0.72 : 0.82;

      const xStrength = Math.min(28, Math.max(13, rect.width * 0.065));
      const yStrength = Math.min(22, Math.max(10, rect.height * 0.13));
      layer.uniforms.uStrength.value.set(xStrength, yStrength);
    });

    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this._render);
  }
}

// ============================================================
// RainEffect — physical rain drops on acrylic glass
// ============================================================
class RainEffect {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.drops = [];
    this.staticDrops = [];
    this.width = 0;
    this.height = 0;
    this.lastTime = 0;
    this.active = false;
    this.rafId = null;

    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
    if (this.active) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.95)";
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.drops = [];
    this.staticDrops = [];
    
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.95)";
    this.ctx.fillRect(0, 0, this.width, this.height);

    const staticCount = Math.floor((this.width * this.height) / 12000);
    for (let i = 0; i < staticCount; i++) {
      this.staticDrops.push(this._createStaticDrop(true));
    }

    this.lastTime = performance.now();
    this._loop = this._loop.bind(this);
    this.rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    this.active = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  _createStaticDrop(randomY = false) {
    return {
      x: Math.random() * this.width,
      y: randomY ? Math.random() * this.height : -10,
      r: Math.random() * 2.5 + 1.2,
      opacity: Math.random() * 0.4 + 0.3
    };
  }

  _createRunningDrop() {
    return {
      x: Math.random() * this.width,
      y: -20,
      r: Math.random() * 2.8 + 2.5,
      vy: Math.random() * 1.5 + 1.8,
      vx: 0,
      trail: [],
      trailLength: Math.floor(Math.random() * 15 + 10),
      lastTrailSpawn: 0
    };
  }

  _loop(time) {
    if (!this.active) return;

    const dt = Math.min(33, time - this.lastTime);
    this.lastTime = time;

    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.016)";
    this.ctx.fillRect(0, 0, this.width, this.height);

    if (this.drops.length < Math.min(18, Math.floor(this.width / 90)) && Math.random() < 0.04) {
      this.drops.push(this._createRunningDrop());
    }

    if (this.staticDrops.length < Math.floor((this.width * this.height) / 10000) && Math.random() < 0.3) {
      this.staticDrops.push(this._createStaticDrop(false));
    }

    this.ctx.globalCompositeOperation = "destination-out";
    this.staticDrops.forEach(drop => {
      const grad = this.ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, drop.r);
      grad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
      grad.addColorStop(0.7, "rgba(255, 255, 255, 0.7)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.drops.forEach((drop, index) => {
      drop.vx += (Math.random() - 0.5) * 0.22;
      drop.vx = Math.max(-0.8, Math.min(0.8, drop.vx));
      drop.x += drop.vx;
      drop.y += drop.vy;

      if (time - drop.lastTrailSpawn > 25) {
        drop.trail.push({ x: drop.x, y: drop.y, r: drop.r * 0.76 });
        if (drop.trail.length > drop.trailLength) {
          drop.trail.shift();
        }
        drop.lastTrailSpawn = time;
      }

      for (let i = this.staticDrops.length - 1; i >= 0; i--) {
        const sd = this.staticDrops[i];
        const dist = Math.hypot(drop.x - sd.x, drop.y - sd.y);
        if (dist < drop.r + sd.r + 2.5) {
          drop.r = Math.min(5.5, drop.r + 0.12);
          drop.vy = Math.min(4.5, drop.vy + 0.18);
          this.staticDrops.splice(i, 1);
        }
      }

      this.ctx.globalCompositeOperation = "destination-out";
      drop.trail.forEach((p, idx) => {
        const ratio = idx / drop.trail.length;
        const radius = p.r * (0.35 + ratio * 0.65);
        const grad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        grad.addColorStop(0, "rgba(255, 255, 255, 0.8)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
      });

      const dropGrad = this.ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, drop.r);
      dropGrad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
      dropGrad.addColorStop(0.8, "rgba(255, 255, 255, 0.8)");
      dropGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
      this.ctx.fillStyle = dropGrad;
      this.ctx.beginPath();
      this.ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
      this.ctx.fill();

      if (drop.y > this.height + 20) {
        this.drops.splice(index, 1);
      }
    });

    this.ctx.globalCompositeOperation = "source-over";
    
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    this.staticDrops.forEach(drop => {
      this.ctx.beginPath();
      this.ctx.arc(drop.x - drop.r * 0.18, drop.y - drop.r * 0.18, drop.r * 0.35, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.drops.forEach(drop => {
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
      this.ctx.beginPath();
      this.ctx.arc(drop.x - drop.r * 0.2, drop.y - drop.r * 0.2, drop.r * 0.38, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
      this.ctx.lineWidth = 0.5;
      this.ctx.beginPath();
      this.ctx.arc(drop.x, drop.y, drop.r - 0.5, 0, Math.PI * 2);
      this.ctx.stroke();
    });

    this.rafId = requestAnimationFrame(this._loop);
  }
}

// ============================================================
// Floating Dust (separate canvas, 40 motes)
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
    this._rafId = requestAnimationFrame(() => this._loop());
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
      this._rafId = requestAnimationFrame(() => this._loop());
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
    this._rafId = requestAnimationFrame(() => this._loop());
  }
}

// ============================================================
// WarpField — Realistic flight through space
// ============================================================
class WarpField {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.hdrEnabled = options.hdr !== false;
    this.ctx = aiHubGet2dContext(canvas, this.hdrEnabled);
    this.starGlow = aiHubNormalizeStarGlow(options.starGlow);
    this.reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.stars = [];
    this.starCount = normalizeFlightStarCount(options.flightStarCount);
    this.flightSpeed = normalizeFlightSpeed(options.flightSpeed);
    this.speed = 0.18 * this.flightSpeed;
    this.baseSpeed = this.reducedMotion ? 0.018 : 0.18;
    this.speedBreathRange = this.reducedMotion ? 0 : 0.04;
    this.width = 0;
    this.height = 0;
    this.cx = 0;
    this.cy = 0;
    this.stopped = false;
    this.maxDepth = 2000;
    this.focalLength = 400;
    this.time = 0;
    this.entryProgress = options.instant ? 1 : 0;
    this.nextClosePass = 300 + Math.random() * 600;
    this.flightForegroundEnabled = options.flightForeground !== false;

    this.starColors = [
      { r: 255, g: 255, b: 255 },
      { r: 255, g: 255, b: 255 },
      { r: 255, g: 255, b: 255 },
      { r: 220, g: 235, b: 255 },
      { r: 200, g: 220, b: 255 },
      { r: 255, g: 245, b: 230 },
      { r: 255, g: 235, b: 200 },
      { r: 255, g: 210, b: 170 },
      { r: 180, g: 210, b: 255 },
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

  setFlightSpeed(value) {
    this.flightSpeed = normalizeFlightSpeed(value);
  }

  setStarCount(value) {
    const nextCount = normalizeFlightStarCount(value);
    if (nextCount === this.starCount) return;
    this.starCount = nextCount;
    if (this.stars.length > nextCount) {
      this.stars.length = nextCount;
      return;
    }
    while (this.stars.length < nextCount) {
      this.stars.push(this._makeStar(true));
    }
  }

  setFlightForeground(enabled) {
    this.flightForegroundEnabled = enabled !== false;
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
    const audio = window.aiHubAudioLevels ? window.aiHubAudioLevels() : { bass: 0, high: 0, beat: 0 };
    const audioBass = audio.bass || 0;
    const audioHigh = audio.high || 0;
    const audioBeat = audio.beat || 0;

    const orbitR = 30;
    const orbitPeriod = 3600;
    const cx = (w / 2) + Math.cos(this.time / orbitPeriod * TAU) * orbitR;
    const cy = (h / 2) + Math.sin(this.time / orbitPeriod * TAU * 0.7) * orbitR * 0.6;

    this.entryProgress = Math.min(1, this.entryProgress + 0.014);
    const ramp = this.entryProgress * this.entryProgress * (3 - 2 * this.entryProgress);
    const cruiseSpeed = this.baseSpeed + Math.sin(this.time * 0.008) * this.speedBreathRange;
    this.speed = (0.035 + (cruiseSpeed - 0.035) * ramp) * normalizeFlightSpeed(this.flightSpeed) * (1 + audioBass * 0.9 + audioBeat * 0.45);
    const spd = this.speed;
    const dz = spd * 5.2;

    this.nextClosePass--;
    if (this.flightForegroundEnabled && this.nextClosePass <= 0) {
      this.nextClosePass = 600 + Math.random() * 600;
      const color = this.starColors[Math.floor(Math.random() * this.starColors.length)];
      const spread = Math.max(w, h) * 0.8;
      this.stars.push({
        x: (Math.random() - 0.5) * spread,
        y: (Math.random() - 0.5) * spread,
        z: 80 + Math.random() * 120,
        r: color.r, g: color.g, b: color.b,
        color: aiHubCanvasColor(color.r, color.g, color.b, 1, this.hdrEnabled),
        brightness: 1.0
      });
    } else if (!this.flightForegroundEnabled && this.nextClosePass <= 0) {
      this.nextClosePass = 600 + Math.random() * 600;
    }

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "round";

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      const prevZ = star.z;
      star.z -= dz;

      if (star.z <= (this.flightForegroundEnabled ? 1 : maxD * 0.48)) {
        Object.assign(star, this._makeStar(false));
        continue;
      }

      const k = fl / star.z;
      let sx = cx + star.x * k;
      let sy = cy + star.y * k;

      if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) {
        Object.assign(star, this._makeStar(false));
        continue;
      }

      const prevK = fl / prevZ;
      let prevSx = cx + star.x * prevK;
      let prevSy = cy + star.y * prevK;

      const depthRatio = 1 - star.z / maxD;
      const glow = aiHubNormalizeStarGlow(this.starGlow);
      const lift = Math.max(0, glow - 1);
      const brightRank = Math.min(1, Math.pow(Math.max(0, depthRatio), 2.2) * (0.65 + star.brightness * 0.55));
      const boost = 1 + lift * brightRank * 1.6 + audioHigh * brightRank * 0.42 + audioBeat * brightRank * 0.35;
      let alpha = Math.max(0, Math.min(1, depthRatio * 1.35 * boost)) * star.brightness;
      let size = Math.max(0.15, depthRatio * 1.8) * (1 + audioBass * brightRank * 0.18);
      if (!this.flightForegroundEnabled) {
        alpha = Math.min(0.42, alpha * 0.62);
        size *= 0.72;
      }

      if (alpha < 0.01) continue;

      const dx = sx - prevSx;
      const dy = sy - prevSy;
      const streakLen = Math.sqrt(dx * dx + dy * dy);

      // Gate by motion alone — the previous `spd > 0.12` happened to equal baseSpeed,
      // so trails flickered on/off with every breath cycle. streakLen drops naturally
      // for distant stars, so they still render as points.
      if (streakLen > 0.4) {
        const tailScale = 2.6 + spd * 2.8;
        const rawTailX = dx * tailScale;
        const rawTailY = dy * tailScale;
        const rawTailLen = Math.sqrt(rawTailX * rawTailX + rawTailY * rawTailY);
        const maxTail = this.flightForegroundEnabled
          ? 10 + brightRank * 48 + Math.min(24, spd * 4)
          : 5 + brightRank * 22 + Math.min(10, spd * 2);
        const tailClamp = Math.min(1, maxTail / Math.max(0.001, rawTailLen));
        const tailX = sx - rawTailX * tailClamp;
        const tailY = sy - rawTailY * tailClamp;
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

      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, TAU);
      ctx.fill();

    }

    ctx.globalAlpha = 1;

    requestAnimationFrame(() => this._animate());
  }
}

// ============================================================
// Starfield (4200 stars, shooting stars, constellations)
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
    this.reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.shootingEnabled = settings.shooting;
    this.constellationsEnabled = settings.constellations;
    this.flightSpeed = normalizeFlightSpeed(this.settings.flightSpeed);
    this.starCount = this._resolveStarCount();
    this.colors = aiHubStarPalette(this.hdrEnabled);
    this.constellations = [];
    this.nextConstellTime = Date.now() + 5000;
    this.fallenCount = 0; // stars currently "detached" and awaiting respawn

    this.stopped = false;

    // Parallax drift disabled — visible drift made brighter stars appear to float.
    this.driftAngle = Math.random() * Math.PI * 2;
    this.driftSpeed = 0;

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

  setFlightSpeed(value) {
    this.settings.flightSpeed = normalizeFlightSpeed(value);
    this.flightSpeed = this.settings.flightSpeed;
  }

  setFlightStarCount(value) {
    this.settings.flightStarCount = normalizeFlightStarCount(value);
    if (this.settings.warpSkyOverlay !== true) return;
    const nextCount = this._resolveStarCount();
    if (nextCount === this.starCount) return;
    this.starCount = nextCount;
    this._createStars();
    this.fallenCount = 0;
  }

  setFlightForeground(enabled) {
    this.settings.flightForeground = enabled !== false;
    if (this.settings.warpSkyOverlay !== true) return;
    this._createStars();
    this.fallenCount = 0;
  }

  _resolveStarCount() {
    if (this.settings.warpSkyOverlay === true) {
      return normalizeWarpSkyStarCount(this.settings.flightStarCount);
    }
    return 5600;
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
    for (let i = 0; i < nodes.length - 1; i++) {
      lines.push([nodes[i], nodes[i + 1]]);
    }
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
      if (s.size < 0.5 || s.fadeIn > 0) continue;               // too small or still fading in
      if (s.y > this.height * 0.6) continue;                      // only upper 60%
      const dx = s.x - cx, dy = s.y - cy;
      if (dx * dx + dy * dy < 90000) continue;                    // not within 300px of center
      candidates.push(i);
    }
    if (candidates.length === 0) return null;
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    const star = this.stars[idx];
    const origin = { x: star.x, y: star.y };
    this.stars.splice(idx, 1);
    this.fallenCount++;
    // Schedule replacement star after 5-15s
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
    // Pick layer randomly: mostly tiny stars, with brightness tied to size.
    const r = Math.random();
    let minS, maxS, alpha;
    if (r < 0.50) { minS = 0.08; maxS = 0.20; alpha = 0.22; }
    else if (r < 0.82) { minS = 0.16; maxS = 0.36; alpha = 0.36; }
    else if (r < 0.95) { minS = 0.32; maxS = 0.62; alpha = 0.52; }
    else if (r < 0.99) { minS = 0.58; maxS = 0.95; alpha = 0.68; }
    else { minS = 0.90; maxS = 1.18; alpha = 0.84; }
    const star = new Star(x, y, minS, maxS, alpha, this.colors);
    star.fadeIn = 180;       // 3s at 60fps
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
  }

  _createStars() {
    this.stars = [];
    const n = this.starCount;
    if (this.settings.warpSkyOverlay === true) {
      this._generateLayer(Math.floor(n * 0.44), 0.07, 0.18, 0.13, false);
      this._generateLayer(Math.floor(n * 0.31), 0.14, 0.34, 0.24, true, { speedScale: 0.62, trail: 0.22 });
      this._generateLayer(Math.floor(n * 0.17), 0.30, 0.58, 0.38, true, { speedScale: 0.92, trail: 0.34 });
      if (this.settings.flightForeground !== false) {
        this._generateLayer(Math.floor(n * 0.065), 0.54, 0.88, 0.52, false, { speedScale: 1.2, trail: 0.42 });
        this._generateLayer(Math.floor(n * 0.015), 0.84, 1.08, 0.68, false, { speedScale: 1.45, trail: 0.52 });
      }
      return;
    }
    this._generateLayer(Math.floor(n * 0.50), 0.08, 0.20, 0.22, false);
    this._generateLayer(Math.floor(n * 0.32), 0.16, 0.36, 0.36, true);
    this._generateLayer(Math.floor(n * 0.13), 0.32, 0.62, 0.52, true);
    this._generateLayer(Math.floor(n * 0.04), 0.58, 0.95, 0.68, false);
    this._generateLayer(Math.floor(n * 0.01), 0.90, 1.18, 0.84, false);
  }

  _generateLayer(count, minSize, maxSize, alpha, cluster, warpMotion) {
    const clusters = [];
    for (let i = 0; i < 5; i++) {
      clusters.push({ x: Math.random() * this.width, y: Math.random() * this.height });
    }
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
      const star = new Star(x, y, minSize, maxSize, alpha, this.colors);
      if (warpMotion && this.settings.warpSkyOverlay === true) {
        this._seedWarpSkyFlight(star, true, warpMotion.speedScale, warpMotion.trail);
      }
      this.stars.push(star);
    }
  }

  _seedWarpSkyFlight(star, randomZ = true, speedScale = 1, trail = 0.25) {
    const fl = Math.max(360, Math.min(this.width, this.height) * 0.52);
    const maxZ = 1450 + Math.random() * 340;
    const minZ = 280;
    const z = randomZ ? minZ + Math.random() * (maxZ - minZ) : maxZ + Math.random() * 280;
    const k = fl / z;
    const cx = this.width / 2;
    const cy = this.height / 2;
    star.warpFly = true;
    star.warpFocalLength = fl;
    star.warpMaxZ = maxZ;
    star.warpZ = z;
    star.warpWorldX = (star.x - cx) / k;
    star.warpWorldY = (star.y - cy) / k;
    star.warpSpeedBase = Math.max(0.2, speedScale);
    star.warpSpeedScale = star.warpSpeedBase * (0.75 + Math.random() * 0.5);
    star.warpTrail = Math.max(0.12, trail);
    star.warpBaseSize = star.size;
    star.prevX = star.x;
    star.prevY = star.y;
    star.warpDepth = 1 - Math.min(1, z / maxZ);
  }

  _resetWarpSkyFlight(star) {
    star.x = Math.random() * this.width;
    star.y = Math.random() * this.height;
    star.size = star.warpBaseSize || star.size;
    this._seedWarpSkyFlight(star, false, star.warpSpeedBase || 1, star.warpTrail || 0.25);
  }

  _advanceWarpSkyFlight(star, speed) {
    if (!star.warpFly || !Number.isFinite(star.warpZ)) return;
    star.prevX = star.x;
    star.prevY = star.y;
    star.warpZ -= speed * star.warpSpeedScale;
    const depth = 1 - Math.min(1, Math.max(0, star.warpZ / star.warpMaxZ));
    const k = star.warpFocalLength / Math.max(1, star.warpZ);
    const cx = this.width / 2;
    const cy = this.height / 2;
    star.x = cx + star.warpWorldX * k;
    star.y = cy + star.warpWorldY * k;
    star.warpDepth = depth;
    const foreground = this.settings.flightForeground !== false;
    star.size = (star.warpBaseSize || star.size) * (1 + depth * (foreground ? 1.25 : 0.68));
    const minZ = foreground ? 180 : star.warpMaxZ * 0.48;
    if (star.warpZ <= minZ || star.x < -90 || star.x > this.width + 90 || star.y < -90 || star.y > this.height + 90) {
      this._resetWarpSkyFlight(star);
    }
  }

  _createWarpSkyStar(x, y) {
    const r = this.settings.flightForeground === false ? Math.random() * 0.93 : Math.random();
    let star;
    if (r < 0.50) star = new Star(x, y, 0.07, 0.18, 0.16, this.colors);
    else if (r < 0.79) star = new Star(x, y, 0.14, 0.34, 0.27, this.colors);
    else if (r < 0.93) star = new Star(x, y, 0.30, 0.58, 0.41, this.colors);
    else if (r < 0.985) star = new Star(x, y, 0.54, 0.88, 0.56, this.colors);
    else star = new Star(x, y, 0.84, 1.08, 0.72, this.colors);
    if (r >= 0.50) this._seedWarpSkyFlight(star, true, r < 0.93 ? 0.82 : 1.25, r < 0.93 ? 0.28 : 0.44);
    return star;
  }

  _animate() {
    if (this.stopped) return;
    const ctx = this.ctx;
    const overlay = this.settings.warpSkyOverlay === true;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!overlay) this._drawDeepSpace(ctx);
    const now = Date.now();

    // Slow parallax drift; in warp overlay, mid/near stars use a light perspective flight.
    this.driftAngle += this.driftSpeed;
    const baseDX = Math.cos(this.driftAngle) * 0.015;
    const baseDY = Math.sin(this.driftAngle) * 0.01;
    const warpSkyFlight = overlay && this.settings.warp === true && !this.reducedMotion;
    const warpSkySpeed = (this.reducedMotion ? 0.05 : 0.18) * normalizeFlightSpeed(this.flightSpeed) * 1.35;
    for (const star of this.stars) {
      if (star.fadeIn > 0) continue; // don't drift stars still fading in
      if (warpSkyFlight && star.warpFly) {
        this._advanceWarpSkyFlight(star, warpSkySpeed);
        continue;
      }
      const depthFactor = 0.3 + star.size * 0.7;
      star.x += baseDX * depthFactor;
      star.y += baseDY * depthFactor;
      // Wrap at edges
      if (star.x < -5) star.x = this.width + 5;
      else if (star.x > this.width + 5) star.x = -5;
      if (star.y < -5) star.y = this.height + 5;
      else if (star.y > this.height + 5) star.y = -5;
    }

    // Shooting stars — suppressed under prefers-reduced-motion (fast trajectory motion).
    const speedMult = Number.isFinite(this.settings.shootingSpeed) ? Math.max(0, this.settings.shootingSpeed) : 1;
    if (this.shootingEnabled && !this.reducedMotion && speedMult > 0 && now >= this.nextShootTime) {
      const scenario = this._pickScenario();
      const stagger = scenario.type === 'shower' ? 120 :
                      scenario.type === 'burst'  ? 250 :
                      scenario.type === 'pair'   ? 350 : 0;
      for (let i = 0; i < scenario.count; i++) {
        setTimeout(() => {
          if (!this.shootingEnabled || this.stopped) return;
          let origin = null;
          // 35% chance for single/pair to originate from a real star
          if ((scenario.type === 'single' || scenario.type === 'pair') && Math.random() < 0.35) {
            origin = this._detachStar();
            // Detach flash: small burst of particles at origin
            if (origin) {
              for (let k = 0; k < 3; k++) {
                this.deathParticles.push(new DeathParticle(origin.x, origin.y, 'detach'));
              }
            }
          }
          this.shootingStars.push(new ShootingStar(this.width, this.height, scenario.type, origin, speedMult));
        }, i * (Math.random() * stagger + 60));
      }
      this.nextShootTime = now + this._shootInterval(scenario.type) / speedMult;
    }

    // Constellations — suppressed when real sky is active (positions wouldn't match catalog).
    if (this.constellationsEnabled && this.settings.realSky !== true) {
      if (now >= this.nextConstellTime && this.constellations.length < 2) {
        this._spawnConstellation();
        this.nextConstellTime = now + Math.random() * 15000 + 10000;
      }
      let ci = this.constellations.length;
      while (ci--) { if (this.constellations[ci].age >= this.constellations[ci].lifespan) this.constellations.splice(ci, 1); }
      for (const c of this.constellations) {
        c.age++;
        if (c.age < c.fadeInFrames) {
          c.alpha = (c.age / c.fadeInFrames) * c.maxAlpha;
        } else if (c.age > c.lifespan - c.fadeOutFrames) {
          c.alpha = ((c.lifespan - c.age) / c.fadeOutFrames) * c.maxAlpha;
        } else {
          c.alpha = c.maxAlpha;
        }
        ctx.save();
        ctx.strokeStyle = aiHubCanvasColor(147, 197, 253, c.alpha, this.hdrEnabled);
        ctx.lineWidth = 0.5;
        for (const [a, b] of c.lines) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Stars with cursor repulsion — batched rendering to minimize save/restore
    const repulseR = overlay ? 0 : 50;
    const repulseR2 = repulseR * repulseR;
    const mx = this.mouseX, my = this.mouseY;
    const TAU = Math.PI * 2;
    const realSkyOn = this.settings.realSky === true;
    const webgpuStarsOn = this.settings.webgpuStarsActive === true;
    const threeActive = !overlay && this.settings.threeStars !== false && this.settings.cosmicDepth !== false && window.THREE;
    const drawCanvasStars = !realSkyOn && !webgpuStarsOn && !threeActive;
    const starGlow = aiHubNormalizeStarGlow(this.settings.starGlow);
    const audio = this.settings.audioReactive && window.aiHubAudioLevels ? window.aiHubAudioLevels() : { bass: 0, high: 0, beat: 0 };
    const audioBass = audio.bass || 0;
    const audioHigh = audio.high || 0;
    const audioBeat = audio.beat || 0;

    for (const star of this.stars) {
      star.update();
      if (!drawCanvasStars) continue;
      const dx = star.x - mx, dy = star.y - my;
      const dist2 = dx * dx + dy * dy;
      let sx = star.x, sy = star.y;
      if (dist2 < repulseR2 && dist2 > 0) {
        const dist = Math.sqrt(dist2);
        const force = (1 - dist / repulseR) * 8;
        sx += (dx / dist) * force;
        sy += (dy / dist) * force;
      }
      const rank = typeof star.luminosity === "number" ? star.luminosity : aiHubStarRankFromSize(star.size);
      const overlayDepth = overlay ? 0.72 + rank * 0.28 : 1;
      const audioLift = 1 + audioHigh * (0.06 + rank * 0.22) + audioBeat * rank * 0.2;
      const alphaBoost = (overlay ? overlayDepth : aiHubGlowBoost(starGlow, rank, 0.18)) * audioLift;
      const radius = (overlay ? Math.min(1.7, Math.max(0.1, star.size * (0.95 + rank * 0.5))) : star.size) * (1 + audioBass * rank * 0.18 + audioBeat * rank * 0.12);
      ctx.fillStyle = star.color;
      if (overlay && star.warpFly && Number.isFinite(star.prevX) && Number.isFinite(star.prevY)) {
        const vx = sx - star.prevX;
        const vy = sy - star.prevY;
        const trailLen = Math.sqrt(vx * vx + vy * vy);
        if (trailLen > 0.35) {
          const foreground = this.settings.flightForeground !== false;
          const maxTrail = foreground ? 8 + (star.warpDepth || 0) * 30 : 5 + (star.warpDepth || 0) * 12;
          const trailScale = Math.min(1, maxTrail / trailLen);
          const tailX = sx - vx * trailScale;
          const tailY = sy - vy * trailScale;
          const trailAlpha = Math.min(foreground ? 0.18 : 0.09, star.alpha * (star.warpTrail || 0.25) * (0.32 + (star.warpDepth || 0) * 0.28));
          const grad = ctx.createLinearGradient(tailX, tailY, sx, sy);
          grad.addColorStop(0, aiHubCanvasColor(120, 175, 255, 0, this.hdrEnabled));
          grad.addColorStop(1, aiHubCanvasColor(210, 235, 255, trailAlpha, this.hdrEnabled));
          ctx.globalAlpha = 1;
          ctx.strokeStyle = grad;
          ctx.lineWidth = Math.max(0.25, radius * 0.55);
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = Math.min(1, star.alpha * alphaBoost);
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Shooting stars — update, draw, handle death
    let i = this.shootingStars.length;
    while (i--) {
      const s = this.shootingStars[i];
      s.update();
      if (s.dead) {
        // Death particles
        const cnt = s.type === 'fireball' ? 12 : 5;
        for (let j = 0; j < cnt; j++) {
          this.deathParticles.push(new DeathParticle(s.x, s.y, s.type));
        }
        // Afterglow for fireballs
        if (s.type === 'fireball') {
          this.afterglows.push({
            x1: s.tailX, y1: s.tailY, x2: s.x, y2: s.y,
            alpha: 0.3, decay: 0.003
          });
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
      ctx.beginPath();
      ctx.moveTo(a.x1, a.y1);
      ctx.lineTo(a.x2, a.y2);
      ctx.strokeStyle = aiHubCanvasColor(255, 200, 100, a.alpha, this.hdrEnabled);
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      ctx.stroke();
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
}

// ============================================================
// Star
// ============================================================
class Star {
  constructor(x, y, minSize, maxSize, baseAlpha, colors) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * (maxSize - minSize) + minSize;
    this.luminosity = aiHubStarRankFromSize(this.size);
    this.baseAlpha = Math.min(1, baseAlpha * (0.72 + this.luminosity * 0.46));
    this.alpha = this.baseAlpha * (Math.random() * 0.28 + 0.72);
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.fadeIn = 0;
    this.fadeDuration = 0;
  }

  update() {
    if (this.fadeIn > 0) {
      this.alpha = this.baseAlpha * (1 - this.fadeIn / this.fadeDuration);
      this.fadeIn--;
    }
  }

  // draw is inlined in Starfield._animate() for batched rendering
}

// ============================================================
// ShootingStar
// ============================================================
class ShootingStar {
  constructor(width, height, type = 'single', origin = null, speedMult = 1) {
    this.width = width;
    this.height = height;
    this.type = type;
    const sm = Math.max(0, Number.isFinite(speedMult) ? speedMult : 1);

    if (origin) {
      // Star-origin meteor: starts from the detached star's position
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
      const speed = (Math.random() * 8 + 14) * sm;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.trailLen = Math.random() * 160 + 200;
      this.size = Math.random() * 1.2 + 2.2;
      this.fadeSpeed = Math.random() * 0.005 + 0.004;
    } else if (type === 'shower') {
      const speed = (Math.random() * 7 + 9) * sm;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.trailLen = Math.random() * 70 + 50;
      this.size = Math.random() * 0.7 + 0.4;
      this.fadeSpeed = Math.random() * 0.015 + 0.012;
    } else {
      const speed = (Math.random() * 9 + 7) * sm;
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
    this.speed = Math.hypot(this.vx, this.vy); // cache for update()
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
    ctx.beginPath();
    ctx.moveTo(this.tailX, this.tailY);
    ctx.lineTo(this.x, this.y);
    ctx.strokeStyle = grad;
    ctx.lineWidth = this.size;
    ctx.lineCap = "round";
    ctx.stroke();

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
// DeathParticle (sparks when shooting star fades)
// ============================================================
class DeathParticle {
  constructor(x, y, parentType) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    this.isFireball = parentType === 'fireball';
    this.isDetach = parentType === 'detach';
    if (this.isDetach) {
      // Gentle outward flash when a star detaches
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
