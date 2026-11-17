// Column one: the scopes and the sites.
import { memo, useMemo, useRef, useState } from "react";
import { plural, siteLabel } from "./library.ts";
import { type Hits, type SiteView, type Views, siteViews } from "./view.ts";
import { setScope } from "./actions.ts";
import { icon } from "./ui-icons.tsx";
import { siteIcon } from "./site-icon.tsx";
import { cn } from "./ui/cn.ts";
import { tabThroughRows, useRowWindow, windowedRows } from "./windowing.tsx";

// The height of a site row, set in manage.css.
const SITE_ROW = 32;

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

export const Navigation = memo(function Navigation({
  views,
  scope,
  hits,
}: {
  views: Views | null;
  scope: string;
  hits: Hits | null;
}) {
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
      <div className="well">
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
      </div>
      <div className="eyebrow">
        <span>Sites</span>
        {!!siteList.length && <span className="count">{siteList.length}</span>}
      </div>
      {!all && (
        <p className="quiet">Saved tabs appear here, grouped by site.</p>
      )}
      <div className="well" hidden={!siteList.length}>
        <div ref={section}>{rows}</div>
      </div>
    </nav>
  );
});
