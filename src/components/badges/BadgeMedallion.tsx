import type { ComponentType } from "react";
import { LockKeyhole } from "lucide-react";
import type { BadgeRarity } from "@/lib/badges/display";
import { badgeRarityMedallionClass } from "@/lib/badges/display";
import { cn } from "@/lib/utils";

export type BadgeMedallionShape = "coin" | "hex" | "shield" | "stack";

type BadgeMedallionProps = {
  icon: ComponentType<{ className?: string }>;
  earned: boolean;
  rarity: BadgeRarity;
  shape?: BadgeMedallionShape;
  className?: string;
  iconClassName?: string;
};

const shapeChrome: Record<BadgeMedallionShape, string> = {
  coin: "rounded-full",
  hex: "rounded-[1.35rem]",
  shield: "rounded-[1.45rem]",
  stack: "rounded-[1.15rem]",
};

const shapePath: Record<BadgeMedallionShape, string> = {
  coin: "M50 5a45 45 0 1 0 0 90 45 45 0 0 0 0-90Z",
  hex: "M50 6 86 26v48L50 94 14 74V26L50 6Z",
  shield: "M50 6 88 18v27c0 24-14 40-38 49C26 85 12 69 12 45V18L50 6Z",
  stack: "M18 18h64v13h10v51H28V69H18V18Z",
};

export function BadgeMedallion({
  icon: Icon,
  earned,
  rarity,
  shape = "coin",
  className,
  iconClassName,
}: BadgeMedallionProps) {
  const locked = !earned;

  return (
    <div
      className={cn(
        "relative flex size-12 shrink-0 items-center justify-center overflow-hidden transition-[scale,box-shadow,background-color,color,filter] duration-200 before:absolute before:inset-1 before:rounded-[inherit] before:bg-background/35 before:opacity-0 before:transition-opacity after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
        shapeChrome[shape],
        badgeRarityMedallionClass(rarity, earned),
        earned && "before:opacity-100",
        locked && "grayscale",
        earned && rarity === "Legendary" && "after:shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_0_0_0_1px_currentColor]",
        className,
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.70),transparent_34%)]" />
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" focusable="false" aria-hidden="true">
        <path d={shapePath[shape]} className="fill-background/15 stroke-current/35" strokeWidth="2.6" />
        <path d={shapePath[shape]} className="fill-none stroke-white/60" strokeWidth="1.1" transform="translate(0 -1)" />
      </svg>
      <span className={cn("absolute inset-x-2 bottom-2 h-1/3 rounded-full bg-black/20 blur-md", earned ? "opacity-25" : "opacity-10")} />
      {earned ? (
        <Icon className={cn("relative z-10 size-5 drop-shadow-sm", iconClassName)} />
      ) : (
        <LockKeyhole className={cn("relative z-10 size-5", iconClassName)} />
      )}
    </div>
  );
}
