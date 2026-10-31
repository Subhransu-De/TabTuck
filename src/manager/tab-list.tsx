// Column three's list, windowed: see windowing.tsx.
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { HOUR } from "../shared/model.ts";
import {
  type Entry,
  longDate,
  shortAgo,
  shortLeft,
  siteLabel,
} from "./library.ts";
import {
  choose,
  erase,
  remove,
  restoreFromBin,
  restoreTab,
  run,
} from "./actions.ts";
import { clock, restoring, selection, useHas, useStore } from "./store.ts";
import { icon } from "./ui-icons.tsx";
import { SMALL, useRowWindow, windowedRows } from "./windowing.tsx";
import { siteIcon } from "./site-icon.tsx";

const rowOf = (event: React.SyntheticEvent<Element>) =>
  event.currentTarget.closest<HTMLElement>(".tab-row")!.dataset.tab!;

// Clicking anywhere except the title and the buttons selects the row.
function rowClick(event: React.MouseEvent<HTMLElement>) {
  if ((event.target as Element).closest("a, button, input")) return;
  event.preventDefault();
  const id = event.currentTarget.dataset.tab!;
  choose(id, !selection.has(id), event.shiftKey);
}
function rowMouseDown(event: React.MouseEvent<HTMLElement>) {
  if (
    (event.shiftKey || event.detail > 1) &&
    !(event.target as Element).closest("a")
  )
    event.preventDefault();
}
function pick(event: React.MouseEvent<HTMLInputElement>) {
  choose(rowOf(event), event.currentTarget.checked, event.shiftKey);
}
// A saved tab's title restores it here; Ctrl-click or middle-click keeps it.
// A restored row leaves and the next one moves under the pointer, so clicks in
// one place restore tab after tab. The system counts those as a double-click
// (event.detail) for up to half a second, so time decides too: only a repeat
// click this soon after the last restore is the second half of a
// double-click, and must not restore the row that moved up.
const DOUBLE_CLICK_GAP = 200;
let lastRestore = -Infinity;
function titleClick(event: React.MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  if (event.detail > 1 && event.timeStamp - lastRestore < DOUBLE_CLICK_GAP)
    return;
  lastRestore = event.timeStamp;
  restoreTab(rowOf(event), event.ctrlKey || event.metaKey);
}
// React handles clicks at the root, which a row removed by a restore no
// longer reaches; a stale click on its title must still not open the page.
const preventDefault = (event: Event) => event.preventDefault();
function guardTitle(link: HTMLAnchorElement | null) {
  link?.addEventListener("click", preventDefault);
}
function titleAuxClick(event: React.MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 1) return;
  event.preventDefault();
  if (event.detail > 1) return;
  restoreTab(rowOf(event), true);
}
const deleteClick = (event: React.MouseEvent<HTMLElement>) => {
  const id = rowOf(event);
  void run(() => remove([id]));
};
const binRestoreClick = (event: React.MouseEvent<HTMLElement>) => {
  const id = rowOf(event);
  void run(() => restoreFromBin([id]));
};
const eraseClick = (event: React.MouseEvent<HTMLElement>) => {
  const id = rowOf(event);
  void run(() => erase([id]));
};
const iso = (time: number) => new Date(time).toISOString();
// The click handler above updates the selection; React wants an onChange too.
const noop = () => {};

const TabRow = memo(function TabRow({
  entry,
  showHost,
  binHours,
}: {
  entry: Entry;
  showHost: boolean;
  // Set in the bin, where a tab counts down to being erased.
  binHours?: number;
}) {
  const { tab: t, group: g } = entry;
  const selected = useHas(selection, t.id);
  const busy = useHas(restoring, t.id);
  const { now } = useStore(clock);
  const inBin = binHours !== undefined;
  const end = inBin ? entry.addedAt + binHours * HOUR : 0;
  return (
    <div
      className={selected ? "tab-row selected" : "tab-row"}
      data-tab={t.id}
      data-group={g.id}
      onClick={rowClick}
      onMouseDown={rowMouseDown}
    >
      <label className="pick">
        <input
          type="checkbox"
          className="checkbox"
          checked={selected}
          aria-label={`Select ${t.title}`}
          onClick={pick}
          onChange={noop}
        />
      </label>
      {siteIcon(t.url)}
      {inBin ? (
        // In the bin a title is a plain link: opening the page leaves it binned.
        <a
          key="open"
          href={t.url}
          draggable={false}
          target="_blank"
          rel="noopener noreferrer"
          title={t.url}
        >
          {t.title}
        </a>
      ) : (
        <a
          key="restore"
          ref={guardTitle}
          href={t.url}
          draggable={false}
          title={t.url + (g.locked ? " (locked collection)" : "")}
          aria-disabled={busy || undefined}
          aria-busy={busy || undefined}
          onClick={titleClick}
          onAuxClick={titleAuxClick}
        >
          {t.title}
        </a>
      )}
      <span className="meta">
        {showHost && <span className="domain">{siteLabel(entry.host)}</span>}
        {inBin ? (
          <time
            className={end - now < 24 * HOUR ? "tab-left soon" : "tab-left"}
            dateTime={iso(end)}
            title={`Deleted ${longDate(entry.addedAt)}. Erased ${longDate(end)}.`}
          >
            {shortLeft(end - now)}
          </time>
        ) : (
          <time
            className="tab-date"
            dateTime={iso(entry.addedAt)}
            title={`Saved ${longDate(entry.addedAt)}`}
          >
            {shortAgo(entry.addedAt, now)}
          </time>
        )}
      </span>
      {inBin ? (
        <>
          <button
            type="button"
            className="row-tool bin-restore"
            aria-label={`Restore ${t.title}`}
            title="Restore"
            onClick={binRestoreClick}
          >
            {icon("restore")}
          </button>
          <button
            type="button"
            className="row-tool delete"
            aria-label={`Erase ${t.title}`}
            title="Erase for good"
            onClick={eraseClick}
          >
            {icon("trash")}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="row-tool delete"
          aria-label={`Delete ${t.title}`}
          title={
            g.locked
              ? "Unlock this collection to delete tabs"
              : "Move to the bin"
          }
          disabled={g.locked}
          onClick={deleteClick}
        >
          {icon("trash")}
        </button>
      )}
    </div>
  );
});

// Moves focus into a row by its index, mounting it first if the window has
// scrolled past it. Set while the list is on screen.
export const listFocus: {
  current?: (
    index: number,
    tag?: string,
    reverse?: boolean,
    scroll?: boolean,
  ) => boolean;
} = {};

const focusable = "input, a[href], button:not(:disabled)";

export const TabList = memo(function TabList({
  items,
  showHost,
  binHours,
  viewKey,
  empty,
}: {
  items: Entry[];
  showHost: boolean;
  binHours?: number;
  // The list scrolls back to the top when the view changes.
  viewKey: string;
  empty: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [row, setRow] = useState(34);
  // The focused row stays mounted while the window scrolls away from it.
  const [pinned, setPinned] = useState<string>();
  const live = useRef({ items });
  useLayoutEffect(() => {
    live.current = { items };
  });
  const { range, reset } = useRowWindow(ref, ref, items.length, row);
  // A new view starts at the top; the same view keeps its place.
  useLayoutEffect(() => {
    ref.current!.scrollTop = 0;
    reset();
  }, [viewKey, reset]);
  // Rows have one height. The browser reports it after its own layout, so
  // measuring never forces an extra one, and reports it again if it changes.
  const hasRows = items.length > 0;
  useEffect(() => {
    const first = ref.current?.querySelector(".tab-row");
    if (!first) return;
    const observer = new ResizeObserver(([entry]) => {
      const height = entry.borderBoxSize[0]?.blockSize;
      if (height) setRow(height);
    });
    observer.observe(first);
    return () => observer.disconnect();
  }, [hasRows, viewKey]);

  const count = items.length;
  const pinnedIndex =
    pinned === undefined ? -1 : items.findIndex((e) => e.tab.id === pinned);
  const children = windowedRows(count, row, range, [pinnedIndex], (index) => {
    const entry = items[index];
    return (
      <TabRow
        key={entry.tab.id}
        entry={entry}
        showHost={showHost}
        binHours={binHours}
      />
    );
  });

  const focusRow = useCallback(
    (index: number, tag?: string, reverse = false, scroll = false) => {
      const { items } = live.current;
      const id = items[index]?.tab.id;
      if (id === undefined) return false;
      flushSync(() => setPinned(id));
      const element = ref.current?.querySelector<HTMLElement>(
        `.tab-row[data-tab="${CSS.escape(id)}"]`,
      );
      if (!element) return false;
      const targets = [...element.querySelectorAll<HTMLElement>(focusable)];
      const target =
        (tag && element.querySelector<HTMLElement>(tag)) ||
        (reverse ? targets.at(-1) : targets[0]);
      target?.focus({ preventScroll: true });
      if (scroll) element.scrollIntoView({ block: "nearest" });
      return !!target;
    },
    [],
  );
  useEffect(() => {
    listFocus.current = focusRow;
    return () => {
      listFocus.current = undefined;
    };
  }, [focusRow]);

  // Tab and Shift-Tab walk the rows even past the edge of the window.
  const keydown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab" || count <= SMALL) return;
    const focused = document.activeElement as HTMLElement | null;
    const element = focused?.closest<HTMLElement>(".tab-row");
    if (!element) return;
    const targets = [...element.querySelectorAll<HTMLElement>(focusable)];
    if (focused !== (event.shiftKey ? targets[0] : targets.at(-1))) return;
    const next =
      items.findIndex((e) => e.tab.id === element.dataset.tab) +
      (event.shiftKey ? -1 : 1);
    if (next < 0 || next >= count) return;
    event.preventDefault();
    focusRow(next, undefined, event.shiftKey, true);
  };
  const focusIn = (event: React.FocusEvent<HTMLElement>) => {
    const id = (event.target as Element).closest<HTMLElement>(".tab-row")
      ?.dataset.tab;
    if (id !== undefined && id !== pinned) setPinned(id);
  };

  return (
    <div
      className="list"
      id="groups"
      ref={ref}
      onKeyDown={keydown}
      onFocus={focusIn}
    >
      {children}
      {!count && empty}
    </div>
  );
});
