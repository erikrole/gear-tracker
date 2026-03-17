import type { Role } from "./types";
import { ROLE_BADGE } from "./types";

export default function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`badge-sm ${ROLE_BADGE[role]}`}>
      {role.charAt(0) + role.slice(1).toLowerCase()}
    </span>
  );
}
