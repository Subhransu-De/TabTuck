// The manager page: three panels joined by the vine.
import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { duration, forgetSearchText, plural } from "./library.ts";
import {
  type Library,
  Views,
  facets,
  hits,
  listHeading,
  validScope,
  visibleOf,
} from "./view.ts";
import {
  agree,
  exportJson,
  exportPlain,
  importText,
  openShortcuts,
  run,
  saveSettings,
  saveWindow,
  toggleTheme,
} from "./actions.ts";
import {
  clock,
  hidden,
  library,
  normalized,
  screen,
  search,
  store,
  systemDark,
  toast,
  ui,
  useStore,
} from "./store.ts";
import { anyDialog, dialogs, setDialog } from "./dialog-state.ts";
import type { DialogsProps } from "./dialogs.tsx";
import { Navigation } from "./navigation.tsx";
import { Facets, ScopeHead } from "./scope-head.tsx";
import { TabList, listFocus } from "./tab-list.tsx";
import { ListHead, SearchBox, Strip } from "./list-bars.tsx";
import { icon } from "./ui-icons.tsx";
import { Vine } from "./vine.ts";
import { Button } from "./ui/button.tsx";

// chrome.storage holds the theme setting; this page-local copy only lets
// boot.js paint the last theme before that asynchronous read finishes.
const THEME_KEY = "tabtuck-theme";
function useTheme(lib: Library | null) {
  const system = useStore(systemDark);
  const theme = lib?.state.settings.theme;
  const dark = theme === "dark" || (theme !== "light" && system);
  useLayoutEffect(() => {
    if (!lib) return;
    document.body.classList.toggle("dark", dark);
    document.body.classList.toggle("light", !dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [lib, dark]);
  return lib ? dark : document.body.classList.contains("dark");
}

// The vine follows the chosen rows after each render, on scroll and on
// resize, measuring once per frame. A new view (the app's data-view) animates
// it to its new rows.
function useVine(svg: React.RefObject<SVGSVGElement | null>) {
  const vine = useRef<Vine>(null);
  const frame = useRef(0);
  const follow = useRef(() => {});
  useEffect(() => {
    const app = document.getElementById("app")!;
    vine.current = new Vine(app, svg.current!);
    const byId = (id: string) => document.getElementById(id)!;
    follow.current = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const current = (id: string) =>
          byId(id).querySelector<HTMLElement>(".is-current");
        vine.current!.draw(
          [
            {
              from: byId("col-1"),
              fromRow: current("navigation"),
              to: byId("col-2"),
              toRow: current("facets"),
            },
            {
              from: byId("col-2"),
              fromRow: current("facets"),
              to: byId("col-3"),
              toRow: byId("list-head"),
            },
          ],
          app.dataset.view ?? "",
        );
      });
    };
    const schedule = () => follow.current();
    const lists = ["navigation", "facets"].map(byId);
    for (const list of lists)
      list.addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    for (const id of ["scope-head", "list-head", "facets"])
      observer.observe(byId(id));
    void document.fonts.ready.then(schedule);
    return () => {
      cancelAnimationFrame(frame.current);
      for (const list of lists) list.removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [svg]);
  useLayoutEffect(() => follow.current());
}

interface Focused {
  element: HTMLElement;
  // A data attribute that names the control across renders.
  key?: string;
  value?: string;
  // A tab row: its id, its place in the list and the focused element's tag.
  tab?: string;
  index: number;
  tag: string;
}
const focusKeys = [
  "data-scope",
  "data-facet",
  "data-action",
  "data-folder-toggle",
];
// Focus stays on screen when a render removes the focused control: on the
// control that replaces it, on the row that took a removed row's place, or
// on the search box.
function useFocusKeeper() {
  const last = useRef<Focused>(null);
  useEffect(() => {
    const record = (event: FocusEvent) => {
      const element = event.target as HTMLElement;
      const key = focusKeys.find((name) => element.hasAttribute?.(name));
      const row = element.closest?.<HTMLElement>(".tab-row");
      const tab = row?.dataset.tab;
      last.current = {
        element,
        key,
        value: key ? (element.getAttribute(key) ?? undefined) : undefined,
        tab,
        index: tab ? screen.visible.findIndex((e) => e.tab.id === tab) : -1,
        tag: element.tagName.toLowerCase(),
      };
    };
    document.addEventListener("focusin", record);
    return () => document.removeEventListener("focusin", record);
  }, []);
  useLayoutEffect(() => {
    const was = last.current;
    if (!was || was.element.isConnected) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    last.current = null;
    if (was.key && was.value !== undefined) {
      document
        .querySelector<HTMLElement>(`[${was.key}="${CSS.escape(was.value)}"]`)
        ?.focus({ preventScroll: true });
    } else if (was.tab !== undefined) {
      // Right after this commit, before the next paint: mounting a row that
      // the window has scrolled past needs a render of its own.
      queueMicrotask(() => {
        let index = screen.visible.findIndex((e) => e.tab.id === was.tab);
        if (index < 0) index = Math.min(was.index, screen.visible.length - 1);
        if (index < 0 || !listFocus.current?.(index, was.tag))
          document.getElementById("search")?.focus({ preventScroll: true });
      });
    }
  });
}

// The dialogs load from their own bundle the first time one opens. It takes
// React from this one; see scripts/manager-build.ts. The bundle is held in a
// store rather than behind Suspense, which would hold back its first reveal.
const dialogsBundle = store<((props: DialogsProps) => ReactNode) | null>(null);
let loading: Promise<void> | undefined;
export const preloadDialogs = () => {
  loading ??= import("./dialogs.js").then(
    (module) => dialogsBundle.set(module.renderDialogs),
    (error: unknown) => {
      loading = undefined;
      toast(error instanceof Error ? error.message : String(error));
    },
  );
};
// Opening any dialog loads the bundle in the same event. Pointing at a
// button that opens one starts it a moment sooner.
dialogs.subscribe(() => {
  if (anyDialog()) preloadDialogs();
});
const host: DialogsProps["host"] = {
  run,
  toast,
  close: (name) => setDialog(name, false),
  closePrompt: () => dialogs.set({ ...dialogs.get(), prompt: null }),
  agree,
  importText,
  exportJson,
  exportPlain,
  saveSettings,
  openShortcuts,
};
function DialogHost({ lib }: { lib: Library | null }) {
  const state = useStore(dialogs);
  const renderDialogs = useStore(dialogsBundle);
  // The bin's deletion times, for the line under the bin time in Options.
  const binTimes = useMemo(
    () =>
      state.settings && lib
        ? new Views(lib, new Set(), clock.get().now).bin().map((e) => e.addedAt)
        : [],
    [state.settings, lib],
  );
  if (!renderDialogs || !lib) return null;
  return renderDialogs({
    state,
    settings: lib.state.settings,
    binTimes,
    host,
  });
}

function Empty({
  lib,
  scope,
  query,
}: {
  lib: Library;
  scope: string;
  query: string;
}) {
  const badge = (name: string) => (
    <span className="empty-badge">{icon(name)}</span>
  );
  if (!lib.state.groups.length)
    return (
      <div className="empty">
        {badge("bookmark")}
        <h2>Nothing saved yet</h2>
        <p>
          Press Alt+C on any page to save it here, or save this whole window.
          Your newest save always lands on top.
        </p>
        <Button
          size="sm"
          onPointerEnter={preloadDialogs}
          onClick={() => setDialog("transfer", true)}
        >
          Import tabs
        </Button>
      </div>
    );
  if (query)
    return (
      <div className="empty">
        {badge("search")}
        <h2>No matching tabs</h2>
        <p>{`Nothing here matches “${query}”.`}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            search.set("");
            document.getElementById("search")?.focus();
          }}
        >
          Clear search
        </Button>
      </div>
    );
  if (scope === "bin")
    return (
      <div className="empty">
        {badge("trash")}
        <h2>The bin is empty</h2>
        <p>
          {`Deleted tabs wait here for ${duration(lib.state.settings.binHours)}, then they are erased for good.`}
        </p>
      </div>
    );
  if (scope === "starred")
    return (
      <div className="empty">
        {badge("star")}
        <h2>No starred collections</h2>
        <p>Turn on Starred in a collection's details to find its tabs here.</p>
      </div>
    );
  return (
    <div className="empty">
      {badge("layers")}
      <h2>No tabs here</h2>
      <p>Pick another collection or site.</p>
    </div>
  );
}

const NO_ENTRIES: never[] = [];
export function App() {
  const lib = useStore(library);
  const view = useStore(ui);
  // The list follows the search a beat behind the box, so typing never waits
  // for thousands of rows.
  const text = useDeferredValue(useStore(search));
  const query = normalized(text);
  useEffect(() => {
    if (!query) forgetSearchText();
  }, [query]);
  const hiddenIds = useStore(hidden);
  const { epoch } = useStore(clock);
  const dark = useTheme(lib);
  const svg = useRef<SVGSVGElement>(null);
  useFocusKeeper();

  const views = useMemo(
    () => (lib ? new Views(lib, hiddenIds, epoch) : null),
    [lib, hiddenIds, epoch],
  );
  const scope = useMemo(
    () => (lib ? validScope(lib, view.scope) : view.scope),
    [lib, view.scope],
  );
  const { facet } = view;
  const scoped = useMemo(
    () => views?.scoped(scope, query) ?? NO_ENTRIES,
    [views, scope, query],
  );
  const facetData = useMemo(
    () => views && facets(views, scope, scoped, facet, view.showAllSites),
    [views, scope, scoped, facet, view.showAllSites],
  );
  const visible = useMemo(
    () => visibleOf(scoped, scope, facet, epoch),
    [scoped, scope, facet, epoch],
  );
  const found = useMemo(() => views && hits(views, query), [views, query]);
  useLayoutEffect(() => {
    screen.views = views;
    screen.visible = visible;
  }, [views, visible]);
  const viewKey = `${scope}|${facet}`;
  useVine(svg);

  const heading = views ? listHeading(views, scope, facet) : "Recent";
  const inBin = scope === "bin";
  const site = facet.startsWith("site:");
  const themeLabel = dark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <div className="app" id="app" data-view={viewKey}>
      <svg ref={svg} id="vine" className="vine" aria-hidden="true" />
      <aside className="col" id="col-1" aria-label="Library">
        <div className="head brand-head">
          <div className="brand">
            <img src="../icons/48.png" alt="" />
            <span className="brand-text">
              <span className="brand-name">TabTuck</span>
              <span className="brand-count">
                {views && plural(views.all.length, "saved tab")}
              </span>
            </span>
            <button
              type="button"
              id="theme-toggle"
              className="square"
              aria-label={themeLabel}
              title={themeLabel}
              onClick={toggleTheme}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="theme-icon"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="8.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path d="M12 6a6 6 0 0 1 0 12z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
        <Button
          id="save-window"
          size="lg"
          className="tuck"
          onClick={saveWindow}
        >
          {icon("plus")}
          <span>Save this window</span>
        </Button>
        <Navigation
          views={views}
          scope={scope}
          collapsed={view.collapsed}
          folding={view.folding}
          unfolding={view.unfolding}
          hits={found}
        />
        <div className="foot foot-1">
          <Button
            id="transfer-open"
            variant="ghost"
            size="sm"
            onPointerEnter={preloadDialogs}
            onFocus={preloadDialogs}
            onClick={() => setDialog("transfer", true)}
          >
            {icon("transfer")}
            Import / Export
          </Button>
          <Button
            id="settings-open"
            variant="ghost"
            size="sm"
            onPointerEnter={preloadDialogs}
            onFocus={preloadDialogs}
            onClick={() => setDialog("settings", true)}
          >
            {icon("gear")}
            Options
          </Button>
        </div>
      </aside>
      <section className="col" id="col-2" aria-labelledby="scope-title">
        <ScopeHead views={views} scope={scope} shown={visible.length} />
        <Facets data={facetData} facet={facet} scope={scope} loaded={!!lib} />
      </section>
      <main className="col" id="col-3">
        <header className="head head-3">
          <h1 id="heading" title={heading}>
            {heading}
          </h1>
          <SearchBox />
        </header>
        <div className="well list-well">
          <ListHead
            items={visible}
            undoable={!!lib?.state.trash?.length && !inBin}
          />
          <TabList
            items={visible}
            showHost={!site && !scope.startsWith("site:")}
            binHours={inBin ? lib!.state.settings.binHours : undefined}
            viewKey={viewKey}
            // Only an empty list needs it; null keeps the list memoized.
            empty={
              lib && !visible.length ? (
                <Empty lib={lib} scope={scope} query={text.trim()} />
              ) : null
            }
          />
        </div>
        <Strip items={visible} inBin={inBin} />
      </main>
      <DialogHost lib={lib} />
    </div>
  );
}
