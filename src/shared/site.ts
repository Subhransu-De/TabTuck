// What a site is and what it is called, from nothing but saved addresses,
// titles and the names pages declare. No site is named in this file.

// One key per site:
// - web pages: the host, plus a port when it has one;
// - local files: "";
// - network files: "file://server";
// - FTP: "ftp://host";
// - any other scheme: "scheme:";
// - an address that does not parse: "?".
export function siteOf(url: string) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "?";
  }
  if (u.protocol === "file:") return u.hostname ? `file://${u.hostname}` : "";
  if (u.protocol === "ftp:") return `ftp://${u.host}`;
  if (u.protocol !== "http:" && u.protocol !== "https:") return u.protocol;
  // DNS treats "example.com." as "example.com"; "www." is the same site.
  let host = u.hostname.replace(/\.$/, "");
  if (/^www\.[^.]+\./.test(host)) host = host.slice(4);
  return u.port ? `${host}:${u.port}` : host;
}
// A site key as an address the user can read.
export function siteAddress(key: string) {
  if (key === "") return "Local files";
  if (key === "?") return "Invalid address";
  if (key.startsWith("file://")) return `${key.slice(7)} (network files)`;
  if (key.endsWith(":") && !key.includes("/")) return `Unsupported (${key})`;
  return key;
}
// The labels of a host that can carry a name, decoded from punycode. Null for
// everything else: files, FTP, IP addresses and hosts with a port.
function labelsOf(key: string) {
  if (!key || key.includes(":") || key.includes("/") || key === "?")
    return null;
  const labels = key.split(".");
  if (/^\d+$/.test(labels.at(-1)!) || key.startsWith("[")) return null;
  return labels.map(decodeLabel);
}

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
// " - ", " | ", " · ", " : " and the like; "_" between non-Latin words.
const SEPARATOR =
  /\s+[\p{Pd}|·•:/~»›]+\s+|\s*[|｜]\s*|(?<=\P{ASCII})_|_(?=\P{ASCII})/u;
const segmentsOf = (title: string) =>
  title
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .split(SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);
const trimmed = (s: string) =>
  s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

// What a title may spell to name the host. The brand is the label before the
// last, or the one before that under a short country code ("bbc.co.uk").
// "run" keys may match anywhere; "whole" keys, deeper labels, only as a
// whole segment. A brand with labels to its left is a parent domain: its bare
// name names the parent, so "GitHub" never names kevintngo.github.io.
function keysOf(labels: string[]) {
  const n = labels.length;
  const brands = n === 1 ? [0] : [n - 2];
  if (n > 2 && labels[n - 1].length === 2 && labels[n - 2].length <= 3)
    brands.push(n - 3);
  const run = new Set<string>();
  const whole = new Set<string>();
  const parent = new Set<string>();
  for (const i of brands) {
    run.add(fold(labels[i]));
    if (i > 0) run.add(fold(labels[i] + labels[i - 1]));
    if (n > 1) run.add(fold(labels.slice(i).join("")));
    if (i > 0) {
      parent.add(fold(labels[i]));
      parent.add(fold(labels.slice(i).join("")));
    }
  }
  for (const label of labels.slice(0, Math.min(...brands)))
    whole.add(fold(label));
  for (const key of parent) run.delete(key);
  run.delete("");
  whole.delete("");
  return { run, whole, parent };
}
const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
// Short enough to be a name, and not an address or a path.
const nameShaped = (s: string) =>
  s.length <= 32 &&
  s.split(/\s+/).length <= 4 &&
  /\p{L}/u.test(s) &&
  !/[./\\@:]/.test(s);

interface Hit {
  titles: number;
  strong: boolean;
  spellings: Map<string, [count: number, whole: number]>;
}
// The name the titles give a host, or null. A spelling of the host's own
// letters wins unless a repeated title ending has more support.
function nameFromTitles(labels: string[], titles: string[]) {
  const { run, whole, parent } = keysOf(labels);
  const hits = new Map<string, Hit>();
  const ends = new Map<string, [count: number, split: number]>();
  for (const title of titles) {
    const segments = segmentsOf(title);
    const seen = new Set<string>();
    for (const segment of segments) {
      const words = segment.split(/\s+/).map((w) => [w, fold(w)] as const);
      for (let i = 0; i < words.length; i++) {
        let key = "";
        for (let j = i; j < Math.min(words.length, i + 4); j++) {
          key += words[j][1];
          const full = i === 0 && j === words.length - 1;
          if (!key || !(run.has(key) || (full && whole.has(key)))) continue;
          const spelling = trimmed(
            words
              .slice(i, j + 1)
              .map((w) => w[0])
              .join(" "),
          );
          let hit = hits.get(key);
          if (!hit) {
            hit = { titles: 0, strong: run.has(key), spellings: new Map() };
            hits.set(key, hit);
          }
          if (!seen.has(key)) {
            seen.add(key);
            hit.titles++;
          }
          const tally = hit.spellings.get(spelling) ?? [0, 0];
          tally[0]++;
          if (full) tally[1]++;
          hit.spellings.set(spelling, tally);
        }
      }
    }
    const outer =
      segments.length > 1 ? [segments[0], segments.at(-1)!] : segments;
    for (const end of new Set(outer)) {
      const tally = ends.get(end) ?? [0, 0];
      tally[0]++;
      if (segments.length > 1) tally[1]++;
      ends.set(end, tally);
    }
  }
  const best = [...hits].sort(
    (a, b) =>
      +b[1].strong - +a[1].strong ||
      b[0].length - a[0].length ||
      b[1].titles - a[1].titles ||
      byCode(a[0], b[0]),
  )[0];
  const spelled = best && {
    name: [...best[1].spellings].sort(
      (a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1] || byCode(a[0], b[0]),
    )[0][0],
    support: best[1].titles,
  };
  // A title ending on 3 or more distinct titles, more than half of them,
  // with no rival as common.
  const ranked = [...ends]
    .filter(([s]) => nameShaped(s) && !parent.has(fold(s)))
    .sort((a, b) => b[1][0] - a[1][0]);
  const top = ranked[0]?.[1];
  const repeated =
    top &&
    top[0] >= 3 &&
    top[1] >= 2 &&
    top[0] * 2 > titles.length &&
    (ranked.length < 2 || ranked[1][1][0] < top[0])
      ? { name: ranked[0][0], support: top[0] }
      : null;
  if (repeated && (!spelled || repeated.support > spelled.support))
    return repeated.name;
  return spelled?.name ?? null;
}
// The host's first label, capitalised: "github.com" -> "Github",
// "example.github.io" -> "Example". A one- or two-letter first label, as in
// "en.wikipedia.org" or "m.example.com", is skipped.
function firstLabel(labels: string[]) {
  const label =
    labels.length > 2 && labels[0].length <= 2 ? labels[1] : labels[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// A name a page declares for its site, as read when it was saved: trimmed,
// one line, at most 40 characters, with at least one letter or digit.
export function declaredName(value: unknown) {
  if (typeof value !== "string") return undefined;
  const name = value.replace(/\s+/g, " ").trim();
  return name && name.length <= 40 && /[\p{L}\p{N}]/u.test(name)
    ? name
    : undefined;
}

export interface SiteTab {
  url: string;
  title: string;
  siteName?: string;
}
// A name per site key, in this order: the name its pages declare, a name its
// titles give it, its host's first label. IP addresses, hosts with a port,
// files and other schemes show their address.
export function nameSites(tabs: Iterable<SiteTab & { key: string }>) {
  const sites = new Map<
    string,
    { titles: Set<string>; declared: Map<string, number> }
  >();
  for (const { key, url, title, siteName } of tabs) {
    let site = sites.get(key);
    if (!site) {
      site = { titles: new Set(), declared: new Map() };
      sites.set(key, site);
    }
    const clean = title.trim();
    if (clean && clean !== url && clean !== key) site.titles.add(clean);
    if (siteName)
      site.declared.set(siteName, (site.declared.get(siteName) ?? 0) + 1);
  }
  const names = new Map<string, string>();
  for (const [key, { titles, declared }] of sites) {
    const labels = labelsOf(key);
    if (!labels) {
      names.set(key, siteAddress(key));
      continue;
    }
    const stated = [...declared].sort(
      (a, b) => b[1] - a[1] || byCode(a[0], b[0]),
    )[0]?.[0];
    names.set(
      key,
      stated ?? nameFromTitles(labels, [...titles]) ?? firstLabel(labels),
    );
  }
  return names;
}

// RFC 3492 decoding of one "xn--" label: arithmetic only, no tables.
export function decodeLabel(label: string) {
  if (!label.startsWith("xn--")) return label;
  const s = label.slice(4);
  const out: number[] = [];
  const b = s.lastIndexOf("-");
  for (let p = 0; p < b; p++) out.push(s.charCodeAt(p));
  let n = 128;
  let i = 0;
  let bias = 72;
  for (let p = b < 0 ? 0 : b + 1; p < s.length;) {
    const old = i;
    for (let w = 1, k = 36; ; k += 36) {
      if (p >= s.length) return label;
      const c = s.charCodeAt(p++);
      const d = c >= 48 && c < 58 ? c - 22 : c >= 97 && c < 123 ? c - 97 : 36;
      if (d >= 36) return label;
      i += d * w;
      const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
      if (d < t) break;
      w *= 36 - t;
    }
    const len = out.length + 1;
    let delta = Math.floor((i - old) / (old === 0 ? 700 : 2));
    delta += Math.floor(delta / len);
    let k = 0;
    for (; delta > 455; k += 36) delta = Math.floor(delta / 35);
    bias = k + Math.floor((36 * delta) / (delta + 38));
    n += Math.floor(i / len);
    i %= len;
    if (n > 0x10ffff) return label;
    out.splice(i++, 0, n);
  }
  return String.fromCodePoint(...out);
}
