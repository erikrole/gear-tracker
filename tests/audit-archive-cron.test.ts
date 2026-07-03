import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  auditLog: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  session: {
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/cron", () => ({
  withCron:
    (handler: (req: Request) => Promise<Response>) =>
    (req: Request) =>
      handler(req),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import { GET } from "@/app/api/cron/audit-archive/route";

function request() {
  return new Request("https://app.example.com/api/cron/audit-archive");
}

function auditBatch(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}` }));
}

describe("audit archive cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    dbMock.auditLog.findMany.mockResolvedValue([]);
    dbMock.auditLog.deleteMany.mockResolvedValue({ count: 0 });
    dbMock.session.deleteMany.mockResolvedValue({ count: 0 });
  });

  it("caps audit-log deletion batches per run and reports remaining backlog", async () => {
    for (let batch = 0; batch < 5; batch += 1) {
      dbMock.auditLog.findMany.mockResolvedValueOnce(auditBatch(`audit-${batch}`, 1000));
      dbMock.auditLog.deleteMany.mockResolvedValueOnce({ count: 1000 });
    }
    dbMock.session.deleteMany.mockResolvedValueOnce({ count: 2 });

    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      auditLogsDeleted: 5000,
      sessionsDeleted: 2,
      batchesProcessed: 5,
      batchSize: 1000,
      maxBatchesPerRun: 5,
      hasMoreAuditLogs: true,
      retentionDays: 90,
    });
    expect(dbMock.auditLog.findMany).toHaveBeenCalledTimes(5);
    expect(dbMock.auditLog.deleteMany).toHaveBeenCalledTimes(5);
  });

  it("reports audit-log purge failures while still purging expired sessions", async () => {
    dbMock.auditLog.findMany.mockResolvedValueOnce(auditBatch("audit", 1));
    dbMock.auditLog.deleteMany.mockRejectedValueOnce(new Error("delete failed"));
    dbMock.session.deleteMany.mockResolvedValueOnce({ count: 3 });

    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: false,
      auditLogsDeleted: 0,
      sessionsDeleted: 3,
      partialFailures: ["auditLogs"],
      errors: { auditLogs: "delete failed" },
    });
  });

  it("reports expired-session purge failures without dropping audit-log results", async () => {
    dbMock.auditLog.findMany.mockResolvedValueOnce(auditBatch("audit", 1));
    dbMock.auditLog.deleteMany.mockResolvedValueOnce({ count: 1 });
    dbMock.session.deleteMany.mockRejectedValueOnce(new Error("session purge failed"));

    const res = await GET(request(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: false,
      auditLogsDeleted: 1,
      sessionsDeleted: 0,
      batchesProcessed: 1,
      hasMoreAuditLogs: false,
      partialFailures: ["sessions"],
      errors: { sessions: "session purge failed" },
    });
  });
});
