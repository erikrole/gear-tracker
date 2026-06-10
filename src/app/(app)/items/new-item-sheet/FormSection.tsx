import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { ReactNode } from "react";

type FormSectionProps = {
  title: string;
  badge?: string;
  badgeVariant?: BadgeProps["variant"];
  description?: string;
  children: ReactNode;
};

export function FormSection({
  title,
  badge,
  badgeVariant = "secondary",
  description,
  children,
}: FormSectionProps) {
  return (
    <section className="space-y-4 rounded-xl border border-border/50 bg-background/90 p-4 shadow-xs">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
          {badge && (
            <Badge variant={badgeVariant} size="sm">
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
