// Which dialogs are open. The dialogs themselves load on first use, from
// their own bundle; see dialogs.tsx.
import { store } from "./store.ts";

export type PromptResult =
  string | boolean | { name: string; icon: string } | null;
export interface PromptRequest {
  title: string;
  description?: string;
  // A name field with this text.
  value?: string;
  // A destination list of [id, label] pairs.
  options?: string[][];
  // An icon picker with this icon chosen.
  folderIcon?: string;
  resolve: (result: PromptResult) => void;
}
export interface DialogState {
  transfer: boolean;
  settings: boolean;
  consent: boolean;
  prompt: PromptRequest | null;
}
export const dialogs = store<DialogState>({
  transfer: false,
  settings: false,
  consent: false,
  prompt: null,
});
export type DialogName = "transfer" | "settings" | "consent";
export function setDialog(name: DialogName, open: boolean) {
  dialogs.set({ ...dialogs.get(), [name]: open });
}
export function anyDialog() {
  const d = dialogs.get();
  return d.transfer || d.settings || d.consent || !!d.prompt;
}

type PromptOptions = Omit<PromptRequest, "title" | "resolve">;
export function ask(
  title: string,
  options: PromptOptions & { folderIcon: string },
): Promise<{ name: string; icon: string } | null>;
export function ask(
  title: string,
  options: PromptOptions & ({ value: string } | { options: string[][] }),
): Promise<string | null>;
export function ask(
  title: string,
  options?: PromptOptions,
): Promise<true | null>;
export function ask(
  title: string,
  options: PromptOptions = {},
): Promise<PromptResult> {
  return new Promise((resolve) => {
    dialogs.get().prompt?.resolve(null);
    dialogs.set({ ...dialogs.get(), prompt: { title, ...options, resolve } });
  });
}
