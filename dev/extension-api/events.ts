// A chrome.events.Event stand-in: listeners in a set, fired by the caller.
export class DevEvent<F extends (...args: never[]) => unknown> {
  readonly listeners = new Set<F>();
  addListener = (fn: F) => {
    this.listeners.add(fn);
  };
  removeListener = (fn: F) => {
    this.listeners.delete(fn);
  };
  hasListener = (fn: F) => this.listeners.has(fn);
  hasListeners = () => this.listeners.size > 0;
}
export const clone = <T>(value: T): T =>
  value === undefined ? value : structuredClone(value);
