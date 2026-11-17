// Runs first in the manager page the dev server serves, as a classic script:
// picks the scenario from the address, seeds its library the first time,
// moves the clock if asked, and installs the extension APIs. Each scenario
// and seed keeps its own saved data, so edits survive reloads.
import { installExtensionApi } from "./extension-api/index.ts";
import {
  buildScenario,
  DEFAULT_SCENARIO,
  scenarios,
} from "./fixtures/scenarios.ts";
import { DAY } from "./fixtures/random.ts";
import { showPanel } from "./panel.ts";

const params = new URLSearchParams(location.search);
const LAST = "tabtuck-dev:last";
const CLOCK = "tabtuck-dev:clock";
const last = JSON.parse(localStorage.getItem(LAST) ?? "{}") as {
  scenario?: string;
  seed?: number;
};
const name =
  [params.get("scenario"), last.scenario].find(
    (s): s is string => !!s && s in scenarios,
  ) ?? DEFAULT_SCENARIO;
const seed = Number(params.get("seed") ?? last.seed ?? 1) || 1;
localStorage.setItem(LAST, JSON.stringify({ scenario: name, seed }));
if (params.get("scenario") !== name || params.get("seed") !== String(seed)) {
  params.set("scenario", name);
  params.set("seed", String(seed));
  history.replaceState(null, "", `?${params}${location.hash}`);
}

// The clock, moved by whole days to see buckets change and the bin expire.
const offset = Number(localStorage.getItem(CLOCK) ?? 0) || 0;
if (offset) {
  const RealDate = Date;
  class DevDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length) super(...(args as [number]));
      else super(RealDate.now() + offset);
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = DevDate as DateConstructor;
}

const prefix = `tabtuck-dev:${name}:${seed}`;
const storageKey = `${prefix}:storage`;
const tabsKey = `${prefix}:tabs`;
const built = buildScenario(name, seed, Date.now());
if (localStorage.getItem(storageKey) === null)
  localStorage.setItem(
    storageKey,
    JSON.stringify(built.state ? { state: built.state } : {}),
  );
const api = installExtensionApi({ storageKey, tabsKey, pages: built.pages });

const go = (next: { scenario?: string; seed?: number }) => {
  const query = new URLSearchParams({
    scenario: next.scenario ?? name,
    seed: String(next.seed ?? seed),
  });
  location.search = `?${query}`;
};
export const dev = {
  scenario: name,
  seed,
  clockDays: Math.round(offset / DAY),
  scenarios: Object.fromEntries(
    Object.entries(scenarios).map(([key, s]) => [key, s.description]),
  ),
  open: go,
  // Back to the scenario as built: its library and its open tabs.
  reset() {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(tabsKey);
    location.reload();
  },
  reopenTabs() {
    api.resetTabs();
    location.reload();
  },
  moveClock(days: number | null) {
    if (days === null) localStorage.removeItem(CLOCK);
    else localStorage.setItem(CLOCK, String(offset + days * DAY));
    location.reload();
  },
};
Object.assign(globalThis, { tabtuckDev: dev });
document.addEventListener("DOMContentLoaded", () => showPanel(dev));

// Reload after a rebuild; swap the stylesheet alone when only CSS changed.
const events = new EventSource("/__dev/events");
events.addEventListener("reload", () => location.reload());
events.addEventListener("css", () => {
  for (const link of document.querySelectorAll<HTMLLinkElement>(
    'link[rel="stylesheet"]',
  )) {
    const url = new URL(link.href);
    url.searchParams.set("v", String(Date.now()));
    link.href = url.href;
  }
});
