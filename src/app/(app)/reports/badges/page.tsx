"use client";

import { useEffect, useState } from "react";
import { SkeletonTable } from "@/components/Skeleton";

type LeaderboardEntry = {
  id: string;
  name: string;
  email: string;
  badgeCount: number;
  latestBadge: { earnedAt: string; badge: { name: string } } | null;
};

type RecentUnlock = {
  studentName: string;
  studentId: string;
  badgeName: string;
  badgeSlug: string;
  category: string;
  earnedAt: string;
};

type AccountabilityEntry = {
  id: string;
  name: string;
  returnRate: number;
  overdueCount: number;
  shiftAttendance: number;
  shiftsWorked: number;
  badgeCount: number;
};

type MilestoneReport = {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
};

type DashboardData = {
  leaderboard: LeaderboardEntry[];
  milestoneReport: MilestoneReport;
  recentUnlocks: RecentUnlock[];
  accountability: AccountabilityEntry[];
};

function getColor(value: number, greenThreshold: number, yellowThreshold: number): string {
  if (value >= greenThreshold) return "var(--green)";
  if (value >= yellowThreshold) return "var(--orange)";
  return "var(--red)";
}

export default function BadgesReportPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"leaderboard" | "accountability" | "feed">("leaderboard");

  useEffect(() => {
    fetch("/api/badges/leaderboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Badge Dashboard</h1></div>
        <SkeletonTable rows={8} cols={4} />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <div className="page-header"><h1>Badge Dashboard</h1></div>
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>
          Failed to load badge data.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header"><h1>Badge Dashboard</h1></div>

      {/* Milestone summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Bronze (5+)", count: data.milestoneReport.bronze, reward: "Sticker Pack" },
          { label: "Silver (12+)", count: data.milestoneReport.silver, reward: "T-Shirt" },
          { label: "Gold (22+)", count: data.milestoneReport.gold, reward: "Hoodie" },
          { label: "Platinum (35+)", count: data.milestoneReport.platinum, reward: "Premium Gear" },
        ].map((tier) => (
          <div key={tier.label} className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700 }}>{tier.count}</div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{tier.label}</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{tier.reward}</div>
          </div>
        ))}
      </div>

      {/* Tab navigation */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {([
          { key: "leaderboard" as const, label: "Leaderboard" },
          { key: "accountability" as const, label: "Accountability" },
          { key: "feed" as const, label: "Recent Unlocks" },
        ]).map((t) => (
          <button
            key={t.key}
            className={`btn btn-sm${tab === t.key ? " btn-primary" : ""}`}
            onClick={() => setTab(t.key)}
            style={tab !== t.key ? { background: "var(--panel)", border: "1px solid var(--border)", color: "var(--text)" } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Leaderboard tab */}
      {tab === "leaderboard" && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Badges</th>
                <th>Latest Badge</th>
                <th>Tier</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.map((student, i) => (
                <tr key={student.id}>
                  <td style={{ fontWeight: 600, color: i < 3 ? "var(--accent)" : "var(--text-secondary)" }}>
                    {i + 1}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{student.name}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{student.email}</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>{student.badgeCount}</td>
                  <td>
                    {student.latestBadge ? (
                      <div>
                        <span>{student.latestBadge.badge.name}</span>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                          {new Date(student.latestBadge.earnedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-secondary)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${student.badgeCount >= 35 ? "purple" : student.badgeCount >= 22 ? "orange" : student.badgeCount >= 12 ? "blue" : student.badgeCount >= 5 ? "green" : "gray"}`}>
                      {student.badgeCount >= 35 ? "Platinum" : student.badgeCount >= 22 ? "Gold" : student.badgeCount >= 12 ? "Silver" : student.badgeCount >= 5 ? "Bronze" : "—"}
                    </span>
                  </td>
                </tr>
              ))}
              {data.leaderboard.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-secondary)" }}>No students yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Accountability tab */}
      {tab === "accountability" && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Return Rate</th>
                <th>Overdue</th>
                <th>Shift Attendance</th>
                <th>Shifts Worked</th>
                <th>Badges</th>
              </tr>
            </thead>
            <tbody>
              {data.accountability
                .sort((a, b) => a.returnRate - b.returnRate)
                .map((student) => (
                  <tr key={student.id}>
                    <td style={{ fontWeight: 600 }}>{student.name}</td>
                    <td style={{ color: getColor(student.returnRate, 95, 85), fontWeight: 600 }}>
                      {student.returnRate}%
                    </td>
                    <td style={{ color: student.overdueCount === 0 ? "var(--green)" : student.overdueCount <= 2 ? "var(--orange)" : "var(--red)" }}>
                      {student.overdueCount}
                    </td>
                    <td style={{ color: getColor(student.shiftAttendance, 95, 85), fontWeight: 600 }}>
                      {student.shiftAttendance}%
                    </td>
                    <td>{student.shiftsWorked}</td>
                    <td>{student.badgeCount}</td>
                  </tr>
                ))}
              {data.accountability.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)" }}>No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent unlocks feed */}
      {tab === "feed" && (
        <div className="card">
          {data.recentUnlocks.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>
              No badge unlocks yet.
            </div>
          ) : (
            <div style={{ padding: 0 }}>
              {data.recentUnlocks.map((unlock, i) => (
                <div
                  key={`${unlock.studentId}-${unlock.badgeSlug}-${i}`}
                  style={{
                    padding: "12px 16px",
                    borderBottom: i < data.recentUnlocks.length - 1 ? "1px solid var(--border)" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>{unlock.studentName}</span>
                    <span style={{ color: "var(--text-secondary)" }}> earned </span>
                    <span style={{ fontWeight: 600 }}>{unlock.badgeName}</span>
                    <span className={`badge badge-sm badge-${unlock.category === "SECRET" ? "purple" : unlock.category === "ACCOUNTABILITY" ? "green" : "blue"}`} style={{ marginLeft: 8 }}>
                      {unlock.category}
                    </span>
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {new Date(unlock.earnedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
