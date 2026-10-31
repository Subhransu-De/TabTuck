// shadcn/ui select on Base UI: the list opens with the checked item over the
// trigger, like a macOS pop-up button. The trigger is a raised chip and the
// list a well.
import { Select as SelectPrimitive } from "@base-ui/react/select";
import type { ReactNode } from "react";
import { icon } from "../ui-icons.tsx";
import { cn } from "./cn.ts";

export const Select = SelectPrimitive.Root;

export function SelectValue(props: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className="flex flex-1 text-left"
      {...props}
    />
  );
}
export function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props & { className?: string }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-7.5 items-center justify-between gap-2 rounded-lg border-0 bg-secondary py-1 pr-2 pl-2.5 text-[14px] font-medium whitespace-nowrap shadow-[inset_0_0_0_1px_var(--tt-line-2)] transition-colors outline-none hover:bg-control focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={icon("chevron", "nav-icon size-3.5 text-ink-3")}
      />
    </SelectPrimitive.Trigger>
  );
}
export function SelectContent({ children }: { children: ReactNode }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side="bottom"
        sideOffset={4}
        align="center"
        alignItemWithTrigger
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className="relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-[10px] bg-popover text-popover-foreground shadow-[inset_0_0_0_1px_var(--tt-line-2),var(--tt-pop-shadow)]"
        >
          <SelectPrimitive.ScrollUpArrow className="top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1">
            {icon("chevron-up", "nav-icon size-4")}
          </SelectPrimitive.ScrollUpArrow>
          <SelectPrimitive.List className="p-1">
            {children}
          </SelectPrimitive.List>
          <SelectPrimitive.ScrollDownArrow className="bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1">
            {icon("chevron", "nav-icon size-4")}
          </SelectPrimitive.ScrollDownArrow>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}
export function SelectItem({ children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className="relative flex h-7.5 w-full cursor-default items-center gap-2.5 rounded-md pr-8 pl-2 text-[14px] font-medium outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        {icon("check", "nav-icon size-3.5")}
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
export function SelectSeparator() {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className="pointer-events-none -mx-1 my-1 h-px bg-border"
    />
  );
}
