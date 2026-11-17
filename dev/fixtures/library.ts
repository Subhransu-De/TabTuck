// Builds a saved library: collections spread over the last two months, some
// named, foldered, starred or locked, and deletes waiting in the bin.
import type {
  BinEntry,
  SavedTab,
  State,
  TabGroup,
} from "../../src/shared/types.ts";
import { defaults } from "../../src/shared/model.ts";
import { folderIcons } from "../../src/shared/folder-icons.ts";
import { DAY, HOUR, MINUTE, type Random } from "./random.ts";
import type { OpenPage } from "../extension-api/tabs.ts";
import { siteMix, type Site } from "./sites.ts";

const NAMES = [
  "Reading list",
  "Trip planning",
  "Release prep",
  "Research",
  "Recipes",
  "Gift ideas",
  "Job search",
  "Side project",
  "Taxes",
  "Conference talks",
];
// Each folder keeps one icon, as when the user picks it.
const FOLDERS: Record<string, keyof typeof folderIcons> = {
  Work: "work",
  Home: "home",
  Learning: "book",
  Someday: "idea",
};

export const savedTab = (
  r: Random,
  page: OpenPage,
  addedAt: number,
): SavedTab => ({
  id: r.id("tab"),
  url: page.url,
  title: page.title,
  ...(page.declared ? { siteName: page.declared } : {}),
  addedAt,
});
export function collection(
  r: Random,
  pages: OpenPage[],
  createdAt: number,
  extra: Partial<TabGroup> = {},
): TabGroup {
  return {
    id: r.id("group"),
    name: "",
    createdAt,
    starred: false,
    locked: false,
    folder: "",
    // Tabs saved together are stamped a few milliseconds apart.
    tabs: pages.map((page, i) => savedTab(r, page, createdAt + i * 3)),
    ...extra,
  };
}
// Mostly recent: a few saves today and yesterday, more over the past weeks.
function savedAt(r: Random, now: number) {
  const roll = r.next();
  const ago =
    roll < 0.15
      ? r.int(1, 10 * 60) * MINUTE
      : roll < 0.3
        ? DAY + r.int(0, 23) * HOUR
        : roll < 0.55
          ? r.int(2, 6) * DAY
          : r.int(7, 60) * DAY;
  return now - ago - r.int(0, 59) * MINUTE;
}
export const pagesFrom = (r: Random, sites: Site[], count: number) =>
  Array.from({ length: count }, () => r.pick(sites).page(r));

export function library(
  r: Random,
  now: number,
  size: {
    collections: number;
    tabs: [number, number];
    sites: number;
    bin: number;
  },
): State {
  const sites = siteMix(r, size.sites);
  const groups = Array.from({ length: size.collections }, () => {
    // A collection mostly holds pages from a few sites.
    const own = Array.from({ length: r.int(1, 4) }, () => r.pick(sites));
    const g = collection(
      r,
      pagesFrom(r, own, r.int(...size.tabs)),
      savedAt(r, now),
    );
    if (r.chance(0.25)) g.name = r.pick(NAMES);
    if (r.chance(0.2)) {
      g.folder = r.pick(Object.keys(FOLDERS));
      g.folderIcon = FOLDERS[g.folder];
    }
    g.starred = r.chance(0.1);
    g.locked = r.chance(0.05);
    return g;
  });
  const trash: BinEntry[] = Array.from({ length: size.bin }, () => {
    const at = now - r.int(1, 20 * 24) * HOUR;
    return {
      at,
      groups: [
        collection(
          r,
          pagesFrom(r, sites, r.int(1, 4)),
          at - r.int(1, 30) * DAY,
        ),
      ],
    };
  }).sort((a, b) => b.at - a.at);
  return {
    version: 1,
    groups,
    settings: { ...defaults, dataNotice: true },
    trash,
  };
}
