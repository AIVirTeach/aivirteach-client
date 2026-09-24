import * as React from "react"
import { cn } from "@/lib/utils"

function Skeleton({ as: Component = "div", className, ...props }: React.HTMLAttributes<HTMLElement> & { as?: "div" | "span" | "i" }) {
  return <Component data-slot="skeleton" className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
}

export { Skeleton }
