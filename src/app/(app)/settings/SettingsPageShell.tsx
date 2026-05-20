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
      <div className="grid grid-cols-[220px_minmax(0,1fr)] items-start gap-6 max-lg:grid-cols-1 max-lg:gap-4">
        <aside className="sticky top-20 max-lg:static">
          <h2 className="mb-1.5 text-lg font-semibold tracking-tight text-balance">
            {title}
          </h2>
          {description ? (
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </aside>
        <div className={cn("min-w-0", mainClassName)}>{children}</div>
      </div>
    </FadeUp>
  );
}
