// Page state lives outside React in small stores, so a change re-renders only
// the components that read it: a row reads its own selection, the list reads
// the library.
import { useSyncExternalStore } from "react";
import type { Entry } from "./library.ts";
import type { Library, Views } from "./view.ts";

export interface Store<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
}
export function store<T>(value: T): Store<T> {
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
export function useStore<T>(source: Store<T>): T {
  return useSyncExternalStore(source.subscribe, source.get);
}

// A set of tab ids whose members re-render only when their own id changes.
export class IdSet {
  private ids = new Set<string>();
  private listeners = new Set<() => void>();
  version = 0;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  has(id: string) {
    return this.ids.has(id);
  }
  get size() {
    return this.ids.size;
  }
  values() {
    return this.ids.values();
  }
  update(change: (ids: Set<string>) => void) {
    change(this.ids);
    this.version++;
    for (const listener of this.listeners) listener();
  }
  getVersion = () => this.version;
}
export function useHas(set: IdSet, id: string) {
  return useSyncExternalStore(set.subscribe, () => set.has(id));
}
export function useVersion(set: IdSet) {
  return useSyncExternalStore(set.subscribe, set.getVersion);
}

export const library = store<Library | null>(null);

export interface Ui {
  scope: string;
  facet: string;
  showAllSites: boolean;
  collapsed: ReadonlySet<string>;
  // The folder whose rows unfold as they appear, and the one folding away.
  unfolding?: string;
  folding?: string;
}
export const ui = store<Ui>({
  scope: "recent",
  facet: "all",
  showAllSites: false,
  collapsed: new Set(),
});
export function setUi(patch: Partial<Ui>) {
  ui.set({ ...ui.get(), ...patch });
}

// The search box's text, as typed.
export const search = store("");
export const normalized = (text: string) => text.toLowerCase().trim();

export const selection = new IdSet();
// Shift-click extends from the last row the user picked to this one.
export const anchor: { id?: string } = {};
// Tabs whose restore is in flight, and those already gone from the list.
export const restoring = new IdSet();
export const hidden = store<ReadonlySet<string>>(new Set());

// The time rows count from, moved on each minute and with each new view. The
// epoch moves only when the date changes or a binned tab expires, the two
// times the lists themselves regroup.
export const clock = store({ now: Date.now(), epoch: Date.now() });
export function tick() {
  clock.set({ ...clock.get(), now: Date.now() });
}

export interface Toast {
  id: number;
  message: string;
  undo: boolean;
}
export const toastState = store<Toast | null>(null);
let toasts = 0;
export function toast(message: string, undo = false) {
  toastState.set({ id: ++toasts, message, undo });
}

// The system theme, followed until a theme is saved.
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
export const systemDark = store(darkQuery.matches);
darkQuery.addEventListener("change", () => systemDark.set(darkQuery.matches));

// What the page shows now. Actions read it the way the old page read the DOM.
export const screen: {
  views: Views | null;
  visible: Entry[];
} = { views: null, visible: [] };
