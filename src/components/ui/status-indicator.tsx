import React from "react";
import { cn } from "@/lib/utils";

// Semantic states covering kiosk connection and bulk unit status
type SemanticState =
  | "online"
  | "recent"
  | "offline"
  | "inactive"
  | "available"
  | "checkedOut"
  | "missing"
  | "retired";

// Legacy aliases kept for calendar-sources and any other existing call sites
type LegacyState = "active" | "down" | "fixing" | "idle";

type StatusIndicatorState = SemanticState | LegacyState;

interface StatusIndicatorProps {
  state: StatusIndicatorState;
  color?: string;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  labelClassName?: string;
  animate?: boolean;
  "aria-hidden"?: boolean | "true" | "false";
}

// Normalize legacy aliases to semantic states
function normalizeState(state: StatusIndicatorState): SemanticState {
  switch (state) {
    case "active":
      return "online";
    case "down":
      return "offline";
    case "fixing":
      return "recent";
    case "idle":
      return "inactive";
    default:
      return state;
  }
}

const getStateColors = (state: SemanticState) => {
  switch (state) {
    case "online":
    case "available":
      return { dot: "bg-[var(--green)]", ping: "bg-[var(--green)]/60" };
    case "checkedOut":
      return { dot: "bg-[var(--blue)]", ping: "bg-[var(--blue)]/60" };
    case "recent":
      return { dot: "bg-[var(--orange)]", ping: "bg-[var(--orange)]/60" };
    case "offline":
    case "missing":
      return { dot: "bg-destructive", ping: "bg-destructive/60" };
    case "retired":
    case "inactive":
    default:
      return { dot: "bg-muted-foreground", ping: "bg-muted-foreground/60" };
  }
};

const getSizeClasses = (size: StatusIndicatorProps["size"]) => {
  switch (size) {
    case "sm":
      return { dot: "size-2", ping: "size-2" };
    case "lg":
      return { dot: "size-4", ping: "size-4" };
    case "md":
    default:
      return { dot: "size-3", ping: "size-3" };
  }
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  state = "inactive",
  color,
  label,
  className,
  size = "md",
  labelClassName,
  animate,
  "aria-hidden": ariaHidden,
}) => {
  const normalized = normalizeState(state);
  const shouldAnimate =
    animate !== undefined ? animate : normalized === "online";
  const colors = getStateColors(normalized);
  const sizeClasses = getSizeClasses(size);

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      aria-hidden={ariaHidden}
    >
      <div className="relative flex items-center">
        {shouldAnimate && (
          <span
            className={cn(
              "absolute inline-flex rounded-full opacity-75 animate-ping",
              sizeClasses.ping,
              colors.ping
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full",
            sizeClasses.dot,
            color ?? colors.dot
          )}
        />
      </div>
      {label && (
        <p
          className={cn(
            "text-sm text-muted-foreground",
            labelClassName
          )}
        >
          {label}
        </p>
      )}
    </div>
  );
};

export { StatusIndicator };
export default StatusIndicator;
