// One browser window of open tabs, kept in localStorage: the manager's own
// tab plus pages to save. chrome.tabs, chrome.windows and chrome.scripting.
import { clone } from "./events.ts";

export interface OpenPage {
  url: string;
  title: string;
  // The name the page declares in og:site_name, if any.
  declared?: string;
}
export interface DevTab extends chrome.tabs.Tab {
  id: number;
  declared?: string;
}
export const WINDOW = 1;

export function devTabs(key: string, manager: string, pages: OpenPage[]) {
  const make = (id: number, page: OpenPage, active = false): DevTab => ({
    id,
    index: 0,
    windowId: WINDOW,
    url: page.url,
    title: page.title,
    declared: page.declared,
    active,
    highlighted: active,
    pinned: false,
    incognito: false,
    selected: active,
    discarded: false,
    autoDiscardable: true,
    frozen: false,
    groupId: -1,
    lastAccessed: Date.now(),
    status: "complete",
  });
  const fresh = () => [
    make(1, { url: manager, title: "TabTuck" }, true),
    ...pages.map((page, i) => make(i + 2, page)),
  ];
  let tabs = (JSON.parse(localStorage.getItem(key) ?? "null") ??
    fresh()) as DevTab[];
  let nextId = Math.max(0, ...tabs.map((t) => t.id)) + 1;
  const keep = () => {
    tabs.forEach((t, i) => (t.index = i));
    localStorage.setItem(key, JSON.stringify(tabs));
  };
  keep();
  const find = (id: number) => {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) throw new Error(`No tab with id: ${id}.`);
    return tab;
  };
  const windowInfo = (): chrome.windows.Window => ({
    id: WINDOW,
    focused: true,
    alwaysOnTop: false,
    incognito: false,
    state: "normal",
    type: "normal",
  });

  const api = {
    async query(q: chrome.tabs.QueryInfo = {}) {
      return clone(
        tabs.filter(
          (t) =>
            (q.windowId === undefined || t.windowId === q.windowId) &&
            (q.active === undefined || t.active === q.active),
        ),
      );
    },
    async get(id: number) {
      return clone(find(id));
    },
    async getCurrent() {
      return clone(tabs.find((t) => t.url === manager));
    },
    async create({
      url = "about:blank",
      active = true,
      index,
    }: chrome.tabs.CreateProperties) {
      const tab = make(nextId++, { url, title: url }, active);
      tabs.splice(index ?? tabs.length, 0, tab);
      keep();
      console.info("[dev] opened tab", url);
      return clone(tab);
    },
    async update(id: number, props: chrome.tabs.UpdateProperties) {
      Object.assign(find(id), props);
      keep();
      return clone(find(id));
    },
    async remove(ids: number | number[]) {
      const gone = new Set([ids].flat());
      // The manager tab is the page itself; it never closes.
      tabs = tabs.filter((t) => !gone.has(t.id) || t.url === manager);
      keep();
    },
  };
  const windows = {
    get: async (id: number) => {
      if (id !== WINDOW) throw new Error(`No window with id: ${id}.`);
      return windowInfo();
    },
    getLastFocused: async () => windowInfo(),
    getCurrent: async () => windowInfo(),
    create: async () => windowInfo(),
  };
  // The browser lets TabTuck read only pages it was granted. Here a page that
  // declares a name answers and every other page refuses.
  const scripting = {
    async executeScript({ target }: { target: { tabId: number } }) {
      const tab = find(target.tabId);
      if (!tab.declared) throw new Error("Cannot access contents of the page.");
      return [{ frameId: 0, documentId: "", result: tab.declared }];
    },
  };
  return {
    tabs: api,
    windows,
    scripting,
    managerTab: () => clone(tabs.find((t) => t.url === manager)),
    reset() {
      tabs = fresh();
      nextId = tabs.length + 1;
      keep();
    },
  };
}
