import type {
  State,
  SavedTab,
  TabGroup,
  Message,
  CaptureMode,
  RestoreOptions,
  CaptureInfo,
  CaptureJournal,
} from "../shared/types.ts";
import {
  defaults,
  uid,
  group,
  safeUrl,
  parseImport,
  capturePrefix,
} from "../shared/model.ts";
import { folderIcons } from "../shared/folder-icons.ts";
let queue: Promise<unknown> = Promise.resolve();
export function serial<T>(fn: () => T | Promise<T>) {
  const task = queue.then(fn);
  queue = task.catch(() => {});
  return task;
}
let cached: State | undefined;
let captureOrder = 0;
const captureKeys = new Set<string>();
let urlIndex: { state: State; urls: Set<string> } | undefined;
function normalize(state?: State): State {
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
export async function read(): Promise<State> {
  if (cached && chrome.storage.onChanged) return cached;
  const stored = await chrome.storage.local.get<
    { state?: State; captureInfo?: CaptureInfo } & Record<string, unknown>
  >(null);
  const state = normalize(stored.state);
  captureOrder =
    stored.captureInfo?.base === state.revision
      ? (stored.captureInfo?.order ?? 0)
      : 0;
  captureKeys.clear();
  const captures: CaptureJournal[] = [];
  for (const [key, value] of Object.entries(stored)) {
    if (!key.startsWith(capturePrefix)) continue;
    captureKeys.add(key);
    const entry = value as CaptureJournal;
    if (entry.base !== state.revision) continue;
    captures.push(entry);
    captureOrder = Math.max(captureOrder, entry.order);
  }
  const existing = new Set(state.groups.map((g) => g.id));
  state.groups.unshift(
    ...captures
      .sort((a, b) => b.order - a.order)
      .map((entry) => entry.group)
      .filter((g) => !existing.has(g.id)),
  );
  cached = state;
  urlIndex = undefined;
  return state;
}
async function write(state: State) {
  state.revision = uid();
  const captureInfo: CaptureInfo = {
    base: state.revision,
    order: 0,
    count: state.groups.reduce((n, g) => n + g.tabs.length, 0),
    settings: state.settings,
  };
  const cleanup = [...captureKeys];
  urlIndex = undefined;
  try {
    await chrome.storage.local.set({ state, captureInfo });
  } catch (error) {
    cached = undefined;
    throw error;
  }
  cached = state;
  captureOrder = 0;
  // Keep tracking records whose removal failed so the next write retries it.
  if (cleanup.length) {
    try {
      await chrome.storage.local.remove(cleanup);
      for (const key of cleanup) captureKeys.delete(key);
    } catch {
      // Stale records are ignored on read and removed by a later write.
    }
  }
}
async function appendCapture(info: CaptureInfo, saved?: TabGroup) {
  const next: CaptureInfo = {
    ...info,
    order: info.order + (saved ? 1 : 0),
    count: info.count + (saved?.tabs.length ?? 0),
  };
  const key = saved && `${capturePrefix}${saved.id}`;
  try {
    await chrome.storage.local.set({
      captureInfo: next,
      ...(key && saved
        ? { [key]: { base: next.base, order: next.order, group: saved } }
        : {}),
    });
  } catch (error) {
    cached = undefined;
    urlIndex = undefined;
    throw error;
  }
  captureOrder = next.order;
  if (key && saved) {
    captureKeys.add(key);
    if (
      cached?.revision === next.base &&
      cached &&
      !cached.groups.some((g) => g.id === saved.id)
    ) {
      cached.groups.unshift(saved);
      urlIndex = undefined;
    }
  }
}
chrome.storage.onChanged?.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.state) {
    const next = changes.state.newValue as State | undefined;
    if (!next) {
      cached = undefined;
      captureOrder = 0;
      captureKeys.clear();
      urlIndex = undefined;
    } else if (
      !cached ||
      !next.revision ||
      cached.revision !== next.revision ||
      !changes.captureInfo
    ) {
      cached = normalize(next);
      captureOrder = 0;
      urlIndex = undefined;
    }
    if (next && !changes.captureInfo) {
      const obsolete = [...captureKeys, "captureInfo"];
      serial(() => chrome.storage.local.remove(obsolete)).catch(() => {});
    }
  }
  for (const [key, change] of Object.entries(changes)) {
    if (!key.startsWith(capturePrefix)) continue;
    if (!change.newValue) {
      captureKeys.delete(key);
      continue;
    }
    captureKeys.add(key);
    const entry = change.newValue as CaptureJournal;
    if (!cached || entry.base !== cached.revision) continue;
    captureOrder = Math.max(captureOrder, entry.order);
    if (!cached.groups.some((g) => g.id === entry.group.id)) {
      cached.groups.unshift(entry.group);
      urlIndex = undefined;
    }
  }
  const info = changes.captureInfo?.newValue as CaptureInfo | undefined;
  if (info && cached && info.base === cached.revision)
    captureOrder = info.order;
});
async function captureState() {
  const { captureInfo } = await chrome.storage.local.get<{
    captureInfo?: CaptureInfo;
  }>("captureInfo");
  if (
    captureInfo &&
    captureInfo.count >= 1000 &&
    !captureInfo.settings.deduplicate &&
    (!cached || captureInfo.base === cached.revision)
  )
    return { settings: captureInfo.settings, info: captureInfo };
  const state = await read();
  return { settings: state.settings, state };
}
export async function show(windowId: number) {
  const url = chrome.runtime.getURL("manager/manage.html");
  const tabs = await chrome.tabs.query({ windowId });
  const existing = tabs.find((t) => t.url?.split("#")[0] === url);
  return existing
    ? chrome.tabs.update(existing.id!, { active: true })
    : chrome.tabs.create({ windowId, url, active: true });
}
export async function capture(
  mode: CaptureMode,
  windowId: number,
  referenceId?: number,
) {
  const [snapshot, tabs] = await Promise.all([
    captureState(),
    chrome.tabs.query({ windowId }),
  ]);
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
              ? t.index < (active?.index ?? -1)
              : mode === "right"
                ? t.index > (active?.index ?? Infinity)
                : true),
  );
  if (!chosen.length) {
    await show(windowId);
    return { count: 0 };
  }
  const { settings } = snapshot;
  const state = snapshot.state;
  if (settings.deduplicate && state && urlIndex?.state !== state)
    urlIndex = {
      state,
      urls: new Set(state.groups.flatMap((g) => g.tabs.map((t) => t.url))),
    };
  const seen = settings.deduplicate ? urlIndex!.urls : new Set<string>();
  const saved: SavedTab[] = [];
  for (const tab of chosen) {
    const url = safeUrl(tab.url || tab.pendingUrl);
    if (url && !seen.has(url)) {
      saved.push({
        id: uid(),
        url,
        title: tab.title || url,
        addedAt: Date.now(),
      });
      if (settings.deduplicate) seen.add(url);
    }
  }
  const collection = saved.length ? group(saved) : undefined;
  const count = state?.groups.reduce((n, g) => n + g.tabs.length, 0) ?? 0;
  if (collection && state) state.groups.unshift(collection);
  if (snapshot.info) await appendCapture(snapshot.info, collection);
  else if (state && count >= 1000)
    await appendCapture(
      {
        base: state.revision,
        order: captureOrder,
        count,
        settings,
      },
      collection,
    );
  else await write(state!); // Durability precedes closing any source tab.
  // A manager tab also keeps the original window alive when its last tab is saved.
  if (settings.showAfterSave || chosen.length === tabs.length)
    await show(windowId);
  const closed = await Promise.all(
    chosen.map(async (tab) => {
      try {
        const latest = await chrome.tabs.get(tab.id!);
        if (
          !latest.pinned &&
          (latest.groupId === undefined || latest.groupId === -1) &&
          // Both fields unchanged: no navigation started after the tab was read.
          (latest.url ?? "") === (tab.url ?? "") &&
          (latest.pendingUrl ?? "") === (tab.pendingUrl ?? "")
        )
          await chrome.tabs.remove(tab.id!);
        else return false;
        return true;
      } catch {
        return false;
      }
    }),
  );
  return { count: saved.length, notClosed: closed.filter((ok) => !ok).length };
}
export async function restore(message: RestoreOptions, windowId: number) {
  const state = await read();
  await chrome.windows.get(windowId); // Never fall back to a new or unrelated window.
  let count = 0;
  const failed = [];
  const wanted = message.ids && new Set(message.ids);
  const pairs = state.groups
    .filter((g) => !message.groupId || message.groupId === g.id)
    .flatMap((g) =>
      g.tabs
        .filter((t) => !wanted || wanted.has(t.id))
        .map((tab) => [g, tab] as const),
    );
  // Open tabs in the order they were asked for, which is the order on screen.
  if (message.ids) {
    const rank = new Map(message.ids.map((id, i) => [id, i]));
    pairs.sort(([, a], [, b]) => rank.get(a.id)! - rank.get(b.id)!);
  }
  for (const [g, tab] of pairs) {
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
      if (!g.tabs.length)
        state.groups = state.groups.filter((g) => g.tabs.length);
      await write(state); // Checkpoint each successful restore; failed items stay saved.
    }
  }
  const groups = state.groups.filter((g) => g.tabs.length);
  if (groups.length !== state.groups.length) {
    state.groups = groups;
    await write(state);
  }
  return { count, failed };
}
export async function dispatch(
  m: Message,
  sender: chrome.runtime.MessageSender = {},
) {
  if (m.type === "state") return read();
  const windowId =
    sender.tab?.windowId ?? (await chrome.windows.getLastFocused()).id;
  if (windowId === undefined)
    throw new Error("No destination window is available.");
  if (m.type === "show") return show(windowId);
  if (m.type === "capture") return capture(m.mode, windowId);
  if (m.type === "restore") return restore(m, windowId);
  const state = await read();
  const g = state.groups.find((g) => g.id === m.groupId);
  if (m.type === "settings") {
    for (const key of ["keepRestored", "deduplicate", "showAfterSave"] as const)
      if (typeof m.settings[key] === "boolean")
        state.settings[key] = m.settings[key];
    if (typeof m.settings.theme === "string")
      state.settings.theme = m.settings.theme;
  } else if (m.type === "import") {
    const groups = parseImport(m.text);
    state.groups.unshift(...groups);
    await write(state);
    return {
      groups: groups.length,
      tabs: groups.reduce((n, g) => n + g.tabs.length, 0),
    };
  } else if (m.type === "update" && g) {
    for (const key of ["name", "folder"] as const)
      if (typeof m.patch[key] === "string") g[key] = m.patch[key];
    for (const key of ["starred", "locked", "collapsed"] as const)
      if (typeof m.patch[key] === "boolean") g[key] = m.patch[key];
    if (
      g.folder &&
      m.patch.folderIcon !== undefined &&
      Object.hasOwn(folderIcons, m.patch.folderIcon)
    ) {
      for (const item of state.groups)
        if (item.folder === g.folder) item.folderIcon = m.patch.folderIcon;
    }
  } else if (m.type === "delete") {
    const removed: TabGroup[] = [];
    const wanted = m.ids && new Set(m.ids);
    for (const item of state.groups) {
      if (item.locked || (m.groupId && item.id !== m.groupId)) continue;
      const tabs = item.tabs.filter((t) => !wanted || wanted.has(t.id));
      if (tabs.length) removed.push({ ...item, tabs });
      item.tabs = item.tabs.filter((t) => wanted && !wanted.has(t.id));
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
        if (existing) {
          const ids = new Set(existing.tabs.map((t) => t.id));
          existing.tabs.push(...item.tabs.filter((t) => !ids.has(t.id)));
        } else state.groups.unshift(item);
      }
  } else if (m.type === "move") {
    const target = state.groups.find((g) => g.id === m.targetId);
    if (target?.locked) throw new Error("Unlock the destination group first.");
    const moved: SavedTab[] = [];
    const wanted = new Set(m.ids);
    // Tabs already in the target move too, so a multi-row drop reorders them.
    // If the drop point is itself moving, insert before the next tab that stays.
    let anchor = m.beforeId;
    if (target && anchor && wanted.has(anchor)) {
      const from = target.tabs.findIndex((t) => t.id === anchor);
      anchor = target.tabs.slice(from).find((t) => !wanted.has(t.id))?.id;
    }
    for (const item of state.groups) {
      if (item.locked) continue;
      const selected = item.tabs.filter((t) => wanted.has(t.id));
      moved.push(...selected);
      item.tabs = item.tabs.filter((t) => !wanted.has(t.id));
    }
    // Keep the order the tabs were given in, which is the order on screen.
    const rank = new Map(m.ids.map((id, i) => [id, i]));
    moved.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    if (moved.length) {
      if (target) {
        const index = target.tabs.findIndex((t) => t.id === anchor);
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
chrome.runtime.onMessage.addListener((message: Message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return false;
  serial(() => dispatch(message, sender)).then(
    (result) => reply({ ok: true, result }),
    (error: unknown) =>
      reply({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
  );
  return true;
});
async function report(error: unknown) {
  await chrome.storage.local.set({
    lastError: error instanceof Error ? error.message : String(error),
  });
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
    if (windowId === undefined)
      throw new Error("No destination window is available.");
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
  if (!tab) return;
  serial(async () => {
    if (info.menuItemId === "show") return show(tab.windowId);
    if (
      info.menuItemId === "left" ||
      info.menuItemId === "current" ||
      info.menuItemId === "right"
    )
      return capture(info.menuItemId, tab.windowId, tab.id);
  }).catch(report);
});
