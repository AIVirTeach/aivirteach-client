import * as React from "react";
import { cn } from "@/lib/utils";

function Slider({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return <input data-slot="slider" type="range" className={cn("w-full accent-primary", className)} {...props} />;
}

export { Slider };
