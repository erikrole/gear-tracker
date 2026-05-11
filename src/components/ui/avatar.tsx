"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type AvatarSize = "xs" | "sm" | "default" | "md" | "lg" | "xl"

const avatarSizeClasses =
  "size-7 data-[size=xs]:size-5 data-[size=sm]:size-6 data-[size=md]:size-9 data-[size=lg]:size-11 data-[size=xl]:size-20"

const avatarFallbackSizeClasses =
  "text-xs group-data-[size=xs]/avatar:text-[9px] group-data-[size=sm]/avatar:text-[10px] group-data-[size=md]/avatar:text-[13px] group-data-[size=lg]/avatar:text-sm group-data-[size=xl]/avatar:text-2xl"

const avatarGroupCountTextClasses =
  "text-xs data-[size=xs]:text-[8px] data-[size=sm]:text-[10px] data-[size=md]:text-xs data-[size=lg]:text-sm data-[size=xl]:text-base"

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: AvatarSize
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex shrink-0 overflow-hidden rounded-full select-none",
        avatarSizeClasses,
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-muted-foreground",
        avatarFallbackSizeClasses,
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn("flex -space-x-2", className)}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  size = "sm",
  ...props
}: React.ComponentProps<"div"> & {
  size?: AvatarSize
}) {
  return (
    <div
      data-slot="avatar-group-count"
      data-size={size}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted font-medium text-muted-foreground",
        avatarSizeClasses,
        avatarGroupCountTextClasses,
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
}

export type { AvatarSize }
