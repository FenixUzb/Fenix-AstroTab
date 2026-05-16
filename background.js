const KEY_PENDING = "cngpt_pending_v1";
const KEY_FOCUS_ALARM = "aihub_focus_alarm_v1";
const MENU_PASTE_ID = "cngpt_paste_to_chatgpt";
const MSG_GET_TAB_ID = "cngpt_get_tab_id";
const MSG_FOCUS_SCHEDULE = "aihub_focus_schedule";
const MSG_FOCUS_CANCEL = "aihub_focus_cancel";
const FOCUS_ALARM_NAME = "aihub_focus_complete";
const FOCUS_LABELS = {
  focus: "Фокус",
  short: "Перерыв",
  long: "Длинный перерыв"
};

function ensureContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_PASTE_ID,
      title: "Вставить в ChatGPT",
      contexts: ["selection"]
    });
  });
}

chrome.runtime.onInstalled.addListener(ensureContextMenu);
chrome.runtime.onStartup.addListener(ensureContextMenu);

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-chatgpt") {
    chrome.tabs.create({ url: "https://chatgpt.com/" });
  }
});

function scheduleFocusAlarm(message) {
  const endAt = Number(message.endAt);
  if (!Number.isFinite(endAt) || endAt <= Date.now()) return;

  chrome.storage.local.set({
    [KEY_FOCUS_ALARM]: {
      mode: FOCUS_LABELS[message.mode] ? message.mode : "focus",
      endAt
    }
  });
  chrome.alarms.create(FOCUS_ALARM_NAME, { when: endAt });
}

function cancelFocusAlarm() {
  chrome.alarms.clear(FOCUS_ALARM_NAME);
  chrome.storage.local.remove(KEY_FOCUS_ALARM);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  if (message.type === MSG_GET_TAB_ID) {
    sendResponse({ tabId: sender.tab && sender.tab.id });
    return false;
  }

  if (message.type === MSG_FOCUS_SCHEDULE) {
    scheduleFocusAlarm(message);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === MSG_FOCUS_CANCEL) {
    cancelFocusAlarm();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== FOCUS_ALARM_NAME) return;

  chrome.storage.local.get(KEY_FOCUS_ALARM, (obj) => {
    const pending = obj[KEY_FOCUS_ALARM];
    if (!pending) return;

    const label = FOCUS_LABELS[pending.mode] || FOCUS_LABELS.focus;
    const message = pending.mode === "focus"
      ? "Время сделать перерыв."
      : "Можно возвращаться к фокусу.";

    chrome.notifications.create(`aihub_focus_${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: `${label} завершён`,
      message
    });
    chrome.storage.local.remove(KEY_FOCUS_ALARM);
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_PASTE_ID) return;

  const text = (info.selectionText || "").trim();
  if (!text) return;

  const tab = await chrome.tabs.create({ url: "https://chatgpt.com/", active: true });

  await chrome.storage.local.set({
    [KEY_PENDING]: {
      text,
      ts: Date.now(),
      action: "paste",
      oneTime: true,
      targetTabId: tab && tab.id
    }
  });
});
