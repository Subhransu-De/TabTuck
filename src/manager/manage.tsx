// Entry point of the manager page; it builds to manager/manage.js.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { App } from "./app.tsx";
import { start } from "./actions.ts";
import { toast } from "./store.ts";

// The dialogs bundle takes React from this module, so both share one copy.
import * as R from "react";
import * as RD from "react-dom";
import * as J from "react/jsx-runtime";
// Development builds compile JSX for this runtime instead.
import * as JD from "react/jsx-dev-runtime";
export { R, RD, J, JD };

// boot.js has already set the theme and asked for the library.
start().catch((e: unknown) =>
  toast(e instanceof Error ? e.message : String(e)),
);
const root = createRoot(document.getElementById("root")!);
// Render now, so the first frame already shows the page.
flushSync(() =>
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
