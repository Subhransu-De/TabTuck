interface ManagerElements {
  "#navigation": HTMLElement;
  "#new-folder": HTMLButtonElement;
  "#transfer-open": HTMLButtonElement;
  "#settings-open": HTMLButtonElement;
  "#heading": HTMLElement;
  "#summary": HTMLElement;
  "#save-window": HTMLButtonElement;
  "#search": HTMLInputElement;
  "#restore-all": HTMLButtonElement;
  "#undo": HTMLButtonElement;
  "#selection": HTMLElement;
  "#selected-count": HTMLElement;
  "#restore-selected": HTMLButtonElement;
  "#move-selected": HTMLButtonElement;
  "#delete-selected": HTMLButtonElement;
  "#clear-selected": HTMLButtonElement;
  "#groups": HTMLElement;
  "#drop-zone": HTMLElement;
  "#shortcuts": HTMLButtonElement;
  "#status": HTMLElement;
  "#transfer": HTMLDialogElement;
  "#transfer-title": HTMLElement;
  "#import-text": HTMLTextAreaElement;
  "#import-file": HTMLInputElement;
  "#import": HTMLButtonElement;
  "#export-json": HTMLButtonElement;
  "#export-text": HTMLButtonElement;
  "#import-result": HTMLElement;
  "#settings": HTMLDialogElement;
  "#settings-title": HTMLElement;
  "#command-status": HTMLElement;
  "#settings-save": HTMLButtonElement;
  "#prompt": HTMLDialogElement;
  "#prompt-form": HTMLFormElement;
  "#prompt-title": HTMLElement;
  "#prompt-description": HTMLElement;
  "#prompt-input": HTMLInputElement;
  "#prompt-select": HTMLSelectElement;
  "#folder-icons": HTMLFieldSetElement;
  "#prompt-cancel": HTMLButtonElement;
}

export function $<K extends keyof ManagerElements>(
  selector: K,
): ManagerElements[K] {
  const element = document.querySelector<ManagerElements[K]>(selector);
  if (!element) throw new Error(`Missing manager element: ${selector}`);
  return element;
}
