// Small, browser-native components. Tailwind styles compile ahead of time.
import { icon } from "./ui-icons.ts";
export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string | number,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}
export function actionButton(
  label: string,
  onClick: (event: MouseEvent) => void,
  className?: string,
) {
  const node = element("button", label, className);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}
export function websiteIcon(url: string): Element {
  if (url.startsWith("file:")) return icon("file", "site-mark file-mark");
  const node = element("img", undefined, "site-mark");
  node.alt = "";
  node.loading = "lazy";
  node.decoding = "async";
  const favicon = new URL(chrome.runtime.getURL("/_favicon/"));
  favicon.searchParams.set("pageUrl", url);
  favicon.searchParams.set("size", "32");
  node.src = favicon.href;
  node.onerror = () => {
    node.onerror = null;
    node.src = "../icons/site.svg";
  };
  return node;
}
