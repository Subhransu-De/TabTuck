// A small dev toolbar in the page's corner: switch scenario or seed, reset the
// data, reopen the demo tabs, move the clock. It lives in a shadow root so the
// page's styles and the toolbar's never touch.
interface Dev {
  scenario: string;
  seed: number;
  clockDays: number;
  scenarios: Record<string, string>;
  open(next: { scenario?: string; seed?: number }): void;
  reset(): void;
  reopenTabs(): void;
  moveClock(days: number | null): void;
}
const CSS = `
:host { all: initial; }
.dev { position: fixed; right: 12px; bottom: 12px; z-index: 2147483647;
  display: flex; flex-direction: column; align-items: flex-end;
  font: 12px/1.4 system-ui, sans-serif; color: #f4f1ea; }
button, select, input { font: inherit; color: inherit; }
.pill { border: 0; border-radius: 999px; padding: 5px 10px; cursor: pointer;
  background: #2a2723; box-shadow: 0 2px 8px rgb(0 0 0 / .25); }
.pill b { color: #f5b14c; font-weight: 600; }
.card { display: none; margin-bottom: 8px; width: 260px; padding: 12px;
  border-radius: 10px; background: #2a2723; box-shadow: 0 6px 24px rgb(0 0 0 / .3); }
.open .card { display: grid; gap: 10px; }
label { display: grid; gap: 4px; color: #c9c2b6; }
select, input { padding: 5px 6px; border-radius: 6px; border: 1px solid #4a453e;
  background: #1d1b18; }
.row { display: flex; gap: 6px; flex-wrap: wrap; }
.row button { flex: 1; padding: 5px 8px; border-radius: 6px; border: 1px solid #4a453e;
  background: #34302b; cursor: pointer; }
.row button:hover, .pill:hover { background: #3d3832; }
:focus-visible { outline: 2px solid #f5b14c; outline-offset: 2px; }
.note { color: #a39b8e; margin: 0; }
`;
export function showPanel(dev: Dev) {
  const host = document.createElement("div");
  host.id = "tabtuck-dev-panel";
  const root = host.attachShadow({ mode: "open" });
  const clock = dev.clockDays
    ? `${dev.clockDays > 0 ? "+" : ""}${dev.clockDays}d`
    : "";
  root.innerHTML = `<style>${CSS}</style>
<div class="dev">
  <div class="card" role="group" aria-label="Dev data">
    <label>Scenario<select name="scenario">${Object.entries(dev.scenarios)
      .map(
        ([key, about]) =>
          `<option value="${key}" title="${about}">${key}</option>`,
      )
      .join("")}</select></label>
    <p class="note">${dev.scenarios[dev.scenario]}</p>
    <label>Seed<input name="seed" type="number" min="1" value="${dev.seed}"></label>
    <div class="row">
      <button data-do="reset" title="Back to the scenario as built">Reset data</button>
      <button data-do="tabs" title="Open the demo tabs again">Reopen tabs</button>
    </div>
    <label>Clock ${clock ? `(${clock})` : "(real time)"}</label>
    <div class="row">
      <button data-do="back">−1 day</button>
      <button data-do="ahead">+1 day</button>
      <button data-do="now">Now</button>
    </div>
  </div>
  <button class="pill" aria-expanded="false">Dev · <b>${dev.scenario}</b>${clock ? ` · ${clock}` : ""}</button>
</div>`;
  const panel = root.querySelector<HTMLElement>(".dev")!;
  const pill = root.querySelector<HTMLButtonElement>(".pill")!;
  const select = root.querySelector<HTMLSelectElement>("select")!;
  const seed = root.querySelector<HTMLInputElement>("input")!;
  select.value = dev.scenario;
  pill.onclick = () => {
    const open = panel.classList.toggle("open");
    pill.setAttribute("aria-expanded", String(open));
  };
  select.onchange = () => dev.open({ scenario: select.value });
  seed.onchange = () =>
    dev.open({ seed: Math.max(1, Number(seed.value) || 1) });
  const actions: Record<string, () => void> = {
    reset: dev.reset,
    tabs: dev.reopenTabs,
    back: () => dev.moveClock(-1),
    ahead: () => dev.moveClock(1),
    now: () => dev.moveClock(null),
  };
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-do]"))
    button.onclick = actions[button.dataset.do!];
  document.body.append(host);
}
