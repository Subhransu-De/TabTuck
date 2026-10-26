// Rules and wording for the bin time in Options: a few common lengths, or a
// custom amount in hours or days, within the background's limits.
import { binLimits, HOUR } from "../shared/model.ts";
import { plural } from "./library.ts";

export type Unit = "hours" | "days";
export const PRESETS = [
  { hours: 24, label: "1 day" },
  { hours: 7 * 24, label: "7 days" },
  { hours: 30 * 24, label: "30 days" },
  { hours: 90 * 24, label: "90 days" },
  { hours: 365 * 24, label: "1 year" },
] as const;
export const isPreset = (hours: number) =>
  PRESETS.some((preset) => preset.hours === hours);

// "1 hour", "37 hours", "1 day", "30 days", "1 year".
export function duration(hours: number) {
  if (hours === binLimits.max) return "1 year";
  return hours % 24 ? plural(hours, "hour") : plural(hours / 24, "day");
}
// The unit a value reads best in: whole days show as days, anything else as
// hours.
export function split(hours: number): { amount: number; unit: Unit } {
  return hours % 24 === 0
    ? { amount: hours / 24, unit: "days" }
    : { amount: hours, unit: "hours" };
}
export function join(amount: number, unit: Unit) {
  const hours = unit === "days" ? amount * 24 : amount;
  return Math.min(binLimits.max, Math.max(binLimits.min, Math.round(hours)));
}
// Switching the unit keeps the same time: 2 days becomes 48 hours, and hours
// that are not whole days round up to the next day.
export function convert(amount: number, from: Unit, to: Unit) {
  if (from === to) return amount;
  return to === "days" ? Math.max(1, Math.ceil(amount / 24)) : amount * 24;
}
// The largest amount allowed in a unit.
export function maxAmount(unit: Unit) {
  return unit === "days" ? binLimits.max / 24 : binLimits.max;
}
// Why an amount cannot be saved, or "" when it can.
export function amountError(amount: number, unit: Unit) {
  if (!Number.isFinite(amount) || amount < binLimits.min)
    return "Enter at least 1.";
  if (!Number.isInteger(amount)) return `Use whole ${unit}.`;
  if (amount > maxAmount(unit))
    return `The longest is 1 year (${maxAmount(unit)} ${unit}).`;
  return "";
}

// How many binned tabs, by deletion time, a bin time would erase now.
export function erasedBy(hours: number, deleted: number[], now: number) {
  return deleted.filter((at) => now - at >= hours * HOUR).length;
}
const day = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});
const dayAndTime = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
// "27 Oct", or "25 Oct, 14:00" when the time is under two days away.
export function when(time: number, now: number) {
  return time - now < 48 * HOUR ? dayAndTime.format(time) : day.format(time);
}
// The line under the bin time: what the chosen time does.
export function consequence(hours: number, deleted: number[], now: number) {
  const erased = erasedBy(hours, deleted, now);
  if (erased)
    return `${plural(erased, "tab")} in the bin will be erased when you save.`;
  if (!deleted.length) return `Deleted tabs stay ${duration(hours)}.`;
  const oldest = deleted.reduce((a, b) => Math.min(a, b));
  return `Deleted tabs stay ${duration(hours)}. The oldest one in the bin gets removed on ${when(oldest + hours * HOUR, now)}.`;
}
