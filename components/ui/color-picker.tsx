import * as React from "react";
import { cn } from "@/lib/utils";

function ColorPicker({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return <input data-slot="color-picker" type="color" className={cn("h-9 w-12 cursor-pointer border border-input bg-background p-0.5", className)} {...props} />;
}

export { ColorPicker };
