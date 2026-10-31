// A keyboard key, sunk into the surface like a key cap. See .keycap in
// manage.css.
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn("keycap pointer-events-none select-none", className)}
      {...props}
    />
  );
}
