import { folderIcons } from "../shared/folder-icons.ts";
export { folderIcons };
const navigationIcons: Record<string, readonly [string, string]> = {
  star: ["Starred", "m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1z"],
  tabs: ["All tabs", "M3 3h14v4M3 3v14h4M7 7h14v14H7zM7 11h14"],
  plus: ["New folder", "M12 5v14M5 12h14"],
};
export function icon(name: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("nav-icon");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute(
    "d",
    (folderIcons[name] || navigationIcons[name] || folderIcons.folder)[1],
  );
  svg.append(path);
  return svg;
}
