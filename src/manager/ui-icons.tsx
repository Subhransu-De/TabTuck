// TabTuck's line icons on a 24-unit grid. Folder icons come from the shared
// list the background validates against; the rest are the page's own.
import { folderIcons } from "../shared/folder-icons.ts";
export { folderIcons };
const navigationIcons: Record<string, readonly [string, string]> = {
  star: ["Starred", "m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1z"],
  tabs: ["All tabs", "M3 3h14v4M3 3v14h4M7 7h14v14H7zM7 11h14"],
  plus: ["New folder", "M12 5v14M5 12h14"],
  minus: ["Less", "M5 12h14"],
  recent: ["Recent", "M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"],
  restore: ["Restore", "M7 17 17 7M8 7h9v9"],
  copy: ["Copy", "M8 8h12v12H8zM4 16V4h12"],
  lock: ["Lock", "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3"],
  trash: ["Delete", "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"],
  pencil: ["Rename", "m4 20 4-1 11-11-3-3L5 16zM14 6l3 3"],
  chevron: ["Toggle", "m6 9 6 6 6-6"],
  "chevron-up": ["Up", "m18 15-6-6-6 6"],
  check: ["Done", "M20 6 9 17l-5-5"],
  close: ["Close", "M18 6 6 18M6 6l12 12"],
  search: [
    "Search",
    "M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0M16 16l4.5 4.5",
  ],
  file: ["Local file", "M6 3h8l4 4v14H6zM14 3v4h4"],
  layers: ["Everything", "m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"],
  gear: [
    "Options",
    "M10.27 4.8 10.52 2.11H13.48L13.73 4.8 15.87 5.69 17.95 3.96 20.04 6.05 18.31 8.13 19.2 10.27 21.89 10.52V13.48L19.2 13.73 18.31 15.87 20.04 17.95 17.95 20.04 15.87 18.31 13.73 19.2 13.48 21.89H10.52L10.27 19.2 8.13 18.31 6.05 20.04 3.96 17.95 5.69 15.87 4.8 13.73 2.11 13.48V10.52L4.8 10.27 5.69 8.13 3.96 6.05 6.05 3.96 8.13 5.69zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  ],
};
// An icon as an element, not a component, so rows hold no extra layer.
export function icon(name: string, className = "nav-icon") {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d={
          (folderIcons[name] || navigationIcons[name] || folderIcons.folder)[1]
        }
      />
    </svg>
  );
}
