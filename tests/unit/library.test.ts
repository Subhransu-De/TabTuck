import { test, expect } from "bun:test";
import {
  entries,
  collectionLabel,
  forgetSearchText,
  retimed,
  siteNames,
  sites,
} from "../../src/manager/library.ts";
import { group } from "../../src/shared/model.ts";

const tab = (title: string, url: string) => ({
  id: crypto.randomUUID(),
  title,
  url,
});
test("the library names each site once, for every view", () => {
  const list = entries([
    group([
      tab("Biutiful (2010) - IMDb", "https://www.imdb.com/title/tt1/"),
      tab(
        "GitHub - rust-lang/rust: Empowering everyone",
        "https://github.com/rust-lang/rust",
      ),
      tab("Kevin Ngo · GitHub", "https://kevintngo.github.io/"),
      tab("Ownership · The Rust Book", "https://doc.rust-lang.org/book/"),
      tab("Notes", "file:///C:/notes.txt"),
      tab("Router", "http://192.168.1.1/"),
    ]),
  ]);
  const names = siteNames(list);
  expect(names.get("imdb.com")).toBe("IMDb");
  expect(names.get("github.com")).toBe("GitHub");
  expect(names.get("kevintngo.github.io")).toBe("Kevintngo");
  expect(names.get("doc.rust-lang.org")).toBe("Doc");
  expect(names.get("")).toBe("Local files");
  expect(names.get("192.168.1.1")).toBe("192.168.1.1");
  expect(sites(list).find((s) => s.host === "imdb.com")?.label).toBe("IMDb");
});
test("collection labels use the names the whole library gives sites", () => {
  const one = group([
    tab("a", "https://github.com/a"),
    tab("b", "https://github.com/b"),
    tab("c", "http://192.168.1.1/"),
    tab("d", "https://example.org/"),
  ]);
  const other = group([tab("GitHub - x/y", "https://github.com/x/y")]);
  const names = siteNames(entries([one, other]));
  expect(collectionLabel(one)).toBe("Github, 192.168.1.1 +1");
  expect(collectionLabel(one, names)).toBe("GitHub, 192.168.1.1 +1");
  expect(collectionLabel({ ...one, name: "Work" }, names)).toBe("Work");
});
test("entries share host names and build search text on first use", () => {
  const list = entries([
    group([
      tab("One", "https://www.example.com/a"),
      tab("Two", "https://example.com/b"),
    ]),
  ]);
  expect(list[0].host).toBe("example.com");
  expect(list[0].host).toBe(list[1].host);
  expect(list[1].search).toBe("two https://example.com/b  ");
  const later = retimed(list[1], 42);
  expect(later.addedAt).toBe(42);
  expect(later.search).toBe(list[1].search);
  expect(later.tab).toBe(list[1].tab);
  // Cleared searches drop the text; the next search builds it again.
  forgetSearchText();
  expect(list[1].search).toBe("two https://example.com/b  ");
});
