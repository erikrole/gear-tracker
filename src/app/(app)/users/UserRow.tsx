import Link from "next/link";
import type { UserRow as UserRowType } from "./types";
import RoleBadge from "./RoleBadge";

/* ── Desktop Table Row ─────────────────────────────────── */

export function UserTableRow({ user }: { user: UserRowType }) {
  return (
    <tr>
      <td>
        <Link href={`/users/${user.id}`} className="row-link">
          {user.name}
        </Link>
      </td>
      <td className="hide-mobile">{user.email}</td>
      <td>
        <RoleBadge role={user.role} />
      </td>
      <td className="hide-mobile">{user.location || "\u2014"}</td>
      <td className="hide-mobile">{user.primaryArea || "\u2014"}</td>
    </tr>
  );
}

/* ── Mobile Card ───────────────────────────────────────── */

export function UserMobileCard({ user }: { user: UserRowType }) {
  return (
    <Link href={`/users/${user.id}`} className="user-mobile-card no-underline">
      <div className="user-mobile-top">
        <div className="user-mobile-avatar">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="user-mobile-name">
          <span className="row-link">{user.name}</span>
          <span className="text-secondary text-xs">{user.email}</span>
        </div>
        <RoleBadge role={user.role} />
      </div>
      {(user.location || user.primaryArea) && (
        <div className="user-mobile-meta">
          {user.location && <span>{user.location}</span>}
          {user.location && user.primaryArea && <span className="text-muted">&middot;</span>}
          {user.primaryArea && <span>{user.primaryArea}</span>}
        </div>
      )}
    </Link>
  );
}
