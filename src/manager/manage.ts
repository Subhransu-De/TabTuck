import { $ } from "./dom.ts";
import type {
  State,
  Settings,
  Message,
  MessageResult,
  Reply,
  RestoreOptions,
  TabGroup,
  CaptureJournal,
} from "../shared/types.ts";
import { defaults, exportText, capturePrefix } from "../shared/model.ts";
import { icon, folderIcons } from "./ui-icons.ts";
import { element as node, actionButton, websiteIcon } from "./ui-components.ts";
import {
  type Bucket,
  type Entry,
  ago,
  bucketNames,
  bucketOf,
  bulletList,
  collectionLabel,
  entries,
  groupSites,
  longDate,
  newestFirst,
  plural,
  savedAt,
  shortAgo,
  siteLabel,
  sites,
} from "./library.ts";
import { Vine, type VineLink } from "./vine.ts";
import { WindowedList, reconcile } from "./windowed-list.ts";

let state: State;
// Scope is the first column: "recent", "all", "starred", "folder:<name>" or
// "group:<id>". Facet is the second column: a site host, a time bucket, or "all".
let scope = "recent",
  facet = "all",
  selected = new Set<string>(),
  dragged: { groupId: string; ids: string[] } | null = null,
  busy = false,
  showAllSites = false,
  toastTimer: ReturnType<typeof setTimeout> | undefined;
const collapsedFolders = new Set<string>();
const restoring = new Set<string>();
const hiddenRestores = new Set<string>();
const vine = new Vine($("#app"), $("#vine"));
// chrome.storage holds the theme setting; this page-local copy only lets the
// last theme paint before that asynchronous read finishes.
const THEME_KEY = "tabtuck-theme";
const lastTheme = localStorage.getItem(THEME_KEY);
if (lastTheme === "dark" || lastTheme === "light")
  document.body.classList.add(lastTheme);
const SITE_LIMIT = 14;
let orderedGroups: TabGroup[] = [];
let groupIndex = new Map<string, TabGroup>();
const groupViews = new Map<string, TabGroup[]>();
let liveViews = new Map<TabGroup[], Entry[]>();
let scopedView: Entry[] | undefined;
let visibleView: Entry[] | undefined;
let recentView: Entry[] | undefined;
const collectionRows = new WeakMap<TabGroup, HTMLElement>();
type TabItem =
  | { kind: "tab"; entry: Entry }
  | { kind: "separator"; entry: Entry; count: number; recent: boolean };
let tabItems: TabItem[] = [];
let listScrollTop = 0;
let tabHeight = 34;
let separatorHeight = 33;
const tabWindow = new WindowedList<TabItem>($("#groups"));

function button(
  label: string,
  fn: () => unknown | Promise<unknown>,
  cls?: string,
) {
  return actionButton(label, () => run(fn), cls);
}
// Secondary actions show only their icon; the label stays as the accessible
// name and tooltip.
function toolButton(
  label: string,
  symbol: string,
  fn: () => unknown | Promise<unknown>,
  cls = "",
  iconOnly = false,
) {
  const el = button("", fn, `${cls}${iconOnly ? " icon-only" : ""}`.trim());
  el.dataset.action = symbol;
  if (iconOnly) {
    el.append(icon(symbol));
    el.setAttribute("aria-label", label);
    el.title = label;
  } else el.append(node("span", label));
  return el;
}
function toast(message: string, undo = false) {
  $("#status-text").textContent = message;
  $("#status-undo").hidden = !undo;
  $("#status").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#status").hidden = true), 6500);
}
async function api<M extends Message>(message: M): Promise<MessageResult<M>> {
  const response: Reply<M> = await chrome.runtime.sendMessage(message);
  if (!response?.ok)
    throw new Error(
      response?.error || "The extension did not respond. Reload this page.",
    );
  return response.result;
}
async function run(fn: () => unknown | Promise<unknown>) {
  if (busy) return;
  busy = true;
  try {
    await fn();
    await refresh();
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e));
  } finally {
    busy = false;
  }
}
interface PromptOptions {
  value?: string;
  description?: string;
  options?: string[][];
  folderIcon?: string;
}
type PromptResult = string | boolean | { name: string; icon: string } | null;
function ask(
  title: string,
  options: PromptOptions & { folderIcon: string },
): Promise<{ name: string; icon: string } | null>;
function ask(
  title: string,
  options: PromptOptions & ({ value: string } | { options: string[][] }),
): Promise<string | null>;
function ask(title: string, options?: PromptOptions): Promise<boolean | null>;
function ask(
  title: string,
  { value, description = "", options, folderIcon }: PromptOptions = {},
): Promise<PromptResult> {
  $("#prompt-title").textContent = title;
  $("#prompt-description").textContent = description;
  $("#prompt-input").hidden = value === undefined;
  $("#prompt-input").value = value ?? "";
  $("#prompt-select").hidden = !options;
  $("#prompt-select").replaceChildren();
  const picker = $("#folder-icons");
  picker.hidden = folderIcon === undefined;
  picker.replaceChildren(node("legend", "Icon"));
  if (folderIcon !== undefined)
    for (const [key, [label]] of Object.entries(folderIcons)) {
      const choice = node("label");
      choice.title = label;
      const radio = node("input");
      radio.type = "radio";
      radio.name = "folder-icon";
      radio.value = key;
      radio.checked = key === folderIcon;
      radio.setAttribute("aria-label", label);
      choice.append(radio, icon(key));
      picker.append(choice);
    }
  for (const [id, text] of options || []) {
    const opt = node("option", text);
    opt.value = id;
    $("#prompt-select").append(opt);
  }
  $("#prompt").showModal();
  if (value !== undefined) $("#prompt-input").focus();
  return new Promise<PromptResult>((resolve) => {
    let result: PromptResult = null;
    $("#prompt-form").onsubmit = (e) => {
      e.preventDefault();
      result =
        folderIcon !== undefined
          ? {
              name: $("#prompt-input").value,
              icon:
                document.querySelector<HTMLInputElement>(
                  "#folder-icons input:checked",
                )?.value || "folder",
            }
          : options
            ? $("#prompt-select").value
            : value !== undefined
              ? $("#prompt-input").value
              : true;
      $("#prompt").close();
    };
    $("#prompt-cancel").onclick = () => $("#prompt").close();
    $("#prompt").onclose = () => resolve(result);
  });
}
function sameGroup(a: TabGroup, b: TabGroup) {
  return (
    a === b ||
    (a.id === b.id &&
      a.name === b.name &&
      a.createdAt === b.createdAt &&
      a.starred === b.starred &&
      a.locked === b.locked &&
      a.folder === b.folder &&
      a.folderIcon === b.folderIcon &&
      a.collapsed === b.collapsed &&
      a.site === b.site &&
      a.tabs.length === b.tabs.length &&
      a.tabs.every((tab, i) => {
        const next = b.tabs[i];
        return (
          tab.id === next.id &&
          tab.url === next.url &&
          tab.title === next.title &&
          tab.addedAt === next.addedAt &&
          tab.sourceLocked === next.sourceLocked
        );
      }))
  );
}
function adopt(next: State) {
  next.groups = next.groups.map((g) => {
    const previous = groupIndex.get(g.id);
    return previous && sameGroup(previous, g) ? previous : g;
  });
  state = next;
  state.settings = { ...defaults, ...state.settings };
  groupIndex = new Map(state.groups.map((g) => [g.id, g]));
  orderedGroups = [...state.groups].sort((a, b) => b.createdAt - a.createdAt);
  groupViews.clear();
  recentView = undefined;
  if (selected.size) {
    const ids = new Set(state.groups.flatMap((g) => g.tabs.map((t) => t.id)));
    selected = new Set([...selected].filter((id) => ids.has(id)));
  }
  if (scope.startsWith("group:") && !groupById(scope.slice(6)))
    setScope("recent");
  if (
    scope.startsWith("folder:") &&
    !state.groups.some((g) => g.folder === scope.slice(7))
  )
    setScope("all");
  render();
}
async function refresh() {
  const next = await api({ type: "state" });
  if (
    next.revision &&
    next.revision === state?.revision &&
    next.groups.length === state.groups.length &&
    next.groups[0]?.id === state.groups[0]?.id
  )
    return;
  adopt(next);
}

/* ---------- Data for the current view ---------- */

function groupById(id: string) {
  return groupIndex.get(id);
}
function live(groups: TabGroup[]) {
  let list = liveViews.get(groups);
  if (!list) {
    list = entries(groups);
    if (hiddenRestores.size)
      list = list.filter(({ tab }) => !hiddenRestores.has(tab.id));
    liveViews.set(groups, list);
  }
  return list;
}
function scopeGroups(key = scope) {
  let groups = groupViews.get(key);
  if (!groups) {
    groups =
      key === "starred"
        ? orderedGroups.filter((g) => g.starred)
        : key.startsWith("folder:")
          ? orderedGroups.filter((g) => g.folder === key.slice(7))
          : key.startsWith("group:")
            ? orderedGroups.filter((g) => g.id === key.slice(6))
            : orderedGroups;
    groupViews.set(key, groups);
  }
  return groups;
}
function query() {
  return $("#search").value.toLowerCase().trim();
}
function matches(entry: Entry, q = query()) {
  if (!q) return true;
  return entry.search.includes(q);
}
function recent() {
  return (recentView ??= newestFirst(entries(orderedGroups)));
}
// Tabs in scope that match the search, before the second-column facet.
function scoped() {
  if (!scopedView) {
    const q = query();
    const list = scope === "recent" ? recent() : live(scopeGroups());
    scopedView =
      q || (scope === "recent" && hiddenRestores.size)
        ? list.filter((e) => !hiddenRestores.has(e.tab.id) && matches(e, q))
        : list;
  }
  return scopedView;
}
function facetOf(entry: Entry): string {
  return scope === "recent" ? bucketOf(entry.addedAt) : `site:${entry.host}`;
}
function visible() {
  if (!visibleView) {
    const list = scoped();
    visibleView =
      facet === "all" ? list : list.filter((e) => facetOf(e) === facet);
  }
  return visibleView;
}
function setScope(next: string) {
  if (next !== scope) selected.clear();
  scope = next;
  facet = "all";
  showAllSites = false;
}

/* ---------- Rendering ---------- */

let viewKey = "";
function render() {
  liveViews = new Map();
  scopedView = visibleView = undefined;
  const focused = document.activeElement;
  const focusKey =
    focused instanceof HTMLElement
      ? [
          "data-scope",
          "data-facet",
          "data-site",
          "data-action",
          "data-folder-toggle",
        ].find((key) => focused.hasAttribute(key))
      : undefined;
  const focusValue = focusKey ? focused?.getAttribute(focusKey) : null;
  const tabFocus = focused?.closest<HTMLElement>(".tab-row");
  const tabIndex = tabFocus ? Number(tabFocus.dataset.windowIndex) : -1;
  // Keep each column's scroll position unless the view itself changed.
  const lists = ["#navigation", "#facets", "#groups"] as const;
  const scroll = lists.map((s) => $(s).scrollTop);
  const view = `${scope}|${facet}`;
  if (view !== viewKey) {
    scroll[2] = 0;
    if (!viewKey.startsWith(`${scope}|`)) scroll[1] = 0;
  }
  viewKey = view;
  listScrollTop = scroll[2];
  paint();
  lists.forEach((s, i) => ($(s).scrollTop = scroll[i]));
  if (focused && !focused.isConnected) {
    if (focusKey && focusValue !== null && focusValue !== undefined)
      document
        .querySelector<HTMLElement>(`[${focusKey}="${CSS.escape(focusValue)}"]`)
        ?.focus({ preventScroll: true });
    else if (tabFocus) {
      let index = tabItems.findIndex(
        (item) =>
          item.kind === "tab" && item.entry.tab.id === tabFocus.dataset.tab,
      );
      if (index < 0) {
        index = Math.min(tabIndex, tabItems.length - 1);
        while (index >= 0 && tabItems[index].kind !== "tab") index--;
      }
      if (index < 0 || !tabWindow.focus(index, focused.tagName.toLowerCase()))
        $("#search").focus({ preventScroll: true });
    }
  }
  drawVine();
}
function paint() {
  const dark =
    state.settings.theme === "dark" ||
    (state.settings.theme !== "light" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("dark", dark);
  document.body.classList.toggle("light", !dark);
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  const all = live(state.groups);
  $("#summary").textContent =
    `${all.length} saved ${all.length === 1 ? "tab" : "tabs"}`;
  $("#theme-toggle").setAttribute(
    "aria-label",
    document.body.classList.contains("dark")
      ? "Switch to light theme"
      : "Switch to dark theme",
  );
  $("#theme-toggle").title = $("#theme-toggle").getAttribute("aria-label")!;
  renderNavigation();
  renderScopeHead();
  renderFacets();
  renderTabs();
}

function folderIconOf(folder: string) {
  return (
    state.groups.find((g) => g.folder === folder && g.folderIcon)?.folderIcon ||
    "folder"
  );
}
// One icon per collection: its most saved site.
function leadIcon(group: TabGroup) {
  const top = groupSites(group)[0];
  const tab = top && entries([group]).find((e) => e.host === top.host)?.tab;
  return tab ? websiteIcon(tab.url) : icon("folder");
}
function scopeRow(key: string, label: string, symbol: string, count: number) {
  const row = actionButton(
    "",
    () => {
      setScope(key);
      render();
    },
    "row scope",
  );
  row.dataset.scope = key;
  row.append(
    icon(symbol),
    node("span", label, "label"),
    node("span", count, "count"),
  );
  row.classList.toggle("is-current", scope === key);
  if (scope === key) row.setAttribute("aria-current", "true");
  return row;
}
function buildCollectionRow(g: TabGroup, inFolder: boolean) {
  const key = `group:${g.id}`;
  const count = live([g]).length;
  const row = actionButton(
    "",
    () => {
      setScope(key);
      render();
    },
    "row collection",
  );
  row.dataset.scope = key;
  row.dataset.group = g.id;
  row.title = `${collectionLabel(g)}\n${plural(count, "tab")} · saved ${ago(g.createdAt)}`;
  const name = node("span", collectionLabel(g), "label");
  if (!g.name) name.classList.add("unnamed");
  const marks = node("span", undefined, "marks");
  if (g.starred) marks.append(icon("star", "mark star"));
  if (g.locked) marks.append(icon("lock", "mark lock"));
  row.append(leadIcon(g), name);
  if (marks.childElementCount) row.append(marks);
  row.append(node("span", count, "count"));
  row.classList.toggle("in-folder", inFolder);
  row.classList.toggle("is-current", scope === key);
  if (scope === key) row.setAttribute("aria-current", "true");
  const q = query();
  if (q && !live([g]).some((e) => matches(e, q))) row.classList.add("dim");
  row.addEventListener("dragover", (e) => {
    if (!dragged || g.locked || dragged.groupId === g.id) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    row.classList.add("drop-target");
  });
  row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
  row.addEventListener("drop", (e) => {
    e.preventDefault();
    row.classList.remove("drop-target");
    if (dragged && !g.locked) run(() => moveDragged(g.id));
  });
  return row;
}
function collectionRow(g: TabGroup, inFolder: boolean) {
  let row = collectionRows.get(g);
  if (!row) {
    row = buildCollectionRow(g, inFolder);
    collectionRows.set(g, row);
  }
  const count = live([g]).length;
  const current = scope === `group:${g.id}`;
  row.classList.toggle("is-current", current);
  if (current) row.setAttribute("aria-current", "true");
  else row.removeAttribute("aria-current");
  const q = query();
  row.classList.toggle("dim", !!q && !live([g]).some((e) => matches(e, q)));
  const counter = row.querySelector(".count")!;
  if (counter.textContent !== String(count))
    counter.textContent = String(count);
  row.title = `${collectionLabel(g)}\n${plural(count, "tab")} · saved ${ago(g.createdAt)}`;
  return row;
}
function renderNavigation() {
  const nav = $("#navigation");
  const children: HTMLElement[] = [];
  const groups = scopeGroups("all");
  children.push(
    scopeRow("recent", "Recent", "recent", live(groups).length),
    scopeRow("all", "All tabs", "tabs", live(groups).length),
    scopeRow("starred", "Starred", "star", live(scopeGroups("starred")).length),
  );
  const eyebrow = node("div", undefined, "eyebrow");
  eyebrow.append(
    node("span", "Collections"),
    toolButton("New folder", "plus", newFolder, "eyebrow-action", true),
  );
  eyebrow.querySelector("button")!.dataset.action = "new-folder";
  children.push(eyebrow);
  if (!groups.length)
    children.push(
      node("p", "Saved windows and tabs appear here, newest first.", "quiet"),
    );
  const folders = [
    ...new Set(groups.map((g) => g.folder).filter(Boolean)),
  ].sort();
  for (const f of folders) {
    const members = groups.filter((g) => g.folder === f);
    const key = `folder:${f}`;
    const head = node("div", undefined, "folder-head");
    const toggle = actionButton(
      "",
      () => {
        if (collapsedFolders.has(f)) collapsedFolders.delete(f);
        else collapsedFolders.add(f);
        render();
      },
      "folder-toggle",
    );
    toggle.dataset.folderToggle = f;
    toggle.setAttribute("aria-expanded", String(!collapsedFolders.has(f)));
    toggle.setAttribute(
      "aria-label",
      `${collapsedFolders.has(f) ? "Expand" : "Collapse"} ${f}`,
    );
    toggle.append(icon("chevron"));
    const row = actionButton(
      "",
      () => {
        setScope(key);
        render();
      },
      "row folder",
    );
    row.dataset.scope = key;
    row.append(
      icon(members.find((g) => g.folderIcon)?.folderIcon || "folder"),
      node("span", f, "label"),
      node("span", live(members).length, "count"),
    );
    row.classList.toggle("is-current", scope === key);
    if (scope === key) row.setAttribute("aria-current", "true");
    row.title = f;
    head.append(toggle, row);
    head.classList.toggle("closed", collapsedFolders.has(f));
    children.push(head);
    if (
      !collapsedFolders.has(f) ||
      members.some((g) => scope === `group:${g.id}`)
    )
      for (const g of members) children.push(collectionRow(g, true));
  }
  for (const g of groups.filter((g) => !g.folder))
    children.push(collectionRow(g, false));
  reconcile(nav, children);
}

function renderScopeHead() {
  const head = $("#scope-head");
  head.replaceChildren();
  const title = node("h2");
  title.id = "scope-title";
  const sub = node("p", undefined, "sub");
  const acts = node("div", undefined, "acts");
  const list = live(scopeGroups());
  const ids = () => visible().map((e) => e.tab.id);
  if (scope.startsWith("group:")) {
    const g = groupById(scope.slice(6))!;
    const rename = button(
      collectionLabel(g),
      async () => {
        const name = await ask("Name this collection", { value: g.name });
        if (name !== null)
          await api({
            type: "update",
            groupId: g.id,
            patch: { name: name.trim() },
          });
      },
      g.name ? "rename" : "rename unnamed",
    );
    const label = node("span", collectionLabel(g));
    rename.replaceChildren(label);
    rename.dataset.action = "rename";
    rename.title = `Rename “${collectionLabel(g)}”`;
    rename.append(icon("pencil", "rename-icon"));
    title.append(rename);
    sub.textContent = `${plural(list.length, "tab")} · ${ago(g.createdAt)}`;
    sub.title = `Saved ${longDate(g.createdAt)}`;
    acts.append(
      toolButton(
        "Restore all",
        "restore",
        () => restore({ groupId: g.id, ids: list.map((e) => e.tab.id) }),
        "primary",
      ),
      toolButton(
        "Copy links",
        "copy",
        () => copyLinks(list.map((e) => e.tab.id)),
        "",
        true,
      ),
      toolButton(
        g.starred ? "Unstar" : "Star",
        "star",
        () =>
          api({
            type: "update",
            groupId: g.id,
            patch: { starred: !g.starred },
          }),
        g.starred ? "on star" : "",
        true,
      ),
      toolButton(
        g.locked ? "Unlock" : "Lock",
        "lock",
        () =>
          api({ type: "update", groupId: g.id, patch: { locked: !g.locked } }),
        g.locked ? "on" : "",
        true,
      ),
      toolButton(
        g.folder ? `Folder: ${g.folder}` : "Move to folder",
        "folder",
        async () => {
          const folder = await ask("Move collection to folder", {
            value: g.folder,
            folderIcon: folderIconOf(g.folder),
            description:
              "Type a folder name and pick its icon. Leave the name empty to take the collection out of its folder.",
          });
          if (folder !== null)
            await api({
              type: "update",
              groupId: g.id,
              patch: { folder: folder.name.trim(), folderIcon: folder.icon },
            });
        },
        "",
        true,
      ),
      toolButton(
        "Delete all",
        "trash",
        () =>
          remove(
            list.map((e) => e.tab.id),
            g.id,
          ),
        "danger",
        true,
      ),
    );
    const removeAll = acts.querySelector<HTMLButtonElement>(".danger")!;
    removeAll.disabled = g.locked;
    if (g.locked) removeAll.title = "Unlock this collection to delete tabs";
    acts
      .querySelector('[data-action="star"]')!
      .setAttribute("aria-pressed", String(g.starred));
    acts
      .querySelector('[data-action="lock"]')!
      .setAttribute("aria-pressed", String(g.locked));
    head.append(title, sub, acts);
    return;
  }
  if (scope === "recent") {
    title.textContent = "Recent";
    const newest = recent().find((e) => !hiddenRestores.has(e.tab.id));
    sub.textContent = newest
      ? `Last saved ${ago(newest.addedAt)}`
      : "Newest first";
  } else if (scope.startsWith("folder:")) {
    const f = scope.slice(7);
    title.textContent = f;
    sub.textContent = `${plural(scopeGroups().length, "collection")} · ${plural(list.length, "tab")}`;
    acts.append(
      toolButton(
        "Restore all",
        "restore",
        () => restore({ ids: ids() }),
        "primary",
      ),
      toolButton("Copy links", "copy", () => copyLinks(ids()), "", true),
      toolButton(
        "Edit folder",
        "pencil",
        async () => {
          const edit = await ask("Edit folder", {
            value: f,
            folderIcon: folderIconOf(f),
            description: "Change the folder's name or its icon.",
          });
          const name = edit?.name.trim();
          if (!edit || !name) return;
          for (const g of scopeGroups())
            await api({
              type: "update",
              groupId: g.id,
              patch: { folder: name, folderIcon: edit.icon },
            });
          scope = `folder:${name}`;
        },
        "",
        true,
      ),
    );
  } else {
    title.textContent = scope === "starred" ? "Starred" : "All tabs";
    sub.textContent = `${plural(scopeGroups().length, "collection")} · ${plural(sites(list).length, "site")}`;
    acts.append(
      toolButton("Copy links", "copy", () => copyLinks(ids()), "", true),
    );
  }
  for (const action of acts.querySelectorAll<HTMLButtonElement>(
    '[data-action="copy"], [data-action="restore"]',
  ))
    action.disabled = !visible().length;
  head.append(title, sub);
  if (acts.childElementCount) head.append(acts);
}

function facetRow(key: string, label: string, count: number, lead: Element) {
  const row = actionButton(
    "",
    () => {
      facet = key;
      render();
    },
    "row facet",
  );
  row.dataset.facet = key;
  row.title = label;
  row.append(lead, node("span", label, "label"), node("span", count, "count"));
  row.classList.toggle("is-current", facet === key);
  if (facet === key) row.setAttribute("aria-current", "true");
  if (!count) row.classList.add("dim");
  return row;
}
function renderFacets() {
  const list = $("#facets");
  list.replaceChildren();
  const all = scoped();
  if (!state.groups.length) {
    list.append(
      node(
        "p",
        "Sites and save times show up here once you save tabs.",
        "quiet",
      ),
    );
    return;
  }
  if (scope === "recent") {
    list.append(facetRow("all", bucketNames.all, all.length, icon("layers")));
    const counts = new Map<string, number>();
    for (const entry of all) {
      const key = facetOf(entry);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const b of ["today", "yesterday", "week", "earlier"] as Bucket[]) {
      const count = counts.get(b) ?? 0;
      if (count || facet === b)
        list.append(facetRow(b, bucketNames[b], count, icon("recent")));
    }
    return;
  }
  list.append(facetRow("all", "All sites", all.length, icon("layers")));
  const counts = [...sites(all)];
  const samples = new Map<string, Entry>();
  for (const entry of all)
    if (!samples.has(entry.host)) samples.set(entry.host, entry);
  const current = facet.startsWith("site:") ? facet.slice(5) : null;
  if (current !== null && !counts.some((s) => s.host === current))
    counts.push({ host: current, label: siteLabel(current), count: 0 });
  const singles = counts.filter((s) => s.count <= 1 && s.host !== current);
  const folded =
    !showAllSites && counts.length > SITE_LIMIT && singles.length > 1;
  const shown = folded ? counts.filter((s) => !singles.includes(s)) : counts;
  for (const s of shown) {
    const sample = samples.get(s.host);
    const lead = sample
      ? websiteIcon(sample.tab.url)
      : icon("file", "site-mark file-mark");
    list.append(facetRow(`site:${s.host}`, s.label, s.count, lead));
  }
  if (counts.length > SITE_LIMIT && singles.length > 1) {
    const more = actionButton(
      "",
      () => {
        showAllSites = !showAllSites;
        render();
      },
      "row more",
    );
    more.append(
      node(
        "span",
        showAllSites
          ? "Fold sites with one tab"
          : `${plural(singles.length, "more site")} with one tab`,
      ),
      icon("chevron"),
    );
    more.classList.toggle("open", showAllSites);
    more.setAttribute("aria-expanded", String(showAllSites));
    more.dataset.action = "more-sites";
    list.append(more);
  }
}

function separator(text: string, detail: string, onClick?: () => void) {
  const sep = node("div", undefined, "sep");
  const label = onClick
    ? actionButton(text, onClick, "sep-label")
    : node("span", text, "sep-label");
  sep.append(label, node("span", detail, "sep-detail"));
  return sep;
}
function tabRow(entry: Entry, opts: { showHost: boolean }) {
  const { tab: t, group: g } = entry;
  const row = node("div", undefined, "tab-row");
  row.dataset.tab = t.id;
  row.dataset.group = g.id;
  row.draggable = !g.locked;
  row.classList.toggle("selected", selected.has(t.id));
  const check = node("input");
  check.type = "checkbox";
  check.checked = selected.has(t.id);
  check.setAttribute("aria-label", `Select ${t.title}`);
  check.onchange = () => {
    if (check.checked) selected.add(t.id);
    else selected.delete(t.id);
    row.classList.toggle("selected", check.checked);
    updateSelection();
  };
  const link = node("a", t.title);
  link.href = t.url;
  if (restoring.has(t.id)) {
    link.setAttribute("aria-disabled", "true");
    link.setAttribute("aria-busy", "true");
  }
  link.title = t.url + (g.locked ? " (locked collection)" : "");
  link.onclick = (e) => {
    e.preventDefault();
    if (e.detail > 1) return;
    restore({ ids: [t.id], keep: e.ctrlKey || e.metaKey }).catch((e: unknown) =>
      toast(e instanceof Error ? e.message : String(e)),
    );
  };
  link.onauxclick = (e) => {
    if (e.button === 1) {
      e.preventDefault();
      if (e.detail > 1) return;
      restore({ ids: [t.id], keep: true }).catch((e: unknown) =>
        toast(e instanceof Error ? e.message : String(e)),
      );
    }
  };
  const meta = node("span", undefined, "meta");
  if (opts.showHost) meta.append(node("span", siteLabel(entry.host), "domain"));
  const time = node("time", shortAgo(entry.addedAt), "tab-date");
  time.dateTime = new Date(entry.addedAt).toISOString();
  time.title = `Saved ${longDate(entry.addedAt)}`;
  meta.append(time);
  const del = actionButton("", () => run(() => remove([t.id])), "delete");
  del.append(icon("close"));
  del.setAttribute("aria-label", `Delete ${t.title}`);
  del.disabled = g.locked;
  if (g.locked) del.title = "Unlock this collection to delete tabs";
  row.append(check, websiteIcon(t.url), link, meta, del);
  row.addEventListener("dragstart", (e) => {
    if (!row.draggable) return e.preventDefault();
    const ids = selected.has(t.id)
      ? visible()
          .filter((v) => selected.has(v.tab.id) && !v.group.locked)
          .map((v) => v.tab.id)
      : [t.id];
    dragged = { groupId: g.id, ids };
    e.dataTransfer!.setData("text/plain", t.url);
    e.dataTransfer!.effectAllowed = "move";
    document.body.classList.add("dragging");
  });
  // Reordering only makes sense inside one collection's full list.
  const reorderable =
    scope === `group:${g.id}` && facet === "all" && !query() && !g.locked;
  if (reorderable) {
    row.addEventListener("dragover", (e) => {
      if (!dragged) return;
      e.preventDefault();
      const after =
        e.clientY >= row.getBoundingClientRect().top + row.offsetHeight / 2;
      setInsertion(row, after);
    });
    row.addEventListener("drop", (e) => {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
      const after =
        e.clientY >= row.getBoundingClientRect().top + row.offsetHeight / 2;
      const beforeId = after
        ? live([g])[live([g]).findIndex((e) => e.tab.id === t.id) + 1]?.tab.id
        : t.id;
      run(() => moveDragged(g.id, beforeId));
    });
  }
  return row;
}
function renderTabs() {
  const list = visible();
  const container = $("#groups");
  const heading = $("#heading");
  const sub = $("#subheading");
  const site = facet.startsWith("site:") ? siteLabel(facet.slice(5)) : null;
  const inScope = scoped().length;
  if (scope === "recent") {
    heading.textContent =
      facet === "all" ? "Newest first" : bucketNames[facet as Bucket];
    sub.textContent = "Last saved is on top. Restore it with one click.";
  } else {
    const where = scope.startsWith("group:")
      ? collectionLabel(groupById(scope.slice(6))!)
      : scope === "starred"
        ? "Starred"
        : scope.startsWith("folder:")
          ? scope.slice(7)
          : "All tabs";
    heading.textContent = site ?? where;
    sub.textContent = site
      ? `${list.length} of ${inScope} in ${where}`
      : scope.startsWith("group:")
        ? "Saved in this collection"
        : query() && !list.length
          ? "No matches in this scope"
          : `Across ${plural(new Set(list.map((e) => e.group.id)).size, "collection")}`;
  }
  heading.title = heading.textContent;
  $("#list-meta").textContent = query()
    ? `${plural(list.length, "match", "matches")}`
    : plural(list.length, "tab");
  $("#restore-all").disabled = !list.length;
  $("#undo").hidden = !state.trash?.length;
  tabItems = [];
  if (scope === "recent") {
    for (let i = 0; i < list.length;) {
      const entry = list[i];
      const minute = Math.floor(entry.addedAt / 60_000);
      let end = i + 1;
      while (
        end < list.length &&
        list[end].group.id === entry.group.id &&
        Math.floor(list[end].addedAt / 60_000) === minute
      )
        end++;
      tabItems.push({ kind: "separator", entry, count: end - i, recent: true });
      while (i < end) tabItems.push({ kind: "tab", entry: list[i++] });
    }
  } else if (scope.startsWith("group:")) {
    tabItems = list.map((entry) => ({ kind: "tab", entry }));
  } else {
    const counts = new Map<TabGroup, number>();
    for (const entry of list)
      counts.set(entry.group, (counts.get(entry.group) ?? 0) + 1);
    let last: TabGroup | undefined;
    for (const entry of list) {
      if (entry.group !== last) {
        last = entry.group;
        tabItems.push({
          kind: "separator",
          entry,
          count: counts.get(entry.group)!,
          recent: false,
        });
      }
      tabItems.push({ kind: "tab", entry });
    }
  }
  const showHost = !site;
  const paintWindow = () =>
    tabWindow.set(
      tabItems,
      (item) =>
        item.kind === "tab"
          ? tabRow(item.entry, { showHost })
          : separator(
              item.recent
                ? `Saved ${savedAt(item.entry.addedAt)}`
                : collectionLabel(item.entry.group),
              item.recent
                ? `${collectionLabel(item.entry.group)} · ${plural(item.count, "tab")}`
                : `${plural(item.count, "tab")} · ${savedAt(item.entry.group.createdAt)}`,
              () => {
                setScope(`group:${item.entry.group.id}`);
                render();
              },
            ),
      (item, i) =>
        item.kind === "tab" ? tabHeight : separatorHeight - (i === 0 ? 8 : 0),
      listScrollTop,
    );
  paintWindow();
  if (!list.length) {
    const empty = node("div", undefined, "empty");
    if (!state.groups.length) {
      empty.append(
        node("h2", "Nothing saved yet"),
        node(
          "p",
          "Press Alt+C on any page to save it here, or save this whole window. Your newest save always lands on top.",
        ),
        button("Import from OneTab", async () => $("#transfer").showModal()),
      );
    } else if (query()) {
      empty.append(
        node("h2", "No matching tabs"),
        node("p", `Nothing here matches “${$("#search").value.trim()}”.`),
        button("Clear search", async () => {
          $("#search").value = "";
          $("#search").focus();
        }),
      );
    } else if (scope === "starred") {
      empty.append(
        node("h2", "No starred collections"),
        node("p", "Star a collection in its details to find its tabs here."),
      );
    } else {
      empty.append(
        node("h2", "No tabs here"),
        node("p", "Pick another collection or site."),
      );
    }
    container.append(empty);
  }
  const row = container.querySelector<HTMLElement>(".tab-row");
  const sep = container.querySelector<HTMLElement>(".sep");
  const nextTabHeight = row?.getBoundingClientRect().height ?? tabHeight;
  const nextSeparatorHeight = sep
    ? sep.getBoundingClientRect().height + 18
    : separatorHeight;
  if (nextTabHeight !== tabHeight || nextSeparatorHeight !== separatorHeight) {
    tabHeight = nextTabHeight;
    separatorHeight = nextSeparatorHeight;
    paintWindow();
  }
  updateSelection();
}
function paintSelection() {
  for (const row of $("#groups").querySelectorAll<HTMLElement>(".tab-row")) {
    const checked = selected.has(row.dataset.tab!);
    row.classList.toggle("selected", checked);
    row.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked =
      checked;
  }
  updateSelection();
}
function updateSelection() {
  const ids = visible().map((e) => e.tab.id);
  const chosen = ids.filter((id) => selected.has(id)).length;
  $("#selection").hidden = !selected.size;
  $("#hint").hidden = !!selected.size;
  $("#selected-count").textContent =
    `${selected.size} selected${selected.size > chosen ? ` · ${selected.size - chosen} hidden` : ""}`;
  const all = $("#select-all");
  all.checked = !!ids.length && chosen === ids.length;
  all.indeterminate = chosen > 0 && chosen < ids.length;
  all.disabled = !ids.length;
}

/* ---------- Vine ---------- */

function drawVine() {
  const links: VineLink[] = [
    {
      from: $("#col-1"),
      fromRow: $("#navigation").querySelector<HTMLElement>(".is-current"),
      to: $("#col-2"),
      toRow: $("#facets").querySelector<HTMLElement>(".is-current"),
    },
    {
      from: $("#col-2"),
      fromRow: $("#facets").querySelector<HTMLElement>(".is-current"),
      to: $("#col-3"),
      toRow: $("#list-head"),
    },
  ];
  vine.draw(links, `${scope}|${facet}`);
}
let vineFrame = 0;
function followVine() {
  cancelAnimationFrame(vineFrame);
  vineFrame = requestAnimationFrame(() => state && drawVine());
}
for (const list of ["#navigation", "#facets"] as const)
  $(list).addEventListener("scroll", followVine, { passive: true });
addEventListener("resize", followVine);
const vineObserver = new ResizeObserver(followVine);
for (const target of ["#scope-head", "#list-head", "#facets"] as const)
  vineObserver.observe($(target));
document.fonts.ready.then(followVine);

/* ---------- Drag and drop ---------- */

let insertionRow: HTMLElement | null = null;
function setInsertion(row: HTMLElement | null, after = false) {
  if (insertionRow !== row) {
    insertionRow?.classList.remove("insert-before", "insert-after");
    insertionRow = row;
  }
  row?.classList.toggle("insert-before", !after);
  row?.classList.toggle("insert-after", after);
}
function finishDrag() {
  dragged = null;
  setInsertion(null);
  document.body.classList.remove("dragging");
  for (const el of document.querySelectorAll(".drop-target"))
    el.classList.remove("drop-target");
}
async function moveDragged(targetId?: string, beforeId?: string) {
  if (!dragged) return;
  const d = dragged;
  finishDrag();
  if (d.ids.length === 1 && d.ids[0] === beforeId) return;
  if (d.groupId === targetId && d.ids.length === 1)
    await api({
      type: "reorder",
      groupId: targetId,
      tabId: d.ids[0],
      beforeId,
    });
  else await api({ type: "move", ids: d.ids, targetId, beforeId });
  if (!targetId)
    toast(`Started a new collection with ${plural(d.ids.length, "tab")}.`);
  for (const id of d.ids) selected.delete(id);
}
document.addEventListener("dragend", finishDrag);
$("#drop-zone").ondragover = (e) => {
  if (!dragged) return;
  e.preventDefault();
  $("#drop-zone").classList.add("drop-target");
};
$("#drop-zone").ondragleave = () =>
  $("#drop-zone").classList.remove("drop-target");
$("#drop-zone").ondrop = (e) => {
  e.preventDefault();
  if (dragged) run(() => moveDragged(undefined));
};

/* ---------- Actions ---------- */

async function restore(options: RestoreOptions) {
  const requested = options.ids ? new Set(options.ids) : null;
  const ids: string[] = [];
  for (const group of state.groups) {
    if (options.groupId && options.groupId !== group.id) continue;
    for (const tab of group.tabs) {
      if ((requested && !requested.has(tab.id)) || restoring.has(tab.id))
        continue;
      ids.push(tab.id);
      restoring.add(tab.id);
      if (!group.locked && !state.settings.keepRestored && !options.keep)
        hiddenRestores.add(tab.id);
    }
  }
  if (!ids.length) return;
  if (options.ids) {
    const rank = new Map(options.ids.map((id, i) => [id, i]));
    ids.sort((a, b) => rank.get(a)! - rank.get(b)!);
  }
  // Update the DOM in this click event, before any browser or storage work.
  render();
  try {
    const r = await api({ type: "restore", ...options, ids });
    await refresh();
    toast(
      `${r.count} ${r.count === 1 ? "tab" : "tabs"} restored in this window.${r.failed.length ? ` ${r.failed.length} could not be opened and remain saved.` : ""}`,
    );
  } finally {
    for (const id of ids) {
      restoring.delete(id);
      hiddenRestores.delete(id);
    }
    render();
  }
}
async function remove(ids: string[], groupId?: string) {
  if (!ids.length) return;
  const wanted = new Set(ids);
  const removable = live(state.groups)
    .filter(({ tab, group }) => wanted.has(tab.id) && !group.locked)
    .map(({ tab }) => tab.id);
  if (!removable.length) {
    toast("Unlock the selected collections to delete their tabs.");
    return;
  }
  await api({ type: "delete", ids: removable, groupId });
  for (const id of removable) selected.delete(id);
  const kept = ids.length - removable.length;
  toast(
    `Deleted ${plural(removable.length, "tab")}.${kept ? ` Kept ${plural(kept, "tab")} in locked collections.` : ""}`,
    true,
  );
}
// Copied links keep the order of the ids, which is the order on screen.
async function copyLinks(ids: string[]) {
  const byId = new Map(
    state.groups.flatMap((g) => g.tabs.map((t) => [t.id, t] as const)),
  );
  const tabs = ids.flatMap((id) => byId.get(id) ?? []);
  await navigator.clipboard.writeText(bulletList(tabs));
  toast(`Copied ${plural(tabs.length, "link")}.`);
}
async function newFolder() {
  const folder = await ask("Create a folder", {
    value: "",
    folderIcon: "folder",
    description: "Folders hold collections. Choose the first one next.",
  });
  if (!folder?.name.trim()) return;
  if (!state.groups.length) {
    toast("Save or import a collection first.");
    return;
  }
  const groupId = await ask("Choose a collection", {
    options: state.groups.map((g) => [
      g.id,
      `${collectionLabel(g)} · ${plural(g.tabs.length, "tab")}`,
    ]),
  });
  if (groupId)
    await api({
      type: "update",
      groupId,
      patch: { folder: folder.name.trim(), folderIcon: folder.icon },
    });
}

$("#search").oninput = render;
$("#select-all").onchange = () => {
  const ids = visible().map((e) => e.tab.id);
  if ($("#select-all").checked) for (const id of ids) selected.add(id);
  else for (const id of ids) selected.delete(id);
  paintSelection();
};
$("#save-window").onclick = () =>
  run(async () => {
    const r = await api({ type: "capture", mode: "all" });
    setScope("recent");
    toast(
      `${plural(r.count, "tab")} saved.${r.notClosed ? " Some source tabs stayed open because they changed." : ""}`,
    );
  });
$("#theme-toggle").onclick = () =>
  run(() =>
    api({
      type: "settings",
      settings: {
        theme: document.body.classList.contains("dark") ? "light" : "dark",
      },
    }),
  );
$("#restore-all").onclick = () =>
  run(() => restore({ ids: visible().map((e) => e.tab.id) }));
$("#restore-selected").onclick = () =>
  run(() => restore({ ids: orderedSelection() }));
$("#delete-selected").onclick = () => run(() => remove([...selected]));
// Selected tabs in on-screen order, then any hidden by the current view in
// saved order, so copied links never depend on the order of clicks.
function orderedSelection() {
  const shown = visible()
    .map((e) => e.tab.id)
    .filter((id) => selected.has(id));
  const seen = new Set(shown);
  const hidden = state.groups.flatMap((g) =>
    g.tabs.map((t) => t.id).filter((id) => selected.has(id) && !seen.has(id)),
  );
  return [...shown, ...hidden];
}
$("#copy-selected").onclick = () => run(() => copyLinks(orderedSelection()));
$("#clear-selected").onclick = () => {
  selected.clear();
  paintSelection();
  $("#select-all").focus({ preventScroll: true });
};
$("#move-selected").onclick = () =>
  run(async () => {
    // Locked collections keep their tabs, as with delete; say so instead of
    // silently clearing them from the selection.
    const locked = new Set(
      live(state.groups)
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
        ...state.groups
          .filter((g) => !g.locked)
          .map((g) => [
            g.id,
            `${collectionLabel(g)} · ${plural(g.tabs.length, "tab")}`,
          ]),
      ],
    });
    if (targetId !== null) {
      const next = await api({
        type: "move",
        ids: movable,
        targetId: targetId || undefined,
      });
      // Count what reached the destination; a collection locked elsewhere
      // while the dialog was open keeps its tabs, and they stay selected.
      const target = targetId
        ? next.groups.find((g) => g.id === targetId)
        : next.groups[0];
      const landed = new Set(target?.tabs.map((t) => t.id));
      const moved = movable.filter((id) => landed.has(id));
      for (const id of moved) selected.delete(id);
      const kept = selected.size;
      toast(
        `Moved ${plural(moved.length, "tab")}.${kept ? ` Kept ${plural(kept, "tab")} in locked collections.` : ""}`,
      );
    }
  });
const undo = () =>
  run(() =>
    api({ type: "undo" }).then(() => toast("Restored the deleted tabs.")),
  );
$("#undo").onclick = undo;
$("#status-undo").onclick = undo;
$("#transfer-open").onclick = () => $("#transfer").showModal();
$("#import-file").onchange = async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    if (file.size > 50 * 1024 * 1024) {
      toast("Choose a file smaller than 50 MB.");
      return;
    }
    $("#import-text").value = await file.text();
  }
};
$("#import").onclick = () =>
  run(async () => {
    const r = await api({ type: "import", text: $("#import-text").value });
    $("#import-result").textContent =
      `Imported ${r.tabs} ${r.tabs === 1 ? "tab" : "tabs"} in ${r.groups} ${r.groups === 1 ? "collection" : "collections"}.`;
    $("#import-text").value = "";
    $("#import-file").value = "";
  });
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = node("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
$("#export-json").onclick = () =>
  run(async () => {
    const fresh = await api({ type: "state" });
    download(
      JSON.stringify({ version: 1, groups: fresh.groups }, null, 2),
      "tabtuck-backup.json",
      "application/json",
    );
  });
$("#export-text").onclick = () =>
  run(async () => {
    const fresh = await api({ type: "state" });
    download(exportText(fresh.groups), "tabtuck-export.txt", "text/plain");
  });
async function settings() {
  for (const el of document.querySelectorAll<
    HTMLInputElement | HTMLSelectElement
  >("[data-setting]")) {
    const value = state.settings[el.dataset.setting as keyof Settings];
    if (el instanceof HTMLInputElement && el.type === "checkbox")
      el.checked = value === true;
    else el.value = String(value);
  }
  const commands = await chrome.commands.getAll();
  $("#command-status").textContent = commands
    .map(
      (c) =>
        `${c.description}: ${c.shortcut || "Not assigned — use Change shortcuts"}`,
    )
    .join(" · ");
  $("#settings").showModal();
}
$("#settings-open").onclick = () => run(settings);
$("#settings-save").onclick = () =>
  run(async () => {
    const settings: Partial<Settings> = {};
    for (const el of document.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >("[data-setting]")) {
      const key = el.dataset.setting;
      if (key === "theme") settings.theme = el.value;
      else if (
        (key === "keepRestored" ||
          key === "deduplicate" ||
          key === "showAfterSave") &&
        el instanceof HTMLInputElement
      )
        settings[key] = el.checked;
    }
    await api({ type: "settings", settings });
    $("#settings").close();
    toast("Options saved.");
  });
$("#shortcuts").onclick = () =>
  run(async () => {
    const tab = await chrome.tabs.getCurrent();
    await chrome.tabs.create({
      windowId: tab?.windowId,
      url: "chrome://extensions/shortcuts",
    });
  });
document.addEventListener("keydown", (e) => {
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(
    document.activeElement?.tagName ?? "",
  );
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "/" && !typing) {
    e.preventDefault();
    $("#search").focus();
  } else if (e.key === "Escape") {
    if ($("#search").value) {
      $("#search").value = "";
      render();
    } else if (selected.size) {
      selected.clear();
      paintSelection();
    }
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || busy) return;
  if (changes.state?.newValue) adopt(changes.state.newValue as State);
  else if (state) {
    const captures = Object.entries(changes)
      .filter(
        ([key, change]) => key.startsWith(capturePrefix) && change.newValue,
      )
      .map(([, change]) => change.newValue as CaptureJournal)
      .filter(
        (entry) => entry.base === state.revision && !groupById(entry.group.id),
      )
      .sort((a, b) => b.order - a.order);
    if (captures.length)
      adopt({
        ...state,
        groups: [...captures.map((entry) => entry.group), ...state.groups],
      });
  }
});
matchMedia("(prefers-color-scheme: dark)").addEventListener(
  "change",
  () => state && render(),
);
// Relative save times ("4m", "2h") stay current while the page is open.
setInterval(() => {
  for (const time of document.querySelectorAll<HTMLTimeElement>(
    "time.tab-date",
  ))
    time.textContent = shortAgo(Date.parse(time.dateTime));
}, 60_000);
await refresh();
const { lastError } = await chrome.storage.local.get<{ lastError?: string }>(
  "lastError",
);
if (lastError) {
  toast(lastError);
  await chrome.storage.local.remove("lastError");
  await chrome.action.setBadgeText({ text: "" });
}
if (location.hash === "#settings") await settings();
