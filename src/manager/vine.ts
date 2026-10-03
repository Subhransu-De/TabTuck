// The vine links the chosen row in one column to the next column. It lives in
// the gutters between panels so it never crosses row labels or counts.
export interface VineLink {
  from: HTMLElement; // column panel on the left
  fromRow: HTMLElement | null;
  to: HTMLElement; // column panel on the right
  toRow: HTMLElement | null;
}
interface Geometry {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hidden1: boolean;
  hidden2: boolean;
}

const SVG = "http://www.w3.org/2000/svg";
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const ease = (t: number) => 1 - (1 - t) ** 3;

// Row centre, clamped to the visible part of its scrolling list.
function anchorY(row: HTMLElement, origin: DOMRect) {
  const box = row.getBoundingClientRect();
  const list = row.closest<HTMLElement>(".list")?.getBoundingClientRect();
  const y = box.top + box.height / 2;
  if (!list) return { y: y - origin.top, hidden: false };
  const min = list.top + 4,
    max = Math.max(min, list.bottom - 4);
  return {
    y: Math.min(Math.max(y, min), max) - origin.top,
    hidden: y < list.top || y > list.bottom,
  };
}
function measure(link: VineLink, origin: DOMRect): Geometry | null {
  if (!link.fromRow || !link.toRow) return null;
  const a = anchorY(link.fromRow, origin),
    b = anchorY(link.toRow, origin);
  return {
    x1: link.from.getBoundingClientRect().right - origin.left,
    x2: link.to.getBoundingClientRect().left - origin.left,
    y1: a.y,
    y2: b.y,
    hidden1: a.hidden,
    hidden2: b.hidden,
  };
}
function pathData({ x1, y1, x2, y2 }: Geometry) {
  const gx = (x1 + x2) / 2;
  const dy = y2 - y1;
  if (Math.abs(dy) < 1) return `M${x1},${y1} H${x2}`;
  const dir = Math.sign(dy);
  const r = Math.min(7, Math.abs(dy) / 2, (x2 - x1) / 2);
  return (
    `M${x1},${y1} H${gx - r} Q${gx},${y1} ${gx},${y1 + dir * r}` +
    ` V${y2 - dir * r} Q${gx},${y2} ${gx + r},${y2} H${x2}`
  );
}

export class Vine {
  private links: VineLink[] = [];
  private shown: (Geometry | null)[] = [];
  private frame = 0;
  private key = "";
  constructor(
    private app: HTMLElement,
    private svg: SVGSVGElement,
  ) {}

  // Call with animate=true when the selection changed; scrolling and resizing
  // only follow the rows.
  draw(links: VineLink[], key: string) {
    const origin = this.app.getBoundingClientRect();
    const targets = links.map((link) => measure(link, origin));
    const changed = key !== this.key;
    this.key = key;
    this.links = links;
    if (!changed && this.frame && !reduced.matches) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (!changed || reduced.matches) {
      this.render(targets, 1, null);
      return;
    }
    const starts = targets.map((t, i) => this.shown[i] ?? null);
    const begin = performance.now();
    const step = (now: number) => {
      const origin = this.app.getBoundingClientRect();
      const targets = this.links.map((link) => measure(link, origin));
      const t = Math.min(1, (now - begin) / 260);
      const k = ease(t);
      const frame = targets.map((target, i) => {
        const start = starts[i];
        if (!target || !start) return target;
        return {
          ...target,
          y1: start.y1 + (target.y1 - start.y1) * k,
          y2: start.y2 + (target.y2 - start.y2) * k,
        };
      });
      // Segments that appear for the first time are drawn on instead.
      this.render(
        frame,
        k,
        targets.map((target, i) => !!target && !starts[i]),
      );
      if (t < 1) this.frame = requestAnimationFrame(step);
      else this.frame = 0;
    };
    this.frame = requestAnimationFrame(step);
  }

  private render(
    frame: (Geometry | null)[],
    progress: number,
    growing: boolean[] | null,
  ) {
    this.shown = frame;
    this.svg.replaceChildren();
    frame.forEach((g, i) => {
      if (!g) return;
      const group = document.createElementNS(SVG, "g");
      if (g.hidden1 || g.hidden2) group.classList.add("faded");
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("d", pathData(g));
      group.append(path);
      if (growing?.[i] && progress < 1) {
        const length = path.getTotalLength();
        path.style.strokeDasharray = String(length);
        path.style.strokeDashoffset = String(length * (1 - progress));
      }
      for (const [x, y, hidden, end] of [
        [g.x1, g.y1, g.hidden1, false],
        [g.x2, g.y2, g.hidden2, true],
      ] as const) {
        if (end && growing?.[i] && progress < 1) continue;
        const dot = document.createElementNS(SVG, "circle");
        dot.setAttribute("cx", String(x));
        dot.setAttribute("cy", String(y));
        dot.setAttribute("r", "3.5");
        if (hidden) dot.classList.add("off");
        group.append(dot);
      }
      this.svg.append(group);
    });
  }
}
