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
  await page.waitForFunction(
    () =>
      document.querySelector(`[data-scope="all"] .count`)?.textContent === "0",
  );
  // Body text is Inter at 15px on a 22px line.
  assert.deepEqual(
    await page.evaluate(async () => {
      await document.fonts.ready;
      const style = getComputedStyle(document.body);
      return [
        style.fontSize,
        style.lineHeight,
        [...document.fonts].some(
          (face) =>
            face.family.replaceAll('"', "") === "Inter" &&
            face.status === "loaded",
        ),
      ];
    }),
    ["15px", "22px", true],
  );
  // First use: agree to the data notice before anything can be saved.
  await page.locator("#consent-agree").click();
  await page.locator("#consent").waitFor({ state: "hidden" });
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
  await page.waitForFunction(
    () =>
      document.querySelector(`[data-scope="all"] .count`)?.textContent === "0",
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
      "Imported 3 tabs in 2 collections.",
  );
  await page.locator("#transfer .close").click();
  await page.locator("#search").fill("Beta");
  // The list follows the search box a frame behind, so typing never waits.
  await page.waitForFunction(
    () => document.querySelectorAll(".tab-row").length === 1,
  );
  assert.equal(await page.locator(".tab-row").count(), 1);
  await page.locator("#search").fill("");
  await page.waitForFunction(
    () => document.querySelectorAll(".tab-row").length === 3,
  );
  // The list is plain tab rows: no batch headers and nothing to drag.
  const rows = page.locator(".tab-row");
  assert.equal(await rows.count(), 3);
  assert.equal(await page.locator("#groups .sep, #drop-zone").count(), 0);
  assert.equal(
    await page.$$eval(
      ".tab-row, .tab-row *",
      (els) => els.filter((e) => (e as HTMLElement).draggable).length,
    ),
    0,
  );
  // A click just beside the checkbox still selects the row.
  const box = (await rows.nth(0).locator("input").boundingBox())!;
  await page.mouse.click(box.x - 4, box.y + box.height / 2);
  assert.equal(await page.locator(".tab-row.selected").count(), 1);
  // Shift-clicking a row's empty space selects the range up to it.
  await rows
    .nth(2)
    .click({ position: { x: 300, y: 10 }, modifiers: ["Shift"] });
  assert.equal(await page.locator(".tab-row.selected").count(), 3);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".tab-row.selected").count(), 0);
  // Clearing drops the range anchor, so Shift-click selects one row.
  await rows
    .nth(1)
    .click({ position: { x: 300, y: 10 }, modifiers: ["Shift"] });
  assert.equal(await page.locator(".tab-row.selected").count(), 1);
  await page.keyboard.press("Escape");
  // A collection outside any folder has its own row in the sidebar. The Alpha
  // and Beta collection opens its details in the second column.
  const pair = (await invoke({ type: "state" })).groups.find(
    (g) => g.tabs.length === 2,
  )!;
  const alphaGroup = page.locator(
    `#navigation .row.collection[data-group="${pair.id}"]`,
  );
  await alphaGroup.click();
  // Escape in the restore menu closes the menu and leaves the selection.
  await page.locator("#select-all").check();
  await page.getByRole("button", { name: "More ways to restore" }).click();
  const restoreMenu = page.getByRole("menu", { name: "More ways to restore" });
  await restoreMenu.waitFor();
  await page.keyboard.press("Escape");
  await restoreMenu.waitFor({ state: "hidden" });
  assert.equal(await page.locator(".tab-row.selected").count(), 2);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".tab-row.selected").count(), 0);
  const details = page.locator("#scope-head");
  const lock = details.getByRole("switch", { name: "Locked", exact: true });
  await lock.click();
  await details
    .locator('[role="switch"][data-action="lock"][aria-checked="true"]')
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
  await lock.click();
  await details
    .locator('[role="switch"][data-action="lock"][aria-checked="false"]')
    .waitFor();
  await page.locator("#select-all").check();
  await page.locator("#restore-selected").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".tab-row").length === 1,
  );
  state = await invoke({ type: "state" });
  assert.equal(state.groups[0].tabs[0].title, "Gamma");
  // Deleting moves tabs to the bin at once; the toast and the toolbar both
  // offer Undo.
  await page.locator('#navigation [data-scope="recent"]').click();
  const deleteGamma = async () => {
    await page.locator("#select-all").check();
    await page.locator("#delete-selected").click();
    await page.waitForFunction(
      () => document.querySelectorAll(".tab-row").length === 0,
    );
  };
  await deleteGamma();
  assert.equal(
    await page.locator("#status-text").textContent(),
    "Moved 1 tab to the bin.",
  );
  await page.locator("#undo").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".tab-row").length === 1,
  );
  // The bin lists the deleted tab with its time left and puts it back.
  await deleteGamma();
  await page.locator('#navigation [data-scope="bin"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector(".tab-row .tab-left")?.textContent === "30d left",
  );
  await page.locator(".tab-row .bin-restore").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".tab-row").length === 0,
  );
  assert.equal((await invoke({ type: "state" })).trash?.length, 0);
  await page.locator('#navigation [data-scope="recent"]').click();
  await page.waitForFunction(
    () => document.querySelectorAll(".tab-row").length === 1,
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".tab-row").length === 1,
  );
  await page.locator("#settings-open").click();
  await page.locator("#settings-save").click();
  await page.locator("#theme-toggle").click();
  await page.waitForFunction(() => document.body.classList.contains("dark"));
  await page.locator("#transfer-open").click();
  await page.locator("#transfer-tab-export").click();
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#export-json").click();
  const download = await downloadEvent;
  await download.saveAs(path.join(artifactDir, "synthetic-backup.json"));
  const backup = parseImport(
    await Bun.file(path.join(artifactDir, "synthetic-backup.json")).text(),
  );
  assert.equal(backup[0].tabs[0].title, "Gamma");
  await page.locator("#transfer .close").click();
  // A long list mounts its rows wherever it is scrolled to.
  await invoke({
    type: "import",
    text: Array.from(
      { length: 300 },
      (_, i) => `https://example.com/long-${i} | Long ${i}`,
    ).join("\n"),
  });
  await page.locator('#navigation [data-scope="all"]').click();
  await page.waitForFunction(
    () => document.querySelectorAll(".tab-row").length > 1,
  );
  await page.locator("#groups").evaluate((list) => {
    list.scrollTop = list.scrollHeight / 2;
  });
  await page.waitForFunction(() => {
    const box = document.querySelector("#groups")!.getBoundingClientRect();
    return !!document
      .elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      ?.closest(".tab-row");
  });
  await page.screenshot({ path: path.join(artifactDir, "desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: path.join(artifactDir, "mobile.png") });
  // On a short screen a dialog stays on screen and scrolls.
  await page.setViewportSize({ width: 390, height: 300 });
  await page.locator("#transfer-open").click();
  assert.ok(
    await page.locator("#transfer").evaluate((popup) => {
      const box = popup.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= innerHeight;
    }),
  );
  await page.locator("#transfer .close").click();
  const windows = await worker.evaluate(async () => chrome.windows.getAll());
  assert.equal(windows.length, 2);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Helium UI capture, pinned exclusion, window isolation, single/selected restore, import, search, lock, delete/undo, persistence, settings, backup, long-list scrolling, responsive layout; no page errors.",
  );
} finally {
  await context.close();
}
