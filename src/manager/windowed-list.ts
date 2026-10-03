export function reconcile(container: HTMLElement, children: HTMLElement[]) {
  const keep = new Set(children);
  for (const child of [...container.children])
    if (!keep.has(child as HTMLElement)) child.remove();
  let next = container.firstChild;
  for (const child of children) {
    if (child === next) next = next.nextSibling;
    else if (child.parentNode === container) container.moveBefore(child, next);
    else container.insertBefore(child, next);
  }
}

export class WindowedList<T> {
  private items: T[] = [];
  private offsets = new Float64Array(1);
  private mounted = new Map<number, HTMLElement>();
  private create: (item: T, index: number) => HTMLElement = () =>
    document.createElement("div");
  private frame = 0;
  private dragged = -1;
  private top = document.createElement("div");
  private bottom = document.createElement("div");
  constructor(private container: HTMLElement) {
    this.top.className = this.bottom.className = "window-spacer";
    container.addEventListener("scroll", () => this.schedule(), {
      passive: true,
    });
    new ResizeObserver(() => this.schedule()).observe(container);
    container.addEventListener("keydown", (event) => this.keydown(event));
    container.addEventListener("dragstart", (event) => {
      const row = (event.target as Element).closest<HTMLElement>(
        "[data-window-index]",
      );
      this.dragged = row ? Number(row.dataset.windowIndex) : -1;
    });
    document.addEventListener("dragend", () => {
      this.dragged = -1;
      this.schedule();
    });
  }
  set(
    items: T[],
    create: (item: T, index: number) => HTMLElement,
    height: (item: T, index: number) => number,
    scrollTop: number,
  ) {
    this.items = items;
    this.create = create;
    this.offsets = new Float64Array(items.length + 1);
    for (let i = 0; i < items.length; i++)
      this.offsets[i + 1] = this.offsets[i] + height(items[i], i);
    this.mounted.clear();
    if (!items.length) {
      this.container.replaceChildren();
      return;
    }
    this.paint(scrollTop);
    this.container.scrollTop = scrollTop;
  }
  private schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.paint();
    });
  }
  private at(offset: number) {
    let low = 0,
      high = this.items.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.offsets[mid + 1] <= offset) low = mid + 1;
      else high = mid;
    }
    return Math.min(low, this.items.length - 1);
  }
  private row(index: number) {
    let row = this.mounted.get(index);
    if (!row) {
      row = this.create(this.items[index], index);
      row.dataset.windowIndex = String(index);
      this.mounted.set(index, row);
    }
    return row;
  }
  private paint(scrollTop = this.container.scrollTop, pin = -1) {
    if (!this.items.length) return;
    const small = this.items.length <= 128;
    const top = Math.min(
      scrollTop,
      Math.max(
        0,
        this.offsets[this.items.length] - this.container.clientHeight,
      ),
    );
    const start = small ? 0 : this.at(Math.max(0, top - 600));
    const end = small
      ? this.items.length
      : Math.min(
          this.items.length,
          this.at(top + this.container.clientHeight + 600) + 1,
        );
    const focused = document.activeElement?.closest<HTMLElement>(
      "[data-window-index]",
    );
    const focus =
      focused && this.container.contains(focused)
        ? Number(focused.dataset.windowIndex)
        : -1;
    const indices = new Set<number>();
    for (let i = start; i < end; i++) indices.add(i);
    for (const index of [focus, this.dragged, pin])
      if (index >= 0 && index < this.items.length) indices.add(index);
    const children: HTMLElement[] = [];
    let previous = 0;
    const sorted = [...indices].sort((a, b) => a - b);
    const spacer = (from: number, to: number) => {
      if (from === to) return;
      const element =
        from === 0
          ? this.top
          : to === this.items.length
            ? this.bottom
            : document.createElement("div");
      element.className = "window-spacer";
      element.style.height = `${this.offsets[to] - this.offsets[from]}px`;
      children.push(element);
    };
    for (const index of sorted) {
      spacer(previous, index);
      children.push(this.row(index));
      previous = index + 1;
    }
    spacer(previous, this.items.length);
    reconcile(this.container, children);
    for (const index of this.mounted.keys())
      if (!indices.has(index)) this.mounted.delete(index);
  }
  focus(index: number, tag?: string, reverse = false, scroll = false) {
    this.paint(this.container.scrollTop, index);
    const row = this.row(index);
    const targets = [
      ...row.querySelectorAll<HTMLElement>(
        "input, a[href], button:not(:disabled)",
      ),
    ];
    const target =
      (tag && row.querySelector<HTMLElement>(tag)) ||
      (reverse ? targets.at(-1) : targets[0]);
    target?.focus({ preventScroll: true });
    if (scroll) row.scrollIntoView({ block: "nearest" });
    return !!target;
  }
  private keydown(event: KeyboardEvent) {
    if (event.key !== "Tab" || this.items.length <= 128) return;
    const focused = document.activeElement as HTMLElement | null;
    const row = focused?.closest<HTMLElement>("[data-window-index]");
    if (!row || !this.container.contains(row)) return;
    const targets = [
      ...row.querySelectorAll<HTMLElement>(
        "input, a[href], button:not(:disabled)",
      ),
    ];
    if (focused !== (event.shiftKey ? targets[0] : targets.at(-1))) return;
    const direction = event.shiftKey ? -1 : 1;
    const next = Number(row.dataset.windowIndex) + direction;
    if (next < 0 || next >= this.items.length) return;
    event.preventDefault();
    this.focus(next, undefined, event.shiftKey, true);
  }
}
