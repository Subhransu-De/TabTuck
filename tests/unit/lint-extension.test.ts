import { expect, test } from "bun:test";
import { isFirefoxOnly, parseReport } from "../../scripts/lint-extension.ts";

test("Chromium exceptions never hide other invalid permissions or source errors", () => {
  expect(
    isFirefoxOnly({
      file: "manifest.json",
      code: "MANIFEST_PERMISSIONS",
      message: '/permissions: Invalid permissions "favicon" at 4.',
    }),
  ).toBe(true);
  expect(
    isFirefoxOnly({
      file: "manifest.json",
      code: "MANIFEST_PERMISSIONS",
      message: '/permissions: Invalid permissions "typo" at 4.',
    }),
  ).toBe(false);
  expect(
    isFirefoxOnly({ file: "background.js", code: "ADDON_ID_REQUIRED" }),
  ).toBe(false);
  expect(isFirefoxOnly({ file: "manifest.json", code: "JSON_INVALID" })).toBe(
    false,
  );
});

test("extension reports reject malformed JSON shapes before filtering diagnostics", () => {
  for (const report of [
    null,
    {},
    { errors: [], warnings: [null] },
    { errors: [{ code: 1 }], warnings: [] },
    { errors: [], warnings: [{ code: "OTHER", message: 1 }] },
  ])
    expect(() => parseReport(JSON.stringify(report))).toThrow(
      "Invalid web-ext report",
    );
  expect(
    parseReport(
      '{"errors":[],"warnings":[{"code":"OTHER","message":"Synthetic diagnostic"}]}',
    ),
  ).toEqual({
    errors: [],
    warnings: [{ code: "OTHER", message: "Synthetic diagnostic" }],
  });
});
