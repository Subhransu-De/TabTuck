// Column two: what the chosen scope is, a tray of what can be done with it,
// and its sites or save times.
import { memo, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { HOUR } from "../shared/model.ts";
import type { TabGroup } from "../shared/types.ts";
import {
  type Entry,
  ago,
  collectionLabel,
  plural,
  shortLeft,
  siteLabel,
} from "./library.ts";
import { duration } from "./bin-time.ts";
import { type Facets as FacetData, type Views, leadUrl } from "./view.ts";
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
import { setDialog } from "./dialog-state.ts";
import { screen, setUi } from "./store.ts";
import { icon } from "./ui-icons.tsx";
import { siteIcon } from "./site-icon.tsx";
import { Button, buttonVariants } from "./ui/button.tsx";
import { cn } from "./ui/cn.ts";
import { MenuButton } from "./ui/menu.tsx";
import { Switch } from "./ui/switch.tsx";
import { tabThroughRows, useRowWindow, windowedRows } from "./windowing.tsx";

const ids = (list: Entry[]) => list.map((e) => e.tab.id);
const shownIds = () => ids(screen.visible);

// A row in the tray that does something: an icon, what it does, and a faint
// detail, or a chevron when it opens something.
function TrayAction({
  name,
  label,
  icon: symbol,
  detail,
  opens,
  onClick,
  disabled,
  title,
  danger,
}: {
  name: string;
  label: string;
  icon: string;
  detail?: ReactNode;
  opens?: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn("row", danger && "danger")}
      data-action={name}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {icon(symbol)}
      <span className="label">{label}</span>
      {(detail !== undefined || opens) && (
        <span className="end">
          {detail !== undefined && <span className="count">{detail}</span>}
          {opens && icon("chevron-right")}
        </span>
      )}
    </button>
  );
}
// A row with a switch: clicking anywhere on it flips the switch.
function TrayToggle({
  name,
  label,
  symbol,
  sub,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  symbol: ReactNode;
  sub?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className={cn("row", sub && "two")}>
      {symbol}
      <span className="stack">
        <span>{label}</span>
        {sub && <span className="sub">{sub}</span>}
      </span>
      <Switch
        data-action={name}
        aria-label={label}
        checked={checked}
        onCheckedChange={onChange}
      />
    </label>
  );
}
// The tray's main action under the well: Restore all, with a menu to restore
// and keep the tabs saved.
function RestoreAll({
  count,
  restoreTabs,
}: {
  count: number;
  restoreTabs: (keep: boolean) => Promise<void>;
}) {
  const go = (keep: boolean) => run(() => restoreTabs(keep));
  return (
    <div className="tray-actions">
      <Button data-action="restore" disabled={!count} onClick={() => go(false)}>
        {icon("restore")}
        {count ? `Restore all ${count}` : "Restore all"}
      </Button>
      <MenuButton
        label="More ways to restore"
        className={cn(buttonVariants({ size: "icon" }), "size-7.5")}
        disabled={!count}
        items={[
          {
            label: "Restore and keep saved",
            icon: icon("copy"),
            action: "restore-keep",
            onSelect: () => go(true),
          },
        ]}
      >
        {icon("chevron")}
      </MenuButton>
    </div>
  );
}

function GroupTray({ views, group: g }: { views: Views; group: TabGroup }) {
  const list = views.live(views.scopeGroups(`group:${g.id}`));
  return (
    <>
      <div className="well tray">
        <TrayAction
          name="folder"
          label={g.folder || "No folder"}
          icon={g.folder ? g.folderIcon || "folder" : "folder"}
          title={g.folder ? `Folder: ${g.folder}` : "Move to a folder"}
          opens
          onClick={() => moveToFolder(g)}
        />
        <TrayToggle
          name="star"
          label="Starred"
          symbol={icon("star", cn("nav-icon", g.starred && "star-on"))}
          checked={g.starred}
          onChange={() => toggleStar(g)}
        />
        <TrayToggle
          name="lock"
          label="Locked"
          symbol={icon(g.locked ? "lock" : "unlock")}
          sub={g.locked ? "Tabs here can’t be deleted" : undefined}
          checked={g.locked}
          onChange={() => toggleLock(g)}
        />
        <TrayAction
          name="copy"
          label="Copy links"
          icon="copy"
          detail={list.length}
          disabled={!list.length}
          onClick={() => run(() => copyLinks(ids(list)))}
        />
        <TrayAction
          name="trash"
          label="Delete all"
          icon="trash"
          detail={g.locked ? "locked" : "to the bin"}
          disabled={g.locked || !list.length}
          title={g.locked ? "Unlock this collection to delete tabs" : undefined}
          onClick={() => run(() => remove(ids(list), g.id))}
        />
      </div>
      <RestoreAll
        count={list.length}
        restoreTabs={(keep) => restore({ groupId: g.id, ids: ids(list), keep })}
      />
    </>
  );
}
function BinTray({ views, shown }: { views: Views; shown: number }) {
  const all = views.bin();
  const hours = views.settings.binHours;
  let oldest: Entry | undefined;
  for (const e of all) if (!oldest || e.addedAt < oldest.addedAt) oldest = e;
  const left = oldest ? oldest.addedAt + hours * HOUR - views.now : 0;
  return (
    <>
      <div className="well tray">
        <TrayAction
          name="bin-time"
          label={`Keep for ${duration(hours)}`}
          icon="clock"
          title="Change how long deleted tabs wait"
          opens
          onClick={() => setDialog("settings", true)}
        />
        {oldest && (
          <div className="row two">
            {icon("trash")}
            <span className="stack">
              <span>Next erase</span>
              <span className="sub">{oldest.tab.title}</span>
            </span>
            <span className={cn("count", left < 24 * HOUR && "soon")}>
              {shortLeft(left)}
            </span>
          </div>
        )}
        <TrayAction
          name="copy"
          label="Copy links"
          icon="copy"
          detail={shown}
          disabled={!shown}
          onClick={copyVisible}
        />
        <TrayAction
          name="empty-bin"
          label="Empty bin"
          icon="trash"
          detail={all.length ? `erase ${all.length}` : undefined}
          danger
          disabled={!all.length}
          onClick={() => run(() => erase())}
        />
      </div>
      <div className="tray-actions">
        <Button
          data-action="restore"
          disabled={!shown}
          onClick={() => run(() => restoreFromBin(shownIds()))}
        >
          {icon("restore")}
          {shown ? `Restore all ${shown}` : "Restore all"}
        </Button>
      </div>
    </>
  );
}

export const ScopeHead = memo(function ScopeHead({
  views,
  scope,
  shown,
}: {
  views: Views | null;
  scope: string;
  // How many tabs column three shows, for copy and restore.
  shown: number;
}) {
  if (!views) return <header className="head" id="scope-head" />;
  let title: ReactNode;
  let meta: ReactNode = null;
  let tray: ReactNode = null;
  const list = views.live(views.scopeGroups(scope));
  const group = scope.startsWith("group:")
    ? views.lib.index.get(scope.slice(6))
    : undefined;
  const copyRow = (
    <TrayAction
      name="copy"
      label="Copy links"
      icon="copy"
      detail={shown}
      disabled={!shown}
      onClick={copyVisible}
    />
  );
  const restoreShown = (keep: boolean) => restore({ ids: shownIds(), keep });
  if (group) {
    const g = group;
    const label = collectionLabel(g);
    const lead = leadUrl(g);
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
    meta = (
      <>
        {lead ? siteIcon(lead) : icon("folder")}
        <span>{`${plural(list.length, "tab")} · saved ${ago(g.createdAt, views.now)}`}</span>
      </>
    );
    tray = <GroupTray views={views} group={g} />;
  } else if (scope === "recent") {
    title = "Recent";
    const newest = views.lib.ordered[0];
    if (newest)
      meta = <span>{`Last saved ${ago(newest.createdAt, views.now)}`}</span>;
  } else if (scope === "bin") {
    title = "Bin";
    meta = (
      <span>{`${plural(views.bin().length, "tab")} · erased after ${duration(views.settings.binHours)}`}</span>
    );
    tray = <BinTray views={views} shown={shown} />;
  } else if (scope.startsWith("site:")) {
    const host = scope.slice(5);
    title = views.siteName(host);
    meta = <span>{`${plural(shown, "tab")} from ${siteLabel(host)}`}</span>;
    tray = (
      <>
        <div className="well tray">{copyRow}</div>
        <RestoreAll count={shown} restoreTabs={restoreShown} />
      </>
    );
  } else if (scope.startsWith("folder:")) {
    const f = scope.slice(7);
    const members = views.scopeGroups(scope);
    title = f;
    meta = (
      <>
        {icon(members[0]?.folderIcon || "folder")}
        <span>{`${plural(list.length, "tab")} · ${plural(members.length, "collection")}`}</span>
      </>
    );
    tray = (
      <>
        <div className="well tray">
          <TrayAction
            name="pencil"
            label="Edit folder"
            icon="pencil"
            opens
            onClick={() => editFolder(f)}
          />
          {copyRow}
        </div>
        <RestoreAll count={shown} restoreTabs={restoreShown} />
      </>
    );
  } else {
    const starred = scope === "starred";
    const groups = views.scopeGroups(scope);
    title = starred ? "Starred" : "All tabs";
    meta = (
      <span>{`${plural(list.length, "tab")} in ${plural(groups.length, starred ? "starred collection" : "collection")}`}</span>
    );
    tray = <div className="well tray">{copyRow}</div>;
  }
  return (
    <header className="head" id="scope-head">
      <div className="title-row">
        <h2 id="scope-title">{title}</h2>
      </div>
      {meta && <p className="scope-meta">{meta}</p>}
      {tray}
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
// Recent, the bin and a site split their tabs by time; the rest by site.
const facetLabel = (scope: string) =>
  scope === "bin"
    ? "Deleted"
    : scope === "recent" || scope.startsWith("site:")
      ? "Saved"
      : "Sites";
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
      {data && (
        <div className="eyebrow">
          <span>{facetLabel(scope)}</span>
        </div>
      )}
      <div className="well" hidden={!data}>
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
      </div>
    </nav>
  );
});
