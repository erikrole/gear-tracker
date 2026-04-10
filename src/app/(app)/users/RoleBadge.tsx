import type { Role } from "./types";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const ROLE_VARIANT: Record<Role, BadgeProps["variant"]> = {
  ADMIN: "purple",
  STAFF: "blue",
  STUDENT: "gray",
};

export default function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge
      variant={ROLE_VARIANT[role]}
      style={{ fontFamily: "var(--font-heading)", fontWeight: 600, letterSpacing: "0.03em" }}
    >
      {role.charAt(0) + role.slice(1).toLowerCase()}
    </Badge>
  );
}
