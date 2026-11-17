// The dev server: `bun run dev`, then open http://127.0.0.1:5178/ in any
// browser. It serves TabTuck's real manager page and background script as a
// normal web page, with dev/boot.ts supplying the extension APIs and a
// synthetic library. Edits rebuild only what changed; CSS edits swap the
// stylesheet without reloading.
import { cp, mkdir } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { entryPoints, staticFiles } from "../scripts/package-files.ts";
import { buildManager } from "../scripts/manager-build.ts";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "src");
const out = path.join(root, "dist", "TabTuck");
const manageHtml = path.join(out, "manager", "manage.html");
const port = Number(process.env.PORT) || 5178;

const run = async (cmd: string[]) => {
  const proc = Bun.spawn(cmd, { cwd: root, stdout: "ignore", stderr: "pipe" });
  if ((await proc.exited) === 0) return true;
  console.error(await new Response(proc.stderr).text());
  return false;
};
async function buildBackground() {
  const result = await Bun.build({
    entrypoints: entryPoints
      .filter((file) => !file.startsWith("manager/"))
      .map((file) => path.join(src, file)),
    root: src,
    outdir: out,
    target: "browser",
    format: "esm",
    naming: "[dir]/[name].[ext]",
  });
  if (!result.success)
    throw new AggregateError(result.logs, "Background build failed");
}
let bootScript = "";
async function buildBoot() {
  const result = await Bun.build({
    entrypoints: [path.join(import.meta.dirname, "boot.ts")],
    target: "browser",
    format: "iife",
  });
  if (!result.success)
    throw new AggregateError(result.logs, "Dev boot build failed");
  bootScript = await result.outputs[0].text();
}
const copyStatic = (files: string[]) =>
  Promise.all(
    files.map(async (file) => {
      await mkdir(path.dirname(path.join(out, file)), { recursive: true });
      await cp(path.join(src, file), path.join(out, file));
    }),
  );

// Which builds a changed file needs. Shared code feeds every bundle.
type Part = "background" | "manager" | "boot" | "static";
function partsFor(file: string): Part[] {
  const rel = path.relative(root, file).replaceAll("\\", "/");
  if (rel.startsWith("dev/")) return ["boot"];
  const inSrc = rel.replace(/^src\//, "");
  if (staticFiles.includes(inSrc)) return ["static"];
  if (inSrc.endsWith(".css")) return []; // Tailwind watches CSS itself.
  if (inSrc.startsWith("background/")) return ["background"];
  if (inSrc.startsWith("manager/")) return ["manager"];
  return ["background", "manager", "boot"];
}
async function rebuild(files: Set<string>) {
  const started = performance.now();
  const parts = new Set([...files].flatMap(partsFor));
  if (!parts.size) return false;
  try {
    await Promise.all([
      parts.has("static") &&
        copyStatic(staticFiles.filter((f) => files.has(path.join(src, f)))),
      parts.has("background") && buildBackground(),
      parts.has("manager") && buildManager(out, { production: false }),
      parts.has("boot") && buildBoot(),
    ]);
  } catch (error) {
    console.error(error instanceof AggregateError ? error.errors : error);
    return false;
  }
  console.log(
    `Rebuilt ${[...parts].join(", ")} in ${Math.round(performance.now() - started)} ms`,
  );
  return true;
}

// First a full build, then Tailwind in watch mode for the stylesheet. Its
// stdin stays open, so it stops when this server stops.
if (!(await run(["bun", "scripts/build.ts"]))) process.exit(1);
await buildBoot();
const tailwind = Bun.spawn(["bun", "run", "dev:css"], {
  cwd: root,
  stdin: "pipe",
  stdout: "ignore",
  stderr: "ignore",
});
process.on("exit", () => tailwind.kill());

const clients = new Set<ReadableStreamDefaultController<string>>();
const send = (event: "reload" | "css") => {
  for (const client of clients) client.enqueue(`event: ${event}\ndata: \n\n`);
};

const server = Bun.serve({
  port,
  // This machine only: the page holds whatever data you put in it.
  hostname: "127.0.0.1",
  idleTimeout: 0,
  async fetch(request) {
    const { pathname, search } = new URL(request.url);
    // The scenario and seed in the address carry over to the page.
    if (pathname === "/")
      return Response.redirect(`/manager/manage.html${search}`, 302);
    if (pathname === "/__dev/boot.js")
      return new Response(bootScript, {
        headers: {
          "content-type": "text/javascript",
          "cache-control": "no-store",
        },
      });
    if (pathname === "/__dev/events") {
      let self: ReadableStreamDefaultController<string>;
      return new Response(
        new ReadableStream<string>({
          start(controller) {
            self = controller;
            clients.add(controller);
            controller.enqueue(": connected\n\n");
          },
          cancel() {
            clients.delete(self);
          },
        }),
        {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
          },
        },
      );
    }
    let target: string;
    try {
      target = path.join(out, path.normalize(decodeURIComponent(pathname)));
      if (target.includes("\0")) throw new URIError("NUL in path");
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const file = Bun.file(target);
    if (
      !target.startsWith(out + path.sep) ||
      pathname.endsWith("/") ||
      !(await file.exists())
    )
      return new Response("Not found", { status: 404 });
    // Compared as resolved paths, so "/MANAGER/manage.html" or
    // "/manager//manage.html" get the dev boot too.
    if (path.relative(manageHtml, target) === "") {
      // The dev boot runs first, then the background script registers its
      // message listener, then the page's own module.
      const html = (await file.text()).replace(
        '<script type="module" src="manage.js"></script>',
        '<script src="/__dev/boot.js"></script>\n' +
          '    <script type="module" src="/background/background.js"></script>\n' +
          '    <script type="module" src="manage.js"></script>',
      );
      return new Response(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    return new Response(file, { headers: { "cache-control": "no-store" } });
  },
});

// Changes collect for a moment, then build together.
let pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let building = Promise.resolve();
for (const dir of [src, import.meta.dirname])
  watch(dir, { recursive: true }, (_event, name) => {
    if (!name) return;
    pending.add(path.join(dir, name));
    clearTimeout(timer);
    timer = setTimeout(() => {
      const files = pending;
      pending = new Set();
      // A failure is logged and the next change builds again.
      building = building
        .then(async () => {
          if (await rebuild(files)) send("reload");
        })
        .catch(console.error);
    }, 80);
  });
const css = path.join(out, "manager", "manage.css");
let cssTimer: ReturnType<typeof setTimeout> | undefined;
watch(path.dirname(css), (_event, name) => {
  if (name !== "manage.css") return;
  clearTimeout(cssTimer);
  cssTimer = setTimeout(() => send("css"), 50);
});

console.log(`TabTuck dev server: http://127.0.0.1:${server.port}/`);
console.log(
  "Pick data with ?scenario=typical|first-run|heavy|naming|bin-expiring|long-text&seed=1",
);
