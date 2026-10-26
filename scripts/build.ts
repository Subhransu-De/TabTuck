import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { entryPoints, staticFiles } from "./package-files.ts";
import { buildManager } from "./manager-build.ts";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "dist", "TabTuck");
// A fixed destination and explicit allowlist keep developer files out of releases.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of staticFiles) {
  await mkdir(path.dirname(path.join(output, file)), { recursive: true });
  await cp(path.join(root, "src", file), path.join(output, file));
}

const result = await Bun.build({
  entrypoints: entryPoints
    .filter((file) => !file.startsWith("manager/"))
    .map((file) => path.join(root, "src", file)),
  root: path.join(root, "src"),
  outdir: output,
  target: "browser",
  format: "esm",
  naming: "[dir]/[name].[ext]",
});
if (!result.success)
  throw new AggregateError(result.logs, "Extension compilation failed");
await buildManager(output);
