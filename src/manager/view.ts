// DOM-free views of the library for the three columns. A scope is the first
// column: "recent", "all", "starred", "bin", "site:<host>", "folder:<name>"
// or "group:<id>". A facet is the second column: a site ("site:<host>"), a
// time bucket, or "all".
import type { State, TabGroup } from "../shared/types.ts";
import { defaults, HOUR } from "../shared/model.ts";
import {
  type Bucket,
  type Entry,
  bucketNames,
  bucketOf,
  collectionLabel,
  entries,
  groupSites,
  newestFirst,
  retimed,
  siteLabel,
  siteNames,
  sites,
} from "./library.ts";

export interface Library {
  state: State;
  // Newest collection first.
  ordered: TabGroup[];
  index: Map<string, TabGroup>;
}

function sameGroup(a: TabGroup, b: TabGroup) {
  return (
    a === b ||
    (a.id === b.id &&
      a.name === b.name &&
      a.createdAt === b.createdAt &&
      a.starred === b.starred &&
      a.locked === b.locked &&
      a.folder === b.folder &&
      a.folderIcon === b.folderIcon &&
      a.collapsed === b.collapsed &&
      a.site === b.site &&
      a.tabs.length === b.tabs.length &&
      a.tabs.every((tab, i) => {
        const next = b.tabs[i];
        return (
          tab.id === next.id &&
          tab.url === next.url &&
          tab.title === next.title &&
          tab.addedAt === next.addedAt &&
          tab.sourceLocked === next.sourceLocked
        );
      }))
  );
}
// Unchanged collections keep their objects, so their cached entries and
// rows carry over to the next library.
export function nextLibrary(next: State, previous?: Library | null): Library {
  const groups = next.groups.map((g) => {
    const before = previous?.index.get(g.id);
    return before && sameGroup(before, g) ? before : g;
  });
  return {
    state: { ...next, groups, settings: { ...defaults, ...next.settings } },
    ordered: [...groups].sort((a, b) => b.createdAt - a.createdAt),
    index: new Map(groups.map((g) => [g.id, g])),
  };
}

// Recent, bin and site scopes list tabs newest first and split them by time.
function byTime(scope: string) {
  return scope === "recent" || scope === "bin" || scope.startsWith("site:");
}
function facetOf(entry: Entry, scope: string, now = Date.now()) {
  return byTime(scope) ? bucketOf(entry.addedAt, now) : `site:${entry.host}`;
}
// The scope to show after the library changed: one that no longer exists
// falls back the way the old page did.
export function validScope(lib: Library, scope: string) {
  if (scope.startsWith("group:") && !lib.index.has(scope.slice(6)))
    return "recent";
  if (
    scope.startsWith("folder:") &&
    !lib.state.groups.some((g) => g.folder === scope.slice(7))
  )
    return "all";
  if (
    scope.startsWith("site:") &&
    !entries(lib.ordered).some((e) => e.host === scope.slice(5))
  )
    return "recent";
  return scope;
}

const recentLists = new WeakMap<Library, Entry[]>();
const binGroupLists = new WeakMap<Library, TabGroup[]>();

// Views of one library while some tabs are hidden because they are being
// restored. Each list is computed once, on first use.
export class Views {
  private liveLists = new WeakMap<TabGroup[], Entry[]>();
  private groupLists = new Map<string, TabGroup[]>();
  private binList?: Entry[];
  constructor(
    readonly lib: Library,
    readonly hidden: ReadonlySet<string>,
    readonly now: number,
  ) {}
  get settings() {
    return this.lib.state.settings;
  }
  live(groups: TabGroup[]): Entry[] {
    let list = this.liveLists.get(groups);
    if (!list) {
      list = entries(groups);
      if (this.hidden.size)
        list = list.filter(({ tab }) => !this.hidden.has(tab.id));
      this.liveLists.set(groups, list);
    }
    return list;
  }
  scopeGroups(key: string): TabGroup[] {
    let groups = this.groupLists.get(key);
    if (!groups) {
      const { ordered } = this.lib;
      groups =
        key === "starred"
          ? ordered.filter((g) => g.starred)
          : key.startsWith("folder:")
            ? ordered.filter((g) => g.folder === key.slice(7))
            : key.startsWith("group:")
              ? ordered.filter((g) => g.id === key.slice(6))
              : ordered;
      this.groupLists.set(key, groups);
    }
    return groups;
  }
  // Every saved tab that is not being restored.
  get all() {
    return this.live(this.lib.ordered);
  }
  recent(): Entry[] {
    let list = recentLists.get(this.lib);
    if (!list) {
      list = newestFirst(entries(this.lib.ordered));
      recentLists.set(this.lib, list);
    }
    return list;
  }
  binGroups(): TabGroup[] {
    let groups = binGroupLists.get(this.lib);
    if (!groups) {
      groups = (this.lib.state.trash ?? []).flatMap((entry) => entry.groups);
      binGroupLists.set(this.lib, groups);
    }
    return groups;
  }
  // Tabs in the bin, last deleted first. Their time is when they were deleted.
  bin(): Entry[] {
    if (!this.binList) {
      const keep = this.settings.binHours * HOUR;
      this.binList = (this.lib.state.trash ?? [])
        .filter((entry) => this.now - entry.at < keep)
        .flatMap((entry) =>
          entries(entry.groups).map((e) => retimed(e, entry.at)),
        );
    }
    return this.binList;
  }
  // Named from the whole library so a site reads the same in every view.
  siteName(host: string) {
    return siteNames(this.all).get(host) ?? siteLabel(host);
  }
  // Tabs in scope that match the search, before the second-column facet.
  scoped(scope: string, query: string): Entry[] {
    const list =
      scope === "recent"
        ? this.recent()
        : scope === "bin"
          ? this.bin()
          : scope.startsWith("site:")
            ? this.recent().filter((e) => e.host === scope.slice(5))
            : this.live(this.scopeGroups(scope));
    return query || (byTime(scope) && this.hidden.size)
      ? list.filter(
          (e) =>
            !this.hidden.has(e.tab.id) && (!query || e.search.includes(query)),
        )
      : list;
  }
}

// What the search matches, for dimming rows in the first column.
export interface Hits {
  hosts: Set<string>;
  groups: Set<string>;
}
export function hits(views: Views, query: string): Hits | null {
  if (!query) return null;
  const found: Hits = { hosts: new Set(), groups: new Set() };
  for (const e of views.all)
    if (e.search.includes(query)) {
      found.hosts.add(e.host);
      found.groups.add(e.group.id);
    }
  return found;
}

export interface FolderView {
  name: string;
  icon: string;
  count: number;
  members: TabGroup[];
}
export function folders(views: Views): FolderView[] {
  const groups = views.scopeGroups("all");
  const names = [...new Set(groups.map((g) => g.folder).filter(Boolean))];
  return names.sort().map((name) => {
    const members = groups.filter((g) => g.folder === name);
    return {
      name,
      icon: members.find((g) => g.folderIcon)?.folderIcon || "folder",
      count: views.live(members).length,
      members,
    };
  });
}
export interface SiteView {
  host: string;
  label: string;
  count: number;
  // A page of the site, for its favicon.
  url: string;
}
export function siteViews(list: Entry[]): SiteView[] {
  const samples = new Map<string, string>();
  for (const entry of list)
    if (!samples.has(entry.host)) samples.set(entry.host, entry.tab.url);
  return sites(list).map((s) => ({ ...s, url: samples.get(s.host)! }));
}
// One icon per collection: a page of its most saved site.
export function leadUrl(group: TabGroup) {
  const top = groupSites(group)[0];
  return top && entries([group]).find((e) => e.host === top.host)?.tab.url;
}

const SITE_LIMIT = 14;
export interface FacetRow {
  key: string;
  label: string;
  count: number;
  // "layers" and "recent" are icons; a site row carries a page URL, or ""
  // when there is none to show.
  lead: "layers" | "recent" | { url: string };
}
export interface Facets {
  rows: FacetRow[];
  // Sites with one tab fold away behind a toggle in long site lists.
  more?: { open: boolean; count: number };
}
export function facets(
  views: Views,
  scope: string,
  scoped: Entry[],
  facet: string,
  showAllSites: boolean,
): Facets | null {
  if (!views.lib.state.groups.length) return null;
  if (byTime(scope)) {
    const rows: FacetRow[] = [
      {
        key: "all",
        label: bucketNames.all,
        count: scoped.length,
        lead: "layers",
      },
    ];
    const counts = new Map<string, number>();
    for (const entry of scoped) {
      const key = facetOf(entry, scope, views.now);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const b of ["today", "yesterday", "week", "earlier"] as Bucket[]) {
      const count = counts.get(b) ?? 0;
      if (count || facet === b)
        rows.push({ key: b, label: bucketNames[b], count, lead: "recent" });
    }
    return { rows };
  }
  const rows: FacetRow[] = [
    { key: "all", label: "All sites", count: scoped.length, lead: "layers" },
  ];
  const counts = siteViews(scoped);
  const current = facet.startsWith("site:") ? facet.slice(5) : null;
  if (current !== null && !counts.some((s) => s.host === current))
    counts.push({
      host: current,
      label: views.siteName(current),
      count: 0,
      url: "",
    });
  const singles = new Set(
    counts.filter((s) => s.count <= 1 && s.host !== current),
  );
  const foldable = counts.length > SITE_LIMIT && singles.size > 1;
  const shown =
    foldable && !showAllSites ? counts.filter((s) => !singles.has(s)) : counts;
  for (const s of shown)
    rows.push({
      key: `site:${s.host}`,
      label: s.label,
      count: s.count,
      lead: { url: s.url },
    });
  return {
    rows,
    more: foldable ? { open: showAllSites, count: singles.size } : undefined,
  };
}
export function visibleOf(
  scoped: Entry[],
  scope: string,
  facet: string,
  now = Date.now(),
) {
  return facet === "all"
    ? scoped
    : scoped.filter((e) => facetOf(e, scope, now) === facet);
}

// The third column's title.
export function listHeading(views: Views, scope: string, facet: string) {
  if (scope === "recent")
    return facet === "all" ? "Newest first" : bucketNames[facet as Bucket];
  if (scope === "bin")
    return facet === "all"
      ? "Last deleted first"
      : bucketNames[facet as Bucket];
  if (scope.startsWith("site:"))
    return facet === "all"
      ? views.siteName(scope.slice(5))
      : bucketNames[facet as Bucket];
  if (facet.startsWith("site:")) return views.siteName(facet.slice(5));
  const group = scope.startsWith("group:")
    ? views.lib.index.get(scope.slice(6))
    : undefined;
  if (group) return collectionLabel(group);
  if (scope === "starred") return "Starred";
  return scope.startsWith("folder:") ? scope.slice(7) : "All tabs";
}
