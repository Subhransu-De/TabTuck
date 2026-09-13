import { defaults, exportText, groupBySites } from "./model.js";
import { icon, folderIcons } from "./ui-icons.js";
import {
  element as node,
  actionButton,
  websiteIcon,
  addedTime,
} from "./ui-components.js";
const $ = (s) => document.querySelector(s);
let state,
  filter = "all",
  selected = new Set(),
  dragged,
  busy = false,
  toastTimer;
const collapsedSites = new Set();
const restoring = new Set();
const hiddenRestores = new Set();
function button(label, fn, cls) {
  return actionButton(label, () => run(fn), cls);
}
function toast(message) {
  $("#status").textContent = message;
  $("#status").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#status").hidden = true), 6500);
}
async function api(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok)
    throw new Error(
      response?.error || "The extension did not respond. Reload this page.",
    );
  return response.result;
}
async function run(fn) {
  if (busy) return;
  busy = true;
  try {
    await fn();
    await refresh();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
  }
}
function ask(title, { value, description = "", options, folderIcon } = {}) {
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
  return new Promise((resolve) => {
    let result = null;
    $("#prompt-form").onsubmit = (e) => {
      e.preventDefault();
      result =
        folderIcon !== undefined
          ? {
              name: $("#prompt-input").value,
              icon: $("#folder-icons input:checked")?.value || "folder",
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
async function refresh() {
  state = await api({ type: "state" });
  state.settings = { ...defaults, ...state.settings };
  const ids = new Set(state.groups.flatMap((g) => g.tabs.map((t) => t.id)));
  selected = new Set([...selected].filter((id) => ids.has(id)));
  render();
}
function visibleGroups() {
  const q = $("#search").value.toLowerCase().trim();
  const groups = state.groups
    .filter(
      (g) =>
        filter === "all" ||
        filter === "sites" ||
        (filter === "starred" ? g.starred : g.folder === filter.slice(7)),
    )
    .map((g) => ({
      ...g,
      tabs: g.tabs.filter(
        (t) =>
          !hiddenRestores.has(t.id) &&
          (!q ||
            `${t.title} ${t.url} ${g.name} ${g.folder}`
              .toLowerCase()
              .includes(q)),
      ),
    }))
    .filter((g) => g.tabs.length);
  groups.sort((a, b) => b.createdAt - a.createdAt);
  if (filter === "sites")
    return groupBySites(groups).map((g) => ({
      ...g,
      collapsed: collapsedSites.has(g.id),
    }));
  return groups;
}
function render() {
  document.body.classList.toggle(
    "dark",
    state.settings.theme === "dark" ||
      (state.settings.theme === "system" &&
        matchMedia("(prefers-color-scheme: dark)").matches),
  );
  const nav = $("#navigation");
  nav.replaceChildren();
  const folders = [
    ...new Set(state.groups.map((g) => g.folder).filter(Boolean)),
  ].sort();
  for (const [key, label, symbol] of [
    ["starred", "Starred", "star"],
    ["all", "All tabs", "tabs"],
    ["sites", "Group by sites", "globe"],
    ...folders.map((f) => [
      "folder:" + f,
      f,
      state.groups.find((g) => g.folder === f && g.folderIcon)?.folderIcon ||
        "folder",
    ]),
  ]) {
    let count = state.groups
      .filter(
        (g) =>
          key === "all" ||
          key === "sites" ||
          (key === "starred" ? g.starred : g.folder === key.slice(7)),
      )
      .reduce(
        (n, g) => n + g.tabs.filter((t) => !hiddenRestores.has(t.id)).length,
        0,
      );
    if (key === "sites")
      count = groupBySites(
        state.groups.map((g) => ({
          ...g,
          tabs: g.tabs.filter((t) => !hiddenRestores.has(t.id)),
        })),
      ).length;
    const el = button("", async () => {
      filter = key;
      selected.clear();
    });
    const name = node("span", undefined, "nav-name");
    name.append(icon(symbol), node("span", label, "nav-label"));
    const badge = node("span", count, "nav-count");
    badge.title = `${count} ${key === "sites" ? "websites" : "tabs"}`;
    badge.setAttribute("aria-label", badge.title);
    el.append(name, badge);
    el.classList.toggle("active", filter === key);
    nav.append(el);
  }
  const groups = visibleGroups(),
    count = groups.reduce((n, g) => n + g.tabs.length, 0);
  $("#heading").textContent =
    filter === "all"
      ? "All tabs"
      : filter === "sites"
        ? "Group by sites"
        : filter === "starred"
          ? "Starred"
          : filter.slice(7);
  $("#summary").textContent =
    `${count} saved ${count === 1 ? "tab" : "tabs"} in ${groups.length} ${filter === "sites" ? (groups.length === 1 ? "site" : "sites") : groups.length === 1 ? "group" : "groups"}`;
  $("#undo").disabled = !state.trash?.length;
  $("#restore-all").disabled = !count;
  $("#selection").hidden = !selected.size;
  $("#selected-count").textContent = `${selected.size} selected`;
  const container = $("#groups");
  container.replaceChildren();
  if (!groups.length) {
    const empty = node("div", undefined, "empty");
    const img = node("img");
    img.src = "icons/128.png";
    img.alt = "";
    empty.append(
      img,
      node("h2", state.groups.length ? "No matching tabs" : "No saved tabs"),
      button("Import from OneTab", async () => $("#transfer").showModal()),
    );
    container.append(empty);
  }
  for (const g of groups) {
    const section = node("section", undefined, "group");
    section.dataset.group = g.id;
    section.dataset.droppable = String(!g.site && !g.locked);
    const top = node("div", undefined, "group-top");
    const h2 = node("h2");
    if (g.site) h2.textContent = g.name;
    else
      h2.append(
        button(
          `${g.starred ? "★ " : ""}${g.locked ? "▣ " : ""}${g.name || `${g.tabs.length} ${g.tabs.length === 1 ? "tab" : "tabs"}`}`,
          async () => {
            const name = await ask("Name this group", { value: g.name });
            if (name !== null)
              await api({ type: "update", groupId: g.id, patch: { name } });
          },
        ),
      );
    top.append(h2);
    const date = node(
      "p",
      `${new Date(g.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}${g.name ? ` · ${g.tabs.length} tabs` : ""}${g.folder ? ` · ${g.folder}` : ""}`,
      "group-date",
    );
    const actions = node("div", undefined, "group-actions");
    if (g.site)
      actions.append(
        button("Restore all", () => restore({ ids: g.tabs.map((t) => t.id) })),
        button(
          "Delete all",
          () => remove({ ids: g.tabs.map((t) => t.id) }),
          "danger",
        ),
        button("Select all", async () => {
          for (const tab of g.tabs) selected.add(tab.id);
        }),
        button("Copy links", async () => {
          await navigator.clipboard.writeText(exportText([g]));
          toast("Site links copied.");
        }),
        button(g.collapsed ? "Expand" : "Collapse", async () => {
          g.collapsed ? collapsedSites.delete(g.id) : collapsedSites.add(g.id);
        }),
      );
    else
      actions.append(
        button("Restore all", () =>
          restore({ groupId: g.id, ids: g.tabs.map((t) => t.id) }),
        ),
        button(
          "Delete all",
          () => remove({ groupId: g.id, ids: g.tabs.map((t) => t.id) }),
          "danger",
        ),
        button(g.starred ? "Unstar" : "Star", () =>
          api({
            type: "update",
            groupId: g.id,
            patch: { starred: !g.starred },
          }),
        ),
        button(g.locked ? "Unlock" : "Lock", () =>
          api({ type: "update", groupId: g.id, patch: { locked: !g.locked } }),
        ),
        button("Select all", async () => {
          for (const t of g.tabs) selected.add(t.id);
        }),
        button("Copy links", async () => {
          await navigator.clipboard.writeText(exportText([g]));
          toast("Group links copied.");
        }),
        button("Folder", async () => {
          const folder = await ask("Move group to folder", {
            value: g.folder,
            description:
              "Enter a folder name, or leave empty to remove it from a folder.",
          });
          if (folder !== null)
            await api({
              type: "update",
              groupId: g.id,
              patch: { folder: folder.trim() },
            });
        }),
        button(g.collapsed ? "Expand" : "Collapse", () =>
          api({
            type: "update",
            groupId: g.id,
            patch: { collapsed: !g.collapsed },
          }),
        ),
      );
    section.append(top, date, actions);
    if (!g.collapsed || $("#search").value)
      for (const t of g.tabs) {
        const row = node("div", undefined, "tab-row");
        row.draggable = !g.site && !g.locked;
        row.dataset.tab = t.id;
        const check = node("input");
        check.type = "checkbox";
        check.checked = selected.has(t.id);
        check.setAttribute("aria-label", `Select ${t.title}`);
        check.onchange = () => {
          check.checked ? selected.add(t.id) : selected.delete(t.id);
          $("#selection").hidden = !selected.size;
          $("#selected-count").textContent = `${selected.size} selected`;
        };
        const host = new URL(t.url).hostname.replace(/^www\./, "") || "file";
        const mark = websiteIcon(t.url);
        const link = node("a", t.title);
        link.href = t.url;
        if (restoring.has(t.id)) {
          link.setAttribute("aria-disabled", "true");
          link.setAttribute("aria-busy", "true");
        }
        link.title = t.url + (t.sourceLocked ? " (locked group)" : "");
        link.onclick = (e) => {
          e.preventDefault();
          if (e.detail > 1) return;
          restore({ ids: [t.id], keep: e.ctrlKey || e.metaKey }).catch((e) =>
            toast(e.message),
          );
        };
        link.onauxclick = (e) => {
          if (e.button === 1) {
            e.preventDefault();
            if (e.detail > 1) return;
            restore({ ids: [t.id], keep: true }).catch((e) => toast(e.message));
          }
        };
        row.append(
          check,
          mark,
          link,
          node("span", host, "domain"),
          addedTime(t.addedAt ?? g.createdAt),
          button("×", () => remove({ ids: [t.id] })),
        );
        row.lastChild.setAttribute("aria-label", `Delete ${t.title}`);
        row.addEventListener("dragstart", (e) =>
          startDrag(e, { groupId: g.id, tabId: t.id }),
        );
        row.addEventListener("drop", (e) => {
          if (g.site) return;
          e.preventDefault();
          e.stopPropagation();
          const after =
            e.clientY >= row.getBoundingClientRect().top + row.offsetHeight / 2;
          const beforeId = after ? row.nextElementSibling?.dataset.tab : t.id;
          run(() => drop(g.id, beforeId));
        });
        section.append(row);
      }
    section.addEventListener("dragover", (e) => {
      if (g.site || g.locked || !dragged) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      highlightDropTarget(section);
    });
    section.addEventListener("drop", (e) => {
      if (g.site) return;
      e.preventDefault();
      section.classList.remove("drag-over");
      run(() => drop(g.id));
    });
    container.append(section);
  }
}
function startDrag(e, data) {
  if (!e.currentTarget.draggable) {
    e.preventDefault();
    return;
  }
  dragged = data;
  e.dataTransfer.setData("text/plain", data.tabId || data.groupId);
  e.dataTransfer.effectAllowed = "move";
  document.body.classList.add("dragging");
  highlightDropTarget(e.currentTarget.closest(".group"));
}
let dropTarget = null;
let insertionRow = null;
function setInsertion(row, after = false) {
  if (insertionRow !== row) {
    insertionRow?.classList.remove("insert-before", "insert-after");
    insertionRow = row;
  }
  if (row) {
    row.classList.toggle("insert-before", !after);
    row.classList.toggle("insert-after", after);
  }
}
function highlightDropTarget(target) {
  if (target === dropTarget) return;
  dropTarget?.classList.remove("drag-over");
  dropTarget = target;
  dropTarget?.classList.add("drag-over");
}
function finishDrag() {
  dragged = null;
  highlightDropTarget(null);
  setInsertion(null);
  document.body.classList.remove("dragging");
}
// Track the card, not its changing child elements, throughout a native drag.
for (const event of ["dragenter", "dragover"])
  document.addEventListener(
    event,
    (e) => {
      if (!dragged) return;
      const card = e.target.closest?.(".group");
      highlightDropTarget(card?.dataset.droppable === "true" ? card : null);
      const row = e.target.closest?.(".tab-row");
      if (row && dropTarget)
        setInsertion(
          row,
          e.clientY >= row.getBoundingClientRect().top + row.offsetHeight / 2,
        );
      else setInsertion(null);
    },
    true,
  );
document.addEventListener("dragleave", (e) => {
  if (
    !e.relatedTarget &&
    (e.clientX <= 0 ||
      e.clientY <= 0 ||
      e.clientX >= innerWidth ||
      e.clientY >= innerHeight)
  )
    highlightDropTarget(null);
});
async function drop(targetId, beforeId) {
  if (!dragged) return;
  const d = dragged;
  finishDrag();
  if (d.tabId === beforeId) return;
  if (d.tabId)
    await api(
      d.groupId === targetId
        ? { type: "reorder", groupId: targetId, tabId: d.tabId, beforeId }
        : { type: "move", ids: [d.tabId], targetId, beforeId },
    );
  else if (targetId !== d.groupId)
    await api({ type: "reorder", groupId: d.groupId, beforeId: targetId });
}
document.addEventListener("dragend", finishDrag);
$("#drop-zone").ondragover = (e) => e.preventDefault();
$("#drop-zone").ondrop = (e) => {
  e.preventDefault();
  if (dragged?.tabId) run(() => drop(undefined));
};
async function restore(options) {
  const requested = options.ids ? new Set(options.ids) : null;
  const ids = [];
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
async function remove(options) {
  if (
    await ask("Delete saved tabs?", {
      description:
        "Locked groups are protected. You can undo this from the toolbar.",
    })
  ) {
    await api({ type: "delete", ...options });
    toast("Deleted unlocked tabs. Use Undo delete to recover them.");
  }
}
$("#search").oninput = render;
$("#save-window").onclick = () =>
  run(async () => {
    const r = await api({ type: "capture", mode: "all" });
    toast(
      `${r.count} tabs saved.${r.notClosed ? " Some source tabs stayed open because they changed." : ""}`,
    );
  });
$("#restore-all").onclick = () =>
  run(() =>
    restore({ ids: visibleGroups().flatMap((g) => g.tabs.map((t) => t.id)) }),
  );
$("#restore-selected").onclick = () =>
  run(() => restore({ ids: [...selected] }));
$("#delete-selected").onclick = () => run(() => remove({ ids: [...selected] }));
$("#clear-selected").onclick = () => {
  selected.clear();
  render();
};
$("#move-selected").onclick = () =>
  run(async () => {
    const targetId = await ask("Move selected tabs", {
      options: [
        ["", "New group"],
        ...state.groups
          .filter((g) => !g.locked)
          .map((g) => [
            g.id,
            g.name ||
              `${g.tabs.length} tabs · ${new Date(g.createdAt).toLocaleString()}`,
          ]),
      ],
    });
    if (targetId !== null) {
      await api({ type: "move", ids: [...selected], targetId });
      selected.clear();
    }
  });
$("#undo").onclick = () => run(() => api({ type: "undo" }));
$("#new-folder").onclick = () =>
  run(async () => {
    const folder = await ask("Create a folder", {
      value: "",
      folderIcon: "folder",
      description: "Choose a group to put in this folder in the next step.",
    });
    if (!folder?.name.trim()) return;
    if (!state.groups.length) {
      toast("Save or import a group first.");
      return;
    }
    const groupId = await ask("Choose a group", {
      options: state.groups.map((g) => [
        g.id,
        g.name || `${g.tabs.length} tabs`,
      ]),
    });
    if (groupId)
      await api({
        type: "update",
        groupId,
        patch: { folder: folder.name.trim(), folderIcon: folder.icon },
      });
  });
$("#transfer-open").onclick = () => $("#transfer").showModal();
$("#import-file").onchange = async (e) => {
  const file = e.target.files[0];
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
      `Imported ${r.tabs} ${r.tabs === 1 ? "tab" : "tabs"} in ${r.groups} ${r.groups === 1 ? "group" : "groups"}.`;
    $("#import-text").value = "";
    $("#import-file").value = "";
  });
function download(content, name, type) {
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
  for (const el of document.querySelectorAll("[data-setting]")) {
    if (el.type === "checkbox") el.checked = state.settings[el.dataset.setting];
    else el.value = state.settings[el.dataset.setting];
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
    const settings = {};
    for (const el of document.querySelectorAll("[data-setting]"))
      settings[el.dataset.setting] =
        el.type === "checkbox" ? el.checked : el.value;
    await api({ type: "settings", settings });
    $("#settings").close();
    toast("Options saved.");
  });
$("#shortcuts").onclick = () =>
  run(async () => {
    const tab = await chrome.tabs.getCurrent();
    await chrome.tabs.create({
      windowId: tab.windowId,
      url: "chrome://extensions/shortcuts",
    });
  });
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) &&
    !document.querySelector("dialog[open]")
  ) {
    e.preventDefault();
    $("#search").focus();
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.state?.newValue) {
    state = changes.state.newValue;
    state.settings = { ...defaults, ...state.settings };
    const ids = new Set(state.groups.flatMap((g) => g.tabs.map((t) => t.id)));
    selected = new Set([...selected].filter((id) => ids.has(id)));
    render();
  }
});
matchMedia("(prefers-color-scheme: dark)").addEventListener(
  "change",
  () => state && render(),
);
await refresh();
$("#new-folder").replaceChildren(icon("plus"), node("span", "New folder"));
const { lastError } = await chrome.storage.local.get("lastError");
if (lastError) {
  toast(lastError);
  await chrome.storage.local.remove("lastError");
  await chrome.action.setBadgeText({ text: "" });
}
if (location.hash === "#settings") await settings();
