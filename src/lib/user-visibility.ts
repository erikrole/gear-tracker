import { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";

function parseEmailList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function canViewHiddenUsers(user: Pick<AuthUser, "email">): boolean {
  return parseEmailList(process.env.INTERNAL_OPERATOR_EMAILS).has(user.email.toLowerCase());
}

export function shouldIncludeHiddenUsers(searchParams: URLSearchParams, user: Pick<AuthUser, "email">): boolean {
  const requested = searchParams.get("includeHidden") === "1" || searchParams.get("includeHidden") === "true";
  return requested && canViewHiddenUsers(user);
}

export function visibleUserWhere(
  user: Pick<AuthUser, "email">,
  options: { includeHidden?: boolean } = {},
): Prisma.UserWhereInput {
  if (options.includeHidden && canViewHiddenUsers(user)) return {};
  return { hiddenFromRoster: false };
}

export function visibleActiveUserWhere(extra: Prisma.UserWhereInput = {}): Prisma.UserWhereInput {
  return {
    ...extra,
    active: true,
    hiddenFromRoster: false,
  };
}

/**
 * Person discovery at a staffed kiosk is global. The kiosk's location is an
 * operational handoff boundary, not a user's identity or roster boundary.
 * Collaborators still need the explicit kiosk-roster capability.
 */
export function kioskRosterUserWhere(): Prisma.UserWhereInput {
  return {
    active: true,
    hiddenFromRoster: false,
    OR: [
      { role: { not: Role.COLLABORATOR } },
      {
        role: Role.COLLABORATOR,
        collaboratorPolicy: {
          is: {
            status: "ACTIVE",
            affiliation: { archivedAt: null },
            grants: { some: { capabilityKey: "KIOSK_ROSTER_ELIGIBLE" } },
          },
        },
      },
    ],
  };
}

export function canReadUserProfile(
  actor: Pick<AuthUser, "id" | "email">,
  target: { id: string; hiddenFromRoster?: boolean | null },
): boolean {
  if (!target.hiddenFromRoster) return true;
  return actor.id === target.id || canViewHiddenUsers(actor);
}
