export const folderIcons = {
  folder: ["Folder", "M3 7h7l2-3h9v16H3z"],
  work: ["Work", "M3 7h18v13H3zM8 7V4h8v3M3 12h18M10 12v3h4v-3"],
  book: [
    "Book",
    "M12 5v15M12 5C8 3 5 3 2 4v15c3-1 6-1 10 1 4-2 7-2 10-1V4c-3-1-6-1-10 1",
  ],
  code: ["Code", "m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"],
  globe: [
    "Globe",
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18",
  ],
  heart: ["Heart", "M12 21 3 12C-3 4 7-1 12 6c5-7 15-2 9 6z"],
  film: ["Film", "M3 3h18v18H3zM7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"],
  music: [
    "Music",
    "M9 18V5l12-2v13M9 18a3 3 0 1 1-3-3h3M21 16a3 3 0 1 1-3-3h3",
  ],
  idea: ["Idea", "M9 18h6M9 21h6M9 15c0-3-4-3-4-7a7 7 0 0 1 14 0c0 4-4 4-4 7z"],
  home: ["Home", "m2 11 10-9 10 9M5 9v12h14V9M9 21v-8h6v8"],
};
const navigationIcons = {
  star: ["Starred", "m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1z"],
  tabs: ["All tabs", "M3 3h14v4M3 3v14h4M7 7h14v14H7zM7 11h14"],
  plus: ["New folder", "M12 5v14M5 12h14"],
};
export function icon(name) {
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
