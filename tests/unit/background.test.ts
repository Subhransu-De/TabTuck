import type { State, CaptureMode } from "../../src/shared/types.ts";
import { test, expect, beforeEach } from "bun:test";
import { defaults, group, uid } from "../../src/shared/model.ts";
type TestTab = Partial<chrome.tabs.Tab> & { id: number };
let stored: State;
let tabs: TestTab[];
let created: chrome.tabs.CreateProperties[];
let removed: number[];
let failWrite: boolean;
let failUrl: string;
const event = { addListener() {} };
let toolbarClick: (tab: TestTab) => Promise<unknown>;
let installed: () => void;
const menuItems: chrome.contextMenus.CreateProperties[] = [];
const chromeMock = {
  runtime: {
    id: "test",
    getURL: (path: string) => "chrome-extension://test/" + path,
    onMessage: event,
    onInstalled: {
      addListener(fn: typeof installed) {
        installed = fn;
      },
    },
  },
  storage: {
    local: {
      get: async () => ({ state: structuredClone(stored) }),
      set: async ({ state }: { state: State }) => {
        if (failWrite) throw new Error("Disk full");
        stored = structuredClone(state);
      },
    },
  },
  tabs: {
    query: async ({ windowId }: chrome.tabs.QueryInfo) =>
      tabs.filter((t) => t.windowId === windowId),
    get: async (id: number) => tabs.find((t) => t.id === id)!,
    create: async (args: chrome.tabs.CreateProperties) => {
      if (args.url === failUrl) throw new Error("Cannot open");
      created.push(args);
      const tab = { ...args, id: 100 + created.length };
      tabs.push(tab);
      return tab;
    },
    update: async (id: number, update: chrome.tabs.UpdateProperties) =>
      Object.assign(
        tabs.find((t) => t.id === id)!,
        update,
      ),
    remove: async (id: number) => {
      removed.push(id);
      tabs = tabs.filter((t) => t.id !== id);
    },
  },
  windows: {
    get: async (id: number) => {
      if (id !== 7 && id !== 8) throw new Error("Window closed");
      return { id };
    },
    getLastFocused: async () => ({ id: 8 }),
  },
  action: {
    onClicked: {
      addListener(fn: typeof toolbarClick) {
        toolbarClick = fn;
      },
    },
  },
  commands: { onCommand: event },
  contextMenus: {
    onClicked: event,
    removeAll(callback: () => void) {
      menuItems.length = 0;
      callback();
    },
    create(item: chrome.contextMenus.CreateProperties) {
      menuItems.push(item);
    },
  },
};
// This mock implements only the Chrome API surface exercised by these tests.
globalThis.chrome = chromeMock as unknown as typeof chrome;
const { capture, restore, dispatch, serial } =
  await import("../../src/background/background.ts");
beforeEach(() => {
  stored = { version: 1, groups: [], settings: { ...defaults }, trash: [] };
  tabs = [
    {
      id: 1,
      windowId: 7,
      index: 0,
      active: true,
      url: "https://example.com/",
      title: "A",
    },
    {
      id: 2,
      windowId: 7,
      index: 1,
      url: "https://example.org/",
      title: "B",
      pinned: true,
    },
    {
      id: 3,
      windowId: 8,
      index: 0,
      url: "https://example.net/",
      title: "Other window",
    },
  ];
  created = [];
  removed = [];
  failWrite = false;
  failUrl = "";
});
test("manual link order supports up, down, self-drop and cross-group insertion", async () => {
  stored.groups = [
    group(
      [1, 2, 3].map((id) => ({
        id: String(id),
        title: String(id),
        url: `https://example.com/${id}`,
      })),
    ),
    group([{ id: "4", title: "4", url: "https://example.com/4" }]),
  ];
  const [source, target] = stored.groups;
  const order = () => stored.groups[0].tabs.map((t) => t.id);
  await dispatch({ type: "reorder", groupId: source.id, tabId: "1" });
  expect(order()).toEqual(["2", "3", "1"]);
  await dispatch({
    type: "reorder",
    groupId: source.id,
    tabId: "1",
    beforeId: "2",
  });
  expect(order()).toEqual(["1", "2", "3"]);
  await dispatch({
    type: "reorder",
    groupId: source.id,
    tabId: "2",
    beforeId: "2",
  });
  expect(order()).toEqual(["1", "2", "3"]);
  await dispatch({
    type: "move",
    ids: ["2"],
    targetId: target.id,
    beforeId: "4",
  });
  expect(order()).toEqual(["1", "3"]);
  expect(stored.groups[1].tabs.map((t) => t.id)).toEqual(["2", "4"]);
});
test("storage failure never closes original tabs", async () => {
  failWrite = true;
  await expect(capture("all", 7)).rejects.toThrow("Disk full");
  expect(removed).toEqual([]);
});
test("capture excludes pinned and other windows; creates manager in originating window", async () => {
  await capture("all", 7);
  expect(removed).toEqual([1]);
  expect(stored.groups[0].tabs[0].title).toBe("A");
  expect(created[0].windowId).toBe(7);
});
test("explicit current capture skips pinned tabs", async () => {
  await capture("current", 7, 2);
  expect(removed).toEqual([]);
});
test("last-tab capture keeps originating window alive even with show disabled", async () => {
  tabs = [tabs[0]];
  stored.settings.showAfterSave = false;
  await capture("current", 7);
  expect(created[0].windowId).toBe(7);
  expect(removed).toEqual([1]);
});
test("restoration uses invoking window, retains failures and removes only successes", async () => {
  stored.groups = [
    group([
      { id: uid(), url: "https://example.com/", title: "A" },
      { id: uid(), url: "https://example.org/", title: "B" },
    ]),
  ];
  failUrl = "https://example.org/";
  const result = await restore({}, 7);
  expect(result.count).toBe(1);
  expect(result.failed).toEqual(["B"]);
  expect(created.every((t) => t.windowId === 7)).toBe(true);
  expect(stored.groups[0].tabs.map((t) => t.title)).toEqual(["B"]);
});
test("locked groups retain restored tabs and resist deletion", async () => {
  stored.groups = [
    group([{ id: uid(), url: "https://example.com/", title: "A" }]),
  ];
  stored.groups[0].locked = true;
  await restore({}, 7);
  await dispatch({ type: "delete" });
  expect(stored.groups[0].tabs.length).toBe(1);
});
test("closed destination never falls back to another window", async () => {
  await expect(restore({}, 99)).rejects.toThrow("Window closed");
  expect(created).toEqual([]);
});
test("delete is recoverable across background restarts", async () => {
  stored.groups = [
    group([{ id: uid(), url: "https://example.com/", title: "A" }]),
  ];
  await dispatch({ type: "delete" });
  expect(stored.groups.length).toBe(0);
  await dispatch({ type: "undo" });
  expect(stored.groups[0].tabs[0].title).toBe("A");
});
test("concurrent imports are serialized without losing groups", async () => {
  await Promise.all([
    serial(() => dispatch({ type: "import", text: "https://example.com/" })),
    serial(() => dispatch({ type: "import", text: "https://example.org/" })),
  ]);
  expect(stored.groups.length).toBe(2);
});

test("all capture modes protect pinned and grouped tabs regardless of old preferences", async () => {
  Object.assign(stored.settings, { includePinned: true });
  tabs[0].groupId = 42;
  for (const mode of [
    "all",
    "current",
    "selected",
    "other",
    "left",
    "right",
  ] satisfies CaptureMode[]) {
    await capture(mode, 7, 1);
    await capture(mode, 7, 2);
  }
  expect(removed).toEqual([]);
  expect(stored.groups).toEqual([]);
});

test("toolbar opens the manager in the same window without saving or closing tabs", async () => {
  const initialTabs = structuredClone(tabs);
  await toolbarClick(tabs[0]);
  expect(removed).toEqual([]);
  expect(stored.groups).toEqual([]);
  expect(tabs.filter((t) => t.id < 100)).toEqual(initialTabs);
  expect(created).toEqual([
    {
      windowId: 7,
      url: "chrome-extension://test/manager/manage.html",
      active: true,
    },
  ]);
  await toolbarClick(tabs[0]);
  expect(created.length).toBe(1);
});
test("context menu has exactly the requested actions in order after install or reload", () => {
  installed();
  expect(menuItems.map(({ id, title }) => [id, title])).toEqual([
    ["show", "Show list"],
    ["left", "Save all left"],
    ["current", "Save current"],
    ["right", "Save all right"],
  ]);
  installed();
  expect(menuItems.length).toBe(4);
});
test("left and right capture respect position, pinned tabs, and browser groups", async () => {
  tabs = [
    { id: 1, windowId: 7, index: 0, url: "https://example.com/left" },
    {
      id: 2,
      windowId: 7,
      index: 1,
      url: "https://example.com/pinned",
      pinned: true,
    },
    {
      id: 3,
      windowId: 7,
      index: 2,
      url: "https://example.com/current",
      active: true,
    },
    {
      id: 4,
      windowId: 7,
      index: 3,
      url: "https://example.com/grouped",
      groupId: 9,
    },
    { id: 5, windowId: 7, index: 4, url: "https://example.com/right" },
  ];
  await capture("left", 7, 3);
  expect(removed).toEqual([1]);
  await capture("right", 7, 3);
  expect(removed).toEqual([1, 5]);
  expect(tabs.some((t) => t.id === 3)).toBe(true);
});
