import { expect, test } from "bun:test";
import {
  nextVersion,
  prepareChangelog,
  readVersion,
  releaseNotes,
  setVersion,
} from "../../scripts/release-version.ts";

test("raises the patch version when no version is given", () => {
  expect(nextVersion("1.1.0")).toBe("1.1.1");
  expect(nextVersion("1.1.9", "  ")).toBe("1.1.10");
});

test("accepts a higher requested version, with or without a v", () => {
  expect(nextVersion("1.1.0", "1.2.0")).toBe("1.2.0");
  expect(nextVersion("1.1.0", "v2.0.0")).toBe("2.0.0");
  expect(nextVersion("1.9.0", "1.10.0")).toBe("1.10.0");
});

test("rejects versions that are not higher or not valid", () => {
  expect(() => nextVersion("1.1.0", "1.1.0")).toThrow("must be higher");
  expect(() => nextVersion("1.1.0", "1.0.9")).toThrow("must be higher");
  for (const bad of ["1.2", "1.2.3.4", "1.2.3-beta", "01.2.3", "1.2.x"])
    expect(() => nextVersion("1.1.0", bad)).toThrow("not a version");
  expect(() => nextVersion("1.1.0", "1.1.65536")).toThrow("above 65535");
});

test("changes only the top-level version and keeps line endings", () => {
  const json = [
    "{",
    '  "name": "tabtuck",',
    '  "version": "1.1.0",',
    '  "devDependencies": {',
    '    "version": "9.9.9"',
    "  }",
    "}",
    "",
  ].join("\r\n");
  const updated = setVersion(json, "1.1.1");
  expect(readVersion(updated)).toBe("1.1.1");
  expect(updated).toBe(json.replace('"1.1.0"', '"1.1.1"'));
  expect(() => setVersion('{\n  "name": "x"\n}\n', "1.1.1")).toThrow(
    "No top-level version",
  );
});

const changelog = [
  "# Changelog",
  "",
  "Intro.",
  "",
  "## Unreleased",
  "",
  "### Fixed",
  "",
  "- Synthetic fix",
  "",
  "## [1.1.0] - 2026-10-26",
  "",
  "- Earlier change",
  "",
].join("\r\n");

test("moves the Unreleased entries into a dated section", () => {
  expect(prepareChangelog(changelog, "1.1.1", "2026-10-28")).toBe(
    [
      "# Changelog",
      "",
      "Intro.",
      "",
      "## Unreleased",
      "",
      "## [1.1.1] - 2026-10-28",
      "",
      "### Fixed",
      "",
      "- Synthetic fix",
      "",
      "## [1.1.0] - 2026-10-26",
      "",
      "- Earlier change",
      "",
    ].join("\n"),
  );
});

test("prepares the first release when there is no history", () => {
  expect(
    prepareChangelog(
      "# Changelog\n\n## Unreleased\n- One",
      "1.0.0",
      "2026-01-01",
    ),
  ).toBe("# Changelog\n\n## Unreleased\n\n## [1.0.0] - 2026-01-01\n\n- One\n");
});

test("refuses a missing, empty, duplicate or already released section", () => {
  const prepare = (text: string, version = "1.1.1") =>
    prepareChangelog(text, version, "2026-10-28");
  expect(() =>
    prepare("# Changelog\n\n## [1.1.0] - 2026-10-26\n- A\n"),
  ).toThrow("exactly one");
  expect(() =>
    prepare("## Unreleased\n\n## [1.1.0] - 2026-10-26\n- A\n"),
  ).toThrow("is empty");
  expect(() => prepare("## Unreleased\n- A\n\n## Unreleased\n- B\n")).toThrow(
    "exactly one",
  );
  expect(() => prepare(changelog, "1.1.0")).toThrow("already has a section");
  expect(() => prepareChangelog(changelog, "1.1.1", "28 Oct")).toThrow(
    "not a date",
  );
  expect(() => prepare("### Unreleased\n- A\n")).toThrow("exactly one");
});

test("release notes contain only the requested version", () => {
  const prepared = prepareChangelog(changelog, "1.1.1", "2026-10-28");
  expect(releaseNotes(prepared, "1.1.1")).toBe(
    "### Fixed\n\n- Synthetic fix\n",
  );
  expect(releaseNotes(prepared, "1.1.0")).toBe("- Earlier change\n");
  expect(() => releaseNotes(prepared, "1.2.0")).toThrow("no dated section");
  expect(() =>
    releaseNotes(changelog.replace("1.1.0", "1x1x0"), "1.1.0"),
  ).toThrow("no dated section");
});
