import { test, expect } from "bun:test";
import {
  amountError,
  consequence,
  convert,
  duration,
  erasedBy,
  isPreset,
  join,
  maxAmount,
  split,
} from "../../src/manager/bin-time.ts";
import { HOUR } from "../../src/shared/model.ts";

test("bin times read in the unit they were likely picked in", () => {
  expect(duration(1)).toBe("1 hour");
  expect(duration(37)).toBe("37 hours");
  expect(duration(24)).toBe("1 day");
  expect(duration(30 * 24)).toBe("30 days");
  expect(duration(365 * 24)).toBe("1 year");
  expect(split(48)).toEqual({ amount: 2, unit: "days" });
  expect(split(37)).toEqual({ amount: 37, unit: "hours" });
  expect(isPreset(7 * 24)).toBe(true);
  expect(isPreset(37)).toBe(false);
});

test("amounts stay whole and within the background's limits", () => {
  expect(join(2, "days")).toBe(48);
  expect(join(9999, "days")).toBe(365 * 24);
  expect(convert(2, "days", "hours")).toBe(48);
  expect(convert(37, "hours", "days")).toBe(2);
  expect(convert(1, "hours", "days")).toBe(1);
  expect(maxAmount("days")).toBe(365);
  expect(amountError(0, "hours")).toBe("Enter at least 1.");
  expect(amountError(1.5, "days")).toBe("Use whole days.");
  expect(amountError(366, "days")).toBe("The longest is 1 year (365 days).");
  expect(amountError(37, "hours")).toBe("");
});

test("the line under the bin time says what saving would do", () => {
  const now = Date.UTC(2026, 9, 24, 12);
  const deleted = [now - 2 * HOUR, now - 3 * 24 * HOUR];
  expect(erasedBy(48, deleted, now)).toBe(1);
  expect(consequence(48, deleted, now)).toBe(
    "1 tab in the bin will be erased when you save.",
  );
  expect(consequence(30 * 24, [], now)).toBe("Deleted tabs stay 30 days.");
  expect(consequence(30 * 24, deleted, now)).toMatch(
    /^Deleted tabs stay 30 days\. The oldest one in the bin gets removed on .+\.$/,
  );
});
