import { test, expect } from "bun:test";
import {
  Views,
  facets,
  hits,
  listHeading,
  nextLibrary,
  validScope,
  visibleOf,
} from "../../src/manager/view.ts";
import { defaults, HOUR } from "../../src/shared/model.ts";
import type { State, TabGroup } from "../../src/shared/types.ts";

const now = Date.now();
let n = 0;
const group = (
  tabs: [string, string][],
  extra: Partial<TabGroup> = {},
): TabGroup => ({
  id: `g${++n}`,
  name: "",
  createdAt: now - n * HOUR,
  starred: false,
  locked: false,
  folder: "",
  tabs: tabs.map(([title, url]) => ({
    id: `t${++n}`,
    title,
    url,
    addedAt: now - n * HOUR,
  })),
  ...extra,
});
const state = (groups: TabGroup[], trash: State["trash"] = []): State => ({
  version: 1,
  revision: "r",
  groups,
  settings: { ...defaults, dataNotice: true },
  trash,
});

test("a new library keeps unchanged collections and orders newest first", () => {
  const a = group([["A", "https://a.example/"]]);
  const b = group([["B", "https://b.example/"]]);
  const first = nextLibrary(state([a, b]));
  expect(first.ordered.map((g) => g.id)).toEqual([a.id, b.id]);
  const copy = structuredClone(state([a, b]));
  copy.groups[1].starred = true;
  const second = nextLibrary(copy, first);
  expect(second.index.get(a.id)).toBe(first.index.get(a.id));
  expect(second.index.get(b.id)).not.toBe(first.index.get(b.id));
  expect(second.state.settings.binHours).toBe(defaults.binHours);
});

test("a scope that disappears falls back like the old page", () => {
  const lib = nextLibrary(
    state([group([["A", "https://a.example/"]], { folder: "Work" })]),
  );
  expect(validScope(lib, "group:gone")).toBe("recent");
  expect(validScope(lib, "folder:Play")).toBe("all");
  expect(validScope(lib, "folder:Work")).toBe("folder:Work");
  expect(validScope(lib, "site:b.example")).toBe("recent");
  expect(validScope(lib, "site:a.example")).toBe("site:a.example");
});

test("search, hidden restores and facets narrow the list", () => {
  const g = group([
    ["Alpha notes", "https://a.example/1"],
    ["Beta notes", "https://b.example/2"],
    ["Alpha again", "https://a.example/3"],
  ]);
  const lib = nextLibrary(state([g]));
  const all = new Views(lib, new Set(), now);
  expect(all.scoped("all", "alpha").map((e) => e.tab.title)).toEqual([
    "Alpha notes",
    "Alpha again",
  ]);
  const found = hits(all, "beta")!;
  expect([...found.hosts]).toEqual(["b.example"]);
  expect(hits(all, "")).toBeNull();
  // A tab being restored leaves time-ordered lists at once.
  const restoring = new Views(lib, new Set([g.tabs[0].id]), now);
  expect(restoring.scoped("recent", "")).toHaveLength(2);
  expect(restoring.all).toHaveLength(2);
  // Sites facet: one row per site, and the current one even when empty.
  const list = all.scoped("all", "");
  const data = facets(all, "all", list, "site:c.example", false)!;
  expect(data.rows.map((r) => [r.key, r.count])).toEqual([
    ["all", 3],
    ["site:a.example", 2],
    ["site:b.example", 1],
    ["site:c.example", 0],
  ]);
  expect(visibleOf(list, "all", "site:a.example").map((e) => e.tab.id)).toEqual(
    [g.tabs[0].id, g.tabs[2].id],
  );
  expect(listHeading(all, "all", "all")).toBe("All tabs");
  expect(listHeading(all, "all", "site:a.example")).toBe(
    all.siteName("a.example"),
  );
  expect(listHeading(all, "recent", "all")).toBe("Newest first");
  expect(listHeading(all, "bin", "all")).toBe("Last deleted first");
});

test("the bin lists deletes by their time and drops expired ones", () => {
  const kept = group([["Kept", "https://k.example/"]]);
  const old = group([["Old", "https://o.example/"]]);
  const lib = nextLibrary(
    state(
      [],
      [
        { at: now - HOUR, groups: [kept] },
        { at: now - 31 * 24 * HOUR, groups: [old] },
      ],
    ),
  );
  const bin = new Views(lib, new Set(), now).bin();
  expect(bin.map((e) => [e.tab.title, e.addedAt])).toEqual([
    ["Kept", now - HOUR],
  ]);
  // Without collections there are no facets to show, even in the bin.
  expect(facets(new Views(lib, new Set(), now), "bin", bin, "all", false)).toBe(
    null,
  );
});

test("long site lists fold sites with one tab", () => {
  const tabs: [string, string][] = [];
  for (let i = 0; i < 16; i++) tabs.push([`P${i}`, `https://s${i}.example/`]);
  tabs.push(["Again", "https://s0.example/again"]);
  const lib = nextLibrary(state([group(tabs)]));
  const views = new Views(lib, new Set(), now);
  const list = views.scoped("all", "");
  const folded = facets(views, "all", list, "all", false)!;
  expect(folded.more).toEqual({ open: false, count: 15 });
  expect(folded.rows).toHaveLength(2);
  expect(facets(views, "all", list, "all", true)!.rows).toHaveLength(17);
});
