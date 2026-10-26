// shadcn/ui Luma dialog on Base UI. The scrim is TabTuck's, not black.
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
  "close absolute top-4 right-4 bg-secondary",
);

// The popup's width comes from className (a sm:max-w-* class); layout sets
// its gap and padding.
export function DialogContent({
  className,
  layout = "gap-6 p-6",
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
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-4xl bg-popover text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/5 duration-100 outline-none dark:ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:pointer-events-none data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
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
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
// className replaces the title's size, leading and weight.
export function DialogTitle({
  className = "text-lg leading-none font-medium",
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
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
