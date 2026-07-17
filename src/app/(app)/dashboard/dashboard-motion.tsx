"use client";

import { forwardRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const easeOut = [0.16, 1, 0.3, 1] as const;
const easeInOut = [0.4, 0, 0.2, 1] as const;

const layoutTransition = {
  duration: 0.2,
  ease: easeOut,
};

type DashboardMotionVariant = "scale" | "shift";

type DashboardStateSurfaceProps = {
  children: React.ReactNode;
  className?: string;
  variant?: DashboardMotionVariant;
  layout?: boolean;
};

export const DashboardStateSurface = forwardRef<HTMLDivElement, DashboardStateSurfaceProps>(function DashboardStateSurface({
  children,
  className,
  variant = "scale",
  layout = false,
}, ref) {
  const reduceMotion = useReducedMotion();
  const initial = reduceMotion
    ? { opacity: 0.92 }
    : variant === "shift"
      ? { opacity: 0, y: 4 }
      : { opacity: 0, scale: 0.98 };
  const settled = reduceMotion
    ? { opacity: 1 }
    : variant === "shift"
      ? { opacity: 1, y: 0 }
      : { opacity: 1, scale: 1 };
  const exit = reduceMotion
    ? { opacity: 0 }
    : variant === "shift"
      ? { opacity: 0, y: 4 }
      : { opacity: 0, scale: 0.98 };

  return (
    <motion.div
      ref={ref}
      layout={layout}
      initial={initial}
      animate={{
        ...settled,
        transition: {
          duration: reduceMotion ? 0.12 : 0.2,
          ease: easeOut,
          layout: layoutTransition,
        },
      }}
      exit={{
        ...exit,
        transition: {
          duration: 0.12,
          ease: easeInOut,
        },
      }}
      className={cn("origin-top", className)}
    >
      {children}
    </motion.div>
  );
});

export function DashboardLayoutItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      layout
      transition={{ layout: layoutTransition }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
