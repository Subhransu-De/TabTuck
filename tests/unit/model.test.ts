import { test, expect } from "bun:test";
import {
  parseImport,
  exportText,
  safeUrl,
  groupBySites,
  group,
} from "../../src/shared/model.ts";
test("OneTab import preserves groups, duplicate URLs and titles with separators", () => {
  const raw =
    "https://example.com/ | A | B\r\nhttps://example.com/ | Duplicate\r\n\r\nhttps://example.org/ | Other";
  const g = parseImport(raw);
  expect(g.length).toBe(2);
  expect(g[0].tabs.length).toBe(2);
  expect(g[0].tabs[0].title).toBe("A | B");
  expect(
    parseImport(exportText(g)).map((g) => g.tabs.map((t) => t.title)),
  ).toEqual([["A | B", "Duplicate"], ["Other"]]);
});
test("import validates the entire payload and rejects executable URLs", () => {
  expect(() =>
    parseImport("https://example.com/\njavascript:alert(1)"),
  ).toThrow();
  expect(safeUrl("data:text/html,test")).toBeNull();
  expect(() => parseImport("{oops")).toThrow();
});
test("JSON backup roundtrip preserves group metadata and gives imported items fresh IDs", () => {
  const g = parseImport("https://example.com/ | Example");
  g[0].name = "Research";
  g[0].locked = true;
  g[0].folder = "Work";
  const result = parseImport(JSON.stringify({ groups: g }));
  expect(result[0].name).toBe("Research");
  expect(result[0].locked).toBe(true);
  expect(result[0].folder).toBe("Work");
  expect(result[0].id).not.toBe(g[0].id);
});

test("site view merges hostnames without modifying source groups and keeps dates and locks", () => {
  const groups = [
    {
      ...group([]),
      id: "old",
      createdAt: 1000,
      locked: true,
      tabs: [{ id: "a", title: "A", url: "https://www.example.com/a" }],
    },
    {
      ...group([]),
      id: "new",
      createdAt: 3000,
      tabs: [
        { id: "b", title: "B", url: "https://example.com/b", addedAt: 4000 },
        { id: "c", title: "C", url: "https://example.org/c", addedAt: 2000 },
      ],
    },
  ];
  const before = JSON.stringify(groups);
  const sites = groupBySites(groups);
  expect(sites.map((g) => g.name)).toEqual(["example.com", "example.org"]);
  expect(sites[0].tabs.map((t) => t.id)).toEqual(["b", "a"]);
  expect(sites[0].tabs[1].addedAt).toBe(1000);
  expect(sites[0].tabs[1].sourceLocked).toBe(true);
  expect(JSON.stringify(groups)).toBe(before);
});
test("JSON import preserves per-link dates independently of group dates", () => {
  const result = parseImport(
    JSON.stringify({
      groups: [
        {
          createdAt: 3000,
          tabs: [
            { url: "https://example.com", addedAt: 1000 },
            { url: "https://example.org" },
          ],
        },
      ],
    }),
  );
  expect(result[0].tabs.map((t) => t.addedAt)).toEqual([1000, 3000]);
});
