// shadcn/ui text fields and separator, on native elements, drawn as wells
// with a hairline that turns to the focus ink. A textarea takes its text size
// from className.
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

const field =
  "w-full min-w-0 border-0 bg-well text-foreground shadow-[inset_0_0_0_1px_var(--tt-line-2)] transition-shadow outline-none placeholder:text-ink-3 focus-visible:shadow-[inset_0_0_0_1px_var(--tt-focus)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive)]";
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(field, "h-8 rounded-lg px-2.5 text-[15px]", className)}
      {...props}
    />
  );
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(field, "flex min-h-16 rounded-lg px-3 py-2.5", className)}
      {...props}
    />
  );
}
// A native select dressed as a select trigger. Long lists, such as thousands
// of collections, open at once in the browser's own menu.
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
          "h-8 appearance-none rounded-lg py-1 pr-9 pl-2.5 text-[15px] font-medium",
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
