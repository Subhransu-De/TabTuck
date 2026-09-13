export const defaults = {
  keepRestored: false,
  deduplicate: false,
  showAfterSave: true,
  theme: "light",
};
export const uid = () => crypto.randomUUID();
export function groupBySites(groups) {
  const sites = new Map();
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
          tabs: [],
        });
      const addedAt = tab.addedAt ?? source.createdAt;
      sites.get(site).createdAt = Math.max(sites.get(site).createdAt, addedAt);
      sites
        .get(site)
        .tabs.push({ ...tab, addedAt, sourceLocked: source.locked });
    }
  }
  return [...sites.values()]
    .map((site) => ({
      ...site,
      tabs: site.tabs.sort((a, b) => b.addedAt - a.addedAt),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:", "file:", "ftp:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function group(tabs, name = "") {
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
export function parseImport(text) {
  if (!text.trim())
    throw new Error("Paste an export or choose a backup file first.");
  if (/^[[{]/.test(text.trim())) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("The JSON backup is invalid.");
    }
    const groups = Array.isArray(data) ? data : data.groups;
    if (!Array.isArray(groups))
      throw new Error("This backup does not contain groups.");
    return groups
      .map((g) => {
        if (!Array.isArray(g.tabs))
          throw new Error("A backup group has no tabs.");
        return {
          ...group([], typeof g.name === "string" ? g.name : ""),
          createdAt: Number.isFinite(g.createdAt) ? g.createdAt : Date.now(),
          starred: !!g.starred,
          locked: !!g.locked,
          folder: typeof g.folder === "string" ? g.folder : "",
          folderIcon:
            typeof g.folderIcon === "string" ? g.folderIcon : "folder",
          tabs: g.tabs.map((t) => {
            const url = safeUrl(t.url);
            if (!url)
              throw new Error("The backup contains an unsupported URL.");
            return {
              id: uid(),
              url,
              title: typeof t.title === "string" ? t.title : url,
              addedAt: Number.isFinite(t.addedAt)
                ? t.addedAt
                : Number.isFinite(g.createdAt)
                  ? g.createdAt
                  : Date.now(),
            };
          }),
        };
      })
      .filter((g) => g.tabs.length);
  }
  const groups = [];
  let tabs = [];
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
export function exportText(groups) {
  return groups
    .map((g) =>
      g.tabs
        .map((t) => `${t.url} | ${t.title.replace(/[\r\n]+/g, " ")}`)
        .join("\n"),
    )
    .join("\n\n");
}
