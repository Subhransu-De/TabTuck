// Dev server: builds the extension, serves the manager page on localhost with
// a stand-in for the extension APIs, and reloads the page after each rebuild.
// The real background script runs inside the page, so saving, restoring and
// storage behave as in the browser, against a fake window of demo tabs.
import { watch } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "dist", "TabTuck");
const shim = path.join(import.meta.dirname, "dev", "chrome-shim.js");
const port = Number(process.env.PORT) || 5178;

async function build() {
  const started = performance.now();
  for (const cmd of [
    ["bun", "scripts/build.ts"],
    ["bun", "run", "build:css"],
  ]) {
    const proc = Bun.spawn(cmd, {
      cwd: root,
      stdout: "ignore",
      stderr: "pipe",
    });
    if ((await proc.exited) !== 0) {
      console.error(await new Response(proc.stderr).text());
      return false;
    }
  }
  console.log(`Built in ${Math.round(performance.now() - started)} ms`);
  return true;
}

const clients = new Set<ReadableStreamDefaultController<string>>();
function reload() {
  for (const client of clients) client.enqueue("event: reload\ndata: \n\n");
}

if (!(await build())) process.exit(1);

const server = Bun.serve({
  port,
  idleTimeout: 0,
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/") return Response.redirect("/manager/manage.html", 302);
    if (pathname === "/__dev/chrome-shim.js")
      return new Response(Bun.file(shim));
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
    const file = Bun.file(path.join(out, path.normalize(pathname)));
    if (
      !path.join(out, path.normalize(pathname)).startsWith(out) ||
      !(await file.exists())
    )
      return new Response("Not found", { status: 404 });
    if (pathname === "/manager/manage.html") {
      // The shim runs first; the background module registers its message
      // listener before the page's own module runs.
      const html = (await file.text()).replace(
        '<script type="module" src="manage.js"></script>',
        '<script src="/__dev/chrome-shim.js"></script>\n' +
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

let timer: ReturnType<typeof setTimeout> | undefined;
let building = Promise.resolve();
for (const dir of ["src", "scripts/dev"])
  watch(path.join(root, dir), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      building = building.then(async () => {
        if (await build()) reload();
      });
    }, 150);
  });

console.log(`TabTuck dev server: http://localhost:${server.port}/`);
