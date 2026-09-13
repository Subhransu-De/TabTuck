import { chromium } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";
const dir = process.env.TABTUCK_TEST_DIR;
if (!dir || !process.env.HELIUM_EXECUTABLE)
  throw new Error(
    "Set TABTUCK_TEST_DIR and HELIUM_EXECUTABLE for an isolated test profile.",
  );
const extension = process.env.TABTUCK_EXTENSION || import.meta.dirname;
const baseline = process.env.TABTUCK_BASELINE === "1";
const context = await chromium.launchPersistentContext(
  path.join(dir, "profile"),
  {
    executablePath: process.env.HELIUM_EXECUTABLE,
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  },
);
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${new URL(worker.url()).host}/manage.html`,
  );
  await page.waitForFunction(() =>
    document.querySelector("#summary").textContent.includes("saved"),
  );
  const call = (message) =>
    page.evaluate(async (message) => {
      const response = await chrome.runtime.sendMessage(message);
      if (!response.ok) throw new Error(response.error);
      return response.result;
    }, message);
  await call({
    type: "import",
    text: "https://example.com/first | First\nhttps://example.org/second | Second\nhttps://example.net/third | Third",
  });
  await page.waitForFunction(
    () => document.querySelectorAll(".tab-row").length === 3,
  );
  // Hold the browser reply indefinitely, rather than relying on guessed latency.
  await page.evaluate(() => {
    const native = chrome.runtime.sendMessage.bind(chrome.runtime);
    window.restoreRequests = [];
    chrome.runtime.sendMessage = (message) => {
      if (message.type !== "restore") return native(message);
      return new Promise((resolve, reject) =>
        window.restoreRequests.push({
          message,
          resolve,
          reject,
          succeed: async () => resolve(await native(message)),
        }),
      );
    };
  });
  const evidence = await page.evaluate(() => {
    const link = document.querySelector(".tab-row a");
    const start = performance.now();
    link.click();
    const removed = !link.isConnected;
    const remaining = document.querySelectorAll(".tab-row").length;
    link.click(); // A stale second click must not send a second request.
    return {
      removedBeforeReply: removed,
      remainingBeforeReply: remaining,
      clickHandlerMs: performance.now() - start,
      requests: window.restoreRequests.length,
    };
  });
  console.log(
    JSON.stringify({ mode: baseline ? "baseline" : "fixed", ...evidence }),
  );
  if (baseline) {
    assert.equal(evidence.remainingBeforeReply, 3);
  } else {
    assert.equal(evidence.remainingBeforeReply, 2);
    assert.equal(evidence.removedBeforeReply, true);
    assert.equal(evidence.requests, 1);
    // A physical double-click must not restore the newly shifted row.
    await page.evaluate(() =>
      document.querySelector(".tab-row a").dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          detail: 2,
        }),
      ),
    );
    assert.equal(await page.evaluate(() => window.restoreRequests.length), 1);
    // Separate clicks on other links should work while the first is pending.
    await page.locator(".tab-row a").first().click();
    assert.equal(await page.locator(".tab-row").count(), 1);
    assert.equal(await page.evaluate(() => window.restoreRequests.length), 2);
    // Unrelated storage events must not resurrect pending rows.
    const snapshot = await call({ type: "state" });
    await call({
      type: "update",
      groupId: snapshot.groups[0].id,
      patch: { starred: true },
    });
    assert.equal(await page.locator(".tab-row").count(), 1);
    await page.evaluate(() => window.restoreRequests[0].succeed());
    await page.evaluate(() =>
      window.restoreRequests[1].resolve({
        ok: true,
        result: { count: 0, failed: ["Second"] },
      }),
    );
    await page.waitForFunction(
      () => document.querySelectorAll(".tab-row").length === 2,
    );
    assert.deepEqual(await page.locator(".tab-row a").allTextContents(), [
      "Second",
      "Third",
    ]);
    const restored = await worker.evaluate(async () =>
      chrome.tabs.query({ url: "https://example.com/first" }),
    );
    assert.equal(restored.length, 1);
    assert.equal(
      restored[0].windowId,
      await page.evaluate(
        async () => (await chrome.tabs.getCurrent()).windowId,
      ),
    );
    await page.locator(".tab-row a").first().click();
    assert.equal(await page.locator(".tab-row").count(), 1);
    await page.evaluate(() =>
      window.restoreRequests[2].reject(
        new Error("Synthetic service worker failure"),
      ),
    );
    await page.waitForFunction(
      () => document.querySelectorAll(".tab-row").length === 2,
    );
    // Locked rows stay saved and reject repeated requests while opening.
    const state = await call({ type: "state" });
    await call({
      type: "update",
      groupId: state.groups[0].id,
      patch: { locked: true },
    });
    await page.evaluate(() => {
      const link = document.querySelector(".tab-row a");
      link.click();
      link.click();
    });
    assert.equal(await page.locator(".tab-row").count(), 2);
    assert.equal(await page.evaluate(() => window.restoreRequests.length), 4);
    await page.evaluate(() => window.restoreRequests[3].succeed());
    await page.waitForFunction(
      () => !document.querySelector('a[aria-busy="true"]'),
    );
    assert.equal(await page.locator(".tab-row").count(), 2);
    console.log(
      "PASS: immediate DOM removal before reply; duplicate protection; independent clicks; no resurrection on storage changes; partial failure and rejected-message rollback; locked links retained; same-window opening.",
    );
  }
} finally {
  await context.close();
}
