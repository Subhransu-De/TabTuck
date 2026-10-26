// shadcn/ui Luma keyboard key, in the font of its context.
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5.5 w-fit min-w-5.5 items-center justify-center gap-1 rounded-lg bg-muted px-1.5 text-xs font-medium text-muted-foreground select-none in-data-[slot=input-group]:bg-input [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    />
  );
}
