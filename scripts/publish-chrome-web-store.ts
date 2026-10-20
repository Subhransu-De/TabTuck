import { readFile } from "node:fs/promises";

// Chrome Web Store API v2:
// https://developer.chrome.com/docs/webstore/api/reference/rest
const api = "https://chromewebstore.googleapis.com";
const publishTypes = ["DEFAULT_PUBLISH", "STAGED_PUBLISH"];
const submittedStates = [
  "PENDING_REVIEW",
  "STAGED",
  "PUBLISHED",
  "PUBLISHED_TO_TESTERS",
];

export interface PublishOptions {
  token: string;
  publisherId: string;
  extensionId: string;
  zip: Uint8Array<ArrayBuffer>;
  version: string;
  publishType?: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

function field(value: unknown, key: string) {
  return typeof value === "object" && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

// Uploads the package to the existing store item, waits for processing, then
// submits it for review. The item must already exist in the dashboard.
export async function publish(options: PublishOptions) {
  const {
    token,
    publisherId,
    extensionId,
    zip,
    version,
    publishType = "DEFAULT_PUBLISH",
    fetch: send = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log = console.log,
  } = options;
  if (!publishTypes.includes(publishType))
    throw new Error(`Unknown publish type ${publishType}`);
  const item = `publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(extensionId)}`;
  const headers = { Authorization: `Bearer ${token}` };
  async function call(url: string, init: RequestInit) {
    const response = await send(url, {
      ...init,
      headers: { ...headers, ...init.headers },
    });
    const text = await response.text();
    if (!response.ok)
      throw new Error(
        `${init.method} ${url} failed (${response.status}): ${text}`,
      );
    return text ? (JSON.parse(text) as unknown) : {};
  }

  const status = () => call(`${api}/v2/${item}:fetchStatus`, { method: "GET" });
  // The state of the submitted or published revision that has this version.
  function stateOf(current: unknown) {
    for (const key of [
      "submittedItemRevisionStatus",
      "publishedItemRevisionStatus",
    ]) {
      const revision = field(current, key);
      const channels = field(revision, "distributionChannels");
      const state = field(revision, "state");
      if (
        Array.isArray(channels) &&
        channels.some((channel) => field(channel, "crxVersion") === version) &&
        typeof state === "string" &&
        submittedStates.includes(state)
      )
        return state;
    }
  }

  // A rerun after a successful submission has nothing left to do.
  const existing = stateOf(await status());
  if (existing) {
    log(`Version ${version} is already submitted: ${existing}.`);
    return existing;
  }

  let uploadError: unknown;
  let uploaded: unknown;
  try {
    const upload = await call(`${api}/upload/v2/${item}:upload`, {
      method: "POST",
      headers: { "Content-Type": "application/zip" },
      body: zip,
    });
    let state = field(upload, "uploadState");
    for (let attempt = 0; state === "IN_PROGRESS" && attempt < 30; attempt++) {
      await sleep(10_000);
      state = field(await status(), "lastAsyncUploadState");
    }
    if (state !== "SUCCEEDED")
      throw new Error(`Package upload ended in state ${String(state)}`);
    uploaded = field(upload, "crxVersion");
  } catch (error) {
    // The store rejects a second upload of the same version. When an earlier
    // run uploaded this version but failed to submit it, submit that draft and
    // confirm its version below.
    uploadError = error;
    log(
      `Upload failed; submitting the draft already in the store if it is version ${version}.`,
    );
  }
  // Never submit a draft that holds a different version.
  if (uploaded !== undefined && uploaded !== version)
    throw new Error(
      `Store received version ${String(uploaded)}, not ${version}`,
    );
  if (uploadError === undefined)
    log(`Uploaded version ${version} to ${extensionId}.`);

  let result: unknown;
  try {
    result = await call(`${api}/v2/${item}:publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishType }),
    });
  } catch (error) {
    if (uploadError === undefined) throw error;
    throw new AggregateError(
      [uploadError, error],
      "Upload failed and no draft could be submitted",
      { cause: error },
    );
  }
  const submitted = field(result, "state");
  if (typeof submitted !== "string" || !submittedStates.includes(submitted))
    throw new Error(`Publish request ended in state ${String(submitted)}`);
  if (uploadError !== undefined && !stateOf(await status())) {
    await call(`${api}/v2/${item}:cancelSubmission`, { method: "POST" });
    throw uploadError;
  }
  const warnings = field(result, "warningInfo");
  if (warnings !== undefined)
    log(`Store warnings: ${JSON.stringify(warnings)}`);
  log(`Submitted version ${version}: ${submitted}.`);
  return submitted;
}

if (import.meta.main) {
  const [file, version] = process.argv.slice(2);
  const env = process.env;
  const missing = [
    "CWS_ACCESS_TOKEN",
    "CWS_PUBLISHER_ID",
    "CWS_EXTENSION_ID",
  ].filter((name) => !env[name]);
  if (!file || !version || missing.length) {
    console.error(
      "Usage: bun scripts/publish-chrome-web-store.ts <package.zip> <version>",
    );
    if (missing.length) console.error(`Missing ${missing.join(", ")}`);
    process.exit(2);
  }
  await publish({
    token: env.CWS_ACCESS_TOKEN ?? "",
    publisherId: env.CWS_PUBLISHER_ID ?? "",
    extensionId: env.CWS_EXTENSION_ID ?? "",
    publishType: env.CWS_PUBLISH_TYPE || undefined,
    zip: new Uint8Array(await readFile(file)),
    version,
  });
}
