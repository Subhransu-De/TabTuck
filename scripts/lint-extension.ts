interface Issue {
  file?: string;
  code: string;
  message?: string;
}
function isIssue(value: unknown): value is Issue {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string" &&
    (!("file" in value) || typeof value.file === "string") &&
    (!("message" in value) || typeof value.message === "string")
  );
}
export function parseReport(output: string): {
  errors: Issue[];
  warnings: Issue[];
} {
  const report: unknown = JSON.parse(output);
  if (
    typeof report !== "object" ||
    report === null ||
    !("errors" in report) ||
    !Array.isArray(report.errors) ||
    !report.errors.every(isIssue) ||
    !("warnings" in report) ||
    !Array.isArray(report.warnings) ||
    !report.warnings.every(isIssue)
  )
    throw new Error("Invalid web-ext report");
  return { errors: report.errors, warnings: report.warnings };
}
// web-ext validates Firefox packages. These four diagnostics are specific to
// Firefox and do not apply to this Chromium/Helium Manifest V3 package.
export function isFirefoxOnly(issue: Issue) {
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
  const report = parseReport(output);
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
