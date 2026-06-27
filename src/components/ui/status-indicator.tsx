import type { ComponentProps } from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusIndicatorState = "active" | "down" | "fixing" | "idle";

interface StatusIndicatorProps extends Omit<ComponentProps<"span">, "color"> {
  state: StatusIndicatorState;
  label?: string;
  size?: "sm" | "md" | "lg";
  labelClassName?: string;
}

const stateVariant: Record<StatusIndicatorState, BadgeProps["variant"]> = {
  active: "green",
  down: "red",
  fixing: "orange",
  idle: "gray",
};

const getSizeClasses = (size: StatusIndicatorProps["size"]) => {
  switch (size) {
    case "sm":
      return { badge: "gap-1.5", dot: "size-1.5", ping: "size-1.5" };
    case "lg":
      return { badge: "gap-2 px-3 py-1 text-sm", dot: "size-2.5", ping: "size-2.5" };
    case "md":
    default:
      return { badge: "gap-1.5", dot: "size-2", ping: "size-2" };
  }
};

export default function StatusIndicator({
  state = "idle",
  label,
  className,
  size = "md",
  labelClassName,
  ...props
}: StatusIndicatorProps) {
  const shouldAnimate =
    state === "active" || state === "fixing" || state === "down";
  const sizeClasses = getSizeClasses(size);

  return (
    <Badge
      variant={stateVariant[state]}
      size={size === "sm" ? "sm" : undefined}
      className={cn(sizeClasses.badge, className)}
      {...props}
    >
      <span className="relative inline-flex items-center" aria-hidden="true">
        {shouldAnimate && (
          <span
            className={cn(
              "absolute inline-flex rounded-full opacity-75 animate-ping",
              sizeClasses.ping,
              "bg-current"
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full bg-current",
            sizeClasses.dot
          )}
        />
      </span>
      {label && (
        <span className={cn("font-medium", labelClassName)}>
          {label}
        </span>
      )}
    </Badge>
  );
}
