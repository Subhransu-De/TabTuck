import { test, expect } from "bun:test";
import { buildScenario, scenarios } from "../../dev/fixtures/scenarios.ts";
import { safeUrl } from "../../src/shared/model.ts";

const NOW = Date.UTC(2026, 10, 17, 12);
const urlsOf = (name: string, seed: number) => {
  const { state, pages } = buildScenario(name, seed, NOW);
  return [
    ...(state?.groups ?? []).flatMap((g) => g.tabs.map((t) => t.url)),
    ...(state?.trash ?? []).flatMap((e) =>
      e.groups.flatMap((g) => g.tabs.map((t) => t.url)),
    ),
    ...pages.map((p) => p.url),
  ];
};

for (const name of Object.keys(scenarios)) {
  test(`${name}: the same seed builds the same data`, () => {
    expect(buildScenario(name, 3, NOW)).toEqual(buildScenario(name, 3, NOW));
  });
  test(`${name}: every address is synthetic and saveable`, () => {
    for (const url of urlsOf(name, 3)) {
      expect(safeUrl(url)).not.toBeNull();
      const { protocol, hostname } = new URL(url);
      // Reserved names only, so dev data never names a real site.
      const synthetic =
        protocol === "file:" ||
        /\.(example|test)\.?$/.test(hostname) ||
        /^(localhost|192\.168\.\d+\.\d+|\[::1\])$/.test(hostname);
      expect({ url, synthetic }).toEqual({ url, synthetic: true });
    }
  });
}
test("heavy passes the 1,000-tab fast-save threshold", () => {
  const { state } = buildScenario("heavy", 1, NOW);
  const tabs = state!.groups.reduce((n, g) => n + g.tabs.length, 0);
  expect(tabs).toBeGreaterThan(1000);
});
