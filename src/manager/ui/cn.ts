// Joins class names. Components never pass a utility that conflicts with
// one they already set, so no Tailwind-aware merging is needed.
export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
