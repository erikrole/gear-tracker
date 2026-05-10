import type { ComponentType } from "react";
import { LockKeyhole } from "lucide-react";
import type { BadgeRarity } from "@/lib/badges/display";
import { badgeRarityMedallionClass } from "@/lib/badges/display";
import { cn } from "@/lib/utils";

type BadgeMedallionProps = {
  icon: ComponentType<{ className?: string }>;
  earned: boolean;
  rarity: BadgeRarity;
  className?: string;
};

export function BadgeMedallion({
  icon: Icon,
  earned,
  rarity,
  className,
}: BadgeMedallionProps) {
  return (
    <div
      className={cn(
        "relative flex size-12 shrink-0 items-center justify-center rounded-xl transition-[scale,box-shadow,background-color,color] duration-200",
        badgeRarityMedallionClass(rarity, earned),
        earned && rarity === "Legendary" && "after:absolute after:inset-1 after:rounded-lg after:border after:border-current/20",
        className,
      )}
      aria-hidden="true"
    >
      {earned ? <Icon className="size-5" /> : <LockKeyhole className="size-5" />}
    </div>
  );
}
