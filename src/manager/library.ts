// DOM-free views of the library used by the three manager columns.
import type { SavedTab, TabGroup } from "../shared/types.ts";

export interface Entry {
  tab: SavedTab;
  group: TabGroup;
  addedAt: number;
  host: string;
  search: string;
}
export interface SiteCount {
  host: string;
  label: string;
  count: number;
}
export type Bucket = "all" | "today" | "yesterday" | "week" | "earlier";

const DAY = 86_400_000;

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
export function siteLabel(host: string) {
  return host || "Local files";
}
// "mail.google.com" -> "mail.google", "imdb.com" -> "imdb".
function shortName(host: string) {
  if (!host) return "local files";
  const parts = host.split(".");
  return parts.length > 1 ? parts.slice(0, -1).join(".") : host;
}

const entryCache = new WeakMap<TabGroup, Entry[]>();
function groupEntries(group: TabGroup) {
  let list = entryCache.get(group);
  if (!list) {
    list = group.tabs.map((tab) => ({
      tab,
      group,
      addedAt: tab.addedAt ?? group.createdAt,
      host: hostOf(tab.url),
      search:
        `${tab.title} ${tab.url} ${group.name} ${group.folder}`.toLowerCase(),
    }));
    entryCache.set(group, list);
  }
  return list;
}
export function entries(groups: TabGroup[]): Entry[] {
  if (groups.length === 1) return groupEntries(groups[0]);
  let list = listCache.get(groups);
  if (!list) {
    list = groups.flatMap(groupEntries);
    listCache.set(groups, list);
  }
  return list;
}
const listCache = new WeakMap<TabGroup[], Entry[]>();
// Saving stamps each tab a few milliseconds apart. Tabs stamped within this
// window of their collection's creation count as one save.
const SAME_SAVE = 5_000;
// Last in, first out: the newest save is on top. Tabs saved together keep
// their tab-strip order, so a saved window still reads left to right; tabs
// moved in later sort by their own save time.
export function newestFirst(list: Entry[]): Entry[] {
  const saved = (e: Entry) =>
    Math.abs(e.addedAt - e.group.createdAt) < SAME_SAVE
      ? e.group.createdAt
      : e.addedAt;
  return list
    .map((entry, index) => ({ entry, index, at: saved(entry) }))
    .sort(
      (a, b) =>
        b.at - a.at ||
        b.entry.group.createdAt - a.entry.group.createdAt ||
        a.index - b.index,
    )
    .map(({ entry }) => entry);
}

// Copied links paste as a Markdown bullet list: "- [Title](url)" per line.
export function bulletList(tabs: SavedTab[]) {
  return tabs
    .map((t) => {
      const title = t.title
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[[\]]/g, "\\$&");
      const url = t.url.replace(/\(/g, "%28").replace(/\)/g, "%29");
      return `- [${title || url}](${url})`;
    })
    .join("\n");
}

const siteCache = new WeakMap<Entry[], SiteCount[]>();
export function sites(list: Entry[]): SiteCount[] {
  const cached = siteCache.get(list);
  if (cached) return cached;
  const counts = new Map<string, number>();
  for (const { host } of list) {
    counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  const result = [...counts]
    .map(([host, count]) => ({ host, label: siteLabel(host), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  siteCache.set(list, result);
  return result;
}
export function groupSites(group: TabGroup) {
  return sites(groupEntries(group));
}

export function collectionLabel(group: TabGroup) {
  if (group.name) return group.name;
  const top = groupSites(group);
  if (!top.length) return "Empty collection";
  let names = top.slice(0, 2).map((s) => shortName(s.host));
  // "example.com" and "example.org" would both read "example".
  if (names.length > 1 && names[0] === names[1])
    names = top.slice(0, 2).map((s) => siteLabel(s.host));
  const rest = top.length - names.length;
  return names.join(", ") + (rest > 0 ? ` +${rest}` : "");
}

function startOfDay(now: number) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
export function bucketOf(
  time: number,
  now = Date.now(),
): Exclude<Bucket, "all"> {
  const today = startOfDay(now);
  if (time >= today) return "today";
  if (time >= today - DAY) return "yesterday";
  if (time >= today - 6 * DAY) return "week";
  return "earlier";
}
export const bucketNames: Record<Bucket, string> = {
  all: "Everything",
  today: "Today",
  yesterday: "Yesterday",
  week: "Earlier this week",
  earlier: "Older",
};

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const clock = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const dayAndClock = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const fullDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
const shortDate = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
export function ago(time: number, now = Date.now()) {
  const seconds = Math.round((time - now) / 1000);
  if (seconds > -60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes > -60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (days > -7) return relative.format(days, "day");
  return dayAndClock.format(time);
}
// Compact age for dense rows: "now", "4m", "3h", "2d", or a date.
export function shortAgo(time: number, now = Date.now()) {
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 10_080) return `${Math.floor(minutes / 1440)}d`;
  return shortDate.format(time);
}
export function savedAt(time: number, now = Date.now()) {
  return bucketOf(time, now) === "today"
    ? `today ${clock.format(time)}`
    : bucketOf(time, now) === "yesterday"
      ? `yesterday ${clock.format(time)}`
      : dayAndClock.format(time);
}
export function longDate(time: number) {
  return fullDate.format(time);
}
export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}
