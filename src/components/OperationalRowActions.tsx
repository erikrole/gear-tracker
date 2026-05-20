"use client";

import type { ReactNode } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function OperationalRowActions({
  label = "Row actions",
  children,
  align = "end",
  icon,
  triggerClassName,
  contentClassName,
}: {
  label?: string;
  children: ReactNode;
  align?: "start" | "center" | "end";
  icon?: ReactNode;
  triggerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-10 text-muted-foreground hover:text-foreground", triggerClassName)}
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
        >
          {icon ?? <MoreHorizontalIcon className="size-4" aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={contentClassName}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
