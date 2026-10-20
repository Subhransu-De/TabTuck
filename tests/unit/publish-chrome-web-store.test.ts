import { expect, test } from "bun:test";
import { publish } from "../../scripts/publish-chrome-web-store.ts";

const item =
  "https://chromewebstore.googleapis.com/v2/publishers/pub/items/ext";
const upload =
  "https://chromewebstore.googleapis.com/upload/v2/publishers/pub/items/ext:upload";

function fakeStore(responses: Record<string, unknown[]>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const send = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses[url]?.shift();
    if (next === undefined) throw new Error(`Unexpected request ${url}`);
    return next instanceof Response ? next : Response.json(next);
  }) as unknown as typeof fetch;
  return { calls, send };
}

const base = {
  token: "token",
  publisherId: "pub",
  extensionId: "ext",
  zip: new Uint8Array([1, 2, 3]),
  version: "1.2.3",
  sleep: async () => {},
  log: () => {},
};

test("uploads the package, then submits it for review", async () => {
  const store = fakeStore({
    [upload]: [{ uploadState: "SUCCEEDED", crxVersion: "1.2.3" }],
    [`${item}:publish`]: [{ state: "PENDING_REVIEW" }],
  });
  expect(await publish({ ...base, fetch: store.send })).toBe("PENDING_REVIEW");
  expect(store.calls.map((call) => [call.init.method, call.url])).toEqual([
    ["POST", upload],
    ["POST", `${item}:publish`],
  ]);
  expect(store.calls[0]?.init.headers).toMatchObject({
    Authorization: "Bearer token",
  });
  expect(store.calls[1]?.init.body).toBe(
    JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
  );
});

test("waits for an upload that is still processing", async () => {
  const store = fakeStore({
    [upload]: [{ uploadState: "IN_PROGRESS" }],
    [`${item}:fetchStatus`]: [
      { lastAsyncUploadState: "IN_PROGRESS" },
      { lastAsyncUploadState: "SUCCEEDED" },
    ],
    [`${item}:publish`]: [{ state: "STAGED" }],
  });
  expect(
    await publish({
      ...base,
      publishType: "STAGED_PUBLISH",
      fetch: store.send,
    }),
  ).toBe("STAGED");
  expect(store.calls).toHaveLength(4);
});

test("never submits a failed upload or a different version", async () => {
  await expect(
    publish({
      ...base,
      fetch: fakeStore({ [upload]: [{ uploadState: "FAILED" }] }).send,
    }),
  ).rejects.toThrow("Package upload ended in state FAILED");
  await expect(
    publish({
      ...base,
      fetch: fakeStore({
        [upload]: [{ uploadState: "SUCCEEDED", crxVersion: "1.2.2" }],
      }).send,
    }),
  ).rejects.toThrow("Store received version 1.2.2, not 1.2.3");
  await expect(
    publish({
      ...base,
      fetch: fakeStore({
        [upload]: [new Response('{"error":"denied"}', { status: 403 })],
      }).send,
    }),
  ).rejects.toThrow("failed (403)");
});

test("rejects unexpected publish results and unknown publish types", async () => {
  await expect(
    publish({
      ...base,
      fetch: fakeStore({
        [upload]: [{ uploadState: "SUCCEEDED" }],
        [`${item}:publish`]: [{ state: "REJECTED" }],
      }).send,
    }),
  ).rejects.toThrow("Publish request ended in state REJECTED");
  await expect(publish({ ...base, publishType: "NOW" })).rejects.toThrow(
    "Unknown publish type NOW",
  );
});
