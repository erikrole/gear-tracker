import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";

type StatCardProps = {
  href: string;
  value: number;
  label: string;
  accent?: "red" | "amber";
};

const accentStyles = {
  red: {
    bar: "bg-[var(--wi-red)]",
    card: "border-[var(--wi-red)]/20 bg-[var(--wi-red)]/[0.035]",
    num: "text-[var(--wi-red)]",
  },
  amber: {
    bar: "bg-[var(--orange)]",
    card: "border-[var(--orange)]/20 bg-[var(--orange)]/[0.035]",
    num: "text-[var(--orange-text)]",
  },
} as const;

export function StatCard({ href, value, label, accent }: StatCardProps) {
  const a = accent ? accentStyles[accent] : null;
  const hasValue = value > 0;

  return (
    <Link
      href={href}
      className={`group relative flex min-h-20 flex-col justify-between overflow-hidden rounded-lg border px-4 py-3 no-underline outline-none transition-[background-color,border-color,box-shadow,scale] hover:bg-muted/40 active:scale-[0.96] focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
        a
          ? a.card
          : hasValue
          ? "border-border bg-card shadow-xs"
          : "border-border/60 bg-muted/10"
      }`}
    >
      {/* Left accent bar */}
      {a && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-[3px] ${a.bar}`}
          aria-hidden="true"
        />
      )}

      <span className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {label}
        </span>
        <ArrowUpRightIcon className={`text-muted-foreground/40 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${hasValue ? "opacity-60" : "opacity-0"}`} />
      </span>
      <span
        className={`text-[30px] font-black leading-none tabular-nums md:text-[34px] ${a ? a.num : hasValue ? "text-foreground" : "text-muted-foreground/45"}`}
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {value}
      </span>
    </Link>
  );
}
