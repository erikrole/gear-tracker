import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(),
    location: { findMany: vi.fn(), upsert: vi.fn() },
    department: { findMany: vi.fn(), upsert: vi.fn() },
    asset: { findMany: vi.fn(), createMany: vi.fn(), update: vi.fn() },
    bulkSku: { upsert: vi.fn() },
    bulkStockBalance: { upsert: vi.fn() },
    kit: { upsert: vi.fn() },
    kitMembership: { createMany: vi.fn() },
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
import { POST as importAssets } from "@/app/api/assets/import/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: Role.STAFF,
  avatarUrl: null,
};

function importRequest(path: string, formData: FormData) {
  return new Request(`https://app.example.com${path}`, {
    method: "POST",
    headers: {
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: formData,
  });
}

function csvFile() {
  return new File(["Name,Location\nCAM-1,Main\n"], "items.csv", { type: "text/csv" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(staffUser);
});

describe("asset import route validation", () => {
  it("rejects malformed mapping JSON before touching the database", async () => {
    const formData = new FormData();
    formData.set("file", csvFile());
    formData.set("mapping", "{not-json");

    const res = await importAssets(
      importRequest("/api/assets/import?mode=preview", formData),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Mapping must be valid JSON");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects unsupported import route modes before touching the database", async () => {
    const formData = new FormData();
    formData.set("file", csvFile());
    formData.set("mapping", "{}");

    const res = await importAssets(
      importRequest("/api/assets/import?mode=destroy", formData),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Import mode must be preview or import");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
