// Long lists of rows with one height keep only the rows near the visible part
// of their scrolling container in the DOM, with spacers for the rest, so a
// library of thousands of tabs or hundreds of sites stays a few dozen rows.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";

// Lists this short render every row.
export const SMALL = 128;
// Rows rendered beyond each edge of the visible part, in pixels.
const OVERSCAN = 400;
// The window moves in blocks of rows, so scrolling re-renders only when a
// block edge comes near.
const BLOCK = 8;

function windowOf(top: number, height: number, row: number, count: number) {
  if (count <= SMALL) return [0, count] as const;
  const start = Math.max(0, Math.floor((top - OVERSCAN) / row));
  const end = Math.ceil((top + height + OVERSCAN) / row);
  return [
    Math.floor(start / BLOCK) * BLOCK,
    Math.min(count, Math.ceil(end / BLOCK) * BLOCK),
  ] as const;
}

// The rows of a section that starts somewhere inside a scrolling list, or of
// the list itself when both are the same element, as a [start, end) range. It
// re-renders the caller only when the range changes.
export function useRowWindow(
  list: RefObject<HTMLElement | null>,
  section: RefObject<HTMLElement | null>,
  count: number,
  row: number,
) {
  const [box, setBox] = useState({ top: 0, height: 900 });
  const live = useRef({ count, row });
  useLayoutEffect(() => {
    live.current = { count, row };
  });
  // Measures once per frame at most, on scroll, resize and render.
  const schedule = useRef(() => {});
  useEffect(() => {
    const outer = list.current!;
    let frame = 0;
    const measure = () => {
      const inner = section.current;
      // Short lists render every row, so they never need the layout read.
      if (!inner || live.current.count <= SMALL) return;
      // Where the section starts, in the list's scrolled content. A list that
      // is its own section starts at the top; its padding is well inside the
      // overscan.
      const offset =
        inner === outer
          ? 0
          : inner.getBoundingClientRect().top -
            outer.getBoundingClientRect().top +
            outer.scrollTop;
      const next = {
        top: outer.scrollTop - offset,
        height: outer.clientHeight,
      };
      const { count, row } = live.current;
      setBox((before) => {
        const [a, b] = windowOf(before.top, before.height, row, count);
        const [c, d] = windowOf(next.top, next.height, row, count);
        return a === c && b === d ? before : next;
      });
    };
    const run = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    schedule.current = run;
    outer.addEventListener("scroll", run, { passive: true });
    const observer = new ResizeObserver(run);
    observer.observe(outer);
    return () => {
      cancelAnimationFrame(frame);
      schedule.current = () => {};
      outer.removeEventListener("scroll", run);
      observer.disconnect();
    };
  }, [list, section]);
  // Rows above the section can change on any render, moving where it starts.
  useLayoutEffect(() => {
    if (count > SMALL) schedule.current();
  });
  // A new view starts at the top of the list.
  const reset = useCallback(
    () => setBox((before) => (before.top ? { ...before, top: 0 } : before)),
    [],
  );
  return { range: windowOf(box.top, box.height, row, count), reset };
}

// Rows from start to end, plus any pinned ones outside that range, with
// spacers holding the place of the rows that are not mounted.
export function windowedRows(
  count: number,
  row: number,
  [start, end]: readonly [number, number],
  pinned: number[],
  render: (index: number) => ReactNode,
) {
  const shown = new Set<number>();
  for (const index of pinned)
    if (index >= 0 && index < count && (index < start || index >= end))
      shown.add(index);
  for (let i = start; i < end; i++) shown.add(i);
  const children: ReactNode[] = [];
  let previous = 0;
  for (const index of [...shown].sort((a, b) => a - b)) {
    if (index > previous)
      children.push(
        <div
          key={`gap-${previous}`}
          className="window-spacer"
          style={{ height: (index - previous) * row }}
        />,
      );
    children.push(render(index));
    previous = index + 1;
  }
  if (previous < count)
    children.push(
      <div
        key="gap-end"
        className="window-spacer"
        style={{ height: (count - previous) * row }}
      />,
    );
  return children;
}

// Tab and Shift-Tab move through the rows of a long windowed section one row
// at a time, mounting the next row before focusing it. Rows are single
// controls named by an attribute, such as data-scope.
export function tabThroughRows(
  event: React.KeyboardEvent,
  selector: string,
  attribute: string,
  keys: string[],
  pin: (key: string) => void,
) {
  if (event.key !== "Tab" || keys.length <= SMALL) return;
  const row = (event.target as Element).closest<HTMLElement>(selector);
  const at = row ? keys.indexOf(row.getAttribute(attribute) ?? "") : -1;
  const next = at + (event.shiftKey ? -1 : 1);
  if (at < 0 || next < 0 || next >= keys.length) return;
  event.preventDefault();
  flushSync(() => pin(keys[next]));
  const target = document.querySelector<HTMLElement>(
    `${selector}[${attribute}="${CSS.escape(keys[next])}"]`,
  );
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: "nearest" });
}
