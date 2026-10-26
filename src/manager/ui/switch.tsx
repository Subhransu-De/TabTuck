// shadcn/ui Luma switch on Base UI, with a round thumb in the panel colour.
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

// The thumb's box is a square as tall as the track, and its transparent
// border is the gap around the visible circle. Thumb and track then round to
// the same screen pixels, so the thumb stays centred at display scales such
// as 125%, where a 3px gap between two boxes is 3.75 pixels.
export function Switch(props: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      nativeButton
      render={<button type="button" />}
      className="peer group/switch relative inline-block h-5.5 w-10 shrink-0 rounded-full transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-primary data-unchecked:bg-input/90 data-disabled:cursor-not-allowed data-disabled:opacity-50"
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none absolute inset-y-0 left-0 w-5.5 rounded-full border-3 border-transparent bg-raised bg-clip-padding drop-shadow-sm transition-[left] data-checked:left-[calc(100%-var(--spacing)*5.5)] dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  );
}
