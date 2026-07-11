"use client";

import type { ReactNode } from "react";
import { FadeUp } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

type SettingsPageShellProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  mainClassName?: string;
};

export function SettingsPageShell({
  title,
  description,
  children,
  mainClassName,
}: SettingsPageShellProps) {
  return (
    <FadeUp>
      <div className="flex min-w-0 flex-col gap-4">
        <header className="max-w-3xl">
          <h2 className="mb-1 text-lg font-semibold tracking-tight text-balance">
            {title}
          </h2>
          {description ? (
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </header>
        <div className={cn("min-w-0", mainClassName)}>{children}</div>
      </div>
    </FadeUp>
  );
}
