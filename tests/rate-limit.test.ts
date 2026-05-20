import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, enforceRateLimit } from "@/lib/rate-limit";

// No UPSTASH_REDIS_REST_* env in the test environment, so checkRateLimit
// exercises the in-memory fallback sliding window.

describe("rate-limit in-memory fallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to max requests then blocks within the window", async () => {
    const key = `test:block:${Math.random()}`;
    const config = { max: 3, windowMs: 60_000 };

    for (let i = 0; i < 3; i++) {
      const result = await checkRateLimit(key, config);
      expect(result.allowed).toBe(true);
    }
    const blocked = await checkRateLimit(key, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window elapses", async () => {
    const key = `test:reset:${Math.random()}`;
    const config = { max: 1, windowMs: 1_000 };

    expect((await checkRateLimit(key, config)).allowed).toBe(true);
    expect((await checkRateLimit(key, config)).allowed).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect((await checkRateLimit(key, config)).allowed).toBe(true);
  });

  it("enforceRateLimit throws HttpError(429) once the limit is exceeded", async () => {
    const key = `test:enforce:${Math.random()}`;
    const config = { max: 1, windowMs: 60_000 };

    await expect(enforceRateLimit(key, config)).resolves.toBeUndefined();
    await expect(enforceRateLimit(key, config)).rejects.toMatchObject({ status: 429 });
  });
});
