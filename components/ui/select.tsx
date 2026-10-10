import * as React from "react";
import { cn } from "@/lib/utils";

function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn("h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none disabled:pointer-events-none disabled:opacity-50", className)}
      {...props}
    >
      {children}
    </select>
  );
}

export { Select };
