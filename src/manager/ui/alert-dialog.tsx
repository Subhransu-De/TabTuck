// shadcn/ui alert dialog on Base UI, in the same tray as the dialogs: a title
// and a sentence, then Cancel and the action in the footer strip.
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type { ComponentProps } from "react";
import { overlayClass } from "./dialog.tsx";
import { cn } from "./cn.ts";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogClose = AlertDialogPrimitive.Close;

export function AlertDialogContent({
  className,
  ...props
}: AlertDialogPrimitive.Popup.Props & { className?: string }) {
  return (
    <AlertDialogPrimitive.Portal>
      {/* Base UI skips the backdrop of a nested dialog; the confirmation over
          the Options dialog still needs its scrim. */}
      <AlertDialogPrimitive.Backdrop forceRender className={overlayClass} />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-y-auto -translate-y-1/2 rounded-[16px] bg-panel p-2 text-[15px] text-foreground shadow-[inset_0_0_0_1px_var(--tt-line-2),var(--tt-pop-shadow)] duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:pointer-events-none data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}
export function AlertDialogHeader({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("grid gap-1.5 px-2 pt-2 pb-1 text-left", className)}
      {...props}
    />
  );
}
export function AlertDialogFooter({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-1.5 pt-3 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
export function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.Title.Props & { className?: string }) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "font-heading text-[16px] leading-tight font-semibold tracking-[-0.01em] text-ink-0",
        className,
      )}
      {...props}
    />
  );
}
export function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props & { className?: string }) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-[15px] text-pretty text-muted-foreground", className)}
      {...props}
    />
  );
}
