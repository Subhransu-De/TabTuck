// Runs while the page is parsed, before its module: paints the last theme
// before the saved one loads (on first use, the system's) and asks the
// background for the library while manage.js loads.
{
  const last = localStorage.getItem("tabtuck-theme");
  const dark =
    last === "dark" ||
    (last !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.add(dark ? "dark" : "light");
  globalThis.tabtuckState = chrome.runtime.sendMessage({ type: "state" });
}
