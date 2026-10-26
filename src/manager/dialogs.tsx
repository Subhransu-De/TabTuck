// The dialogs, in a bundle of their own that loads the first time one opens.
// This bundle takes React from manage.js and gets everything with state
// through props; it imports no module that holds page state.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";
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
import { Input, NativeSelect, Separator, Textarea } from "./ui/fields.tsx";
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
  AlertDialogMedia,
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
const link = cn(buttonVariants({ variant: "link", size: "sm" }), "-mx-3");

function Transfer({ open, host }: { open: boolean; host: Host }) {
  // Kept while the dialog is closed, like the page's own text fields.
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const file = useRef<HTMLInputElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && host.close("transfer")}
    >
      <DialogContent id="transfer" className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle id="transfer-title">Import / Export</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Textarea
            id="import-text"
            aria-label="Import text"
            className="h-45 resize-y font-mono text-xs leading-normal"
            placeholder={
              "https://example.com/ | Example Domain\nhttps://developer.mozilla.org/ | MDN Web Docs\n\nhttps://news.ycombinator.com/ | Hacker News"
            }
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <input
            ref={file}
            type="file"
            id="import-file"
            accept=".txt,.json,text/plain,application/json"
            className="file-input"
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
        </div>
        <DialogFooter>
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
          <Button id="export-json" variant="outline" onClick={host.exportJson}>
            Backup as JSON
          </Button>
          <Button id="export-text" variant="outline" onClick={host.exportPlain}>
            Export as text
          </Button>
        </DialogFooter>
        <p
          id="import-result"
          role="status"
          className="-mt-2 text-sm text-muted-foreground empty:hidden"
        >
          {result}
        </p>
      </DialogContent>
    </Dialog>
  );
}

function SwitchRow({
  label,
  checked,
  onCheckedChange,
  setting,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  setting: string;
}) {
  return (
    <label className="flex items-center justify-between gap-6 py-4 text-sm leading-snug">
      {label}
      <Switch
        data-setting={setting}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </label>
  );
}
// "Save the current tab: Alt+C · Show TabTuck: Alt+Q", with keys as Kbd.
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
    <p id="command-status" className="leading-relaxed text-muted-foreground">
      {commands?.map((c, i) => (
        <span key={c.name}>
          {i > 0 && " · "}
          {`${c.description}: `}
          {c.shortcut ? (
            <Kbd className="mx-0.5 align-baseline font-mono">{c.shortcut}</Kbd>
          ) : (
            "Not assigned — use Change shortcuts"
          )}
        </span>
      ))}
    </p>
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
      <div className="flex flex-col">
        <SwitchRow
          label="Keep a tab in TabTuck after opening it"
          setting="keepRestored"
          checked={keepRestored}
          onCheckedChange={setKeepRestored}
        />
        <Separator />
        <SwitchRow
          label="Skip URLs already saved (close the duplicate tab)"
          setting="deduplicate"
          checked={deduplicate}
          onCheckedChange={setDeduplicate}
        />
        <Separator />
        <div className="flex flex-col gap-2 py-4">
          <BinTime
            value={hours}
            onChange={setHours}
            onErrorChange={setAmountError}
          />
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {consequence(hours, binTimes, now)}
          </p>
        </div>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4">
          <Shortcuts />
          <Button
            id="shortcuts"
            variant="link"
            size="sm"
            className="-mx-3"
            onClick={host.openShortcuts}
          >
            Change shortcuts
          </Button>
        </div>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4">
          <p className="leading-relaxed text-muted-foreground">
            Saved tabs stay on this device and are never sent anywhere.
          </p>
          <a
            href={PRIVACY}
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            Privacy policy
          </a>
        </div>
      </div>
      <DialogFooter className="mt-2">
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
            <AlertDialogMedia>{icon("trash")}</AlertDialogMedia>
            <AlertDialogTitle>{`Erase ${plural(erasing, "tab")} now?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {`They were deleted more than ${duration(hours)} ago, so the shorter bin time erases them for good.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              className={buttonVariants({ variant: "outline" })}
            >
              Cancel
            </AlertDialogClose>
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
        layout="p-7 pb-6"
        className="sm:max-w-[460px]"
      >
        <img className="consent-mark" src="../icons/128.png" alt="" />
        <DialogTitle
          id="consent-title"
          ref={title}
          tabIndex={-1}
          className="mb-2 text-[22px] leading-tight font-semibold tracking-tight outline-none"
        >
          Before you save tabs
        </DialogTitle>
        <DialogDescription
          id="consent-summary"
          className="mb-4 text-sm leading-normal"
        >
          TabTuck saves the address and title of each tab you choose to save, so
          you can find it and restore it later.
        </DialogDescription>
        <ul className="consent-facts">
          <li>Everything stays in this browser, on this device.</li>
          <li>No account, no tracking, and no network requests.</li>
          <li>Your tabs are never sent or shared with anyone.</li>
          <li>Delete them any time, or remove TabTuck to erase everything.</li>
        </ul>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <a
            href={PRIVACY}
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            Read the privacy policy
          </a>
          <Button id="consent-agree" onClick={host.agree}>
            Agree and continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const chip =
  "inline-flex size-10 cursor-default items-center justify-center rounded-3xl border border-input text-foreground outline-none transition-colors select-none hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 data-checked:border-primary/35 data-checked:bg-(--tt-accent-soft) data-checked:text-primary [&_svg]:size-4.5";
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
    <form id="prompt-form" onSubmit={submit} className="grid gap-5">
      <DialogHeader className="pr-10">
        <DialogTitle id="prompt-title">{request.title}</DialogTitle>
        {request.description && (
          <DialogDescription id="prompt-description">
            {request.description}
          </DialogDescription>
        )}
      </DialogHeader>
      {request.value !== undefined && (
        <Input
          id="prompt-input"
          aria-label="Name"
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
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
        <div className="grid gap-2">
          <span
            id="folder-icons-label"
            className="font-mono text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
          >
            Icon
          </span>
          <RadioGroup
            id="folder-icons"
            aria-labelledby="folder-icons-label"
            value={picked}
            onValueChange={(next) => setPicked(next as string)}
            className="flex flex-wrap gap-2"
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
      <DialogFooter>
        <DialogClose
          id="prompt-cancel"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancel
        </DialogClose>
        <Button type="submit">Confirm</Button>
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
            <AlertDialogMedia>{icon("trash")}</AlertDialogMedia>
            <AlertDialogTitle id="prompt-title">{shown.title}</AlertDialogTitle>
            <AlertDialogDescription id="prompt-description">
              {shown.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              id="prompt-cancel"
              className={buttonVariants({ variant: "outline" })}
            >
              Cancel
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                shown.resolve(true);
                host.closePrompt();
              }}
            >
              Confirm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  return (
    <Dialog open={!!request} onOpenChange={cancel}>
      <DialogContent id="prompt" className="sm:max-w-md">
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
        <DialogContent
          id="settings"
          layout="gap-2 p-6"
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[560px]"
        >
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
