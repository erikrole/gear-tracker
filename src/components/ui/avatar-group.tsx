import * as React from "react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

function AvatarGroup({
  className,
  max = 4,
  children,
  ...props
}: React.ComponentProps<"div"> & { max?: number }) {
  const avatars = React.Children.toArray(children)
  const shown = avatars.slice(0, max)
  const overflow = avatars.length - max

  return (
    <div
      data-slot="avatar-group"
      className={cn("flex -space-x-2", className)}
      {...props}
    >
      {shown.map((child, i) => (
        <div key={i} className="ring-2 ring-background rounded-full">
          {child}
        </div>
      ))}
      {overflow > 0 && (
        <div className="ring-2 ring-background rounded-full">
          <Avatar>
            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
              +{overflow}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  )
}

export { AvatarGroup }
