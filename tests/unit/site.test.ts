import { test, expect } from "bun:test";
import {
  declaredName,
  decodeLabel,
  nameSites,
  siteAddress,
  siteOf,
  type SiteTab,
} from "../../src/shared/site.ts";

const name = (...tabs: (SiteTab | string)[]) => {
  const list = tabs.map((t) => {
    if (typeof t !== "string") return { ...t, key: siteOf(t.url) };
    const at = t.indexOf(" | ");
    const url = at < 0 ? t : t.slice(0, at);
    return { url, title: at < 0 ? t : t.slice(at + 3), key: siteOf(url) };
  });
  return Object.fromEntries(nameSites(list));
};

test("a site is its host and port, whatever the spelling", () => {
  expect(siteOf("https://WWW.Example.com:443/a")).toBe("example.com");
  expect(siteOf("https://example.com./")).toBe("example.com");
  expect(siteOf("http://localhost:5173/")).toBe("localhost:5173");
  expect(siteOf("http://2130706433/")).toBe("127.0.0.1");
  expect(siteOf("https://www.com/")).toBe("www.com");
  expect(siteOf("https://mail.google.com/")).toBe("mail.google.com");
});
test("files, FTP and other schemes get their own kinds of key", () => {
  expect(siteOf("file:///C:/notes.txt")).toBe("");
  expect(siteOf("file://server/share/a.txt")).toBe("file://server");
  expect(siteOf("ftp://ftp.gnu.org/pub")).toBe("ftp://ftp.gnu.org");
  expect(siteOf("about:blank")).toBe("about:");
  expect(siteOf("not a url")).toBe("?");
  expect(siteAddress("")).toBe("Local files");
  expect(siteAddress("file://server")).toBe("server (network files)");
  expect(siteAddress("data:")).toBe("Unsupported (data:)");
  expect(siteAddress("?")).toBe("Invalid address");
  expect(siteAddress("localhost:5173")).toBe("localhost:5173");
});
test("with nothing better, a host is named by its first label", () => {
  expect(
    name(
      "https://github.com/a | a",
      "https://github.io/ | b",
      "https://example.github.io/ | c",
      "http://intranet/ | d",
    ),
  ).toEqual({
    "github.com": "Github",
    "github.io": "Github",
    "example.github.io": "Example",
    intranet: "Intranet",
  });
});
test("a one- or two-letter first label is skipped", () => {
  expect(name("https://en.wikipedia.org/wiki/Rust | Rust")).toEqual({
    "en.wikipedia.org": "Wikipedia",
  });
  expect(name("https://m.example.com/ | Home")).toEqual({
    "m.example.com": "Example",
  });
  expect(name("https://x.ai/ | Home")).toEqual({ "x.ai": "X" });
});
test("a title that spells the host gives the site's own spelling", () => {
  expect(
    name(
      "https://github.com/rust-lang/rust | GitHub - rust-lang/rust",
      "https://www.imdb.com/title/tt1/ | Biutiful (2010) - IMDb",
      "https://docs.google.com/d | Budget - Google Docs",
      "https://www.amazon.com/k | Amazon.com: Kindle",
      "https://accounts.spotify.com/ | Login with Google - Spotify",
      "https://www.pokemon.com/pokedex | Pokédex | Pokémon",
    ),
  ).toEqual({
    "github.com": "GitHub",
    "imdb.com": "IMDb",
    "docs.google.com": "Google Docs",
    "amazon.com": "Amazon.com",
    "accounts.spotify.com": "Accounts",
    "pokemon.com": "Pokémon",
  });
});
test("a parent domain's name never names its subdomain", () => {
  expect(
    name(
      "https://kevintngo.github.io/ | Notes · GitHub",
      "https://kevintngo.github.io/a | Talks · GitHub",
      "https://kevintngo.github.io/b | Slides · GitHub",
      "https://mail.google.com/ | Inbox - Google",
    ),
  ).toEqual({ "kevintngo.github.io": "Kevintngo", "mail.google.com": "Mail" });
  expect(name("https://kevintngo.github.io/ | About | Kevin T Ngo")).toEqual({
    "kevintngo.github.io": "Kevin T Ngo",
  });
});
test("a title ending repeated on most pages names the site", () => {
  expect(
    name(
      "https://news.ycombinator.com/item?id=1 | Show HN: A tab manager | Hacker News",
      "https://news.ycombinator.com/item?id=2 | Ask HN: Tools? | Hacker News",
      "https://news.ycombinator.com/ | Hacker News",
      "https://www.zhihu.com/q/1 | 问题一 - 知乎",
      "https://www.zhihu.com/q/2 | 问题二 - 知乎",
      "https://www.zhihu.com/q/3 | 问题三 - 知乎",
    ),
  ).toEqual({ "news.ycombinator.com": "Hacker News", "zhihu.com": "知乎" });
  // File names are not names, and one page counts once however often saved.
  expect(
    name(
      "https://cdn.example/1 | IMG_0001.jpg",
      "https://cdn.example/2 | IMG_0002.jpg",
      "https://cdn.example/3 | IMG_0003.jpg",
      "https://sso.example/1 | Sign in - Portal",
      "https://sso.example/2 | Sign in - Portal",
      "https://sso.example/3 | Sign in - Portal",
    ),
  ).toEqual({ "cdn.example": "Cdn", "sso.example": "Sso" });
});
test("the name a page declares wins over every guess", () => {
  expect(
    name(
      {
        url: "https://kevintngo.github.io/",
        title: "Notes · GitHub",
        siteName: "Kevin's notebook",
      },
      { url: "https://news.ycombinator.com/", title: "Hacker News" },
      {
        url: "https://en.wikipedia.org/wiki/Rust",
        title: "Rust - Wikipedia",
        siteName: "Wikipedia",
      },
    ),
  ).toEqual({
    "kevintngo.github.io": "Kevin's notebook",
    "news.ycombinator.com": "News",
    "en.wikipedia.org": "Wikipedia",
  });
});
test("addresses that cannot carry a name show the address", () => {
  expect(
    name(
      "http://192.168.1.1/ | Step 1 - Router setup",
      "http://[::1]:3000/ | Wizard",
      "http://localhost:5173/ | Vite App",
      "https://example.com:8443/ | Admin - Example",
      "file:///C:/notes.txt | notes.txt",
      "file://server/share/b.txt | b.txt",
      "ftp://ftp.gnu.org/pub/ | Index of /pub",
    ),
  ).toEqual({
    "192.168.1.1": "192.168.1.1",
    "[::1]:3000": "[::1]:3000",
    "localhost:5173": "localhost:5173",
    "example.com:8443": "example.com:8443",
    "": "Local files",
    "file://server": "server (network files)",
    "ftp://ftp.gnu.org": "ftp://ftp.gnu.org",
  });
});
test("punycode is decoded for naming", () => {
  expect(decodeLabel("xn--mnchen-3ya")).toBe("münchen");
  expect(decodeLabel("xn--a!b")).toBe("xn--a!b");
  expect(name("https://xn--mnchen-3ya.de/ | Rathaus - München")).toEqual({
    "xn--mnchen-3ya.de": "München",
  });
  expect(name("https://xn--mnchen-3ya.de/ | Rathaus")).toEqual({
    "xn--mnchen-3ya.de": "München",
  });
});
test("declared names are one short line with a letter or digit", () => {
  expect(declaredName("  GitHub \n Pages ")).toBe("GitHub Pages");
  expect(declaredName("—")).toBeUndefined();
  expect(declaredName("x".repeat(41))).toBeUndefined();
  expect(declaredName(42)).toBeUndefined();
});
