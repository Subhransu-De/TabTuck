// What the buttons do: messages to the background, then the toast that says
// what happened. Only one action runs at a time.
import { flushSync } from "react-dom";
import type {
  CaptureJournal,
  Message,
  MessageResult,
  Reply,
  RestoreOptions,
  Settings,
  State,
  TabGroup,
} from "../shared/types.ts";
import { capturePrefix, exportText, HOUR } from "../shared/model.ts";
import { bulletList, collectionLabel, plural } from "./library.ts";
import { nextLibrary, validScope, Views } from "./view.ts";
import {
  anchor,
  clock,
  hidden,
  library,
  restoring,
  screen,
  search,
  selection,
  setUi,
  tick,
  toast,
  ui,
} from "./store.ts";
import { anyDialog, ask, dialogs, setDialog } from "./dialog-state.ts";

declare global {
  // The library, requested by boot.js before this module loaded.
  var tabtuckState: Promise<Reply<{ type: "state" }>> | undefined;
}
// Sends a message, or takes the reply to one already sent.
export async function api<M extends Message>(
  message: M,
  sent?: Promise<Reply<M>>,
): Promise<MessageResult<M>> {
  const response: Reply<M> = await (sent ??
    chrome.runtime.sendMessage(message));
  if (!response?.ok)
    throw new Error(
      response?.error || "The extension did not respond. Reload this page.",
    );
  return response.result;
}
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

let busy = false;
export async function run(fn: () => unknown) {
  if (busy) return;
  busy = true;
  try {
    await fn();
    await refresh();
  } catch (e) {
    toast(errorText(e));
  } finally {
    busy = false;
  }
}

function state() {
  return library.get()!.state;
}
// The views on screen, or fresh ones before the first render.
function views() {
  return (
    screen.views ?? new Views(library.get()!, hidden.get(), clock.get().epoch)
  );
}

export function adopt(next: State) {
  const lib = nextLibrary(next, library.get());
  if (selection.size) {
    const ids = new Set(
      [
        ...lib.state.groups,
        ...(lib.state.trash ?? []).flatMap((entry) => entry.groups),
      ].flatMap((g) => g.tabs.map((t) => t.id)),
    );
    const gone = [...selection.values()].filter((id) => !ids.has(id));
    if (gone.length) deselect(gone);
  }
  tick();
  library.set(lib);
  const { scope } = ui.get();
  const fallback = validScope(lib, scope);
  if (fallback !== scope) setScope(fallback);
  showConsent();
}
// Returns whether the library changed.
export async function refresh(sent?: Promise<Reply<{ type: "state" }>>) {
  const next = await api({ type: "state" }, sent);
  const current = library.get()?.state;
  if (
    next.revision &&
    current &&
    next.revision === current.revision &&
    next.groups.length === current.groups.length &&
    next.groups[0]?.id === current.groups[0]?.id
  )
    return false;
  adopt(next);
  return true;
}

export function setScope(next: string) {
  if (next !== ui.get().scope) clearSelection();
  tick();
  setUi({ scope: next, facet: "all", showAllSites: false });
}
export function setFacet(next: string) {
  tick();
  setUi({ facet: next });
}

/* ---------- Selection ---------- */

function deselect(ids: Iterable<string>) {
  selection.update((set) => {
    for (const id of ids) set.delete(id);
  });
  if (!selection.size) anchor.id = undefined;
}
export function clearSelection() {
  if (!selection.size) return;
  selection.update((set) => set.clear());
  anchor.id = undefined;
}
// Picks a row, or with range the rows from the last pick to this one.
export function choose(id: string, on: boolean, range: boolean) {
  const list = screen.visible;
  const to = list.findIndex((e) => e.tab.id === id);
  const from =
    range && anchor.id ? list.findIndex((e) => e.tab.id === anchor.id) : -1;
  const ids =
    from >= 0 && to >= 0
      ? list
          .slice(Math.min(from, to), Math.max(from, to) + 1)
          .map((e) => e.tab.id)
      : [id];
  selection.update((set) => {
    for (const each of ids)
      if (on) set.add(each);
      else set.delete(each);
  });
  anchor.id = id;
  // Once nothing is selected, the next Shift-click starts a fresh range.
  if (!selection.size) anchor.id = undefined;
}
export function selectAll(on: boolean) {
  const ids = screen.visible.map((e) => e.tab.id);
  selection.update((set) => {
    for (const id of ids)
      if (on) set.add(id);
      else set.delete(id);
  });
  if (!selection.size) anchor.id = undefined;
}
// Selected tabs in on-screen order, then any hidden by the current view in
// saved order, so copied links never depend on the order of clicks.
function orderedSelection() {
  const shown = screen.visible
    .map((e) => e.tab.id)
    .filter((id) => selection.has(id));
  const seen = new Set(shown);
  const pool = ui.get().scope === "bin" ? views().binGroups() : state().groups;
  const rest = pool.flatMap((g) =>
    g.tabs.map((t) => t.id).filter((id) => selection.has(id) && !seen.has(id)),
  );
  return [...shown, ...rest];
}

/* ---------- Tabs ---------- */

export async function restore(options: RestoreOptions) {
  const { groups, settings } = state();
  const requested = options.ids ? new Set(options.ids) : null;
  const ids: string[] = [];
  const hide: string[] = [];
  for (const group of groups) {
    if (options.groupId && options.groupId !== group.id) continue;
    for (const tab of group.tabs) {
      if ((requested && !requested.has(tab.id)) || restoring.has(tab.id))
        continue;
      ids.push(tab.id);
      if (!group.locked && !settings.keepRestored && !options.keep)
        hide.push(tab.id);
    }
  }
  if (!ids.length) return;
  if (options.ids) {
    const rank = new Map(options.ids.map((id, i) => [id, i]));
    ids.sort((a, b) => rank.get(a)! - rank.get(b)!);
  }
  // Update the DOM in this click event, before any browser or storage work.
  flushSync(() => {
    restoring.update((set) => {
      for (const id of ids) set.add(id);
    });
    if (hide.length) hidden.set(new Set([...hidden.get(), ...hide]));
  });
  try {
    const r = await api({ type: "restore", ...options, ids });
    await refresh();
    toast(
      `${r.count} ${r.count === 1 ? "tab" : "tabs"} restored in this window.${r.failed.length ? ` ${r.failed.length} could not be opened and remain saved.` : ""}`,
    );
  } finally {
    restoring.update((set) => {
      for (const id of ids) set.delete(id);
    });
    const rest = new Set(hidden.get());
    for (const id of ids) rest.delete(id);
    hidden.set(rest);
  }
}
// A saved tab's title restores it here; Ctrl-click or middle-click keeps it.
export function restoreTab(id: string, keep: boolean) {
  restore({ ids: [id], keep }).catch((e: unknown) => toast(errorText(e)));
}
export async function remove(ids: string[], groupId?: string) {
  if (!ids.length) return;
  const wanted = new Set(ids);
  const removable = views()
    .live(state().groups)
    .filter(({ tab, group }) => wanted.has(tab.id) && !group.locked)
    .map(({ tab }) => tab.id);
  if (!removable.length) {
    toast("Unlock the selected collections to delete their tabs.");
    return;
  }
  await api({ type: "delete", ids: removable, groupId });
  deselect(removable);
  const kept = ids.length - removable.length;
  toast(
    `Moved ${plural(removable.length, "tab")} to the bin.${kept ? ` Kept ${plural(kept, "tab")} in locked collections.` : ""}`,
    true,
  );
}
// Returns binned tabs to their collections.
export async function restoreFromBin(ids: string[]) {
  if (!ids.length) return;
  await api({ type: "binRestore", ids });
  deselect(ids);
  toast(`Restored ${plural(ids.length, "tab")} from the bin.`);
}
// Erases tabs from the bin for good: the given ones, or all of them. One tab
// goes at once; more ask first.
export async function erase(ids?: string[]) {
  const count = ids?.length ?? views().bin().length;
  if (!count) return;
  if (
    count > 1 &&
    !(await ask(ids ? `Erase ${plural(count, "tab")}?` : "Empty the bin?", {
      description: `${ids ? `These ${count} tabs` : "Everything in the bin"} will be erased for good. This cannot be undone.`,
    }))
  )
    return;
  await api({ type: "binDelete", ids });
  if (ids) deselect(ids);
  toast(`Erased ${plural(count, "tab")}.`);
}
// Copied links keep the order of the ids, which is the order on screen.
export async function copyLinks(ids: string[]) {
  const byId = new Map(
    [...state().groups, ...views().binGroups()].flatMap((g) =>
      g.tabs.map((t) => [t.id, t] as const),
    ),
  );
  const tabs = ids.flatMap((id) => byId.get(id) ?? []);
  await navigator.clipboard.writeText(bulletList(tabs));
  toast(`Copied ${plural(tabs.length, "link")}.`);
}
export const undo = () =>
  run(() =>
    api({ type: "undo" }).then(() => toast("Restored the deleted tabs.")),
  );

const visibleIds = () => screen.visible.map((e) => e.tab.id);
const inBin = () => ui.get().scope === "bin";
export const restoreVisible = () =>
  run(() => {
    const ids = visibleIds();
    return inBin() ? restoreFromBin(ids) : restore({ ids });
  });
export const restoreSelected = () =>
  run(() =>
    inBin()
      ? restoreFromBin(orderedSelection())
      : restore({ ids: orderedSelection() }),
  );
export const deleteSelected = () =>
  run(() =>
    inBin() ? erase(orderedSelection()) : remove([...selection.values()]),
  );
export const copySelected = () => run(() => copyLinks(orderedSelection()));
export const copyVisible = () => run(() => copyLinks(visibleIds()));
export const moveSelected = () =>
  run(async () => {
    // Locked collections keep their tabs, as with delete; say so instead of
    // silently clearing them from the selection.
    const locked = new Set(
      views()
        .live(state().groups)
        .filter(({ group }) => group.locked)
        .map(({ tab }) => tab.id),
    );
    const movable = orderedSelection().filter((id) => !locked.has(id));
    if (!movable.length) {
      toast("Unlock the selected collections to move their tabs.");
      return;
    }
    const targetId = await ask("Move selected tabs", {
      options: [
        ["", "New collection"],
        ...state()
          .groups.filter((g) => !g.locked)
          .map((g) => [
            g.id,
            `${collectionLabel(g)} · ${plural(g.tabs.length, "tab")}`,
          ]),
      ],
    });
    if (targetId === null) return;
    const homeOf = (groups: TabGroup[]) =>
      new Map(groups.flatMap((g) => g.tabs.map((t) => [t.id, g.id] as const)));
    const before = homeOf(state().groups);
    const next = await api({
      type: "move",
      ids: movable,
      targetId: targetId || undefined,
    });
    // Count what actually moved: a collection locked elsewhere while the
    // dialog was open keeps its tabs, and they stay selected.
    const after = homeOf(next.groups);
    const moved = movable.filter((id) =>
      targetId
        ? after.get(id) === targetId
        : after.has(id) && after.get(id) !== before.get(id),
    );
    deselect(moved);
    const kept = selection.size;
    toast(
      `Moved ${plural(moved.length, "tab")}.${kept ? ` Kept ${plural(kept, "tab")} in locked collections.` : ""}`,
    );
  });

/* ---------- Collections and folders ---------- */

const update = (groupId: string, patch: Partial<TabGroup>) =>
  api({ type: "update", groupId, patch });
export const renameGroup = (g: TabGroup) =>
  run(async () => {
    const name = await ask("Name this collection", { value: g.name });
    if (name !== null) await update(g.id, { name: name.trim() });
  });
export const toggleStar = (g: TabGroup) =>
  run(() => update(g.id, { starred: !g.starred }));
export const toggleLock = (g: TabGroup) =>
  run(() => update(g.id, { locked: !g.locked }));
function folderIconOf(folder: string) {
  return (
    state().groups.find((g) => g.folder === folder && g.folderIcon)
      ?.folderIcon || "folder"
  );
}
export const moveToFolder = (g: TabGroup) =>
  run(async () => {
    const folder = await ask("Move collection to folder", {
      value: g.folder,
      folderIcon: folderIconOf(g.folder),
      description:
        "Type a folder name and pick its icon. Leave the name empty to take the collection out of its folder.",
    });
    if (folder !== null)
      await update(g.id, {
        folder: folder.name.trim(),
        folderIcon: folder.icon,
      });
  });
export const editFolder = (f: string) =>
  run(async () => {
    const edit = await ask("Edit folder", {
      value: f,
      folderIcon: folderIconOf(f),
      description: "Change the folder's name or its icon.",
    });
    const name = edit?.name.trim();
    if (!edit || !name) return;
    for (const g of views().scopeGroups(`folder:${f}`))
      await update(g.id, { folder: name, folderIcon: edit.icon });
    setUi({ scope: `folder:${name}` });
  });
export const newFolder = () =>
  run(async () => {
    const folder = await ask("Create a folder", {
      value: "",
      folderIcon: "folder",
      description: "Folders hold collections. Choose the first one next.",
    });
    if (!folder?.name.trim()) return;
    if (!state().groups.length) {
      toast("Save or import a collection first.");
      return;
    }
    const groupId = await ask("Choose a collection", {
      options: state().groups.map((g) => [
        g.id,
        `${collectionLabel(g)} · ${plural(g.tabs.length, "tab")}`,
      ]),
    });
    if (groupId)
      await update(groupId, {
        folder: folder.name.trim(),
        folderIcon: folder.icon,
      });
  });
// Opening a folder lets its rows unfold. Closing one turns the chevron at
// once and folds the rows away; the list reports when they are gone.
export function toggleFolder(f: string) {
  const { collapsed, folding, scope } = ui.get();
  if (collapsed.has(f)) {
    const next = new Set(collapsed);
    next.delete(f);
    setUi({ collapsed: next, unfolding: f });
    return;
  }
  if (folding) return;
  const members = views().scopeGroups(`folder:${f}`);
  if (members.some((g) => scope === `group:${g.id}`)) foldDone(f);
  else setUi({ folding: f });
}
export function foldDone(f: string) {
  const { collapsed } = ui.get();
  setUi({ collapsed: new Set([...collapsed, f]), folding: undefined });
}

/* ---------- Page ---------- */

// Chrome Web Store policy: the user agrees to this notice, inside the product,
// before any tab data is saved. The background refuses to save until then.
export function showConsent() {
  const lib = library.get();
  if (!lib || lib.state.settings.dataNotice || dialogs.get().consent) return;
  dialogs.get().prompt?.resolve(null);
  dialogs.set({
    transfer: false,
    settings: false,
    consent: true,
    prompt: null,
  });
}
export const agree = () =>
  run(async () => {
    await api({ type: "settings", settings: { dataNotice: true } });
    setDialog("consent", false);
    toast("You're set. Press Alt+C on any page to save it here.");
  });
export const saveWindow = () =>
  run(async () => {
    const r = await api({ type: "capture", mode: "all" });
    if (r.needsConsent) return showConsent();
    setScope("recent");
    toast(
      `${plural(r.count, "tab")} saved.${r.notClosed ? " Some source tabs stayed open because they changed." : ""}`,
    );
  });
export const toggleTheme = () =>
  run(() =>
    api({
      type: "settings",
      settings: {
        theme: document.body.classList.contains("dark") ? "light" : "dark",
      },
    }),
  );
export const saveSettings = (settings: Partial<Settings>, done: () => void) =>
  run(async () => {
    await api({ type: "settings", settings });
    done();
    toast("Options saved.");
  });
export const openShortcuts = () =>
  run(async () => {
    const tab = await chrome.tabs.getCurrent();
    await chrome.tabs.create({
      windowId: tab?.windowId,
      url: "chrome://extensions/shortcuts",
    });
  });
export const importText = (text: string, done: (result: string) => void) =>
  run(async () => {
    const r = await api({ type: "import", text });
    done(
      `Imported ${r.tabs} ${r.tabs === 1 ? "tab" : "tabs"} in ${r.groups} ${r.groups === 1 ? "collection" : "collections"}.`,
    );
  });
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export const exportJson = () =>
  run(async () => {
    const fresh = await api({ type: "state" });
    download(
      JSON.stringify({ version: 1, groups: fresh.groups }, null, 2),
      "tabtuck-backup.json",
      "application/json",
    );
  });
export const exportPlain = () =>
  run(async () => {
    const fresh = await api({ type: "state" });
    download(exportText(fresh.groups), "tabtuck-export.txt", "text/plain");
  });

// "/" focuses the search; Escape clears it, then the selection.
function keydown(e: KeyboardEvent) {
  if (anyDialog()) return;
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(
    document.activeElement?.tagName ?? "",
  );
  if (e.key === "/" && !typing) {
    e.preventDefault();
    document.getElementById("search")?.focus();
  } else if (e.key === "Escape") {
    if (search.get()) search.set("");
    else clearSelection();
  }
}

function listen() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || busy) return;
    const lib = library.get();
    if (changes.state?.newValue) adopt(changes.state.newValue as State);
    else if (lib) {
      const captures = Object.entries(changes)
        .filter(
          ([key, change]) => key.startsWith(capturePrefix) && change.newValue,
        )
        .map(([, change]) => change.newValue as CaptureJournal)
        .filter(
          (entry) =>
            entry.base === lib.state.revision && !lib.index.has(entry.group.id),
        )
        .sort((a, b) => b.order - a.order);
      if (captures.length)
        adopt({
          ...lib.state,
          groups: [
            ...captures.map((entry) => entry.group),
            ...lib.state.groups,
          ],
        });
    }
  });
  document.addEventListener("keydown", keydown);
  // Relative save times ("4m", "2h") stay current while the page is open, and
  // Recent regroups into Today and Yesterday when the date changes.
  let today = new Date().toDateString();
  setInterval(() => {
    const now = Date.now();
    const { epoch } = clock.get();
    // Record the new date only once the lists regroup, so a tick that falls
    // during an action is retried on the next one.
    const dated = new Date(now).toDateString() !== today;
    if (dated && busy) return;
    today = new Date(now).toDateString();
    // A binned tab whose time is up leaves the list.
    const lib = library.get();
    const keep = (lib?.state.settings.binHours ?? 0) * HOUR;
    const expired =
      !busy &&
      !!lib?.state.trash?.some(
        (entry) => epoch - entry.at < keep && now - entry.at >= keep,
      );
    clock.set({ now, epoch: dated || expired ? now : epoch });
  }, 60_000);
}

export async function start() {
  listen();
  const sent = globalThis.tabtuckState;
  globalThis.tabtuckState = undefined;
  await refresh(sent);
  const { lastError } = await chrome.storage.local.get<{ lastError?: string }>(
    "lastError",
  );
  if (lastError) {
    toast(lastError);
    await chrome.storage.local.remove("lastError");
    await chrome.action.setBadgeText({ text: "" });
  }
  if (location.hash === "#settings") setDialog("settings", true);
}
