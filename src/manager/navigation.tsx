// Column one: the scopes, the folders with their collections, and the sites.
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TabGroup } from "../shared/types.ts";
import { ago, collectionLabel, plural, siteLabel } from "./library.ts";
import {
  type FolderView,
  type Hits,
  type SiteView,
  type Views,
  folders,
  leadUrl,
  siteViews,
} from "./view.ts";
import { foldDone, newFolder, setScope, toggleFolder } from "./actions.ts";
import { icon } from "./ui-icons.tsx";
import { siteIcon } from "./site-icon.tsx";
import { buttonVariants } from "./ui/button.tsx";
import { cn } from "./ui/cn.ts";
import { tabThroughRows, useRowWindow, windowedRows } from "./windowing.tsx";

// The height of a site row, set in manage.css.
const SITE_ROW = 34;

const current = (on: boolean) => (on ? "true" : undefined);
const go = (event: React.MouseEvent<HTMLElement>) =>
  setScope(event.currentTarget.dataset.scope!);

const ScopeRow = memo(function ScopeRow({
  scopeKey,
  label,
  icon: symbol,
  count,
  on,
}: {
  scopeKey: string;
  label: string;
  icon: string;
  count: number;
  on: boolean;
}) {
  return (
    <button
      type="button"
      className={cn("row scope", on && "is-current")}
      data-scope={scopeKey}
      aria-current={current(on)}
      onClick={go}
    >
      {icon(symbol)}
      <span className="label">{label}</span>
      <span className="count">{count}</span>
    </button>
  );
});

const SiteRow = memo(function SiteRow({
  site: s,
  on,
  dim,
}: {
  site: SiteView;
  on: boolean;
  dim: boolean;
}) {
  return (
    <button
      type="button"
      className={cn("row site", on && "is-current", dim && "dim")}
      data-scope={`site:${s.host}`}
      aria-current={current(on)}
      title={`${s.label}\n${siteLabel(s.host)} · ${plural(s.count, "tab")}`}
      onClick={go}
    >
      {siteIcon(s.host ? s.url : "")}
      <span className="label">{s.label}</span>
      <span className="count">{s.count}</span>
    </button>
  );
});

const CollectionRow = memo(function CollectionRow({
  group: g,
  count,
  on,
  dim,
  inFolder = false,
  unfolding = false,
  folding = false,
}: {
  group: TabGroup;
  count: number;
  on: boolean;
  dim: boolean;
  // Set for the rows under a folder, which sit indented and fold with it.
  inFolder?: boolean;
  unfolding?: boolean;
  folding?: boolean;
}) {
  // Only rows coming into view unfold; rows already shown stay put.
  const [unfold] = useState(unfolding);
  const label = collectionLabel(g);
  const lead = leadUrl(g);
  return (
    <button
      type="button"
      className={cn(
        "row collection",
        inFolder && "in-folder",
        unfold && "unfolding",
        folding && "folding",
        on && "is-current",
        dim && "dim",
      )}
      data-scope={`group:${g.id}`}
      data-group={g.id}
      aria-current={current(on)}
      title={`${label}\n${plural(count, "tab")} · saved ${ago(g.createdAt)}`}
      onClick={go}
    >
      {lead ? siteIcon(lead) : icon("folder")}
      <span className={cn("label", !g.name && "unnamed")}>{label}</span>
      {(g.starred || g.locked) && (
        <span className="marks">
          {g.starred && icon("star", "mark star")}
          {g.locked && icon("lock", "mark lock")}
        </span>
      )}
      <span className="count">{count}</span>
    </button>
  );
});

function Folder({
  folder: f,
  views,
  scope,
  collapsed,
  folding,
  unfolding,
  hits,
}: {
  folder: FolderView;
  views: Views;
  scope: string;
  collapsed: boolean;
  folding: boolean;
  unfolding: boolean;
  hits: Hits | null;
}) {
  const key = `folder:${f.name}`;
  // Closing turns the chevron at once and folds the rows away before they go.
  // One folder folds at a time.
  useLayoutEffect(() => {
    if (!folding) return;
    const rows = document.querySelectorAll<HTMLElement>(
      "#navigation .row.folding",
    );
    const running = [...rows].flatMap((row) => row.getAnimations());
    void Promise.race([
      Promise.allSettled(running.map((a) => a.finished)),
      new Promise((done) => setTimeout(done, 400)),
    ]).then(() => foldDone(f.name));
  }, [folding, f.name]);
  const showMembers =
    !collapsed || f.members.some((g) => scope === `group:${g.id}`);
  return (
    <>
      <div className={cn("folder-head", (collapsed || folding) && "closed")}>
        <button
          type="button"
          className="folder-toggle"
          data-folder-toggle={f.name}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${f.name}`}
          onClick={() => toggleFolder(f.name)}
        >
          {icon("chevron")}
        </button>
        <button
          type="button"
          className={cn("row folder", scope === key && "is-current")}
          data-scope={key}
          aria-current={current(scope === key)}
          title={f.name}
          onClick={go}
        >
          {icon(f.icon)}
          <span className="label">{f.name}</span>
          <span className="count">{f.count}</span>
        </button>
      </div>
      {showMembers &&
        f.members.map((g) => (
          <CollectionRow
            key={g.id}
            group={g}
            count={views.live([g]).length}
            on={scope === `group:${g.id}`}
            dim={!!hits && !hits.groups.has(g.id)}
            inFolder
            unfolding={unfolding}
            folding={folding}
          />
        ))}
    </>
  );
}

const newFolderClass = cn(
  buttonVariants({ variant: "ghost", size: "icon-xs" }),
  "eyebrow-action",
);

export const Navigation = memo(function Navigation({
  views,
  scope,
  collapsed,
  folding,
  unfolding,
  hits,
}: {
  views: Views | null;
  scope: string;
  collapsed: ReadonlySet<string>;
  folding?: string;
  unfolding?: string;
  hits: Hits | null;
}) {
  const folderList = useMemo(() => (views ? folders(views) : []), [views]);
  // Collections outside any folder follow the folders, newest first.
  const unfiled = useMemo(
    () => (views ? views.lib.ordered.filter((g) => !g.folder) : []),
    [views],
  );
  const siteList = useMemo(() => (views ? siteViews(views.all) : []), [views]);
  // Hundreds of sites are windowed; the current and the focused one stay.
  const list = useRef<HTMLElement>(null);
  const section = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<string>();
  const { range } = useRowWindow(list, section, siteList.length, SITE_ROW);
  const keys = () => siteList.map((s) => `site:${s.host}`);
  const rows = windowedRows(
    siteList.length,
    SITE_ROW,
    range,
    [scope, focused].map((key) =>
      key?.startsWith("site:")
        ? siteList.findIndex((s) => s.host === key.slice(5))
        : -1,
    ),
    (index) => {
      const s = siteList[index];
      return (
        <SiteRow
          key={s.host}
          site={s}
          on={scope === `site:${s.host}`}
          dim={!!hits && !hits.hosts.has(s.host)}
        />
      );
    },
  );
  if (!views)
    return (
      <nav ref={list} id="navigation" className="list" aria-label="Saved tabs">
        <div ref={section} />
      </nav>
    );
  const all = views.all.length;
  return (
    <nav
      ref={list}
      id="navigation"
      className="list"
      aria-label="Saved tabs"
      onFocus={(event) => {
        const key = (event.target as HTMLElement).dataset.scope;
        if (key?.startsWith("site:") && key !== focused) setFocused(key);
      }}
      onKeyDown={(event) =>
        tabThroughRows(event, ".row.site", "data-scope", keys(), setFocused)
      }
    >
      <ScopeRow
        scopeKey="recent"
        label="Recent"
        icon="recent"
        count={all}
        on={scope === "recent"}
      />
      <ScopeRow
        scopeKey="all"
        label="All tabs"
        icon="tabs"
        count={all}
        on={scope === "all"}
      />
      <ScopeRow
        scopeKey="starred"
        label="Starred"
        icon="star"
        count={views.live(views.scopeGroups("starred")).length}
        on={scope === "starred"}
      />
      <ScopeRow
        scopeKey="bin"
        label="Bin"
        icon="trash"
        count={views.bin().length}
        on={scope === "bin"}
      />
      <div className="eyebrow">
        <span>Collections</span>
        <button
          type="button"
          className={newFolderClass}
          data-action="new-folder"
          aria-label="New folder"
          title="New folder"
          onClick={newFolder}
        >
          {icon("plus")}
        </button>
      </div>
      {folderList.map((f) => (
        <Folder
          key={f.name}
          folder={f}
          views={views}
          scope={scope}
          collapsed={collapsed.has(f.name)}
          folding={folding === f.name}
          unfolding={unfolding === f.name}
          hits={hits}
        />
      ))}
      {unfiled.map((g) => (
        <CollectionRow
          key={g.id}
          group={g}
          count={views.live([g]).length}
          on={scope === `group:${g.id}`}
          dim={!!hits && !hits.groups.has(g.id)}
        />
      ))}
      <div className="eyebrow">
        <span>Sites</span>
      </div>
      {!all && (
        <p className="quiet">Saved tabs appear here, grouped by site.</p>
      )}
      <div ref={section}>{rows}</div>
    </nav>
  );
});
