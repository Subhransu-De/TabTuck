// Column two: what the chosen scope is, what can be done with it, and its
// sites or save times.
import { memo, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { type Entry, collectionLabel, plural } from "./library.ts";
import type { Facets as FacetData, Views } from "./view.ts";
import {
  copyLinks,
  copyVisible,
  editFolder,
  erase,
  moveToFolder,
  remove,
  renameGroup,
  restore,
  restoreFromBin,
  run,
  setFacet,
  toggleLock,
  toggleStar,
} from "./actions.ts";
import { screen, setUi } from "./store.ts";
import { icon } from "./ui-icons.tsx";
import { siteIcon } from "./site-icon.tsx";
import { Button } from "./ui/button.tsx";
import { cn } from "./ui/cn.ts";
import { tabThroughRows, useRowWindow, windowedRows } from "./windowing.tsx";

const ids = (list: Entry[]) => list.map((e) => e.tab.id);
const shownIds = () => ids(screen.visible);

function Act({
  label,
  icon: symbol,
  onClick,
  disabled,
  pressed,
  className,
  title = label,
  danger,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
  title?: string;
  danger?: boolean;
}) {
  return (
    <Button
      variant={danger ? "danger" : "ghost"}
      size="icon-md"
      className={cn("act", className)}
      data-action={symbol}
      aria-label={label}
      aria-pressed={pressed}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {icon(symbol)}
    </Button>
  );
}
function RestoreAll({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      size="md"
      data-action="restore"
      disabled={disabled}
      onClick={onClick}
    >
      Restore all
    </Button>
  );
}

export const ScopeHead = memo(function ScopeHead({
  views,
  scope,
  empty,
}: {
  views: Views | null;
  scope: string;
  // Nothing on screen to copy or restore.
  empty: boolean;
}) {
  if (!views) return <header className="head" id="scope-head" />;
  let title: ReactNode;
  let acts: ReactNode = null;
  const list = views.live(views.scopeGroups(scope));
  const group = scope.startsWith("group:")
    ? views.lib.index.get(scope.slice(6))
    : undefined;
  if (group) {
    const g = group;
    const label = collectionLabel(g);
    title = (
      <button
        type="button"
        className={cn("rename", !g.name && "unnamed")}
        data-action="rename"
        title={`Rename “${label}”`}
        onClick={() => renameGroup(g)}
      >
        <span>{label}</span>
        {icon("pencil", "rename-icon")}
      </button>
    );
    acts = (
      <>
        <RestoreAll
          disabled={empty}
          onClick={() => run(() => restore({ groupId: g.id, ids: ids(list) }))}
        />
        <Act
          label="Copy links"
          icon="copy"
          disabled={empty}
          onClick={() => run(() => copyLinks(ids(list)))}
        />
        <Act
          label={g.starred ? "Unstar" : "Star"}
          icon="star"
          pressed={g.starred}
          className={g.starred ? "on star" : undefined}
          onClick={() => toggleStar(g)}
        />
        <Act
          label={g.locked ? "Unlock" : "Lock"}
          icon="lock"
          pressed={g.locked}
          className={g.locked ? "on" : undefined}
          onClick={() => toggleLock(g)}
        />
        <Act
          label={g.folder ? `Folder: ${g.folder}` : "Move to folder"}
          icon="folder"
          onClick={() => moveToFolder(g)}
        />
        <Act
          label="Delete all"
          icon="trash"
          danger
          disabled={g.locked}
          title={g.locked ? "Unlock this collection to delete tabs" : undefined}
          onClick={() => run(() => remove(ids(list), g.id))}
        />
      </>
    );
  } else if (scope === "recent") {
    title = "Recent";
  } else if (scope === "bin") {
    const all = views.bin();
    title = "Bin";
    acts = (
      <>
        <RestoreAll
          disabled={empty}
          onClick={() => run(() => restoreFromBin(shownIds()))}
        />
        <Act
          label="Copy links"
          icon="copy"
          disabled={empty}
          onClick={copyVisible}
        />
        <Act
          label="Empty bin"
          icon="trash"
          danger
          disabled={!all.length}
          onClick={() => run(() => erase())}
        />
      </>
    );
  } else if (scope.startsWith("site:")) {
    title = views.siteName(scope.slice(5));
    acts = (
      <>
        <RestoreAll
          disabled={empty}
          onClick={() => run(() => restore({ ids: shownIds() }))}
        />
        <Act
          label="Copy links"
          icon="copy"
          disabled={empty}
          onClick={copyVisible}
        />
      </>
    );
  } else if (scope.startsWith("folder:")) {
    const f = scope.slice(7);
    title = f;
    acts = (
      <>
        <RestoreAll
          disabled={empty}
          onClick={() => run(() => restore({ ids: shownIds() }))}
        />
        <Act
          label="Copy links"
          icon="copy"
          disabled={empty}
          onClick={copyVisible}
        />
        <Act label="Edit folder" icon="pencil" onClick={() => editFolder(f)} />
      </>
    );
  } else {
    title = scope === "starred" ? "Starred" : "All tabs";
    acts = (
      <Act
        label="Copy links"
        icon="copy"
        disabled={empty}
        onClick={copyVisible}
      />
    );
  }
  return (
    <header className="head" id="scope-head">
      <h2 id="scope-title">{title}</h2>
      {acts && <div className="acts">{acts}</div>}
    </header>
  );
});

const pickFacet = (event: React.MouseEvent<HTMLElement>) =>
  setFacet(event.currentTarget.dataset.facet!);
const FacetRow = memo(function FacetRow({
  facetKey,
  label,
  count,
  lead,
  url,
  on,
}: {
  facetKey: string;
  label: string;
  count: number;
  lead: string;
  url: string;
  on: boolean;
}) {
  return (
    <button
      type="button"
      className={cn("row facet", on && "is-current", !count && "dim")}
      data-facet={facetKey}
      aria-current={on ? "true" : undefined}
      title={label}
      onClick={pickFacet}
    >
      {lead === "site" ? siteIcon(url) : icon(lead)}
      <span className="label">{label}</span>
      <span className="count">{count}</span>
    </button>
  );
});

// The height of a facet row, set in manage.css.
const FACET_ROW = 32;
export const Facets = memo(function Facets({
  data,
  facet,
  scope,
  loaded,
}: {
  data: FacetData | null;
  facet: string;
  // The list scrolls back to the top when the scope changes.
  scope: string;
  loaded: boolean;
}) {
  const list = useRef<HTMLElement>(null);
  const section = useRef<HTMLDivElement>(null);
  const rowsData = data?.rows ?? [];
  // Hundreds of sites are windowed; the current and the focused one stay.
  const [focused, setFocused] = useState<string>();
  const { range, reset } = useRowWindow(
    list,
    section,
    rowsData.length,
    FACET_ROW,
  );
  useLayoutEffect(() => {
    list.current!.scrollTop = 0;
    reset();
  }, [scope, reset]);
  const rows = windowedRows(
    rowsData.length,
    FACET_ROW,
    range,
    [facet, focused].map((key) => rowsData.findIndex((row) => row.key === key)),
    (index) => {
      const row = rowsData[index];
      return (
        <FacetRow
          key={row.key}
          facetKey={row.key}
          label={row.label}
          count={row.count}
          lead={typeof row.lead === "string" ? row.lead : "site"}
          url={typeof row.lead === "string" ? "" : row.lead.url}
          on={facet === row.key}
        />
      );
    },
  );
  return (
    <nav
      ref={list}
      className="list"
      id="facets"
      aria-label="Sites and save times"
      onFocus={(event) => {
        const key = (event.target as HTMLElement).dataset.facet;
        if (key !== undefined && key !== focused) setFocused(key);
      }}
      onKeyDown={(event) =>
        tabThroughRows(
          event,
          ".row.facet",
          "data-facet",
          rowsData.map((row) => row.key),
          setFocused,
        )
      }
    >
      {!data && loaded && (
        <p className="quiet">
          Sites and save times show up here once you save tabs.
        </p>
      )}
      <div ref={section}>{rows}</div>
      {data?.more && (
        <button
          type="button"
          className={cn("row more", data.more.open && "open")}
          aria-expanded={data.more.open}
          data-action="more-sites"
          onClick={() => setUi({ showAllSites: !data.more!.open })}
        >
          <span>
            {data.more.open
              ? "Fold sites with one tab"
              : `${plural(data.more.count, "more site")} with one tab`}
          </span>
          {icon("chevron")}
        </button>
      )}
    </nav>
  );
});
