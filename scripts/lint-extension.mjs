// web-ext validates Firefox packages. These four diagnostics are specific to
// Firefox and do not apply to this Chromium/Helium Manifest V3 package.
export function isFirefoxOnly(issue) {
  if (issue.file !== "manifest.json") return false;
  if (
    [
      "BACKGROUND_SERVICE_WORKER_NOFALLBACK",
      "ADDON_ID_REQUIRED",
      "MISSING_DATA_COLLECTION_PERMISSIONS",
    ].includes(issue.code)
  )
    return true;
  return (
    issue.code === "MANIFEST_PERMISSIONS" &&
    issue.message === '/permissions: Invalid permissions "favicon" at 4.'
  );
}

if (import.meta.main) {
  const child = Bun.spawn(
    [
      "node",
      "node_modules/web-ext/bin/web-ext.js",
      "lint",
      "--source-dir",
      "dist/TabTuck",
      "--output",
      "json",
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(child.stdout).text();
  const status = await child.exited;
  const report = JSON.parse(output);
  if (!Array.isArray(report.errors) || !Array.isArray(report.warnings))
    throw new Error("Invalid web-ext report");
  const issues = [...report.errors, ...report.warnings];
  const failures = issues.filter((issue) => !isFirefoxOnly(issue));
  if (failures.length || (status !== 0 && !report.errors.length)) {
    console.error(JSON.stringify(failures.length ? failures : report, null, 2));
    process.exit(1);
  }
  console.log(
    `Extension validation passed (${issues.length} documented Firefox-only diagnostics excluded).`,
  );
}
