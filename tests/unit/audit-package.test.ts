import { expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import { auditPackage, readZip } from "../../scripts/audit-package.ts";
import { packageFiles } from "../../scripts/package-files.ts";

interface FakeEntry {
  name: string;
  data?: string | Uint8Array;
  extra?: Uint8Array;
}

// Writes a minimal deflate ZIP with optional extra fields and comment.
function zip(files: FakeEntry[], comment = "") {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const { name, data = "", extra = new Uint8Array() } of files) {
    const raw = typeof data === "string" ? encoder.encode(data) : data;
    const packed = new Uint8Array(deflateRawSync(raw));
    const nameBytes = encoder.encode(name);
    const local = new Uint8Array(30 + nameBytes.length + extra.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 8, true);
    lv.setUint32(14, Bun.hash.crc32(raw), true);
    lv.setUint32(18, packed.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, extra.length, true);
    local.set(nameBytes, 30);
    local.set(extra, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length + extra.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(16, Bun.hash.crc32(raw), true);
    cv.setUint32(20, packed.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, extra.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    central.set(extra, 46 + nameBytes.length);
    locals.push(local, packed);
    centrals.push(central);
    offset += local.length + packed.length;
  }
  const commentBytes = encoder.encode(comment);
  const end = new Uint8Array(22 + commentBytes.length);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(
    12,
    centrals.reduce((sum, part) => sum + part.length, 0),
    true,
  );
  ev.setUint32(16, offset, true);
  ev.setUint16(20, commentBytes.length, true);
  end.set(commentBytes, 22);
  return new Uint8Array(Buffer.concat([...locals, ...centrals, end]));
}

const manifest = JSON.stringify({ manifest_version: 3, version: "1.2.3" });
function cleanPackage(overrides: Record<string, string | Uint8Array> = {}) {
  return packageFiles.map((name) => ({
    name,
    data: overrides[name] ?? (name === "manifest.json" ? manifest : "ok"),
  }));
}

test("a clean package passes and reads back exactly", () => {
  const entries = readZip(zip([{ name: "icons/" }, ...cleanPackage()]));
  expect(entries.map((entry) => entry.name)).toEqual(packageFiles);
  expect(
    auditPackage(entries, { version: "1.2.3", identity: ["someone"] }),
  ).toEqual([]);
});

test("ZIP metadata that can carry machine details is rejected", () => {
  expect(() => readZip(zip(cleanPackage(), "built on my laptop"))).toThrow(
    "ZIP has a comment",
  );
  // Info-ZIP Unix extra field with owner IDs.
  const extra = new Uint8Array([0x75, 0x78, 0x0b, 0x00, 1, 4, 0xe8, 3, 0, 0]);
  expect(() =>
    readZip(zip([{ name: "manifest.json", data: manifest, extra }])),
  ).toThrow("extra fields");
  for (const name of ["/etc/passwd", "../outside.js", "icons\\16.png"])
    expect(() => readZip(zip([{ name }]))).toThrow("unsafe path");
});

test("missing, extra, and source map files are reported", () => {
  const entries = readZip(
    zip([
      ...cleanPackage().filter((entry) => entry.name !== "icons/16.png"),
      { name: "manager/manage.js.map", data: "{}" },
    ]),
  );
  expect(auditPackage(entries)).toEqual([
    "Missing icons/16.png",
    "Unexpected manager/manage.js.map",
  ]);
});

test("personal paths, emails, keys, and local identity strings are found", () => {
  const cases: [string, string][] = [
    [String.raw`// C:\Users\someone\project\x.ts`, "a Windows path"],
    ["// c:/users/someone/x.ts", "a Windows path"],
    ["// /home/someone/project/x.ts", "an absolute path"],
    ["// /Users/someone/x.ts", "an absolute path"],
    ["//# sourceMappingURL=manage.js.map", "a source map reference"],
    ["const owner = 'someone@example.com';", "an email address"],
    ["-----BEGIN OPENSSH PRIVATE KEY-----", "a private key"],
    ["const host = 'DESKTOP-ABC123';", "a local identity string"],
  ];
  for (const [text, label] of cases)
    expect(
      auditPackage(readZip(zip(cleanPackage({ "manager/manage.js": text }))), {
        identity: ["desktop-abc123"],
      }),
    ).toEqual([`manager/manage.js contains ${label}`]);
  // URLs and the public project link are not paths or identities.
  expect(
    auditPackage(
      readZip(
        zip(
          cleanPackage({
            "manager/manage.html":
              '<a href="https://example.com/home/x">x</a><a href="https://github.com/Subhransu-De/TabTuck">y</a>',
          }),
        ),
      ),
      { identity: ["subhransu-de"] },
    ),
  ).toEqual([]);
});

test("PNG text metadata is reported", () => {
  const chunk = (type: string, data: string) => {
    const bytes = new Uint8Array(12 + data.length);
    new DataView(bytes.buffer).setUint32(0, data.length);
    bytes.set(new TextEncoder().encode(type + data), 4);
    return bytes;
  };
  const png = new Uint8Array(
    Buffer.concat([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", "x".repeat(13)),
      chunk("tEXt", "Author\0someone"),
      chunk("IEND", ""),
    ]),
  );
  expect(
    auditPackage(readZip(zip(cleanPackage({ "icons/48.png": png })))),
  ).toEqual(["icons/48.png contains PNG tEXt metadata"]);
});

test("the manifest must match the release version and leave store fields alone", () => {
  const entries = readZip(
    zip(
      cleanPackage({
        "manifest.json": JSON.stringify({
          manifest_version: 2,
          version: "1.2.3",
          key: "x",
          update_url: "https://example.com/updates.xml",
        }),
      }),
    ),
  );
  expect(auditPackage(entries, { version: "1.2.4" })).toEqual([
    "manifest.json must use Manifest V3",
    "manifest.json sets key",
    "manifest.json sets update_url",
    "manifest.json version 1.2.3 does not match 1.2.4",
  ]);
});
