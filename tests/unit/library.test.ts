import { test, expect } from "bun:test";
import {
  entries,
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
test("site names come from tab titles, else from the domain", () => {
  const list = entries([
    group([
      tab("Biutiful (2010) - IMDb", "https://www.imdb.com/title/tt1/"),
      tab(
        "Romance (1999) - Google Search",
        "https://www.google.com/search?q=a",
      ),
      tab(
        "GitHub - rust-lang/rust: Empowering everyone",
        "https://github.com/rust-lang/rust",
      ),
      tab("Ownership · The Rust Book", "https://doc.rust-lang.org/book/"),
      tab("World news", "https://news.bbc.co.uk/world"),
      tab("Notes", "file:///C:/notes.txt"),
    ]),
  ]);
  const names = siteNames(list);
  expect(names.get("imdb.com")).toBe("IMDb");
  expect(names.get("google.com")).toBe("Google");
  expect(names.get("github.com")).toBe("GitHub");
  expect(names.get("doc.rust-lang.org")).toBe("Rust-lang");
  expect(names.get("news.bbc.co.uk")).toBe("Bbc");
  expect(names.get("")).toBe("Local files");
  expect(sites(list).find((s) => s.host === "imdb.com")?.label).toBe("IMDb");
});
test("hosts that would share a name keep their domains", () => {
  const names = siteNames(
    entries([
      group([
        tab("Inbox - Google", "https://mail.google.com/"),
        tab("Search - Google", "https://google.com/"),
      ]),
    ]),
  );
  expect(names.get("mail.google.com")).toBe("mail.google.com");
  expect(names.get("google.com")).toBe("google.com");
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
