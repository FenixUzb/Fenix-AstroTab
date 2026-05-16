(() => {
  function normalizeScale(value) {
    const scale = Number(value);
    return Number.isFinite(scale) ? Math.min(1.15, Math.max(0.5, scale)) : 1;
  }

  function normalizeSearchWidth(value) {
    const width = Number(value);
    return Number.isFinite(width) ? Math.min(800, Math.max(320, Math.round(width))) : 460;
  }

  const root = document.documentElement;
  let bootReleased = false;
  window.aiHubReleaseBoot = () => {
    if (bootReleased) return;
    bootReleased = true;
    document.getElementById("aihub-preload-tool-visibility")?.remove();
    root.classList.remove("aihub-booting");
    root.classList.add("aihub-ready");
  };
  window.setTimeout(window.aiHubReleaseBoot, 1600);

  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem("aiHubSettings"));
  } catch {}

  const scale = normalizeScale(saved && saved.scale);
  const searchWidth = normalizeSearchWidth(saved && saved.searchWidth);
  const rules = [
    `:root { --ui-scale: ${scale} !important; --search-width: ${searchWidth}px !important; }`,
    `.container { transform: scale(${scale}) !important; transform-origin: center !important; }`,
    ".buttons { opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }"
  ];

  const defaults = {
    chatgpt: true,
    gemini: true,
    claude: true,
    perplexity: false,
    grok: false,
    qwen: false,
    deepseek: false,
    copilot: false,
    mistral: false
  };

  let savedTools = {};
  if (saved && saved.aiTools && typeof saved.aiTools === "object") {
    savedTools = saved.aiTools;
  }

  const tools = { ...defaults, ...savedTools };
  const ids = Object.keys(defaults);
  if (!ids.some(id => tools[id] !== false)) tools.chatgpt = true;

  const hiddenIds = ids.filter(id => tools[id] === false);
  if (hiddenIds.length) {
    rules.push(`${hiddenIds.map(id => `.buttons [data-ai-tool="${id}"]`).join(",")} { display: none !important; visibility: hidden !important; }`);
  }

  const style = document.createElement("style");
  style.id = "aihub-preload-tool-visibility";
  style.textContent = rules.join("\n");
  (document.head || document.documentElement).appendChild(style);
})();
