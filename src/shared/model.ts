import type { SavedTab, TabGroup, Settings } from "./types.ts";
export const defaults: Settings = {
  keepRestored: false,
  deduplicate: false,
  showAfterSave: true,
  theme: "light",
};
export const uid = () => crypto.randomUUID();
export function groupBySites(groups: TabGroup[]): TabGroup[] {
  const sites = new Map<string, TabGroup>();
  for (const source of [...groups].sort((a, b) => b.createdAt - a.createdAt)) {
    for (const tab of source.tabs) {
      const url = new URL(tab.url);
      const site = url.hostname.replace(/^www\./, "") || "Local files";
      if (!sites.has(site))
        sites.set(site, {
          id: `site:${site}`,
          name: site,
          createdAt: source.createdAt,
          site: true,
          starred: false,
          locked: false,
          folder: "",
          tabs: [],
        });
      const addedAt = tab.addedAt ?? source.createdAt;
      sites.get(site)!.createdAt = Math.max(
        sites.get(site)!.createdAt,
        addedAt,
      );
      sites
        .get(site)!
        .tabs.push({ ...tab, addedAt, sourceLocked: source.locked });
    }
  }
  return [...sites.values()]
    .map((site) => ({
      ...site,
      tabs: site.tabs.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0)),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}
export function safeUrl(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    return ["http:", "https:", "file:", "ftp:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function group(tabs: SavedTab[], name = ""): TabGroup {
  return {
    id: uid(),
    name,
    createdAt: Date.now(),
    starred: false,
    locked: false,
    folder: "",
    tabs,
  };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
export function parseImport(text: string): TabGroup[] {
  if (!text.trim())
    throw new Error("Paste an export or choose a backup file first.");
  if (/^[[{]/.test(text.trim())) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("The JSON backup is invalid.");
    }
    const groups = Array.isArray(data)
      ? data
      : isRecord(data)
        ? data.groups
        : undefined;
    if (!Array.isArray(groups))
      throw new Error("This backup does not contain groups.");
    return groups
      .map((g: unknown) => {
        if (!isRecord(g) || !Array.isArray(g.tabs))
          throw new Error("A backup group has no tabs.");
        return {
          ...group([], typeof g.name === "string" ? g.name : ""),
          createdAt: isTimestamp(g.createdAt) ? g.createdAt : Date.now(),
          starred: !!g.starred,
          locked: !!g.locked,
          folder: typeof g.folder === "string" ? g.folder : "",
          folderIcon:
            typeof g.folderIcon === "string" ? g.folderIcon : "folder",
          tabs: g.tabs.map((t: unknown) => {
            if (!isRecord(t))
              throw new Error("The backup contains an invalid tab.");
            const url = safeUrl(typeof t.url === "string" ? t.url : undefined);
            if (!url)
              throw new Error("The backup contains an unsupported URL.");
            return {
              id: uid(),
              url,
              title: typeof t.title === "string" ? t.title : url,
              addedAt: isTimestamp(t.addedAt)
                ? t.addedAt
                : isTimestamp(g.createdAt)
                  ? g.createdAt
                  : Date.now(),
            };
          }),
        };
      })
      .filter((g) => g.tabs.length);
  }
  const groups: TabGroup[] = [];
  let tabs: SavedTab[] = [];
  const flush = () => {
    if (tabs.length) groups.push(group(tabs));
    tabs = [];
  };
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (!line.trim()) {
      flush();
      continue;
    }
    const split = line.indexOf(" | ");
    const raw = (split < 0 ? line : line.slice(0, split)).trim();
    const url = safeUrl(raw);
    if (!url) throw new Error("Invalid URL in import: " + raw.slice(0, 80));
    tabs.push({
      id: uid(),
      url,
      title: split < 0 ? url : line.slice(split + 3).trim() || url,
      addedAt: Date.now(),
    });
  }
  flush();
  return groups;
}
export function exportText(groups: TabGroup[]) {
  return groups
    .map((g) =>
      g.tabs
        .map((t) => `${t.url} | ${t.title.replace(/[\r\n]+/g, " ")}`)
        .join("\n"),
    )
    .join("\n\n");
}
