import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  refreshCompanionProjection: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/services/companion-projection", () => ({
  refreshCompanionProjection: mocks.refreshCompanionProjection,
}));

import {
  deferCompanionProjectionRefresh,
  deferCompanionProjectionRefreshForCommittedMutation,
} from "@/lib/services/companion-projection-publisher";

describe("companion projection publication scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    mocks.refreshCompanionProjection.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("schedules one post-response refresh for a successful reservation mutation", async () => {
    deferCompanionProjectionRefresh(
      new Request("https://wisconsincreative.com/api/reservations", { method: "POST" }),
      new Response(null, { status: 201 }),
    );

    expect(mocks.after).toHaveBeenCalledTimes(1);
    const task = mocks.after.mock.calls[0]![0] as () => Promise<void>;
    await task();
    expect(mocks.refreshCompanionProjection).toHaveBeenCalledTimes(1);
    expect(mocks.refreshCompanionProjection).toHaveBeenCalledWith({ notify: true });
  });

  it("does not schedule reads, failed mutations, or lookalike routes", () => {
    const success = new Response(null, { status: 200 });
    deferCompanionProjectionRefresh(
      new Request("https://wisconsincreative.com/api/reservations"),
      success,
    );
    deferCompanionProjectionRefresh(
      new Request("https://wisconsincreative.com/api/reservations/1", { method: "DELETE" }),
      new Response(null, { status: 409 }),
    );
    deferCompanionProjectionRefresh(
      new Request("https://wisconsincreative.com/api/reservations-archive", { method: "POST" }),
      success,
    );

    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.refreshCompanionProjection).not.toHaveBeenCalled();
  });

  it("publishes a committed mutation once even when the success wrapper also schedules it", async () => {
    const req = new Request("https://wisconsincreative.com/api/reservations/1/cancel", {
      method: "POST",
    });

    deferCompanionProjectionRefreshForCommittedMutation(req);
    deferCompanionProjectionRefresh(req, new Response(null, { status: 200 }));

    expect(mocks.after).toHaveBeenCalledTimes(1);
    const task = mocks.after.mock.calls[0]![0] as () => Promise<void>;
    await task();
    expect(mocks.refreshCompanionProjection).toHaveBeenCalledTimes(1);
  });
});
