import { folderIcons } from "../shared/folder-icons.ts";
export { folderIcons };
const navigationIcons: Record<string, readonly [string, string]> = {
  star: ["Starred", "m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1z"],
  tabs: ["All tabs", "M3 3h14v4M3 3v14h4M7 7h14v14H7zM7 11h14"],
  plus: ["New folder", "M12 5v14M5 12h14"],
  recent: ["Recent", "M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"],
  restore: ["Restore", "M7 17 17 7M8 7h9v9"],
  copy: ["Copy", "M8 8h12v12H8zM4 16V4h12"],
  lock: ["Lock", "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3"],
  trash: ["Delete", "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"],
  pencil: ["Rename", "m4 20 4-1 11-11-3-3L5 16zM14 6l3 3"],
  chevron: ["Toggle", "m6 9 6 6 6-6"],
  file: ["Local file", "M6 3h8l4 4v14H6zM14 3v4h4"],
  close: ["Remove", "M6 6l12 12M18 6 6 18"],
  layers: ["Everything", "m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"],
};
export function icon(name: string, className = "nav-icon") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add(...className.split(" "));
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute(
    "d",
    (folderIcons[name] || navigationIcons[name] || folderIcons.folder)[1],
  );
  svg.append(path);
  return svg;
}
