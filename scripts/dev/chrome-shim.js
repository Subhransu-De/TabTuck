// A stand-in for the extension APIs, so the manager runs as a normal web page
// on the dev server. The real background script runs in the same page and
// answers runtime messages. Storage lives in localStorage; one fake window
// holds the manager tab and a few demo tabs to save.
(() => {
  const STORE = "tabtuck-dev-storage";
  // Bump the suffix when the demo tabs change, so open pages pick them up.
  const TABS = "tabtuck-dev-tabs-3";
  const ID = "tabtuck-dev";
  const MANAGER = `chrome-extension://${ID}/manager/manage.html`;
  const WINDOW = 1;

  const event = () => {
    const listeners = new Set();
    return {
      listeners,
      addListener: (fn) => listeners.add(fn),
      removeListener: (fn) => listeners.delete(fn),
      hasListener: (fn) => listeners.has(fn),
    };
  };
  const clone = (value) =>
    value === undefined ? undefined : structuredClone(value);

  /* ---------- storage ---------- */
  const load = () => JSON.parse(localStorage.getItem(STORE) || "{}");
  const save = (data) => localStorage.setItem(STORE, JSON.stringify(data));
  const onChanged = event();
  const emit = (changes) => {
    if (Object.keys(changes).length)
      for (const fn of onChanged.listeners) fn(changes, "local");
  };
  const local = {
    async get(keys) {
      const data = load();
      if (keys === null || keys === undefined) return clone(data);
      if (typeof keys === "string") keys = [keys];
      if (Array.isArray(keys))
        return Object.fromEntries(
          keys.filter((k) => k in data).map((k) => [k, clone(data[k])]),
        );
      return Object.fromEntries(
        Object.entries(keys).map(([k, d]) => [
          k,
          k in data ? clone(data[k]) : d,
        ]),
      );
    },
    async set(items) {
      const data = load();
      const changes = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: data[k], newValue: clone(v) };
        data[k] = clone(v);
      }
      save(data);
      emit(changes);
    },
    async remove(keys) {
      const data = load();
      const changes = {};
      for (const k of typeof keys === "string" ? [keys] : keys)
        if (k in data) {
          changes[k] = { oldValue: data[k] };
          delete data[k];
        }
      save(data);
      emit(changes);
    },
    async clear() {
      const data = load();
      save({});
      emit(
        Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, { oldValue: v }]),
        ),
      );
    },
    async getBytesInUse() {
      return (localStorage.getItem(STORE) || "").length;
    },
  };

  /* ---------- tabs and windows ---------- */
  const DEMO = [
    [
      "https://github.com/oven-sh/bun",
      "oven-sh/bun: Incredibly fast JavaScript runtime",
    ],
    ["https://github.com/microsoft/playwright", "microsoft/playwright"],
    ["https://github.com/facebook/react/issues", "Issues · facebook/react"],
    ["https://github.com/tailwindlabs/tailwindcss", "tailwindlabs/tailwindcss"],
    ["https://react.dev/learn", "Quick Start – React"],
    ["https://react.dev/reference/react/useEffect", "useEffect – React"],
    [
      "https://developer.mozilla.org/en-US/docs/Web/API/EventSource",
      "EventSource - Web APIs | MDN",
    ],
    [
      "https://developer.mozilla.org/en-US/docs/Web/CSS/:has",
      ":has() - CSS | MDN",
    ],
    [
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/structuredClone",
      "structuredClone() | MDN",
    ],
    [
      "https://developer.chrome.com/docs/extensions/reference/api/tabs",
      "chrome.tabs | Chrome for Developers",
    ],
    [
      "https://developer.chrome.com/docs/extensions/reference/api/storage",
      "chrome.storage | Chrome for Developers",
    ],
    [
      "https://stackoverflow.com/questions/11223015",
      "How to persist state in a Chrome extension - Stack Overflow",
    ],
    [
      "https://stackoverflow.com/questions/2219526",
      "How many bytes in a JavaScript string? - Stack Overflow",
    ],
    ["https://news.ycombinator.com/", "Hacker News"],
    [
      "https://news.ycombinator.com/item?id=41000000",
      "Show HN: A private tab manager | Hacker News",
    ],
    [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "Rick Astley - Never Gonna Give You Up",
    ],
    [
      "https://www.youtube.com/watch?v=8aGhZQkoFbQ",
      "What the heck is the event loop anyway? | JSConf EU",
    ],
    [
      "https://www.youtube.com/watch?v=cCOL7MC4Pl0",
      "In The Loop - Jake Archibald",
    ],
    ["https://blog.janestreet.com/", "Jane Street Tech Blog"],
    [
      "https://blog.janestreet.com/what-the-interns-have-wrought-2024/",
      "What the interns have wrought, 2024 edition",
    ],
    // A third entry plays the page's og:site_name, read when the tab is saved.
    ["https://kevintngo.github.io/", "Kevin Ngo", "Kevin Ngo"],
    [
      "https://en.wikipedia.org/wiki/Tab_(interface)",
      "Tab (interface) - Wikipedia",
    ],
    [
      "https://en.wikipedia.org/wiki/Zettelkasten",
      "Zettelkasten - Wikipedia",
      "Wikipedia",
    ],
    [
      "https://www.google.com/search?q=tab+manager",
      "tab manager - Google Search",
    ],
    [
      "https://www.google.com/search?q=onetab+alternative",
      "onetab alternative - Google Search",
    ],
    [
      "https://docs.google.com/document/d/1a2b3c/edit",
      "Weekly notes - Google Docs",
    ],
    ["https://www.reddit.com/r/chrome/", "r/chrome"],
    ["https://www.reddit.com/r/webdev/top/", "Top posts in r/webdev"],
    ["https://bun.com/docs/runtime/http/server", "HTTP server – Bun"],
    ["https://tailwindcss.com/docs/theme", "Theme variables - Tailwind CSS"],
    ["https://claude.ai/new", "Claude"],
    ["https://www.figma.com/files/recents", "Recents – Figma"],
    [
      "https://arxiv.org/abs/1706.03762",
      "[1706.03762] Attention Is All You Need",
    ],
    [
      "https://www.nytimes.com/section/technology",
      "Technology - The New York Times",
    ],
    ["https://open.spotify.com/", "Spotify – Web Player"],
  ];
  const freshTabs = () =>
    [
      { url: MANAGER, title: "TabTuck", active: true },
      ...DEMO.map(([url, title, declared]) => ({
        url,
        title,
        declared,
        active: false,
      })),
    ].map((t, index) => ({
      id: index + 1,
      index,
      windowId: WINDOW,
      pinned: false,
      highlighted: t.active,
      groupId: -1,
      ...t,
    }));
  let tabs = JSON.parse(localStorage.getItem(TABS) || "null") || freshTabs();
  let nextId = Math.max(...tabs.map((t) => t.id)) + 1;
  const keepTabs = () => {
    tabs.forEach((t, i) => (t.index = i));
    localStorage.setItem(TABS, JSON.stringify(tabs));
  };
  const find = (id) => {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) throw new Error(`No tab with id: ${id}.`);
    return tab;
  };
  const windowInfo = { id: WINDOW, focused: true, type: "normal" };

  /* ---------- runtime messages ---------- */
  const onMessage = event();
  let ready;
  const backgroundReady = new Promise((resolve) => (ready = resolve));
  const addMessageListener = onMessage.addListener;
  onMessage.addListener = (fn) => {
    addMessageListener(fn);
    ready();
  };
  async function sendMessage(message) {
    await backgroundReady;
    const sender = { id: ID, tab: clone(tabs.find((t) => t.url === MANAGER)) };
    return new Promise((resolve) => {
      for (const fn of onMessage.listeners) {
        const async = fn(clone(message), sender, (r) => resolve(clone(r)));
        if (async === true) return;
      }
      resolve(undefined);
    });
  }

  const noop = async () => {};
  globalThis.chrome = {
    runtime: {
      id: ID,
      // The manager's own address mimics an extension page so Save this window
      // skips it, as it would in the browser. Other files come from the server.
      getURL: (path) =>
        path.replace(/^\//, "").startsWith("manager/")
          ? `chrome-extension://${ID}/${path.replace(/^\//, "")}`
          : new URL(path, location.origin).href,
      sendMessage,
      onMessage,
      onInstalled: event(),
      lastError: undefined,
    },
    storage: { local, onChanged },
    tabs: {
      async query(q = {}) {
        return clone(
          tabs.filter(
            (t) =>
              (q.windowId === undefined || t.windowId === q.windowId) &&
              (q.active === undefined || t.active === q.active),
          ),
        );
      },
      async get(id) {
        return clone(find(id));
      },
      async getCurrent() {
        return clone(tabs.find((t) => t.url === MANAGER));
      },
      async create({ url = "about:blank", active = true, index }) {
        const tab = {
          id: nextId++,
          windowId: WINDOW,
          url,
          title: url,
          active,
          pinned: false,
          highlighted: active,
          groupId: -1,
        };
        tabs.splice(index ?? tabs.length, 0, tab);
        keepTabs();
        console.info("[dev] opened tab", url);
        return clone(tab);
      },
      async update(id, props) {
        Object.assign(find(id), props);
        keepTabs();
        return clone(find(id));
      },
      async remove(ids) {
        const gone = new Set([ids].flat());
        tabs = tabs.filter((t) => !gone.has(t.id) || t.url === MANAGER);
        keepTabs();
      },
    },
    windows: {
      get: async (id) => {
        if (id !== WINDOW) throw new Error(`No window with id: ${id}.`);
        return { ...windowInfo };
      },
      getLastFocused: async () => ({ ...windowInfo }),
      getCurrent: async () => ({ ...windowInfo }),
      create: async () => ({ ...windowInfo }),
    },
    action: {
      onClicked: event(),
      setBadgeText: noop,
      setBadgeBackgroundColor: noop,
    },
    commands: {
      onCommand: event(),
      getAll: async () => [
        {
          name: "save-current",
          description: "Save the current tab",
          shortcut: "Alt+C",
        },
        {
          name: "show-manager",
          description: "Show TabTuck",
          shortcut: "Alt+Q",
        },
      ],
    },
    // Chrome refuses pages TabTuck was not granted. Here a demo tab with a
    // declared name answers, and every other tab refuses.
    scripting: {
      async executeScript({ target }) {
        const tab = find(target.tabId);
        if (!tab.declared)
          throw new Error("Cannot access contents of the page.");
        return [{ frameId: 0, result: tab.declared }];
      },
    },
    contextMenus: {
      create: () => {},
      removeAll: (done) => done?.(),
      onClicked: event(),
    },
  };

  // Dev helpers in the console: tabtuckDev.reset() and tabtuckDev.refillTabs().
  globalThis.tabtuckDev = {
    reset() {
      localStorage.removeItem(STORE);
      localStorage.removeItem(TABS);
      location.reload();
    },
    refillTabs() {
      localStorage.removeItem(TABS);
      location.reload();
    },
  };

  // Reload when the dev server finishes a rebuild.
  new EventSource("/__dev/events").addEventListener("reload", () =>
    location.reload(),
  );
})();
