import { readFile, writeFile } from "node:fs/promises";

// Chrome allows up to four dot-separated integers from 0 to 65535. Releases use
// three so the version is also a valid semantic version.
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const versionField = /^( {2}"version": ")([^"]*)(",?\r?)$/m;
const unreleased = "## Unreleased";

function parse(version: string) {
  const match = versionPattern.exec(version);
  if (!match) throw new Error(`${version} is not a version like 1.2.3`);
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 65535))
    throw new Error(`${version} has a part above 65535`);
  return parts;
}

function compare(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

// The requested version, or the next patch version when none is given.
export function nextVersion(current: string, requested = "") {
  const now = parse(current);
  const wanted = requested.trim().replace(/^v/, "");
  if (!wanted) return `${now[0]}.${now[1]}.${now[2] + 1}`;
  if (compare(parse(wanted), now) <= 0)
    throw new Error(`${wanted} must be higher than the current ${current}`);
  return wanted;
}

export function readVersion(json: string) {
  const match = versionField.exec(json);
  if (!match) throw new Error("No top-level version field");
  return match[2];
}

// Replaces only the top-level version so the file keeps its formatting.
export function setVersion(json: string, version: string) {
  parse(version);
  readVersion(json);
  return json.replace(versionField, `$1${version}$3`);
}

// Splits text at the first level-two heading, keeping the heading in the rest.
function untilNextSection(text: string) {
  const next = text.search(/^## /m);
  return next === -1 ? [text, ""] : [text.slice(0, next), text.slice(next)];
}

// Moves the Unreleased entries into a dated section for the version.
export function prepareChangelog(
  changelog: string,
  version: string,
  date: string,
) {
  parse(version);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error(`${date} is not a date like 2026-01-31`);
  const text = changelog.replace(/\r\n/g, "\n");
  const headings = text.split("\n").filter((line) => line === unreleased);
  if (headings.length !== 1)
    throw new Error("CHANGELOG.md must have exactly one ## Unreleased section");
  if (text.includes(`\n## [${version}] - `))
    throw new Error(`CHANGELOG.md already has a section for ${version}`);
  const heading = /^## Unreleased$/m.exec(text);
  if (!heading) throw new Error("CHANGELOG.md has no ## Unreleased section");
  const preamble = text.slice(0, heading.index);
  const [changes, history] = untilNextSection(
    text.slice(heading.index + unreleased.length),
  );
  if (!changes.trim())
    throw new Error(
      "The Unreleased section of CHANGELOG.md is empty. Add the changes for this release first.",
    );
  return `${preamble}${unreleased}\n\n## [${version}] - ${date}\n\n${changes.trim()}\n${history ? `\n${history.trimEnd()}\n` : ""}`;
}

// The changelog section for one version, used as the GitHub release notes.
export function releaseNotes(changelog: string, version: string) {
  const text = changelog.replace(/\r\n/g, "\n");
  const heading = new RegExp(
    `^## \\[${version.replace(/\./g, "\\.")}\\] - \\d{4}-\\d{2}-\\d{2}\\n`,
    "m",
  );
  const match = heading.exec(text);
  if (!match)
    throw new Error(`CHANGELOG.md has no dated section for ${version}`);
  const [notes] = untilNextSection(text.slice(match.index + match[0].length));
  if (!notes.trim())
    throw new Error(`The CHANGELOG.md section for ${version} is empty`);
  return `${notes.trim()}\n`;
}

const files = ["src/manifest.json", "package.json"];

async function current() {
  const [manifest, pkg] = await Promise.all(
    files.map((path) => readFile(path, "utf8")),
  );
  const version = readVersion(manifest);
  if (readVersion(pkg) !== version)
    throw new Error(
      `src/manifest.json is ${version} but package.json is ${readVersion(pkg)}`,
    );
  return version;
}

if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);
  if (command === "current") {
    console.log(await current());
  } else if (command === "next") {
    console.log(nextVersion(await current(), args[0]));
  } else if (command === "apply" && args[0] && args[1]) {
    const [version, date] = args;
    for (const path of files)
      await writeFile(path, setVersion(await readFile(path, "utf8"), version));
    const changelog = await readFile("CHANGELOG.md", "utf8");
    await writeFile("CHANGELOG.md", prepareChangelog(changelog, version, date));
  } else if (command === "notes" && args[0] && args[1]) {
    const changelog = await readFile("CHANGELOG.md", "utf8");
    await writeFile(args[1], releaseNotes(changelog, args[0]));
  } else {
    console.error(
      [
        "Usage:",
        "  bun scripts/release-version.ts current",
        "  bun scripts/release-version.ts next [version]",
        "  bun scripts/release-version.ts apply <version> <yyyy-mm-dd>",
        "  bun scripts/release-version.ts notes <version> <notes.md>",
      ].join("\n"),
    );
    process.exit(2);
  }
}
