import { describe, it, expect } from "vitest";
import { requireRole, requirePermission } from "@/lib/rbac";
import { getAllowedRoles, PERMISSIONS } from "@/lib/permissions";

// Pure function tests — no mocking needed

describe("requireRole", () => {
  it("passes when user role is in allowed list", () => {
    expect(() => requireRole("ADMIN" as any, ["ADMIN", "STAFF"] as any[])).not.toThrow();
  });

  it("passes for STUDENT role when allowed", () => {
    expect(() => requireRole("STUDENT" as any, ["ADMIN", "STAFF", "STUDENT"] as any[])).not.toThrow();
  });

  it("throws 403 when user role is not in allowed list", () => {
    expect(() => requireRole("STUDENT" as any, ["ADMIN", "STAFF"] as any[])).toThrow("Forbidden");
  });

  it("throws HttpError with status 403", () => {
    try {
      requireRole("STUDENT" as any, ["ADMIN"] as any[]);
    } catch (err: any) {
      expect(err.status).toBe(403);
    }
  });
});

describe("requirePermission", () => {
  it("passes for ADMIN on asset.delete", () => {
    expect(() => requirePermission("ADMIN" as any, "asset", "delete")).not.toThrow();
  });

  it("throws 403 for STUDENT on asset.delete", () => {
    expect(() => requirePermission("STUDENT" as any, "asset", "delete")).toThrow("Forbidden");
  });

  it("throws 403 for STAFF on asset.delete", () => {
    expect(() => requirePermission("STAFF" as any, "asset", "delete")).toThrow("Forbidden");
  });

  it("passes for STUDENT on booking.create", () => {
    expect(() => requirePermission("STUDENT" as any, "booking", "create")).not.toThrow();
  });
});

describe("getAllowedRoles", () => {
  it("returns role list for known resource+action", () => {
    const roles = getAllowedRoles("asset", "view");
    expect(roles).toEqual(["ADMIN", "STAFF", "STUDENT"]);
  });

  it("throws Error for unknown resource", () => {
    expect(() => getAllowedRoles("nonexistent", "view")).toThrow("No permission defined");
  });

  it("throws Error for unknown action", () => {
    expect(() => getAllowedRoles("asset", "nonexistent")).toThrow("No permission defined");
  });
});

describe("PERMISSIONS map completeness", () => {
  const expectedResources = [
    "user", "asset", "category", "booking", "checkout",
    "bulk_sku", "calendar_source", "location", "location_mapping",
    "report", "notification", "diagnostics", "shift", "shift_assignment",
    "sport_config", "student_sport", "student_area", "shift_trade", "kit",
  ];

  it("has all expected resources", () => {
    for (const resource of expectedResources) {
      expect(PERMISSIONS[resource]).toBeDefined();
    }
  });

  it("every permission has at least one allowed role", () => {
    for (const [resource, actions] of Object.entries(PERMISSIONS)) {
      for (const [action, roles] of Object.entries(actions)) {
        expect(roles.length).toBeGreaterThan(0);
      }
    }
  });

  it("ADMIN has access to diagnostics.view", () => {
    expect(PERMISSIONS.diagnostics.view).toContain("ADMIN");
    expect(PERMISSIONS.diagnostics.view).not.toContain("STAFF");
    expect(PERMISSIONS.diagnostics.view).not.toContain("STUDENT");
  });
});
