"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-input bg-muted outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-primary", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className="block size-5 rounded-full border border-input bg-background transition-transform data-checked:translate-x-5" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
