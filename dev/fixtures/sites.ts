// Made-up sites under the reserved .example and .test names, so dev data
// never names a real site. Each kind of site exercises one way TabTuck names
// a site: a declared name, its own spelling in titles, or its host's first
// label.
import { capital, type Random } from "./random.ts";
import type { OpenPage } from "../extension-api/tabs.ts";

const PARTS = [
  "note",
  "hub",
  "cloud",
  "pixel",
  "forge",
  "shelf",
  "spark",
  "atlas",
  "river",
  "mint",
  "orbit",
  "quill",
  "lumen",
  "harbor",
  "tide",
  "ember",
  "maple",
  "cobalt",
  "signal",
  "paper",
  "bloom",
  "vector",
  "summit",
  "fern",
];
const VERBS = [
  "Build",
  "Debug",
  "Plan",
  "Measure",
  "Design",
  "Ship",
  "Refactor",
  "Profile",
  "Sketch",
  "Review",
  "Migrate",
  "Organize",
];
const THINGS = [
  "a reading list",
  "offline sync",
  "the release checklist",
  "dark mode",
  "keyboard shortcuts",
  "a weekly review",
  "search ranking",
  "the onboarding flow",
  "tab groups",
  "a small CLI",
  "the pricing page",
  "error budgets",
  "a recipe archive",
  "trip notes",
  "the design tokens",
  "focus timers",
];
const PEOPLE = ["ana", "bo", "chidi", "dana", "eli", "farah", "goran", "hana"];

export interface Site {
  // Draws one page of the site.
  page(r: Random): OpenPage;
}
const topic = (r: Random) => `${r.pick(VERBS)} ${r.pick(THINGS)}`;
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-");

// A site whose titles carry its own spelling: "Plan trip notes - NoteForge".
function branded(r: Random): Site {
  const [a, b] = [r.pick(PARTS), r.pick(PARTS)];
  const name = capital(a) + capital(b);
  const host = `${a}${b}.${r.pick(["example", "test"])}`;
  const style = r.int(0, 2);
  return {
    page(r) {
      const t = topic(r);
      const url = `https://${r.chance(0.3) ? "www." : ""}${host}/${slug(t)}`;
      const title =
        style === 0
          ? `${t} - ${name}`
          : style === 1
            ? `${name} | ${t}`
            : `${t} · ${name}`;
      return { url, title };
    },
  };
}
// Titles never name the site, as on many signed-in apps: named by its host.
function unbranded(r: Random): Site {
  const host = `${r.pick(PARTS)}${r.pick(["ly", "io", "app", "base"])}.example`;
  return {
    page: (r) => ({
      url: `https://${host}/${slug(topic(r))}`,
      title: topic(r),
    }),
  };
}
// The page declares its name, which no title or host could give.
function declaring(r: Random): Site {
  const host = `${r.pick(PARTS)}.${r.pick(PARTS)}.test`;
  const declared = `${capital(r.pick(PARTS))} ${r.pick(["Journal", "Studio", "Library", "Notes"])}`;
  return {
    page: (r) => ({
      url: `https://${host}/${slug(topic(r))}`,
      title: topic(r),
      declared,
    }),
  };
}
// People's pages on a shared host, titled with the host's brand. Each is
// named for its person, never for the host: "dana.pages.test" is "Dana".
function sharedHost(r: Random): Site {
  const person = r.pick(PEOPLE);
  return {
    page: (r) => ({
      url: `https://${person}.pages.test/${slug(topic(r))}`,
      title: `${topic(r)} · Pages`,
    }),
  };
}
// A subdomain with its own product name: "docs.atlas.example" as "Atlas Docs".
function productSubdomain(r: Random): Site {
  const brand = r.pick(PARTS);
  const product = r.pick(["docs", "mail", "maps", "status"]);
  return {
    page: (r) => ({
      url: `https://${product}.${brand}.example/${slug(topic(r))}`,
      title: `${topic(r)} - ${capital(brand)} ${capital(product)}`,
    }),
  };
}
// A forum whose titles end in a name its host does not spell, so it keeps
// its first label.
function forum(r: Random): Site {
  const host = `news.${r.pick(PARTS)}.test`;
  const name = `${capital(r.pick(PARTS))} Talk`;
  return {
    page: (r) => ({
      url: `https://${host}/item?id=${r.int(1000, 99999)}`,
      title: `${r.pick(["Ask", "Show", "Tell"])}: ${topic(r)} | ${name}`,
    }),
  };
}
// Local pages: a dev server, a router, local and network files.
function local(): Site {
  return {
    page(r) {
      const kind = r.int(0, 3);
      if (kind === 0)
        return {
          url: `http://localhost:${r.pick([3000, 5173, 8080])}/`,
          title: "Dev preview",
        };
      if (kind === 1)
        return { url: "http://192.168.1.1/status", title: "Router status" };
      if (kind === 2)
        return {
          url: `file:///C:/notes/${slug(topic(r))}.md`,
          title: `${slug(topic(r))}.md`,
        };
      return {
        url: `file://nas/share/${slug(topic(r))}.pdf`,
        title: `${topic(r)}.pdf`,
      };
    },
  };
}

// A mix of sites, weighted towards the common kinds.
export function siteMix(r: Random, count: number): Site[] {
  const kinds = [
    branded,
    branded,
    branded,
    branded,
    unbranded,
    unbranded,
    declaring,
    sharedHost,
    productSubdomain,
    forum,
    local,
  ];
  return Array.from({ length: count }, () =>
    r.pick<(r: Random) => Site>(kinds)(r),
  );
}
