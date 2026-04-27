import Link from "next/link";

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

  return (
    <Link
      href={href}
      className={`relative flex flex-col justify-between px-4 py-3.5 md:py-4 bg-card border rounded-lg no-underline overflow-hidden transition-colors hover:bg-muted/40 ${a ? a.card : "border-border"}`}
    >
      {/* Left accent bar */}
      {a && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-[3px] ${a.bar}`}
          aria-hidden="true"
        />
      )}

      <span
        className={`text-[38px] md:text-[46px] font-black leading-none tabular-nums ${a ? a.num : "text-foreground"}`}
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {value}
      </span>
      <span
        className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60 mt-2"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </span>
    </Link>
  );
}
