import { expect, test } from "bun:test";
import { publish } from "../../scripts/publish-chrome-web-store.ts";

const item =
  "https://chromewebstore.googleapis.com/v2/publishers/pub/items/ext";
const upload =
  "https://chromewebstore.googleapis.com/upload/v2/publishers/pub/items/ext:upload";
const status = `${item}:fetchStatus`;

function fakeStore(responses: Record<string, unknown[]>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const send = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses[url]?.shift();
    if (next === undefined) throw new Error(`Unexpected request ${url}`);
    return next instanceof Response ? next : Response.json(next);
  }) as unknown as typeof fetch;
  return { calls, send, urls: () => calls.map((call) => call.url) };
}

function submitted(version: string, state = "PENDING_REVIEW") {
  return {
    submittedItemRevisionStatus: {
      state,
      distributionChannels: [{ deployPercentage: 100, crxVersion: version }],
    },
  };
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
    [status]: [{}],
    [upload]: [{ uploadState: "SUCCEEDED", crxVersion: "1.2.3" }],
    [`${item}:publish`]: [{ state: "PENDING_REVIEW" }],
  });
  expect(await publish({ ...base, fetch: store.send })).toBe("PENDING_REVIEW");
  expect(store.calls.map((call) => [call.init.method, call.url])).toEqual([
    ["GET", status],
    ["POST", upload],
    ["POST", `${item}:publish`],
  ]);
  expect(store.calls[1]?.init.headers).toMatchObject({
    Authorization: "Bearer token",
  });
  expect(store.calls[2]?.init.body).toBe(
    JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
  );
});

test("waits for an upload that is still processing", async () => {
  const store = fakeStore({
    [status]: [
      {},
      { lastAsyncUploadState: "IN_PROGRESS" },
      { lastAsyncUploadState: "SUCCEEDED" },
    ],
    [upload]: [{ uploadState: "IN_PROGRESS" }],
    [`${item}:publish`]: [{ state: "STAGED" }],
  });
  expect(
    await publish({
      ...base,
      publishType: "STAGED_PUBLISH",
      fetch: store.send,
    }),
  ).toBe("STAGED");
  expect(store.calls).toHaveLength(5);
});

test("a rerun after a successful submission changes nothing", async () => {
  const store = fakeStore({ [status]: [submitted("1.2.3")] });
  expect(await publish({ ...base, fetch: store.send })).toBe("PENDING_REVIEW");
  expect(store.urls()).toEqual([status]);
});

test("a rerun submits the draft an earlier run uploaded but did not submit", async () => {
  const store = fakeStore({
    [status]: [{}, submitted("1.2.3")],
    [upload]: [
      new Response('{"error":"version must be increased"}', { status: 400 }),
    ],
    [`${item}:publish`]: [{ state: "PENDING_REVIEW" }],
  });
  expect(await publish({ ...base, fetch: store.send })).toBe("PENDING_REVIEW");
  expect(store.urls()).toEqual([status, upload, `${item}:publish`, status]);
});

test("a submitted draft with another version is cancelled", async () => {
  const store = fakeStore({
    [status]: [{}, submitted("1.2.2")],
    [upload]: [{ uploadState: "FAILED" }],
    [`${item}:publish`]: [{ state: "PENDING_REVIEW" }],
    [`${item}:cancelSubmission`]: [{}],
  });
  await expect(publish({ ...base, fetch: store.send })).rejects.toThrow(
    "Package upload ended in state FAILED",
  );
  expect(store.urls().at(-1)).toBe(`${item}:cancelSubmission`);
});

test("never submits when the store received a different version", async () => {
  const store = fakeStore({
    [status]: [{}],
    [upload]: [{ uploadState: "SUCCEEDED", crxVersion: "1.2.2" }],
  });
  await expect(publish({ ...base, fetch: store.send })).rejects.toThrow(
    "Store received version 1.2.2, not 1.2.3",
  );
  expect(store.urls()).toEqual([status, upload]);
});

test("reports both errors when there is no draft to submit", async () => {
  const store = fakeStore({
    [status]: [{}],
    [upload]: [new Response('{"error":"denied"}', { status: 403 })],
    [`${item}:publish`]: [
      new Response('{"error":"no draft"}', { status: 400 }),
    ],
  });
  const error = await publish({ ...base, fetch: store.send }).catch(
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AggregateError);
  expect(String((error as AggregateError).errors[0])).toContain("failed (403)");
});

test("rejects unexpected publish results and unknown publish types", async () => {
  await expect(
    publish({
      ...base,
      fetch: fakeStore({
        [status]: [{}],
        [upload]: [{ uploadState: "SUCCEEDED" }],
        [`${item}:publish`]: [{ state: "REJECTED" }],
      }).send,
    }),
  ).rejects.toThrow("Publish request ended in state REJECTED");
  await expect(publish({ ...base, publishType: "NOW" })).rejects.toThrow(
    "Unknown publish type NOW",
  );
});
