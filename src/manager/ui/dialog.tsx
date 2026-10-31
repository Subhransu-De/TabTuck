// shadcn/ui dialog on Base UI, drawn as a tray: a panel with a title strip,
// cards for its content and a footer strip. The scrim is TabTuck's, not black.
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ComponentProps } from "react";
import { icon } from "../ui-icons.tsx";
import { buttonVariants } from "./button.tsx";
import { cn } from "./cn.ts";

export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;

export const overlayClass =
  "fixed inset-0 isolate z-50 bg-scrim duration-100 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:pointer-events-none data-closed:animate-out data-closed:fade-out-0";
const closeClass = cn(
  buttonVariants({ variant: "ghost", size: "icon-sm" }),
  "close absolute top-2 right-2",
);

// The popup's width comes from className (a sm:max-w-* class); layout sets
// its gap and padding.
export function DialogContent({
  className,
  layout = "gap-0 p-2",
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  className?: string;
  layout?: string;
  showCloseButton?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className={overlayClass} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-y-auto -translate-y-1/2 rounded-[16px] bg-panel text-[14px] text-foreground shadow-[inset_0_0_0_1px_var(--tt-line-2),var(--tt-pop-shadow)] duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:pointer-events-none data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          layout,
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close className={closeClass} aria-label="Close">
            {icon("close")}
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}
export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex min-h-10 flex-col justify-center gap-0.5 pt-1.5 pr-10 pb-3 pl-2",
        className,
      )}
      {...props}
    />
  );
}
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-1.5 pt-2 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
// className replaces the title's size, leading and weight.
export function DialogTitle({
  className = "text-[16px] leading-tight font-semibold tracking-[-0.01em] text-ink-0",
  ...props
}: DialogPrimitive.Title.Props & { className?: string }) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading", className)}
      {...props}
    />
  );
}
export function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props & { className?: string }) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-[14px] text-muted-foreground", className)}
      {...props}
    />
  );
}
