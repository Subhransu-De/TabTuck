// DOM-free views of the library used by the three manager columns.
import type { SavedTab, TabGroup } from "../shared/types.ts";

export interface Entry {
  readonly tab: SavedTab;
  readonly group: TabGroup;
  readonly addedAt: number;
  readonly host: string;
  // Lowercase title, address, collection name and folder.
  readonly search: string;
}
export interface SiteCount {
  host: string;
  label: string;
  count: number;
}
export type Bucket = "all" | "today" | "yesterday" | "week" | "earlier";

// One copy of each host name, however many tabs share it.
const hosts = new Map<string, string>();
export function hostOf(url: string) {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
  const shared = hosts.get(host);
  if (shared !== undefined) return shared;
  hosts.set(host, host);
  return host;
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

// Each tab's search text, built the first time a search reads it and dropped
// when the search is cleared, so a page that is not searching never holds it.
let searchText = new WeakMap<Entry, string>();
export function forgetSearchText() {
  searchText = new WeakMap();
}
class SavedEntry implements Entry {
  readonly tab: SavedTab;
  readonly group: TabGroup;
  readonly addedAt: number;
  readonly host: string;
  constructor(tab: SavedTab, group: TabGroup, addedAt: number, host: string) {
    this.tab = tab;
    this.group = group;
    this.addedAt = addedAt;
    this.host = host;
  }
  get search() {
    let text = searchText.get(this);
    if (text === undefined) {
      const { tab, group } = this;
      text =
        `${tab.title} ${tab.url} ${group.name} ${group.folder}`.toLowerCase();
      searchText.set(this, text);
    }
    return text;
  }
}
// The same tab counted from another time, such as when it was deleted.
export function retimed(entry: Entry, addedAt: number): Entry {
  return new SavedEntry(entry.tab, entry.group, addedAt, entry.host);
}
const entryCache = new WeakMap<TabGroup, Entry[]>();
function groupEntries(group: TabGroup) {
  let list = entryCache.get(group);
  if (!list) {
    list = group.tabs.map(
      (tab) =>
        new SavedEntry(
          tab,
          group,
          tab.addedAt ?? group.createdAt,
          hostOf(tab.url),
        ),
    );
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

// The registrable part of a host: "doc.rust-lang.org" -> "rust-lang",
// "news.bbc.co.uk" -> "bbc".
export function brandOf(host: string) {
  const parts = host.split(".");
  if (parts.length < 2) return host;
  const tail =
    parts.length > 2 && parts.at(-1)!.length === 2 && parts.at(-2)!.length <= 3;
  return parts.at(tail ? -3 : -2)!;
}
const compact = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const SEPARATOR = /\s+[-|·•—–:]\s+/;
// Pages usually carry the site's own spelling of its name at either end of
// their title: "Biutiful (2010) - IMDb", "GitHub - rust-lang/rust".
function nameInTitle(title: string, brand: string) {
  const parts = title.split(SEPARATOR);
  const ends = parts.length > 1 ? [parts[0], parts.at(-1)!] : [title];
  for (const end of ends) {
    const words = end.trim().split(/\s+/);
    for (let i = 0; i < words.length; i++)
      for (let j = i + 1; j <= Math.min(words.length, i + 3); j++) {
        const name = words
          .slice(i, j)
          .join(" ")
          .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
        if (compact(name) === brand) return name;
      }
  }
  return null;
}
// A readable name per host, taken from its saved tab titles, else from the
// domain. Hosts that would share a name keep their domain instead.
const nameCache = new WeakMap<Entry[], Map<string, string>>();
export function siteNames(list: Entry[]): Map<string, string> {
  let names = nameCache.get(list);
  if (names) return names;
  const votes = new Map<string, Map<string, number>>();
  for (const { host, tab } of list) {
    const tally = votes.get(host) ?? new Map<string, number>();
    votes.set(host, tally);
    const brand = compact(brandOf(host));
    const name = brand ? nameInTitle(tab.title, brand) : null;
    if (name) tally.set(name, (tally.get(name) ?? 0) + 1);
  }
  names = new Map();
  for (const [host, tally] of votes) {
    const best = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0];
    const brand = brandOf(host);
    names.set(
      host,
      host
        ? (best ?? brand.charAt(0).toUpperCase() + brand.slice(1))
        : siteLabel(host),
    );
  }
  const seen = new Map<string, number>();
  for (const name of names.values()) seen.set(name, (seen.get(name) ?? 0) + 1);
  for (const [host, name] of names)
    if (seen.get(name)! > 1) names.set(host, siteLabel(host));
  nameCache.set(list, names);
  return names;
}

const siteCache = new WeakMap<Entry[], SiteCount[]>();
export function sites(list: Entry[]): SiteCount[] {
  const cached = siteCache.get(list);
  if (cached) return cached;
  const counts = new Map<string, number>();
  for (const { host } of list) {
    counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  const names = siteNames(list);
  const result = [...counts]
    .map(([host, count]) => ({ host, label: names.get(host)!, count }))
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

// Calendar days, not 24-hour blocks, so daylight-saving changes do not move
// tabs saved near midnight into the wrong group.
function startOfDay(now: number, daysAgo = 0) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.getTime();
}
export function bucketOf(
  time: number,
  now = Date.now(),
): Exclude<Bucket, "all"> {
  if (time >= startOfDay(now)) return "today";
  if (time >= startOfDay(now, 1)) return "yesterday";
  if (time >= startOfDay(now, 6)) return "week";
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
// Time a binned tab has left, as compact as shortAgo: "29d", "5h", "12m".
export function shortLeft(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes}m left`;
  if (minutes < 2880) return `${Math.floor(minutes / 60)}h left`;
  return `${Math.floor(minutes / 1440)}d left`;
}
// A bin time in the unit the user is likely to have picked it in.
export function duration(hours: number) {
  return hours % 24 ? plural(hours, "hour") : plural(hours / 24, "day");
}
export function longDate(time: number) {
  return fullDate.format(time);
}
export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}
