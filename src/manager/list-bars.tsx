// Column three around the list: the search box, the bar above the list, and
// the strip below it with the selection actions and the toast.
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type Entry, plural } from "./library.ts";
import {
  clearSelection,
  copySelected,
  deleteSelected,
  moveSelected,
  restoreSelected,
  restoreVisible,
  selectAll,
  undo,
} from "./actions.ts";
import {
  type Toast,
  search,
  selection,
  toastState,
  useStore,
  useVersion,
} from "./store.ts";
import { icon } from "./ui-icons.tsx";
import { Button } from "./ui/button.tsx";
import { Kbd } from "./ui/kbd.tsx";

export function SearchBox() {
  const text = useStore(search);
  return (
    <div className="search" data-slot="input-group" role="search">
      {icon("search", "search-icon")}
      <input
        id="search"
        type="search"
        data-slot="input-group-control"
        placeholder="Search saved tabs"
        aria-label="Search saved tabs"
        autoComplete="off"
        value={text}
        onChange={(event) => search.set(event.target.value)}
      />
      <Kbd>/</Kbd>
    </div>
  );
}

function chosen(items: Entry[]) {
  let count = 0;
  for (const { tab } of items) if (selection.has(tab.id)) count++;
  return count;
}

function SelectAll({ items }: { items: Entry[] }) {
  useVersion(selection);
  const ref = useRef<HTMLInputElement>(null);
  const picked = chosen(items);
  const some = picked > 0 && picked < items.length;
  useLayoutEffect(() => {
    ref.current!.indeterminate = some;
  }, [some]);
  return (
    <input
      ref={ref}
      type="checkbox"
      id="select-all"
      className="checkbox"
      checked={!!items.length && picked === items.length}
      disabled={!items.length}
      onChange={(event) => selectAll(event.target.checked)}
    />
  );
}

export const ListHead = memo(function ListHead({
  items,
  undoable,
}: {
  items: Entry[];
  undoable: boolean;
}) {
  return (
    <div className="list-head" id="list-head">
      <label className="pick-all">
        <SelectAll items={items} />
        <span>Select all</span>
      </label>
      <span className="list-count">{plural(items.length, "tab")}</span>
      <div className="list-actions">
        <Button
          id="undo"
          variant="ghost"
          size="sm"
          hidden={!undoable}
          onClick={undo}
        >
          Undo delete
        </Button>
        <Button
          id="restore-all"
          variant="ghost"
          size="sm"
          disabled={!items.length}
          onClick={restoreVisible}
        >
          Restore all
        </Button>
      </div>
    </div>
  );
});

function clear() {
  clearSelection();
  document.getElementById("select-all")?.focus({ preventScroll: true });
}
export const Strip = memo(function Strip({
  items,
  inBin,
}: {
  items: Entry[];
  inBin: boolean;
}) {
  useVersion(selection);
  const size = selection.size;
  const offScreen = size - chosen(items);
  return (
    <div className={size ? "foot strip" : "foot strip idle"}>
      <div id="selection" hidden={!size}>
        <span id="selected-count">
          {`${size} selected`}
          {offScreen > 0 && (
            <span className="count">{` · ${offScreen} hidden`}</span>
          )}
        </span>
        <Button id="restore-selected" size="sm" onClick={restoreSelected}>
          Restore
        </Button>
        <Button
          id="move-selected"
          variant="ghost"
          size="sm"
          hidden={inBin}
          onClick={moveSelected}
        >
          {icon("move")}
          Move
        </Button>
        <Button
          id="copy-selected"
          variant="ghost"
          size="sm"
          onClick={copySelected}
        >
          {icon("copy")}
          Copy links
        </Button>
        <Button
          id="delete-selected"
          variant="danger"
          size="sm"
          onClick={deleteSelected}
        >
          {icon("trash")}
          {inBin ? "Erase" : "Delete"}
        </Button>
        <span className="selection-sep" />
        <Button
          id="clear-selected"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear selection"
          title="Clear selection"
          onClick={clear}
        >
          {icon("close")}
        </Button>
      </div>
      <Toaster />
    </div>
  );
});

// One message at a time, for 6.5 seconds; pointing at it or focusing it
// holds it open.
const TOAST_MS = 6500;
function Toaster() {
  const toast = useStore(toastState);
  const [closed, setClosed] = useState<number>();
  return (
    <div id="status" role="status">
      {toast && closed !== toast.id && (
        <ToastCard key={toast.id} toast={toast} onDone={setClosed} />
      )}
    </div>
  );
}
function ToastCard({
  toast,
  onDone,
}: {
  toast: Toast;
  onDone: (id: number) => void;
}) {
  const [held, setHeld] = useState(false);
  const left = useRef(TOAST_MS);
  useEffect(() => {
    if (held) return;
    const start = Date.now();
    const timer = setTimeout(() => onDone(toast.id), left.current);
    return () => {
      clearTimeout(timer);
      left.current = Math.max(1000, left.current - (Date.now() - start));
    };
  }, [held, toast.id, onDone]);
  return (
    <div
      className="toast"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span id="status-text">{toast.message}</span>
      {toast.undo && (
        <Button id="status-undo" variant="outline" size="sm" onClick={undo}>
          {icon("undo")}
          Undo
        </Button>
      )}
    </div>
  );
}
