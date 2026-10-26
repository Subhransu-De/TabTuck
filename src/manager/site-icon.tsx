// Favicons from the browser's cache, set on a contrasting tile when they would
// vanish into the theme, and a letter tile when the site has none.
import { useState, type CSSProperties } from "react";
import { brandOf, hostOf } from "./library.ts";
import { icon } from "./ui-icons.tsx";

function faviconUrl(pageUrl: string) {
  const favicon = new URL(chrome.runtime.getURL("/_favicon/"));
  favicon.searchParams.set("pageUrl", pageUrl);
  favicon.searchParams.set("size", "32");
  return favicon.href;
}
const SIDE = 16;
function pixels(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIDE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, SIDE, SIDE);
  try {
    return context.getImageData(0, 0, SIDE, SIDE).data;
  } catch {
    return null;
  }
}
// The browser answers a page it has no icon for with its generic globe. Load
// that globe once, for a host that cannot exist, to recognise it later.
let blank: Promise<Uint8ClampedArray | null> | undefined;
function blankFavicon() {
  return (blank ??= new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(pixels(image));
    image.onerror = () => resolve(null);
    image.src = faviconUrl("https://tabtuck.invalid/");
  }));
}
function alike(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
  return diff / a.length < 6;
}
// "dark" or "light" when almost all visible pixels are, so the theme can set
// the icon on a contrasting tile.
function toneOf(data: Uint8ClampedArray) {
  let seen = 0,
    dark = 0,
    light = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 64) continue;
    const luma =
      (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    seen++;
    if (luma < 0.22) dark++;
    else if (luma > 0.9) light++;
  }
  if (!seen) return "";
  return dark / seen > 0.85 ? "dark" : light / seen > 0.85 ? "light" : "";
}
// A favicon's look, measured once per image: a tone, "" for neither, or
// "none" when the site has no icon of its own.
const looks = new Map<string, string>();

// Sites without an icon get their initial on a colour of their own, the way
// the browser's new tab page shows them.
function Monogram({ url }: { url: string }) {
  const brand = brandOf(hostOf(url));
  let hash = 0;
  for (const char of brand) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return (
    <span
      className="site-mark monogram"
      aria-hidden="true"
      style={{ "--hue": hash % 360 } as CSSProperties}
    >
      {(brand.match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase()}
    </span>
  );
}
function Favicon({ url }: { url: string }) {
  const src = faviconUrl(url);
  // Measured looks are shared, so a page seen before renders its final form.
  const [look, setLook] = useState(() => looks.get(src));
  if (look === "none") return <Monogram url={url} />;
  return (
    <img
      className="site-mark"
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      src={src}
      data-tone={look || undefined}
      onLoad={
        look === undefined
          ? async (event) => {
              const data = pixels(event.currentTarget);
              if (!data) return;
              const reference = await blankFavicon();
              const next =
                reference && alike(data, reference) ? "none" : toneOf(data);
              looks.set(src, next);
              setLook(next);
            }
          : undefined
      }
      onError={() => {
        looks.set(src, "none");
        setLook("none");
      }}
    />
  );
}
// A page's icon: its favicon, or the file icon for local files and rows
// without a page.
export function siteIcon(url: string) {
  if (!url || url.startsWith("file:"))
    return icon("file", "site-mark file-mark");
  return <Favicon key={url} url={url} />;
}
