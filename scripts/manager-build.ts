// Builds the manager page as two bundles: manager/manage.js with React and
// the page, and manager/dialogs.js, which the page loads the first time a
// dialog opens. The dialogs bundle takes React from manage.js, which exports
// it, so the page runs one copy of React and both files keep fixed names.
import path from "node:path";
import type { BunPlugin } from "bun";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "src");
// The React modules manage.tsx exports, by the name it exports each under.
const shared: Record<string, string> = {
  react: "R",
  "react-dom": "RD",
  "react/jsx-runtime": "J",
  // Development builds compile JSX for this runtime instead.
  "react/jsx-dev-runtime": "JD",
};
// Modules that hold page state; the dialogs bundle gets those through props.
const stateful = /(?:^|\/)(?:store|actions|app|dialog-state)\.tsx?$/;

async function shareReact(): Promise<BunPlugin> {
  const shims = new Map<string, string>();
  for (const [name, binding] of Object.entries(shared)) {
    const module = (await import(name)) as Record<string, unknown>;
    const names = Object.keys(module).filter(
      (key) => key !== "default" && /^[A-Za-z_$][\w$]*$/.test(key),
    );
    shims.set(
      name,
      `import { ${binding} as m } from "./manage.js";\n` +
        `export default m.default ?? m;\n` +
        `export const { ${names.join(", ")} } = m;\n`,
    );
  }
  return {
    name: "share-react",
    setup(build) {
      build.onResolve(
        { filter: /^react(?:-dom)?(?:\/jsx-(?:dev-)?runtime)?$/ },
        (args) => {
          if (!shims.has(args.path))
            throw new Error(`The dialogs bundle cannot share ${args.path}`);
          return { path: args.path, namespace: "shared-react" };
        },
      );
      build.onLoad({ filter: /.*/, namespace: "shared-react" }, (args) => ({
        contents: shims.get(args.path)!,
        loader: "js",
      }));
      build.onResolve({ filter: /^\.\/manage\.js$/ }, () => ({
        path: "./manage.js",
        external: true,
      }));
      build.onResolve({ filter: stateful }, (args) => {
        throw new Error(
          `${args.importer} imports ${args.path}, which holds page state; pass it through props instead.`,
        );
      });
    },
  };
}

export async function buildManager(
  outdir: string,
  { production = true }: { production?: boolean } = {},
) {
  const options = {
    target: "browser",
    format: "esm",
    minify: production,
    root: src,
    outdir,
    naming: "[dir]/[name].[ext]",
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        production ? "production" : "development",
      ),
    },
  } as const;
  const page = await Bun.build({
    ...options,
    entrypoints: [path.join(src, "manager/manage.tsx")],
    plugins: [
      {
        name: "dialogs-bundle",
        setup(build) {
          // The page loads dialogs.js at run time; it is not part of manage.js.
          build.onResolve({ filter: /^\.\/dialogs\.js$/ }, () => ({
            path: "./dialogs.js",
            external: true,
          }));
        },
      },
    ],
  });
  const dialogs = await Bun.build({
    ...options,
    entrypoints: [path.join(src, "manager/dialogs.tsx")],
    plugins: [await shareReact()],
  });
  for (const result of [page, dialogs])
    if (!result.success)
      throw new AggregateError(result.logs, "Manager compilation failed");
  // React must reach the dialogs only through manage.js.
  for (const output of dialogs.outputs)
    if ((await output.text()).includes("react.transitional.element"))
      throw new Error("The dialogs bundle contains its own copy of React");
  return [...page.outputs, ...dialogs.outputs];
}
