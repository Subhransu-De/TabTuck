import { expect, test } from "bun:test";
import { isFirefoxOnly } from "./lint-extension.mjs";

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
