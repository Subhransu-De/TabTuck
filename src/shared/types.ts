export interface SavedTab {
  id: string;
  url: string;
  title: string;
  addedAt?: number;
  sourceLocked?: boolean;
}
export interface TabGroup {
  id: string;
  name: string;
  createdAt: number;
  starred: boolean;
  locked: boolean;
  folder: string;
  folderIcon?: string;
  collapsed?: boolean;
  site?: boolean;
  tabs: SavedTab[];
}
export interface Settings {
  keepRestored: boolean;
  deduplicate: boolean;
  showAfterSave: boolean;
  theme: string;
}
export interface State {
  version: number;
  groups: TabGroup[];
  settings: Settings;
  trash?: { groups: TabGroup[]; at: number }[];
}
export type CaptureMode =
  "current" | "selected" | "other" | "left" | "right" | "all";
export interface Selection {
  groupId?: string;
  ids?: string[];
}
export interface RestoreOptions extends Selection {
  keep?: boolean;
}
export interface RestoreResult {
  count: number;
  failed: string[];
}
export interface CaptureResult {
  count: number;
  notClosed?: number;
}
export type GroupPatch = Partial<
  Pick<
    TabGroup,
    "name" | "folder" | "starred" | "locked" | "collapsed" | "folderIcon"
  >
>;
export type Message = (
  | { type: "state" }
  | { type: "show" }
  | { type: "capture"; mode: CaptureMode }
  | ({ type: "restore" } & RestoreOptions)
  | { type: "settings"; settings: Partial<Settings> }
  | { type: "import"; text: string }
  | { type: "update"; groupId: string; patch: GroupPatch }
  | ({ type: "delete" } & Selection)
  | { type: "undo" }
  | {
      type: "move";
      ids: string[];
      targetId?: string;
      beforeId?: string;
      name?: string;
    }
  | { type: "reorder"; groupId: string; tabId?: string; beforeId?: string }
) & { groupId?: string };
export type MessageResult<M extends Message> = M extends { type: "restore" }
  ? RestoreResult
  : M extends { type: "capture" }
    ? CaptureResult
    : M extends { type: "import" }
      ? { groups: number; tabs: number }
      : M extends { type: "show" }
        ? chrome.tabs.Tab | undefined
        : State;
export type Reply<M extends Message = Message> =
  { ok: true; result: MessageResult<M> } | { ok: false; error: string };
