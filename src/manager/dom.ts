interface ManagerElements {
  "#app": HTMLElement;
  "#vine": SVGSVGElement;
  "#col-1": HTMLElement;
  "#col-2": HTMLElement;
  "#col-3": HTMLElement;
  "#theme-toggle": HTMLButtonElement;
  "#summary": HTMLElement;
  "#save-window": HTMLButtonElement;
  "#navigation": HTMLElement;
  "#transfer-open": HTMLButtonElement;
  "#settings-open": HTMLButtonElement;
  "#shortcuts": HTMLButtonElement;
  "#scope-head": HTMLElement;
  "#facets": HTMLElement;
  "#drop-zone": HTMLElement;
  "#heading": HTMLElement;
  "#subheading": HTMLElement;
  "#search": HTMLInputElement;
  "#list-head": HTMLElement;
  "#select-all": HTMLInputElement;
  "#list-meta": HTMLElement;
  "#restore-all": HTMLButtonElement;
  "#undo": HTMLButtonElement;
  "#groups": HTMLElement;
  "#selection": HTMLElement;
  "#selected-count": HTMLElement;
  "#restore-selected": HTMLButtonElement;
  "#move-selected": HTMLButtonElement;
  "#copy-selected": HTMLButtonElement;
  "#delete-selected": HTMLButtonElement;
  "#clear-selected": HTMLButtonElement;
  "#hint": HTMLElement;
  "#status": HTMLElement;
  "#status-text": HTMLElement;
  "#status-undo": HTMLButtonElement;
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
