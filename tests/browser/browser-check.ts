import { parseImport } from "../../src/shared/model.ts";
import type { Message, MessageResult, Reply } from "../../src/shared/types.ts";
// Run with HELIUM_EXECUTABLE and TABTUCK_TEST_DIR set to an isolated artifact directory.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";
const artifactDir = process.env.TABTUCK_TEST_DIR;
if (!artifactDir || !process.env.HELIUM_EXECUTABLE)
  throw new Error(
    "Set HELIUM_EXECUTABLE and TABTUCK_TEST_DIR; never use a personal browser profile.",
  );
const extension = path.resolve(import.meta.dirname, "../../dist/TabTuck");
const context = await chromium.launchPersistentContext(
  path.join(artifactDir, "profile"),
  {
    executablePath: process.env.HELIUM_EXECUTABLE,
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
    acceptDownloads: true,
    viewport: { width: 1400, height: 900 },
  },
);
const errors: string[] = [];
context.on("page", (page) =>
  page.on("pageerror", (error) => errors.push(error.message)),
);
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/manager/manage.html`);
  await page.waitForFunction(() =>
    document.querySelector("#summary")?.textContent?.includes("0 saved"),
  );
  const invoke = <M extends Message>(message: M): Promise<MessageResult<M>> =>
    page.evaluate(async (message) => {
      const r: Reply<M> = await chrome.runtime.sendMessage(message);
      if (!r.ok) throw new Error(r.error);
      return r.result;
    }, message);
  const currentWindow = await page.evaluate(
    async () => (await chrome.tabs.getCurrent())!.windowId,
  );
  const otherWindow = await worker.evaluate(
    async () =>
      (await chrome.windows.create({ url: "https://example.net/?untouched" }))!
        .id,
  );
  await worker.evaluate(async (windowId) => {
    await chrome.tabs.create({
      windowId,
      url: "https://example.com/?capture-a",
      active: true,
    });
    await chrome.tabs.create({
      windowId,
      url: "https://example.org/?pinned",
      pinned: true,
    });
    const grouped = await chrome.tabs.create({
      windowId,
      url: "https://example.org/?grouped",
    });
    await chrome.tabs.group({
      tabIds: [grouped.id!],
      createProperties: { windowId },
    });
  }, currentWindow);
  const capture = await invoke({ type: "capture", mode: "all" });
  assert.equal(capture.count, 1);
  const protectedTabs = await worker.evaluate(async () =>
    chrome.tabs.query({ url: "https://example.org/*" }),
  );
  assert.equal(protectedTabs.length, 2);
  assert.ok(protectedTabs.some((t) => t.pinned));
  assert.ok(protectedTabs.some((t) => t.groupId !== -1));
  let state = await invoke({ type: "state" });
  assert.equal(state.groups[0].tabs[0].url, "https://example.com/?capture-a");
  const untouched = await worker.evaluate(
    async (id) => (await chrome.tabs.query({ windowId: id })).length,
    otherWindow,
  );
  assert.equal(untouched, 1);
  await page.locator(".tab-row a").click();
  await page.waitForFunction(() =>
    document.querySelector("#summary")?.textContent?.startsWith("0 saved"),
  );
  const restored = await worker.evaluate(async () =>
    chrome.tabs.query({ url: "https://example.com/?capture-a" }),
  );
  assert.equal(restored.length, 1);
  assert.equal(restored[0].windowId, currentWindow);
  await page.locator("#transfer-open").click();
  await page
    .locator("#import-text")
    .fill(
      "https://example.com/a | Alpha\nhttps://example.org/b | Beta\n\nhttps://example.net/c | Gamma",
    );
  await page.locator("#import").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#import-result")?.textContent ===
      "Imported 3 tabs in 2 groups.",
  );
  await page.locator("#transfer .close").click();
  await page.locator("#search").fill("Beta");
  assert.equal(await page.locator(".tab-row").count(), 1);
  await page.locator("#search").fill("");
  const alphaGroup = page
    .locator(".group")
    .filter({ has: page.getByRole("link", { name: "Alpha", exact: true }) });
  await alphaGroup.getByRole("button", { name: "Lock", exact: true }).click();
  await alphaGroup
    .getByRole("button", { name: "Unlock", exact: true })
    .waitFor();
  const lockedId = await alphaGroup.getAttribute("data-group");
  assert.ok(lockedId);
  await invoke({ type: "restore", groupId: lockedId });
  assert.equal(
    (await invoke({ type: "state" })).groups.find((g) => g.id === lockedId)!
      .tabs.length,
    2,
  );
  await invoke({ type: "delete", groupId: lockedId });
  assert.equal(
    (await invoke({ type: "state" })).groups.find((g) => g.id === lockedId)!
      .tabs.length,
    2,
  );
  await alphaGroup.getByRole("button", { name: "Unlock", exact: true }).click();
  await alphaGroup.getByRole("button", { name: "Lock", exact: true }).waitFor();
  await alphaGroup
    .getByRole("button", { name: "Select all", exact: true })
    .click();
  await page.locator("#restore-selected").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".tab-row").length === 1,
  );
  state = await invoke({ type: "state" });
  assert.equal(state.groups[0].tabs[0].title, "Gamma");
  await page
    .locator(".group")
    .getByRole("button", { name: "Delete all", exact: true })
    .click();
  await page.locator("#prompt-form button[type=submit]").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".tab-row").length === 0,
  );
  await page.locator("#undo").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".tab-row").length === 1,
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".tab-row").length === 1,
  );
  await page.locator("#settings-open").click();
  await page.locator("[data-setting=theme]").selectOption("dark");
  await page.locator("#settings-save").click();
  await page.waitForFunction(() => document.body.classList.contains("dark"));
  await page.locator("#transfer-open").click();
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#export-json").click();
  const download = await downloadEvent;
  await download.saveAs(path.join(artifactDir, "synthetic-backup.json"));
  const backup = parseImport(
    await Bun.file(path.join(artifactDir, "synthetic-backup.json")).text(),
  );
  assert.equal(backup[0].tabs[0].title, "Gamma");
  await page.locator("#transfer .close").click();
  await page.screenshot({ path: path.join(artifactDir, "desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: path.join(artifactDir, "mobile.png") });
  const windows = await worker.evaluate(async () => chrome.windows.getAll());
  assert.equal(windows.length, 2);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Helium UI capture, pinned exclusion, window isolation, single/selected restore, import, search, lock, delete/undo, persistence, settings, backup, responsive layout; no page errors.",
  );
} finally {
  await context.close();
}
