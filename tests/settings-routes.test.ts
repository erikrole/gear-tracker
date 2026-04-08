import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock modules ───────────────────────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    escalationRule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    systemConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  GET as getEscalation,
  PATCH as patchEscalation,
} from "@/app/api/settings/escalation/route";
import {
  GET as getExtendPresets,
  PUT as putExtendPresets,
} from "@/app/api/settings/extend-presets/route";

const adminUser = {
  id: "admin-1",
  email: "admin@test.com",
  name: "Admin",
  role: "ADMIN" as const,
  avatarUrl: null,
};

const staffUser = {
  id: "staff-1",
  email: "staff@test.com",
  name: "Staff",
  role: "STAFF" as const,
  avatarUrl: null,
};

const studentUser = {
  id: "student-1",
  email: "student@test.com",
  name: "Student",
  role: "STUDENT" as const,
  avatarUrl: null,
};

function makeGetRequest(url = "https://app.example.com/api/settings/escalation") {
  return new Request(url, {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

function makePatchRequest(body: Record<string, unknown>, url = "https://app.example.com/api/settings/escalation") {
  return new Request(url, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

function makePutRequest(body: Record<string, unknown>, url = "https://app.example.com/api/settings/extend-presets") {
  return new Request(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

const noParams = { params: Promise.resolve({}) };

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/settings/escalation
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/settings/escalation", () => {
  it("returns escalation rules and config for ADMIN", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.escalationRule.findMany).mockResolvedValue([
      { id: "rule-1", name: "Overdue 24h", sortOrder: 1, enabled: true, notifyAdmins: true, notifyRequester: false } as any,
    ]);
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue({
      key: "escalation",
      value: { maxNotificationsPerBooking: 5 },
    } as any);

    const res = await getEscalation(makeGetRequest(), noParams);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.rules).toHaveLength(1);
    expect(body.data.config.maxNotificationsPerBooking).toBe(5);
  });

  it("returns default maxNotificationsPerBooking when no config exists", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.escalationRule.findMany).mockResolvedValue([]);
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue(null);

    const res = await getEscalation(makeGetRequest(), noParams);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.config.maxNotificationsPerBooking).toBe(10);
  });

  it("returns 403 for STAFF", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);

    const res = await getEscalation(makeGetRequest(), noParams);

    expect(res.status).toBe(403);
  });

  it("returns 403 for STUDENT", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await getEscalation(makeGetRequest(), noParams);

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/settings/escalation
// ═════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/settings/escalation", () => {
  it("updates maxNotificationsPerBooking", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue(null);
    vi.mocked(db.systemConfig.upsert).mockResolvedValue({} as any);

    const res = await patchEscalation(
      makePatchRequest({ maxNotificationsPerBooking: 20 }),
      noParams
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.maxNotificationsPerBooking).toBe(20);
  });

  it("updates an escalation rule", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    const beforeRule = {
      id: "cm123456789012345678901234",
      enabled: true,
      notifyAdmins: false,
      notifyRequester: false,
    };
    vi.mocked(db.escalationRule.findUnique).mockResolvedValue(beforeRule as any);
    vi.mocked(db.escalationRule.update).mockResolvedValue({
      ...beforeRule,
      notifyAdmins: true,
    } as any);

    const res = await patchEscalation(
      makePatchRequest({ ruleId: "cm123456789012345678901234", notifyAdmins: true }),
      noParams
    );

    expect(res.status).toBe(200);
    expect(db.escalationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cm123456789012345678901234" },
        data: { notifyAdmins: true },
      })
    );
  });

  it("returns 404 when updating non-existent rule", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.escalationRule.findUnique).mockResolvedValue(null);

    const res = await patchEscalation(
      makePatchRequest({ ruleId: "cm123456789012345678901234", enabled: false }),
      noParams
    );

    expect(res.status).toBe(404);
  });

  it("returns 403 for STAFF", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);

    const res = await patchEscalation(
      makePatchRequest({ maxNotificationsPerBooking: 5 }),
      noParams
    );

    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body (no fields to update)", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);

    const res = await patchEscalation(
      makePatchRequest({ ruleId: "cm123456789012345678901234" }),
      noParams
    );

    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/settings/extend-presets
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/settings/extend-presets", () => {
  it("returns stored presets", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue({
      key: "extend_presets",
      value: [{ label: "+2 days", minutes: 2880 }],
    } as any);

    const res = await getExtendPresets(
      makeGetRequest("https://app.example.com/api/settings/extend-presets"),
      noParams
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.presets).toEqual([{ label: "+2 days", minutes: 2880 }]);
  });

  it("returns default presets when none configured", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue(null);

    const res = await getExtendPresets(
      makeGetRequest("https://app.example.com/api/settings/extend-presets"),
      noParams
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.presets).toHaveLength(3);
    expect(body.data.presets[0].label).toBe("+1 day");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PUT /api/settings/extend-presets
// ═════════════════════════════════════════════════════════════════════════════
describe("PUT /api/settings/extend-presets", () => {
  it("updates presets for ADMIN", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(db.systemConfig.upsert).mockResolvedValue({} as any);

    const presets = [
      { label: "+1 day", minutes: 1440 },
      { label: "+1 week", minutes: 10080 },
    ];

    const res = await putExtendPresets(
      makePutRequest({ presets }),
      noParams
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.presets).toEqual(presets);
  });

  it("returns 403 for STAFF", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);

    const res = await putExtendPresets(
      makePutRequest({ presets: [{ label: "+1 day", minutes: 1440 }] }),
      noParams
    );

    expect(res.status).toBe(403);
  });

  it("returns 403 for STUDENT", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await putExtendPresets(
      makePutRequest({ presets: [{ label: "+1 day", minutes: 1440 }] }),
      noParams
    );

    expect(res.status).toBe(403);
  });

  it("returns 400 for empty presets array", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);

    const res = await putExtendPresets(
      makePutRequest({ presets: [] }),
      noParams
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid minutes (negative)", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);

    const res = await putExtendPresets(
      makePutRequest({ presets: [{ label: "Bad", minutes: -1 }] }),
      noParams
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 for missing label", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);

    const res = await putExtendPresets(
      makePutRequest({ presets: [{ label: "", minutes: 100 }] }),
      noParams
    );

    expect(res.status).toBe(400);
  });
});
