import { expect, test } from "bun:test";
import {
  isFirefoxOnly,
  isReactDom,
  parseReport,
} from "../../scripts/lint-extension.ts";

test("Chromium exceptions never hide other invalid permissions or source errors", () => {
  expect(
    isFirefoxOnly({
      file: "manifest.json",
      code: "MANIFEST_PERMISSIONS",
      message: '/permissions: Invalid permissions "favicon" at 3.',
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

test("the react-dom exception covers only innerHTML in manage.js", () => {
  const issue = {
    file: "manager/manage.js",
    code: "UNSAFE_VAR_ASSIGNMENT",
    message: "Unsafe assignment to innerHTML",
  };
  expect(isReactDom(issue)).toBe(true);
  expect(isReactDom({ ...issue, file: "manager/dialogs.js" })).toBe(false);
  expect(isReactDom({ ...issue, file: "background/background.js" })).toBe(
    false,
  );
  expect(
    isReactDom({ ...issue, message: "Unsafe assignment to outerHTML" }),
  ).toBe(false);
  expect(
    isReactDom({ ...issue, message: "Unsafe call to import for argument 0" }),
  ).toBe(false);
  expect(isReactDom({ ...issue, code: "DANGEROUS_EVAL" })).toBe(false);
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
