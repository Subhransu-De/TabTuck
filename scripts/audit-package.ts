import { readFile } from "node:fs/promises";
import os from "node:os";
import { inflateRawSync } from "node:zlib";
import { packageFiles } from "./package-files.ts";

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

// Reads a ZIP into memory and rejects anything that can carry data outside
// the files themselves: archive or entry comments, extra fields (which can
// hold owner IDs and file system timestamps), encryption, and unsafe paths.
export function readZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let at = bytes.length - 22; at >= 0; at--)
    if (view.getUint32(at, true) === 0x06054b50) {
      end = at;
      break;
    }
  if (end < 0) throw new Error("Not a ZIP archive");
  if (view.getUint16(end + 20, true)) throw new Error("ZIP has a comment");
  const count = view.getUint16(end + 10, true);
  if (view.getUint16(end + 4, true) || count !== view.getUint16(end + 8, true))
    throw new Error("Multi-part ZIP archives are not supported");
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let at = view.getUint32(end + 16, true);
  for (let index = 0; index < count; index++) {
    if (view.getUint32(at, true) !== 0x02014b50)
      throw new Error("Corrupt ZIP central directory");
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    if (flags & 1) throw new Error(`${name} is encrypted`);
    if (extraLength || commentLength)
      throw new Error(`${name} has ZIP extra fields or a comment`);
    if (
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").includes("..")
    )
      throw new Error(`${name} has an unsafe path`);
    if (name.endsWith("/")) continue;
    if (view.getUint32(local, true) !== 0x04034b50)
      throw new Error(`${name} has a corrupt local header`);
    if (view.getUint16(local + 28, true))
      throw new Error(`${name} has ZIP extra fields`);
    const start = local + 30 + view.getUint16(local + 26, true);
    const stored = bytes.subarray(start, start + size);
    if (method !== 0 && method !== 8)
      throw new Error(`${name} uses unsupported compression`);
    const data = method === 8 ? new Uint8Array(inflateRawSync(stored)) : stored;
    if (Bun.hash.crc32(data) !== crc)
      throw new Error(`${name} fails its checksum`);
    if (entries.some((entry) => entry.name === name))
      throw new Error(`${name} appears twice`);
    entries.push({ name, data });
  }
  return entries;
}

// PNG text and EXIF chunks can name the author, software, or source path.
function pngMetadata(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const found: string[] = [];
  for (let at = 8; at + 8 <= data.length;) {
    const type = String.fromCharCode(...data.subarray(at + 4, at + 8));
    if (["tEXt", "zTXt", "iTXt", "eXIf"].includes(type)) found.push(type);
    at += 12 + view.getUint32(at);
  }
  return found;
}

const textFile = /\.(?:js|css|html|json|svg|txt)$/;
const patterns: [RegExp, string][] = [
  [/sourceMappingURL/, "a source map reference"],
  [
    /(?<![\w])[A-Za-z]:[\\/]+(?:Users|Documents and Settings|Windows|Program Files)/i,
    "a Windows path",
  ],
  [/(?<![\w.])\/(?:Users|home|root|private\/var|tmp)\//, "an absolute path"],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/, "an email address"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
];
// Public project links may name the repository owner. Remove them before
// looking for the local user name.
const publicUrls = ["https://github.com/Subhransu-De/TabTuck"];

export interface AuditOptions {
  version?: string;
  // Words that identify the building machine, such as the user or host name.
  identity?: string[];
}

export function auditPackage(entries: ZipEntry[], options: AuditOptions = {}) {
  const problems: string[] = [];
  const names = entries.map((entry) => entry.name);
  for (const file of packageFiles)
    if (!names.includes(file)) problems.push(`Missing ${file}`);
  for (const name of names)
    if (!packageFiles.includes(name)) problems.push(`Unexpected ${name}`);
  const identity = (options.identity ?? [])
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length >= 3);
  for (const { name, data } of entries) {
    if (name.endsWith(".png"))
      for (const chunk of pngMetadata(data))
        problems.push(`${name} contains PNG ${chunk} metadata`);
    if (!textFile.test(name)) continue;
    let text = new TextDecoder().decode(data);
    for (const [pattern, label] of patterns)
      if (pattern.test(text)) problems.push(`${name} contains ${label}`);
    for (const url of publicUrls) text = text.replaceAll(url, "");
    const lower = text.toLowerCase();
    for (const word of identity)
      if (lower.includes(word))
        problems.push(`${name} contains a local identity string`);
  }
  const manifestEntry = entries.find((entry) => entry.name === "manifest.json");
  if (manifestEntry) {
    const manifest: unknown = JSON.parse(
      new TextDecoder().decode(manifestEntry.data),
    );
    if (typeof manifest !== "object" || manifest === null)
      problems.push("manifest.json is not an object");
    else {
      if (!("manifest_version" in manifest) || manifest.manifest_version !== 3)
        problems.push("manifest.json must use Manifest V3");
      // The store assigns the key and the update URL.
      for (const field of ["key", "update_url"])
        if (field in manifest) problems.push(`manifest.json sets ${field}`);
      const version = "version" in manifest ? manifest.version : undefined;
      if (options.version !== undefined && version !== options.version)
        problems.push(
          `manifest.json version ${String(version)} does not match ${options.version}`,
        );
    }
  }
  return problems;
}

if (import.meta.main) {
  const [file, flag, version] = process.argv.slice(2);
  if (!file || (flag !== undefined && (flag !== "--version" || !version))) {
    console.error(
      "Usage: bun scripts/audit-package.ts <package.zip> [--version X.Y.Z]",
    );
    process.exit(2);
  }
  const packageJson: unknown = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const expected =
    version ??
    (typeof packageJson === "object" &&
    packageJson !== null &&
    "version" in packageJson &&
    typeof packageJson.version === "string"
      ? packageJson.version
      : undefined);
  const user = os.userInfo();
  let problems: string[];
  try {
    problems = auditPackage(readZip(await readFile(file)), {
      version: expected,
      identity: [user.username, os.hostname(), user.homedir],
    });
  } catch (error) {
    problems = [error instanceof Error ? error.message : String(error)];
  }
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(
    `Package audit passed: ${packageFiles.length} expected files, version ${expected}, no local paths, identities, or metadata.`,
  );
}
