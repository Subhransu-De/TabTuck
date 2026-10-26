// shadcn/ui Luma alert dialog on Base UI.
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
          "group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full max-w-xs -translate-x-1/2 -translate-y-1/2 gap-6 rounded-4xl bg-popover p-6 text-popover-foreground shadow-xl ring-1 ring-foreground/5 duration-100 outline-none sm:max-w-md dark:ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:pointer-events-none data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
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
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:place-items-start sm:text-left sm:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className,
      )}
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
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
export function AlertDialogMedia({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:row-span-2 *:[svg]:size-8",
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
        "font-heading text-lg font-medium sm:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
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
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty",
        className,
      )}
      {...props}
    />
  );
}
