// shadcn/ui Luma text fields and separator, on native elements. A textarea
// takes its text size from className.
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

const field =
  "w-full min-w-0 border border-transparent bg-input/50 transition-[color,box-shadow,background-color] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(field, "h-9 rounded-3xl px-3 py-1 text-sm", className)}
      {...props}
    />
  );
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(field, "flex min-h-16 rounded-2xl px-3 py-3", className)}
      {...props}
    />
  );
}
// A native select dressed as Luma's select trigger. Long lists, such as
// thousands of collections, open at once in the browser's own menu.
export function NativeSelect({
  className,
  ...props
}: ComponentProps<"select">) {
  return (
    <span className="native-select">
      <select
        data-slot="native-select"
        className={cn(
          field,
          "h-9 appearance-none rounded-3xl py-1 pr-9 pl-3 text-sm",
          className,
        )}
        {...props}
      />
    </span>
  );
}
export function Separator() {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className="h-px w-full shrink-0 bg-border"
    />
  );
}
