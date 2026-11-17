// Named data sets for the dev server: a saved library and a window of open
// tabs to save. Open one with ?scenario=<name>&seed=<number>.
import type { State } from "../../src/shared/types.ts";
import { defaults } from "../../src/shared/model.ts";
import type { OpenPage } from "../extension-api/tabs.ts";
import { collection, library, pagesFrom } from "./library.ts";
import { DAY, HOUR, MINUTE, random, type Random } from "./random.ts";
import { siteMix } from "./sites.ts";

export interface Scenario {
  description: string;
  build(r: Random, now: number): { state?: State; pages: OpenPage[] };
}
const openPages = (r: Random, count = 20) =>
  pagesFrom(r, siteMix(r, 12), count);
const only = (groups: State["groups"], trash: State["trash"] = []): State => ({
  version: 1,
  groups,
  settings: { ...defaults, dataNotice: true },
  trash,
});
const page = (line: string, declared?: string): OpenPage => {
  const at = line.indexOf(" | ");
  return {
    url: line.slice(0, at),
    title: line.slice(at + 3),
    ...(declared ? { declared } : {}),
  };
};

export const scenarios: Record<string, Scenario> = {
  typical: {
    description: "About 300 tabs over two months, with folders and a bin",
    build: (r, now) => ({
      state: library(r, now, {
        collections: 40,
        tabs: [1, 12],
        sites: 30,
        bin: 4,
      }),
      pages: openPages(r),
    }),
  },
  "first-run": {
    description: "Nothing saved yet; the data notice shows first",
    build: (r) => ({ pages: openPages(r) }),
  },
  heavy: {
    description: "About 5,000 tabs, past the 1,000-tab fast-save path",
    build: (r, now) => ({
      state: library(r, now, {
        collections: 400,
        tabs: [5, 20],
        sites: 120,
        bin: 30,
      }),
      pages: openPages(r, 40),
    }),
  },
  naming: {
    description: "Every way a site gets its name, and every kind of address",
    build(r, now) {
      const cases = [
        "https://noteforge.example/plan | Plan trip notes - NoteForge",
        "https://www.noteforge.example/ship | NoteForge | Ship dark mode",
        "https://noteforge.example./debug | Debug sync · NoteForge",
        "https://signin.example/home | Your dashboard",
        "https://dana.pages.test/a | Offline sync · Pages",
        "https://dana.pages.test/b | Focus timers · Pages",
        "https://dana.pages.test/c | Trip notes · Pages",
        "https://eli.pages.test/ | About | Eli",
        "https://pages.test/ | Pages",
        "https://docs.atlas.example/guide | Guide - Atlas Docs",
        "https://mail.atlas.example/inbox | Inbox - Atlas",
        "https://news.ember.test/item?id=1 | Ask: tab managers? | Ember Talk",
        "https://news.ember.test/item?id=2 | Show: a reading list | Ember Talk",
        "https://news.ember.test/ | Ember Talk",
        "https://en.lumen.example/wiki/Tabs | Tabs - Lumen",
        "https://m.orbit.example/ | Home",
        "https://xn--mnchen-3ya.example/ | Rathaus - München",
        "https://wenda.test/q/1 | 问题一 - 问答",
        "https://wenda.test/q/2 | 问题二 - 问答",
        "https://wenda.test/q/3 | 问题三 - 问答",
        "https://cdn.example/1 | IMG_0001.jpg",
        "https://cdn.example/2 | IMG_0002.jpg",
        "https://cdn.example/3 | IMG_0003.jpg",
        "https://bare.example/x | https://bare.example/x",
        "http://localhost:3000/ | Dev preview",
        "http://localhost:5173/ | Dev preview",
        "http://192.168.1.1/status | Router status",
        "http://[::1]:8080/ | Local admin",
        "file:///C:/notes/plan.md | plan.md",
        "file:///home/me/report.pdf | report.pdf",
        "file://nas/share/photos.zip | photos.zip",
        "ftp://files.example/pub/ | Index of /pub",
      ].map((line) => page(line));
      const declared = [
        page("https://studio.fern.test/a | Untitled sketch", "Fern Studio"),
        page("https://studio.fern.test/b | Untitled sketch 2", "Fern Studio"),
      ];
      return {
        state: only([
          collection(r, cases, now - 2 * HOUR, { name: "Naming cases" }),
          collection(r, declared, now - 3 * HOUR, { name: "Declared names" }),
        ]),
        // Saving these shows a declared name being read, and a password
        // dropped from an address.
        pages: [
          page("https://journal.maple.test/today | Today", "Maple Journal"),
          page("https://user:secret@vault.example/ | Vault sign-in"),
          page("https://dana.pages.test/d | Error budgets · Pages"),
          ...openPages(r, 6),
        ],
      };
    },
  },
  "bin-expiring": {
    description: "A 24-hour bin with deletes about to be erased",
    build(r, now) {
      const sites = siteMix(r, 8);
      const deleted = (ago: number) => ({
        at: now - ago,
        groups: [collection(r, pagesFrom(r, sites, 3), now - ago - DAY)],
      });
      const state = only(
        [collection(r, pagesFrom(r, sites, 5), now - HOUR)],
        // The last one is past its time and goes when the page loads.
        [
          deleted(HOUR),
          deleted(12 * HOUR),
          deleted(23 * HOUR + 50 * MINUTE),
          deleted(24 * HOUR + 10 * MINUTE),
        ],
      );
      state.settings.binHours = 24;
      return { state, pages: openPages(r, 5) };
    },
  },
  "long-text": {
    description: "Very long, right-to-left, emoji and empty titles",
    build(r, now) {
      const long = "A remarkably long page title that keeps going "
        .repeat(8)
        .trim();
      const pages = [
        page(`https://longread.example/${"deep/".repeat(30)}end | ${long}`),
        page("https://akhbar.test/a | مقال عن تنظيم علامات التبويب - أخبار"),
        page("https://hadashot.test/b | כתבה על ניהול לשוניות - חדשות"),
        page("https://emoji.example/🎉 | 🎉 Launch day 🚀 · Party Planner"),
        page("https://untitled.example/ | https://untitled.example/"),
        page("https://blank.example/ | "),
        page("https://mixed.example/ | Résumé tips — naïve café façade"),
      ];
      return {
        state: only([
          collection(r, pages, now - 30 * MINUTE),
          collection(r, pages.slice(0, 3), now - 2 * DAY, { name: long }),
        ]),
        pages: openPages(r, 5),
      };
    },
  },
};
export const DEFAULT_SCENARIO = "typical";

export function buildScenario(name: string, seed: number, now: number) {
  const scenario = scenarios[name] ?? scenarios[DEFAULT_SCENARIO];
  return scenario.build(random(seed), now);
}
