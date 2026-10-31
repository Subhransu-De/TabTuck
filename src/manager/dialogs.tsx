// The dialogs, in a bundle of their own that loads the first time one opens.
// This bundle takes React from manage.js and gets everything with state
// through props; it imports no module that holds page state.
//
// Each dialog is a tray: a title strip, wells for what it holds, and a
// footer strip with its action.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";
import { Tabs } from "@base-ui/react/tabs";
import type { Settings } from "../shared/types.ts";
import type {
  DialogName,
  DialogState,
  PromptRequest,
  PromptResult,
} from "./dialog-state.ts";
import { consequence, duration, erasedBy } from "./bin-time.ts";
import { plural } from "./library.ts";
import { BinTime } from "./bin-time-control.tsx";
import { folderIcons, icon } from "./ui-icons.tsx";
import { Button, buttonVariants } from "./ui/button.tsx";
import { Kbd } from "./ui/kbd.tsx";
import { cn } from "./ui/cn.ts";
import { Input, NativeSelect, Textarea } from "./ui/fields.tsx";
import { Switch } from "./ui/switch.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog.tsx";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog.tsx";

export interface DialogsProps {
  state: DialogState;
  settings: Settings;
  // When each tab in the bin was deleted.
  binTimes: number[];
  host: {
    run: (fn: () => unknown) => Promise<void>;
    toast: (message: string) => void;
    close: (name: DialogName) => void;
    closePrompt: () => void;
    agree: () => Promise<void>;
    importText: (text: string, done: (result: string) => void) => Promise<void>;
    exportJson: () => Promise<void>;
    exportPlain: () => Promise<void>;
    saveSettings: (
      settings: Partial<Settings>,
      done: () => void,
    ) => Promise<void>;
    openShortcuts: () => Promise<void>;
  };
}
type Host = DialogsProps["host"];

const PRIVACY =
  "https://github.com/Subhransu-De/TabTuck/blob/main/wiki/privacy.md";
const link = cn(
  buttonVariants({ variant: "ghost", size: "sm" }),
  "[&_svg]:size-3.5",
);
const quiet = buttonVariants({ variant: "outline" });

// Import or Export, as two tabs on one segmented track.
const tab =
  "inline-flex h-6.5 flex-1 items-center justify-center rounded-[7px] px-3 font-medium text-ink-2 outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-active:bg-well data-active:text-ink-0 data-active:shadow-[inset_0_0_0_1px_var(--tt-line-2),0_1px_2px_rgb(0_0_0/0.2)]";

function Transfer({ open, host }: { open: boolean; host: Host }) {
  // Kept while the dialog is closed, like the page's own text fields.
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [panel, setPanel] = useState("import");
  const file = useRef<HTMLInputElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && host.close("transfer")}
    >
      <DialogContent id="transfer" className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle id="transfer-title">Import / Export</DialogTitle>
        </DialogHeader>
        <Tabs.Root
          value={panel}
          onValueChange={(next) => setPanel(next as string)}
        >
          <Tabs.List
            aria-label="Import or export"
            className="mb-2 flex gap-0.5 rounded-[10px] bg-recess p-0.75 shadow-[inset_0_0_0_1px_var(--tt-line)]"
          >
            <Tabs.Tab id="transfer-tab-import" value="import" className={tab}>
              Import
            </Tabs.Tab>
            <Tabs.Tab id="transfer-tab-export" value="export" className={tab}>
              Export
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="import" className="outline-none">
            <Textarea
              id="import-text"
              aria-label="Import text"
              className="h-40 resize-y font-mono text-[13px] leading-normal"
              placeholder={
                "https://example.com/ | Example Domain\nhttps://developer.mozilla.org/ | MDN Web Docs\n\nA blank line starts a new collection."
              }
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <input
              ref={file}
              type="file"
              id="import-file"
              accept=".txt,.json,text/plain,application/json"
              hidden
              onChange={async (event) => {
                const chosen = event.target.files?.[0];
                if (!chosen) return;
                if (chosen.size > 50 * 1024 * 1024) {
                  host.toast("Choose a file smaller than 50 MB.");
                  return;
                }
                setText(await chosen.text());
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => file.current?.click()}>
                {icon("upload")}
                Choose file
              </Button>
              <p className="min-w-0 flex-1 truncate px-1 text-ink-2">
                <span id="import-result" role="status">
                  {result}
                </span>
                {!result && "Text or a TabTuck backup"}
              </p>
              <Button
                id="import"
                onClick={() =>
                  host.importText(text, (done) => {
                    setResult(done);
                    setText("");
                    if (file.current) file.current.value = "";
                  })
                }
              >
                Import tabs
              </Button>
            </DialogFooter>
          </Tabs.Panel>
          <Tabs.Panel value="export" className="outline-none">
            <div className="well">
              <div className="dialog-row">
                {icon("file-json")}
                <span className="stack">
                  <span>Backup</span>
                  <span className="sub">
                    Everything, with folders, stars and locks. Import it to
                    restore.
                  </span>
                </span>
                <Button
                  id="export-json"
                  variant="outline"
                  size="sm"
                  onClick={host.exportJson}
                >
                  {icon("download")}
                  JSON
                </Button>
              </div>
              <div className="dialog-row">
                {icon("file-text")}
                <span className="stack">
                  <span>Link list</span>
                  <span className="sub">
                    One link and title per line, for any other app.
                  </span>
                </span>
                <Button
                  id="export-text"
                  variant="outline"
                  size="sm"
                  onClick={host.exportPlain}
                >
                  {icon("download")}
                  Text
                </Button>
              </div>
            </div>
          </Tabs.Panel>
        </Tabs.Root>
      </DialogContent>
    </Dialog>
  );
}

function SwitchRow({
  label,
  sub,
  checked,
  onCheckedChange,
  setting,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  setting: string;
}) {
  return (
    <label className="dialog-row">
      <span className="stack">
        <span>{label}</span>
        {sub && <span className="sub">{sub}</span>}
      </span>
      <Switch
        data-setting={setting}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </label>
  );
}
// One row per command: what it does, then its keys.
function Shortcuts() {
  const [commands, setCommands] = useState<chrome.commands.Command[]>();
  useEffect(() => {
    let live = true;
    void chrome.commands.getAll().then((all) => live && setCommands(all));
    return () => {
      live = false;
    };
  }, []);
  return (
    <div id="command-status" className="well">
      {commands?.map((c) => (
        <div key={c.name} className="dialog-row">
          <span className="stack">
            <span>{c.description}</span>
          </span>
          {c.shortcut ? (
            <span className="keys">
              {c.shortcut.split("+").map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          ) : (
            <span className="text-ink-3">Not assigned</span>
          )}
        </div>
      ))}
    </div>
  );
}
function Options({
  settings,
  binTimes,
  host,
}: {
  settings: Settings;
  binTimes: number[];
  host: Host;
}) {
  const [keepRestored, setKeepRestored] = useState(settings.keepRestored);
  const [deduplicate, setDeduplicate] = useState(settings.deduplicate);
  const [hours, setHours] = useState(settings.binHours);
  const [amountError, setAmountError] = useState("");
  const [erasing, setErasing] = useState(0);
  // The line under the bin time counts from when Options opened.
  const [now] = useState(() => Date.now());
  const save = () =>
    host.saveSettings({ keepRestored, deduplicate, binHours: hours }, () =>
      host.close("settings"),
    );
  function submit(event: FormEvent) {
    event.preventDefault();
    if (amountError) return;
    const lost = erasedBy(hours, binTimes, Date.now());
    if (lost) setErasing(lost);
    else void save();
  }
  return (
    <form onSubmit={submit} className="contents" noValidate>
      <div className="well">
        <SwitchRow
          label="Keep a tab saved after opening it"
          setting="keepRestored"
          checked={keepRestored}
          onCheckedChange={setKeepRestored}
        />
        <SwitchRow
          label="Skip links already saved"
          sub="Closes the duplicate tab instead"
          setting="deduplicate"
          checked={deduplicate}
          onCheckedChange={setDeduplicate}
        />
        <BinTime
          value={hours}
          onChange={setHours}
          onErrorChange={setAmountError}
          note={consequence(hours, binTimes, now)}
          warn={!!erasedBy(hours, binTimes, now)}
        />
      </div>
      <div className="dialog-label">
        <span>Shortcuts</span>
        <Button
          id="shortcuts"
          variant="ghost"
          size="sm"
          className="[&_svg]:size-3.5"
          onClick={host.openShortcuts}
        >
          Change
          {icon("external")}
        </Button>
      </div>
      <Shortcuts />
      <DialogFooter>
        <span className="mr-auto flex min-w-0 items-center gap-2 pl-2 text-ink-2 [&_svg]:size-3.5">
          {icon("shield")}
          Tabs stay on this device.
        </span>
        <a
          href={PRIVACY}
          target="_blank"
          rel="noopener noreferrer"
          className={link}
        >
          Privacy policy
          {icon("external")}
        </a>
        <Button type="submit" id="settings-save" disabled={!!amountError}>
          Save
        </Button>
      </DialogFooter>
      <AlertDialog
        open={!!erasing}
        onOpenChange={(next) => !next && setErasing(0)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`Erase ${plural(erasing, "tab")} now?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {`They were deleted more than ${duration(hours)} ago, so the shorter bin time erases them for good.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose className={quiet}>Cancel</AlertDialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setErasing(0);
                void save();
              }}
            >
              Erase and save
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

const facts = [
  "Everything stays in this browser, on this device.",
  "No account, no tracking, and no network requests.",
  "Your tabs are never sent or shared with anyone.",
  "Delete them any time, or remove TabTuck to erase everything.",
];
// Chrome Web Store policy: the user agrees to this notice before any tab is
// saved. It cannot be dismissed.
function Consent({ open, host }: { open: boolean; host: Host }) {
  const title = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog open={open} disablePointerDismissal>
      <DialogContent
        id="consent"
        showCloseButton={false}
        aria-describedby="consent-summary"
        // Start on the title so nothing is outlined until the keyboard is used.
        initialFocus={title}
        className="sm:max-w-[460px]"
      >
        <img className="consent-mark" src="../icons/128.png" alt="" />
        <div className="grid gap-1.5 px-2 pb-3">
          <DialogTitle
            id="consent-title"
            ref={title}
            tabIndex={-1}
            className="text-[19px] leading-tight font-semibold tracking-[-0.015em] text-ink-0 outline-none"
          >
            Before you save tabs
          </DialogTitle>
          <DialogDescription
            id="consent-summary"
            className="leading-normal text-pretty"
          >
            TabTuck saves the address and title of each tab you choose to save,
            so you can find it and restore it later.
          </DialogDescription>
        </div>
        <div className="well">
          <ul className="consent-facts">
            {facts.map((fact) => (
              <li key={fact}>
                {icon("done")}
                {fact}
              </li>
            ))}
          </ul>
          <div className="mx-1 my-1 h-px bg-border" />
          <div className="p-1">
            <Button
              id="consent-agree"
              size="lg"
              className="w-full"
              onClick={host.agree}
            >
              Agree and continue
            </Button>
          </div>
        </div>
        <div className="flex justify-center pt-2">
          <a
            href={PRIVACY}
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            Read the privacy policy
            {icon("external")}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const chip =
  "inline-flex size-9 cursor-default items-center justify-center rounded-lg text-ink-2 outline-none transition-colors select-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-checked:bg-well data-checked:text-ink-0 data-checked:shadow-[inset_0_0_0_1px_var(--tt-line-2)] [&_svg]:size-4.5";
const fieldLabel = "text-[13px] font-medium text-ink-2";
function PromptForm({ request, host }: { request: PromptRequest; host: Host }) {
  const [name, setName] = useState(request.value ?? "");
  const [choice, setChoice] = useState(request.options?.[0]?.[0] ?? "");
  const [picked, setPicked] = useState(request.folderIcon ?? "folder");
  const finish = (result: PromptResult) => {
    request.resolve(result);
    host.closePrompt();
  };
  function submit(event: FormEvent) {
    event.preventDefault();
    finish(
      request.folderIcon !== undefined
        ? { name, icon: picked }
        : request.options
          ? choice
          : request.value !== undefined
            ? name
            : true,
    );
  }
  return (
    <form id="prompt-form" onSubmit={submit} className="grid">
      <DialogHeader>
        <DialogTitle id="prompt-title">{request.title}</DialogTitle>
        {request.description && (
          <DialogDescription id="prompt-description" className="text-pretty">
            {request.description}
          </DialogDescription>
        )}
      </DialogHeader>
      <div className="grid gap-4 px-2 pt-1 pb-2">
        {request.value !== undefined && (
          <div className="grid gap-1.5">
            <label htmlFor="prompt-input" className={fieldLabel}>
              Name
            </label>
            <Input
              id="prompt-input"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        )}
        {request.options && (
          <NativeSelect
            id="prompt-select"
            aria-label="Destination"
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
          >
            {request.options.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </NativeSelect>
        )}
        {request.folderIcon !== undefined && (
          <div className="grid gap-1.5">
            <span id="folder-icons-label" className={fieldLabel}>
              Icon
            </span>
            <RadioGroup
              id="folder-icons"
              aria-labelledby="folder-icons-label"
              value={picked}
              onValueChange={(next) => setPicked(next as string)}
              className="-mx-1 flex flex-wrap gap-0.5"
            >
              {Object.entries(folderIcons).map(([key, [label]]) => (
                <Radio.Root
                  key={key}
                  value={key}
                  aria-label={label}
                  title={label}
                  className={chip}
                >
                  {icon(key)}
                </Radio.Root>
              ))}
            </RadioGroup>
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose id="prompt-cancel" className={quiet}>
          Cancel
        </DialogClose>
        <Button type="submit">{request.action ?? "Confirm"}</Button>
      </DialogFooter>
    </form>
  );
}
// A question with an answer field, or a yes-or-no question about erasing.
function Prompt({
  request,
  host,
}: {
  request: PromptRequest | null;
  host: Host;
}) {
  // The last question stays on screen while its dialog closes; each new one
  // starts with fresh fields.
  const [shown, setShown] = useState(request);
  const [round, setRound] = useState(0);
  if (request && request !== shown) {
    setShown(request);
    setRound(round + 1);
  }
  const cancel = (open: boolean) => {
    if (open || !request) return;
    request.resolve(null);
    host.closePrompt();
  };
  const fields =
    !!shown &&
    (shown.value !== undefined || !!shown.options || !!shown.folderIcon);
  if (shown && !fields)
    return (
      <AlertDialog open={!!request} onOpenChange={cancel}>
        <AlertDialogContent id="prompt">
          <AlertDialogHeader>
            <AlertDialogTitle id="prompt-title">{shown.title}</AlertDialogTitle>
            <AlertDialogDescription id="prompt-description">
              {shown.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose id="prompt-cancel" className={quiet}>
              Cancel
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                shown.resolve(true);
                host.closePrompt();
              }}
            >
              {shown.action ?? "Confirm"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  return (
    <Dialog open={!!request} onOpenChange={cancel}>
      <DialogContent id="prompt" className="sm:max-w-[420px]">
        {shown && <PromptForm key={round} request={shown} host={host} />}
      </DialogContent>
    </Dialog>
  );
}

function Dialogs({ state, settings, binTimes, host }: DialogsProps) {
  return (
    <>
      <Transfer open={state.transfer} host={host} />
      <Dialog
        open={state.settings}
        onOpenChange={(next) => !next && host.close("settings")}
      >
        <DialogContent id="settings" className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle id="settings-title">Options</DialogTitle>
          </DialogHeader>
          <Options settings={settings} binTimes={binTimes} host={host} />
        </DialogContent>
      </Dialog>
      <Consent open={state.consent} host={host} />
      <Prompt request={state.prompt} host={host} />
    </>
  );
}

// The page renders the dialogs through this function, so its own component
// tree only ever names components defined in its bundle.
export function renderDialogs(props: DialogsProps) {
  return <Dialogs {...props} />;
}
