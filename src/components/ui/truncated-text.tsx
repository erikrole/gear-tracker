"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type TruncatedTextProps = {
  text: string
  className?: string
  tooltipClassName?: string
}

function TruncatedText({ text, className, tooltipClassName }: TruncatedTextProps) {
  const textRef = React.useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = React.useState(false)

  React.useEffect(() => {
    const node = textRef.current
    if (!node) return

    const update = () => {
      setIsTruncated(
        node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight
      )
    }

    const frame = window.requestAnimationFrame(update)
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
    observer?.observe(node)
    window.addEventListener("resize", update)

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [text])

  const trigger = (
    <span
      ref={textRef}
      className={cn("block min-w-0 truncate", className)}
      tabIndex={isTruncated ? 0 : undefined}
    >
      {text}
    </span>
  )

  if (!isTruncated) return trigger

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent className={cn("max-w-sm whitespace-normal break-words text-pretty", tooltipClassName)}>
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

export { TruncatedText }
