// Small, browser-native components. Tailwind styles compile ahead of time.
export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function actionButton(label, onClick, className) {
  const node = element("button", label, className);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}
export function websiteIcon(url) {
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
    node.src = "icons/site.svg";
  };
  return node;
}
const addedDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
export function addedTime(timestamp) {
  const date = new Date(timestamp);
  const node = element("time", addedDateFormatter.format(date), "tab-date");
  node.dateTime = date.toISOString();
  node.title = `Added to TabTuck: ${date.toLocaleString()}`;
  return node;
}
