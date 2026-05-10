import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTx } = vi.hoisted(() => ({
  mockTx: {
    user: {
      findUnique: vi.fn(),
    },
    badgeDefinition: {
      findUnique: vi.fn(),
    },
    studentBadge: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    _mockTx: mockTx,
  },
}));

import { awardBadgeManually } from "@/lib/badges/queries";

const targetUser = {
  id: "staff-1",
  name: "Staff One",
  role: "STAFF",
  active: true,
  notificationPrefs: null,
};

const definition = {
  id: "badge-1",
  name: "Team Player",
  active: true,
};

const award = {
  id: "award-1",
  userId: "staff-1",
  definitionId: "badge-1",
  awardedAt: new Date("2026-05-09T20:00:00.000Z"),
  source: "MANUAL",
  note: "Staff pick",
  definition: {
    id: "badge-1",
    key: "first_trade",
    name: "Team Player",
    description: "Complete a shift trade.",
    icon: "Handshake",
    category: "TRADE",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.user.findUnique.mockResolvedValue(targetUser);
  mockTx.badgeDefinition.findUnique.mockResolvedValue(definition);
  mockTx.studentBadge.findUnique.mockResolvedValue(null);
  mockTx.studentBadge.create.mockResolvedValue(award);
  mockTx.notification.create.mockResolvedValue({});
});

describe("manual badge awards", () => {
  it("creates a manual award and persistent inbox notification by default", async () => {
    await awardBadgeManually({
      userId: "staff-1",
      definitionId: "badge-1",
      awardedById: "admin-1",
      note: "Staff pick",
    });

    expect(mockTx.studentBadge.create).toHaveBeenCalledWith({
      data: {
        userId: "staff-1",
        definitionId: "badge-1",
        source: "MANUAL",
        awardedById: "admin-1",
        note: "Staff pick",
      },
      include: {
        definition: {
          select: {
            id: true,
            key: true,
            name: true,
            description: true,
            icon: true,
            category: true,
          },
        },
      },
    });
    expect(mockTx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "staff-1",
        type: "badge_awarded",
        payload: expect.objectContaining({
          href: "/users/staff-1?tab=badges",
        }),
      }),
    });
  });

  it("skips the inbox notification when badge notifications are muted", async () => {
    mockTx.user.findUnique.mockResolvedValue({
      ...targetUser,
      notificationPrefs: {
        pausedUntil: null,
        channels: { email: true, push: true },
        badges: false,
      },
    });

    await awardBadgeManually({
      userId: "staff-1",
      definitionId: "badge-1",
      awardedById: "admin-1",
    });

    expect(mockTx.studentBadge.create).toHaveBeenCalled();
    expect(mockTx.notification.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate manual awards", async () => {
    mockTx.studentBadge.findUnique.mockResolvedValue({ id: "award-existing" });

    await expect(
      awardBadgeManually({
        userId: "staff-1",
        definitionId: "badge-1",
        awardedById: "admin-1",
      }),
    ).rejects.toThrow("Badge already awarded");
    expect(mockTx.studentBadge.create).not.toHaveBeenCalled();
    expect(mockTx.notification.create).not.toHaveBeenCalled();
  });

  it("rejects manual awards for inactive users", async () => {
    mockTx.user.findUnique.mockResolvedValue({
      ...targetUser,
      active: false,
    });

    await expect(
      awardBadgeManually({
        userId: "staff-1",
        definitionId: "badge-1",
        awardedById: "admin-1",
      }),
    ).rejects.toThrow("Active user not found");
    expect(mockTx.studentBadge.create).not.toHaveBeenCalled();
  });
});
