// A small menu on the browser's popover layer, which brings light dismiss,
// Escape and focus return with it. It opens under its button, or above it
// when there is no room below, and the arrow keys move between its items.
import { useId, useRef, useState, type ReactNode } from "react";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  action?: string;
  onSelect: () => void;
}

export function MenuButton({
  label,
  items,
  className,
  disabled,
  children,
}: {
  label: string;
  items: MenuItem[];
  className?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  function place() {
    const anchor = button.current!.getBoundingClientRect();
    const popup = menu.current!;
    const below = anchor.bottom + 6 + popup.offsetHeight <= innerHeight;
    popup.style.top = `${below ? anchor.bottom + 6 : anchor.top - 6 - popup.offsetHeight}px`;
    popup.style.left = `${Math.max(8, Math.min(anchor.right - popup.offsetWidth, innerWidth - popup.offsetWidth - 8))}px`;
    popup.style.visibility = "";
  }
  return (
    <>
      <button
        ref={button}
        type="button"
        className={className}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        popoverTarget={id}
        disabled={disabled}
      >
        {children}
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        role="menu"
        aria-label={label}
        className="menu"
        onBeforeToggle={(event) => {
          // Hidden until placed, so it never flashes at the popover default.
          if (event.newState === "open")
            event.currentTarget.style.visibility = "hidden";
        }}
        onToggle={(event) => {
          const isOpen = event.newState === "open";
          setOpen(isOpen);
          if (!isOpen) return;
          place();
          menu.current!.querySelector<HTMLElement>(".menu-item")?.focus();
        }}
        onKeyDown={(event) => {
          // The browser closes the menu on Escape; the page must not also
          // take it to clear its search or selection.
          if (event.key === "Escape") event.stopPropagation();
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          const all = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(".menu-item"),
          ];
          const at = all.indexOf(document.activeElement as HTMLElement);
          const step = event.key === "ArrowDown" ? 1 : -1;
          all[(at + step + all.length) % all.length]?.focus();
        }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="menu-item"
            data-action={item.action}
            onClick={() => {
              menu.current!.hidePopover();
              item.onSelect();
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
