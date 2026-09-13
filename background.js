import { defaults, uid, group, safeUrl, parseImport } from "./model.js";
import { folderIcons } from "./ui-icons.js";
let queue = Promise.resolve();
export function serial(fn) {
  const task = queue.then(fn);
  queue = task.catch(() => {});
  return task;
}
export async function read() {
  const { state } = await chrome.storage.local.get("state");
  if (state) {
    for (const g of [
      ...state.groups,
      ...(state.trash || []).flatMap((entry) => entry.groups),
    ]) {
      for (const tab of g.tabs) tab.addedAt ??= g.createdAt;
    }
  }
  return (
    state || { version: 1, groups: [], settings: { ...defaults }, trash: [] }
  );
}
async function write(state) {
  await chrome.storage.local.set({ state });
}
export async function show(windowId) {
  const url = chrome.runtime.getURL("manage.html");
  const tabs = await chrome.tabs.query({ windowId });
  const existing = tabs.find((t) => t.url?.split("#")[0] === url);
  return existing
    ? chrome.tabs.update(existing.id, { active: true })
    : chrome.tabs.create({ windowId, url, active: true });
}
export async function capture(mode, windowId, referenceId) {
  const state = await read();
  const tabs = await chrome.tabs.query({ windowId });
  const active =
    tabs.find((t) => t.id === referenceId) || tabs.find((t) => t.active);
  const chosen = tabs.filter(
    (t) =>
      safeUrl(t.url || t.pendingUrl) &&
      !t.pinned &&
      (t.groupId === undefined || t.groupId === -1) &&
      (mode === "current"
        ? t.id === active?.id
        : mode === "selected"
          ? t.highlighted
          : mode === "other"
            ? t.id !== active?.id
            : mode === "left"
              ? t.index < active?.index
              : mode === "right"
                ? t.index > active?.index
                : true),
  );
  if (!chosen.length) {
    await show(windowId);
    return { count: 0 };
  }
  const seen = new Set(
    state.settings.deduplicate
      ? state.groups.flatMap((g) => g.tabs.map((t) => t.url))
      : [],
  );
  const saved = [];
  for (const tab of chosen) {
    const url = safeUrl(tab.url || tab.pendingUrl);
    if (!seen.has(url)) {
      saved.push({
        id: uid(),
        url,
        title: tab.title || url,
        addedAt: Date.now(),
      });
      if (state.settings.deduplicate) seen.add(url);
    }
  }
  if (saved.length) state.groups.unshift(group(saved));
  await write(state); // Durability precedes closing any source tab.
  // A manager tab also keeps the original window alive when its last tab is saved.
  if (state.settings.showAfterSave || chosen.length === tabs.length)
    await show(windowId);
  let notClosed = 0;
  for (const tab of chosen) {
    try {
      const latest = await chrome.tabs.get(tab.id);
      if (
        !latest.pinned &&
        (latest.groupId === undefined || latest.groupId === -1) &&
        (latest.url || latest.pendingUrl) === (tab.url || tab.pendingUrl)
      )
        await chrome.tabs.remove(tab.id);
      else notClosed++;
    } catch {
      notClosed++;
    }
  }
  return { count: saved.length, notClosed };
}
export async function restore(message, windowId) {
  const state = await read();
  await chrome.windows.get(windowId); // Never fall back to a new or unrelated window.
  let count = 0;
  const failed = [];
  for (const g of state.groups) {
    if (message.groupId && message.groupId !== g.id) continue;
    for (const tab of [...g.tabs]) {
      if (message.ids && !message.ids.includes(tab.id)) continue;
      try {
        if (!safeUrl(tab.url)) throw new Error("Unsupported URL");
        await chrome.tabs.create({ windowId, url: tab.url, active: false });
      } catch {
        failed.push(tab.title);
        continue;
      }
      count++;
      if (!g.locked && !state.settings.keepRestored && !message.keep) {
        g.tabs = g.tabs.filter((t) => t.id !== tab.id);
        await write(state); // Checkpoint each successful restore; failed items stay saved.
      }
    }
  }
  state.groups = state.groups.filter((g) => g.tabs.length);
  await write(state);
  return { count, failed };
}
export async function dispatch(m, sender = {}) {
  if (m.type === "state") return read();
  const windowId =
    sender.tab?.windowId ?? (await chrome.windows.getLastFocused()).id;
  if (m.type === "show") return show(windowId);
  if (m.type === "capture") return capture(m.mode, windowId);
  if (m.type === "restore") return restore(m, windowId);
  const state = await read();
  const g = state.groups.find((g) => g.id === m.groupId);
  if (m.type === "settings") {
    for (const key of Object.keys(defaults))
      if (typeof m.settings[key] === typeof defaults[key])
        state.settings[key] = m.settings[key];
  } else if (m.type === "import") {
    const groups = parseImport(m.text);
    state.groups.unshift(...groups);
    await write(state);
    return {
      groups: groups.length,
      tabs: groups.reduce((n, g) => n + g.tabs.length, 0),
    };
  } else if (m.type === "update" && g) {
    for (const key of ["name", "folder", "starred", "locked", "collapsed"])
      if (
        key in m.patch &&
        typeof m.patch[key] ===
          (["name", "folder"].includes(key) ? "string" : "boolean")
      )
        g[key] = m.patch[key];
    if (g.folder && Object.hasOwn(folderIcons, m.patch.folderIcon)) {
      for (const item of state.groups)
        if (item.folder === g.folder) item.folderIcon = m.patch.folderIcon;
    }
  } else if (m.type === "delete") {
    const removed = [];
    for (const item of state.groups) {
      if (item.locked || (m.groupId && item.id !== m.groupId)) continue;
      const tabs = item.tabs.filter((t) => !m.ids || m.ids.includes(t.id));
      if (tabs.length) removed.push({ ...item, tabs });
      item.tabs = item.tabs.filter((t) => !tabs.includes(t));
    }
    state.groups = state.groups.filter((g) => g.tabs.length);
    if (removed.length)
      state.trash = [
        { groups: removed, at: Date.now() },
        ...(state.trash || []),
      ].slice(0, 20);
  } else if (m.type === "undo") {
    const entry = state.trash?.shift();
    if (entry)
      for (const item of entry.groups) {
        const existing = state.groups.find((g) => g.id === item.id);
        if (existing)
          existing.tabs.push(
            ...item.tabs.filter(
              (t) => !existing.tabs.some((e) => e.id === t.id),
            ),
          );
        else state.groups.unshift(item);
      }
  } else if (m.type === "move") {
    const target = state.groups.find((g) => g.id === m.targetId);
    if (target?.locked) throw new Error("Unlock the destination group first.");
    const moved = [];
    for (const item of state.groups) {
      if (item.locked || item.id === target?.id) continue;
      const selected = item.tabs.filter((t) => m.ids.includes(t.id));
      moved.push(...selected);
      item.tabs = item.tabs.filter((t) => !m.ids.includes(t.id));
    }
    if (moved.length) {
      if (target) {
        const index = target.tabs.findIndex((t) => t.id === m.beforeId);
        target.tabs.splice(index < 0 ? target.tabs.length : index, 0, ...moved);
      } else state.groups.unshift(group(moved, m.name || ""));
    }
    state.groups = state.groups.filter((g) => g.tabs.length);
  } else if (m.type === "reorder" && g) {
    if (m.tabId && !g.locked && m.tabId !== m.beforeId) {
      const index = g.tabs.findIndex((t) => t.id === m.tabId);
      if (index >= 0) {
        const [tab] = g.tabs.splice(index, 1);
        const before = g.tabs.findIndex((t) => t.id === m.beforeId);
        g.tabs.splice(before < 0 ? g.tabs.length : before, 0, tab);
      }
    } else if (!m.tabId) {
      state.groups = state.groups.filter((item) => item.id !== g.id);
      const at = state.groups.findIndex((item) => item.id === m.beforeId);
      state.groups.splice(at < 0 ? state.groups.length : at, 0, g);
    }
  } else
    throw new Error(
      "This action is no longer available. Refresh and try again.",
    );
  await write(state);
  return state;
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return false;
  serial(() => dispatch(message, sender)).then(
    (result) => reply({ ok: true, result }),
    (error) => reply({ ok: false, error: error.message }),
  );
  return true;
});
async function report(error) {
  await chrome.storage.local.set({ lastError: error.message });
  await chrome.action.setBadgeText({ text: "!" });
  await chrome.action.setBadgeBackgroundColor({ color: "#b53d3d" });
}
chrome.action.onClicked.addListener((tab) => {
  return serial(() => show(tab.windowId)).catch(report);
});
chrome.commands.onCommand.addListener((command, tab) => {
  serial(async () => {
    const windowId =
      tab?.windowId ?? (await chrome.windows.getLastFocused()).id;
    return command === "show-manager"
      ? show(windowId)
      : capture("current", windowId, tab?.id);
  }).catch(report);
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const [id, title] of Object.entries({
      show: "Show list",
      left: "Save all left",
      current: "Save current",
      right: "Save all right",
    }))
      chrome.contextMenus.create({
        id,
        title,
        contexts: ["all"],
        documentUrlPatterns: [
          "http://*/*",
          "https://*/*",
          "file:///*",
          "ftp://*/*",
        ],
      });
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  serial(() =>
    info.menuItemId === "show"
      ? show(tab.windowId)
      : capture(info.menuItemId, tab.windowId, tab.id),
  ).catch(report);
});
