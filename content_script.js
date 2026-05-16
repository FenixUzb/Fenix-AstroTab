const KEY_PENDING = "cngpt_pending_v1";
const MSG_GET_TAB_ID = "cngpt_get_tab_id";

const PENDING_TTL_MS = 90 * 1000;
const WAIT_LIMIT_MS  = 90 * 1000;
const POLL_MS        = 300;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let currentTabIdPromise = null;
let handledPendingId = null;

function getCurrentTabId() {
  if (!currentTabIdPromise) {
    currentTabIdPromise = new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: MSG_GET_TAB_ID }, (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response && typeof response.tabId === "number" ? response.tabId : null);
        });
      } catch {
        resolve(null);
      }
    });
  }
  return currentTabIdPromise;
}

function getPendingId(pending) {
  return [
    pending.ts || 0,
    typeof pending.targetTabId === "number" ? pending.targetTabId : "all",
    pending.action || "paste",
    pending.text.length
  ].join(":");
}

async function getPending() {
  const obj = await new Promise((resolve) => chrome.storage.local.get(KEY_PENDING, resolve));
  return obj[KEY_PENDING];
}

async function clearPending() {
  await new Promise((resolve) => chrome.storage.local.remove(KEY_PENDING, resolve));
}

function findTextareaTarget() {
  // Intentionally allow hidden textarea: ChatGPT sometimes keeps a fallback textarea that drives state.
  const selectors = [
    'textarea[name="prompt-textarea"]',
    "textarea.wcDTda_fallbackTextarea",
    "textarea#prompt-textarea",
    'textarea[data-testid="prompt-textarea"]',
    "main textarea",
    "textarea"
  ];
  for (const selector of selectors) {
    const target = document.querySelector(selector);
    if (target && target.tagName === "TEXTAREA") return target;
  }
  return null;
}

function findContentEditableTarget() {
  return (
    document.querySelector('#prompt-textarea[contenteditable="true"]') ||
    document.querySelector('[contenteditable="true"][data-testid="prompt-textarea"]') ||
    document.querySelector('[data-lexical-editor="true"][contenteditable="true"]') ||
    document.querySelector(".ProseMirror[contenteditable='true']") ||
    document.querySelector('main [contenteditable="true"][role="textbox"]') ||
    document.querySelector('main [contenteditable="true"]')
  );
}

function dispatchInput(el) {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  // Some editors listen to beforeinput
  try {
    el.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: "" }));
  } catch {}
}

function setTextViaTextarea(textarea, text) {
  if (!textarea || textarea.tagName !== "TEXTAREA") return false;
  try { textarea.focus(); } catch {}
  try {
    const proto = window.HTMLTextAreaElement && window.HTMLTextAreaElement.prototype;
    const setter = proto && Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(textarea, text);
    else textarea.value = text;
  } catch {
    textarea.value = text;
  }
  dispatchInput(textarea);
  try { textarea.setSelectionRange(text.length, text.length); } catch {}
  return true;
}

function setTextViaContentEditable(ce, text) {
  if (!ce) return false;
  try { ce.focus(); } catch {}
  try {
    const selection = window.getSelection && window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(ce);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  } catch {}
  // Best-effort: execCommand triggers more listeners in many editors.
  let ok = false;
  try {
    ok = document.execCommand && document.execCommand("insertText", false, text);
  } catch {}
  if (!ok) {
    ce.textContent = text;
    try { ce.dispatchEvent(new InputEvent("input", { bubbles: true, data: text })); } catch { dispatchInput(ce); }
  } else {
    try { ce.dispatchEvent(new InputEvent("input", { bubbles: true, data: text })); } catch { dispatchInput(ce); }
  }
  return true;
}

function findSendButton() {
  return (
    document.querySelector('button[data-testid="send-button"]') ||
    document.querySelector("#composer-submit-button") ||
    document.querySelector('button[aria-label*="Отправить"]') ||
    document.querySelector('button[aria-label*="Send"]')
  );
}

async function clickSendWhenReady(timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const btn = findSendButton();
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    await sleep(120);
  }
  return false;
}

async function attempt(pending) {
  // 1) Prefer textarea path
  const ta = findTextareaTarget();
  if (ta && setTextViaTextarea(ta, pending.text)) {
    if (pending.action === "send") {
      await sleep(150);
      await clickSendWhenReady();
    }
    return true;
  }

  // 2) Fallback to contenteditable
  const ce = findContentEditableTarget();
  if (ce && setTextViaContentEditable(ce, pending.text)) {
    if (pending.action === "send") {
      await sleep(150);
      await clickSendWhenReady();
    }
    return true;
  }

  return false;
}

async function runForPending(pending) {
  if (!pending || !pending.text) return;

  const age = Date.now() - (pending.ts || 0);
  if (age < 0 || age > PENDING_TTL_MS) {
    await clearPending();
    return;
  }

  if (typeof pending.targetTabId === "number") {
    const currentTabId = await getCurrentTabId();
    if (currentTabId !== pending.targetTabId) return;
  }

  const pendingId = getPendingId(pending);
  if (handledPendingId === pendingId) return;
  handledPendingId = pendingId;

  const start = Date.now();

  if (await attempt(pending)) {
    await clearPending();
    return;
  }

  let done = false;
  const observer = new MutationObserver(async () => {
    if (done) return;
    if (Date.now() - start > WAIT_LIMIT_MS) {
      done = true;
      observer.disconnect();
      return;
    }

    if (await attempt(pending)) {
      done = true;
      observer.disconnect();
      await clearPending();
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  try {
    while (!done && Date.now() - start < WAIT_LIMIT_MS) {
      if (await attempt(pending)) {
        done = true;
        observer.disconnect();
        await clearPending();
        break;
      }
      await sleep(POLL_MS);
    }
  } finally {
    if (!done) {
      done = true;
      observer.disconnect();
    }
  }
}

(async function init() {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "local") return;
    if (!changes[KEY_PENDING] || !changes[KEY_PENDING].newValue) return;
    await runForPending(changes[KEY_PENDING].newValue);
  });

  const pending = await getPending();
  if (pending) await runForPending(pending);
})();
