import { Role } from "@prisma/client";

/**
 * Centralized permission policy map.
 * Keyed by resource → action → list of roles allowed.
 *
 * Reference: docs/AREA_USERS.md § Permission Matrix (V1)
 *
 * Booking-specific action permissions (edit own, cancel own, etc.)
 * are handled by booking-rules.ts which does ownership + status checks.
 * This map covers coarse role gating at the API route level.
 */
export const PERMISSIONS: Record<string, Record<string, Role[]>> = {
  user: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    create: ["ADMIN", "STAFF"],
    edit: ["ADMIN", "STAFF"],
    manage_role: ["ADMIN", "STAFF"],
  },
  asset: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    create: ["ADMIN", "STAFF"],
    edit: ["ADMIN", "STAFF"],
    delete: ["ADMIN"],
    duplicate: ["ADMIN", "STAFF"],
    import: ["ADMIN", "STAFF"],
    maintenance: ["ADMIN", "STAFF"],
    retire: ["ADMIN", "STAFF"],
    generate_qr: ["ADMIN", "STAFF"],
    export: ["ADMIN", "STAFF"],
  },
  category: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    create: ["ADMIN", "STAFF"],
    edit: ["ADMIN", "STAFF"],
    delete: ["ADMIN"],
  },
  booking: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    create: ["ADMIN", "STAFF", "STUDENT"],
    // Fine-grained booking actions (edit, cancel, extend, checkin)
    // are enforced by booking-rules.ts with ownership checks.
  },
  checkout: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    create: ["ADMIN", "STAFF", "STUDENT"],
    scan: ["ADMIN", "STAFF", "STUDENT"],
    complete: ["ADMIN", "STAFF"],
    admin_override: ["ADMIN", "STAFF"],
  },
  bulk_sku: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    create: ["ADMIN", "STAFF"],
    edit: ["ADMIN", "STAFF"],
    adjust: ["ADMIN", "STAFF"],
    delete: ["ADMIN"],
  },
  calendar_source: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    create: ["ADMIN", "STAFF"],
    edit: ["ADMIN", "STAFF"],
    delete: ["ADMIN", "STAFF"],
    sync: ["ADMIN", "STAFF"],
  },
  location: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    manage: ["ADMIN", "STAFF"],
  },
  location_mapping: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    create: ["ADMIN", "STAFF"],
    delete: ["ADMIN", "STAFF"],
  },
  report: {
    view: ["ADMIN", "STAFF"],
  },
  notification: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    process: ["ADMIN", "STAFF"],
  },
  diagnostics: {
    view: ["ADMIN"],
  },
  shift: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    create: ["ADMIN", "STAFF"],
    edit: ["ADMIN", "STAFF"],
    delete: ["ADMIN", "STAFF"],
  },
  shift_assignment: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    assign: ["ADMIN", "STAFF"],
    request: ["ADMIN", "STAFF", "STUDENT"],
    approve: ["ADMIN", "STAFF"],
  },
  sport_config: {
    view: ["ADMIN", "STAFF"],
    manage: ["ADMIN", "STAFF"],
  },
  student_sport: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    manage: ["ADMIN", "STAFF"],
  },
  student_area: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    manage: ["ADMIN", "STAFF"],
  },
  shift_trade: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    post: ["ADMIN", "STAFF", "STUDENT"],
    claim: ["ADMIN", "STAFF", "STUDENT"],
    approve: ["ADMIN", "STAFF"],
  },
  allowed_email: {
    view: ["ADMIN", "STAFF"],
    create: ["ADMIN", "STAFF"],
    delete: ["ADMIN", "STAFF"],
  },
  kit: {
    view: ["ADMIN", "STAFF"],
    create: ["ADMIN", "STAFF"],
    edit: ["ADMIN", "STAFF"],
    delete: ["ADMIN"],
  },
  kiosk_device: {
    view: ["ADMIN"],
    create: ["ADMIN"],
    edit: ["ADMIN"],
    delete: ["ADMIN"],
  },
  guide: {
    view: ["ADMIN", "STAFF", "STUDENT"],
    create: ["ADMIN", "STAFF"],
    edit: ["ADMIN", "STAFF"],
    delete: ["ADMIN"],
  },
};

/**
 * Look up allowed roles for a resource + action from the policy map.
 * Returns the role list, or throws if the combination is not defined.
 */
export function getAllowedRoles(resource: string, action: string): Role[] {
  const actions = PERMISSIONS[resource];
  if (!actions || !actions[action]) {
    throw new Error(`No permission defined for ${resource}.${action}`);
  }
  return actions[action];
}
