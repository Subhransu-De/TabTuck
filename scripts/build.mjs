import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "dist", "TabTuck");
// A fixed destination and explicit allowlist keep developer files out of releases.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of [
  "manifest.json",
  "background.js",
  "model.js",
  "ui-icons.js",
  "ui-components.js",
  "manage.html",
  "manage.js",
  "manage.css",
  "icons/16.png",
  "icons/32.png",
  "icons/48.png",
  "icons/128.png",
  "icons/site.svg",
]) {
  await mkdir(path.dirname(path.join(output, file)), { recursive: true });
  await cp(path.join(root, file), path.join(output, file));
}
