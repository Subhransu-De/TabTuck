// chrome.storage.local, kept in the page's localStorage under one key.
import { DevEvent, clone } from "./events.ts";

type Data = Record<string, unknown>;
type Changes = Record<string, chrome.storage.StorageChange>;
type Keys = string | string[] | Data | null | undefined;

export function devStorage(key: string) {
  const load = (): Data =>
    JSON.parse(localStorage.getItem(key) ?? "{}") as Data;
  const save = (data: Data) => localStorage.setItem(key, JSON.stringify(data));
  const onChanged = new DevEvent<
    (changes: Changes, area: chrome.storage.AreaName) => void
  >();
  const emit = (changes: Changes) => {
    if (!Object.keys(changes).length) return;
    for (const fn of onChanged.listeners) fn(clone(changes), "local");
  };
  const local = {
    async get(keys?: Keys) {
      const data = load();
      if (keys === null || keys === undefined) return clone(data);
      if (typeof keys === "string") keys = [keys];
      if (Array.isArray(keys))
        return Object.fromEntries(
          keys.filter((k) => k in data).map((k) => [k, clone(data[k])]),
        );
      return Object.fromEntries(
        Object.entries(keys).map(([k, fallback]) => [
          k,
          k in data ? clone(data[k]) : fallback,
        ]),
      );
    },
    async set(items: Data) {
      const data = load();
      const changes: Changes = {};
      for (const [k, value] of Object.entries(items)) {
        changes[k] = { oldValue: data[k], newValue: clone(value) };
        data[k] = clone(value);
      }
      save(data);
      emit(changes);
    },
    async remove(keys: string | string[]) {
      const data = load();
      const changes: Changes = {};
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
          Object.entries(data).map(([k, oldValue]) => [k, { oldValue }]),
        ),
      );
    },
    async getBytesInUse() {
      return (localStorage.getItem(key) ?? "").length;
    },
  };
  return { local, onChanged };
}
