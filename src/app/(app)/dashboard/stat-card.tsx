import Link from "next/link";

type StatCardProps = {
  href: string;
  value: number;
  label: string;
  accent?: "red" | "amber";
};

const accentBorder = {
  red: "border-red-600/25 bg-red-600/[0.04]",
  amber: "border-amber-600/25 bg-amber-600/[0.04]",
} as const;

const accentText = {
  red: "text-red-600",
  amber: "text-amber-600",
} as const;

export function StatCard({ href, value, label, accent }: StatCardProps) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center px-3 py-2 md:py-3 bg-card border border-border rounded-lg no-underline cursor-pointer transition-colors hover:bg-accent/50 ${accent ? accentBorder[accent] : ""}`}
    >
      <span
        className={`font-heading text-xl font-extrabold leading-none ${accent ? accentText[accent] : "text-foreground"}`}
      >
        {value}
      </span>
      <span className="text-[10px] md:text-xs text-muted-foreground mt-1 tracking-normal font-medium">
        {label}
      </span>
    </Link>
  );
}
