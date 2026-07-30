import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { isSerializationConflict, withSerializationRetry } from "@/lib/serialization";
import { fail } from "@/lib/http";

describe("isSerializationConflict", () => {
  it("matches the Prisma P2034 shape", () => {
    const error = new Prisma.PrismaClientKnownRequestError("write conflict", {
      code: "P2034",
      clientVersion: "test",
    });
    expect(isSerializationConflict(error)).toBe(true);
  });

  // The Neon adapter can pass the raw driver code through instead of mapping
  // it to P2034, on either `code` or `meta.code`.
  it("matches the raw 40001 driver code", () => {
    expect(isSerializationConflict({ code: "40001" })).toBe(true);
    expect(isSerializationConflict({ meta: { code: "40001" } })).toBe(true);
  });

  it("rejects unrelated errors", () => {
    expect(isSerializationConflict(new Error("boom"))).toBe(false);
    expect(isSerializationConflict({ code: "P2002" })).toBe(false);
    expect(isSerializationConflict(null)).toBe(false);
    expect(isSerializationConflict("40001")).toBe(false);
  });
});

describe("withSerializationRetry", () => {
  it("returns the first result when there is no conflict", async () => {
    const operation = vi.fn().mockResolvedValue("ok");
    await expect(withSerializationRetry(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries once after a conflict and runs onRetry before the second attempt", async () => {
    const order: string[] = [];
    const operation = vi.fn()
      .mockImplementationOnce(async () => {
        order.push("attempt-1");
        throw { code: "40001" };
      })
      .mockImplementationOnce(async () => {
        order.push("attempt-2");
        return "ok";
      });

    await expect(
      withSerializationRetry(operation, { onRetry: () => order.push("reset") }),
    ).resolves.toBe("ok");
    expect(order).toEqual(["attempt-1", "reset", "attempt-2"]);
  });

  it("gives up after one retry rather than looping", async () => {
    const operation = vi.fn().mockRejectedValue({ code: "40001" });
    await expect(withSerializationRetry(operation)).rejects.toMatchObject({ code: "40001" });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("rethrows a non-conflict error without retrying", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(withSerializationRetry(operation)).rejects.toThrow("boom");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe("fail() serialization mapping", () => {
  it("maps the Prisma P2034 shape to a retryable 409", async () => {
    const res = fail(new Prisma.PrismaClientKnownRequestError("write conflict", {
      code: "P2034",
      clientVersion: "test",
    }));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("same time"),
    });
  });

  // REGRESSION: the raw 40001 shape used to fall through to a 500, so a real
  // two-students-claim-the-same-shift race read as an app crash.
  it("maps the raw 40001 driver code to a retryable 409", async () => {
    expect(fail({ code: "40001" }).status).toBe(409);
    expect(fail({ meta: { code: "40001" } }).status).toBe(409);
  });
});
