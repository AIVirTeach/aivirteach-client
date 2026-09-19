"use client"

import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { cn } from "@/lib/utils"

function Progress({ className, indicatorClassName, value, ...props }: ProgressPrimitive.Root.Props & { indicatorClassName?: string }) {
  return <ProgressPrimitive.Root value={value} data-slot="progress" className="contents" {...props}><ProgressTrack className={className}><ProgressIndicator className={indicatorClassName} /></ProgressTrack></ProgressPrimitive.Root>
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return <ProgressPrimitive.Track data-slot="progress-track" className={cn("relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted", className)} {...props} />
}

function ProgressIndicator({ className, ...props }: ProgressPrimitive.Indicator.Props) {
  return <ProgressPrimitive.Indicator render={<span />} data-slot="progress-indicator" className={cn("h-full bg-primary transition-all", className)} {...props} />
}

export { Progress, ProgressTrack, ProgressIndicator }
