// The extension APIs TabTuck uses, for its pages served as plain web pages by
// the dev server. Any browser can open them: this code runs inside the page,
// before TabTuck's own scripts, and the real background script runs in the
// same page and answers its messages.
import { DevEvent, clone } from "./events.ts";
import { devStorage } from "./storage.ts";
import { devTabs, type OpenPage } from "./tabs.ts";

export const EXTENSION_ID = "tabtuck-dev";
// The manager keeps an extension address, so "Save this window" skips its
// own tab as it does in the browser.
export const MANAGER_URL = `chrome-extension://${EXTENSION_ID}/manager/manage.html`;

type Listener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  reply: (response: unknown) => void,
) => boolean | void;

export function installExtensionApi(options: {
  storageKey: string;
  tabsKey: string;
  pages: OpenPage[];
}) {
  const storage = devStorage(options.storageKey);
  const window = devTabs(options.tabsKey, MANAGER_URL, options.pages);

  // Messages wait for the background script to start listening, since both
  // load as modules in the same page.
  const onMessage = new DevEvent<Listener>();
  let ready = () => {};
  const listening = new Promise<void>((resolve) => (ready = resolve));
  const addListener = onMessage.addListener;
  onMessage.addListener = (fn) => {
    addListener(fn);
    ready();
  };
  async function sendMessage(message: unknown) {
    await listening;
    const sender: chrome.runtime.MessageSender = {
      id: EXTENSION_ID,
      tab: window.managerTab(),
    };
    return new Promise((resolve) => {
      for (const fn of onMessage.listeners)
        if (fn(clone(message), sender, (r) => resolve(clone(r))) === true)
          return;
      resolve(undefined);
    });
  }

  const noop = async () => {};
  const api = {
    runtime: {
      id: EXTENSION_ID,
      getURL: (path: string) => {
        const file = path.replace(/^\/+/, "");
        return file === "manager/manage.html"
          ? MANAGER_URL
          : `${location.origin}/${file}`;
      },
      sendMessage,
      onMessage,
      onInstalled: new DevEvent<() => void>(),
      lastError: undefined,
    },
    storage,
    tabs: window.tabs,
    windows: window.windows,
    scripting: window.scripting,
    action: {
      onClicked: new DevEvent<(tab: chrome.tabs.Tab) => void>(),
      setBadgeText: noop,
      setBadgeBackgroundColor: noop,
    },
    commands: {
      onCommand: new DevEvent<
        (command: string, tab?: chrome.tabs.Tab) => void
      >(),
      getAll: async (): Promise<chrome.commands.Command[]> => [
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
    contextMenus: {
      create: () => {},
      removeAll: (done?: () => void) => done?.(),
      onClicked: new DevEvent<() => void>(),
    },
  };
  // Only the members TabTuck calls exist; the rest of the API is absent.
  globalThis.chrome = api as unknown as typeof chrome;
  return { resetTabs: window.reset };
}
