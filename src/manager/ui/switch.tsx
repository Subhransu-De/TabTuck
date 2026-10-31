// A switch on a native button with role="switch". manage.css draws it; see
// .switch there. Small enough for both bundles to carry their own copy.
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<ComponentProps<"button">, "onChange" | "onClick"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      data-slot="switch"
      className={cn("switch", className)}
      onClick={() => onCheckedChange(!checked)}
    />
  );
}
