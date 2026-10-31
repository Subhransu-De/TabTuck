// shadcn/ui button on a native <button>, in TabTuck's tray style: the primary
// one is the strongest ink on screen, the rest stay quiet until hovered.
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

export const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-[15px] font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--tt-ink-0))]",
        // Quiet: the raised fill, for Cancel and other second choices.
        outline:
          "bg-secondary text-foreground shadow-[inset_0_0_0_1px_var(--tt-line-2)] hover:bg-control aria-expanded:bg-control",
        secondary:
          "bg-secondary text-foreground shadow-[inset_0_0_0_1px_var(--tt-line-2)] hover:bg-control aria-expanded:bg-control",
        ghost:
          "text-ink-2 hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
        // Red text from the start, for actions that remove tabs.
        danger: "text-destructive hover:bg-destructive/12",
        // The confirm step of an erase: still red on the text, never a fill.
        destructive:
          "bg-secondary text-destructive shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--destructive)_30%,transparent)] hover:bg-[color-mix(in_oklab,var(--destructive)_14%,var(--tt-raised))]",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-7.5 gap-1.5 px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-[13px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 rounded-[7px] px-2.5",
        md: "h-7 gap-1.5 rounded-[7px] px-2.5",
        lg: "h-8 gap-2 px-3.5",
        icon: "size-8",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-7 rounded-[7px]",
        "icon-md": "size-7 rounded-[7px]",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;
export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}
