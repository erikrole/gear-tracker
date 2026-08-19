export const SOFTWARE_CREDENTIAL_AUDIENCES = ["STAFF", "STUDENT", "COLLABORATOR"] as const;

export type SoftwareCredentialAudience = (typeof SOFTWARE_CREDENTIAL_AUDIENCES)[number];

/**
 * Staff and administrators are the vault operators, so they retain visibility
 * of every record they may need to manage. Students and collaborators are
 * limited to the audiences explicitly selected on each login.
 */
export function canViewSoftwareCredential(
  role: string,
  visibleTo: readonly SoftwareCredentialAudience[],
  collaboratorCanView = false,
) {
  if (role === "ADMIN" || role === "STAFF") return true;
  if (role === "STUDENT") return visibleTo.includes("STUDENT");
  if (role === "COLLABORATOR") return collaboratorCanView && visibleTo.includes("COLLABORATOR");
  return false;
}
