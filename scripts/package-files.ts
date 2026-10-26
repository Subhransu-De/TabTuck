// Static assets copied from src/ into the package. Keep this list explicit so
// developer files never reach a release.
export const staticFiles = [
  "manifest.json",
  "manager/manage.html",
  "manager/boot.js",
  "icons/16.png",
  "icons/32.png",
  "icons/48.png",
  "icons/128.png",
  "fonts/schibsted-grotesk.woff2",
  "fonts/hanken-grotesk.woff2",
  "fonts/spline-sans-mono.woff2",
  "fonts/OFL.txt",
];

// TypeScript entry points compiled into the package. The manager's dialogs
// load from their own bundle the first time one opens.
export const entryPoints = [
  "background/background.ts",
  "manager/manage.tsx",
  "manager/dialogs.tsx",
];

// Every file the published ZIP must contain, and nothing else.
export const packageFiles = [
  ...staticFiles,
  ...entryPoints.map((file) => file.replace(/\.tsx?$/, ".js")),
  "manager/manage.css",
].sort();
