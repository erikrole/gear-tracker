"use client";

import { FormEvent, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

type Location = { id: string; name: string };
type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF" | "STUDENT";
  location: Location | null;
};

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF" | "STUDENT";
  location: string | null;
};

type Badge = {
  slug: string;
  name: string;
  description: string;
  category: string;
  iconUrl: string | null;
  isSecret: boolean;
  earned: boolean;
  earnedAt: string | null;
};

type BadgeStats = {
  returnRate: number;
  shiftAttendance: number;
  itemsLost: number;
  overdueCount: number;
  currentStreak: number;
};

type Milestone = { threshold: number; reached: boolean };

type BadgeData = {
  badges: Badge[];
  earnedCount: number;
  totalVisible: number;
  stats: BadgeStats;
  milestones: {
    bronze: Milestone;
    silver: Milestone;
    gold: Milestone;
    platinum: Milestone;
  };
};

const CATEGORY_LABELS: Record<string, string> = {
  ACCOUNTABILITY: "Accountability",
  GEAR: "Gear & Checkout",
  SHIFT: "Shift & Scheduling",
  EVENT: "Event Coverage",
  SECRET: "Secret",
};

const CATEGORY_ORDER = ["ACCOUNTABILITY", "GEAR", "SHIFT", "EVENT", "SECRET"];

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="stat-card" style={{ borderLeft: `3px solid var(--${color})` }}>
      <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{label}</div>
    </div>
  );
}

function getStatColor(value: number, greenThreshold: number, yellowThreshold: number): string {
  if (value >= greenThreshold) return "green";
  if (value >= yellowThreshold) return "orange";
  return "red";
}

function MilestoneBar({ milestones, earnedCount }: { milestones: BadgeData["milestones"]; earnedCount: number }) {
  const tiers = [
    { key: "bronze", label: "Bronze", reward: "Sticker Pack", ...milestones.bronze },
    { key: "silver", label: "Silver", reward: "T-Shirt", ...milestones.silver },
    { key: "gold", label: "Gold", reward: "Hoodie", ...milestones.gold },
    { key: "platinum", label: "Platinum", reward: "Premium Gear", ...milestones.platinum },
  ];

  // Find next milestone
  const nextTier = tiers.find((t) => !t.reached);
  const maxThreshold = tiers[tiers.length - 1].threshold;
  const progressPct = Math.min(100, (earnedCount / maxThreshold) * 100);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "var(--text-sm)" }}>
        <span>{earnedCount} badges earned</span>
        {nextTier && (
          <span style={{ color: "var(--text-secondary)" }}>
            {nextTier.threshold - earnedCount} more for {nextTier.label} ({nextTier.reward})
          </span>
        )}
      </div>
      <div style={{ height: 8, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${progressPct}%`,
            background: "var(--accent)",
            borderRadius: 4,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        {tiers.map((t) => (
          <span
            key={t.key}
            style={{
              fontSize: "var(--text-xs)",
              color: t.reached ? "var(--green)" : "var(--text-secondary)",
              fontWeight: t.reached ? 600 : 400,
            }}
          >
            {t.label} ({t.threshold})
          </span>
        ))}
      </div>
    </div>
  );
}

function BadgeGrid({ badges, category }: { badges: Badge[]; category: string }) {
  const filtered = badges.filter((b) => b.category === category);
  if (filtered.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>
        {CATEGORY_LABELS[category] ?? category}
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
        {filtered.map((badge) => (
          <div
            key={badge.slug}
            className="card"
            style={{
              padding: 12,
              textAlign: "center",
              opacity: badge.earned ? 1 : 0.4,
              position: "relative",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 4 }}>
              {badge.earned ? getBadgeIcon(badge.slug) : "?"}
            </div>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: 2 }}>
              {badge.earned || !badge.isSecret ? badge.name : "???"}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.3 }}>
              {badge.earned || !badge.isSecret ? badge.description : "Hidden badge"}
            </div>
            {badge.earned && badge.earnedAt && (
              <div style={{ fontSize: 9, color: "var(--green)", marginTop: 4 }}>
                {new Date(badge.earnedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getBadgeIcon(slug: string): string {
  const icons: Record<string, string> = {
    "ironclad": "\u{1F6E1}",
    "trusted-hands": "\u{1F932}",
    "steward": "\u{1F527}",
    "unbreakable": "\u{26D3}",
    "full-accountability": "\u{2705}",
    "the-vault": "\u{1F512}",
    "first-checkout": "\u{1F4E6}",
    "gear-head": "\u{1F3A5}",
    "century-club": "\u{1F4AF}",
    "clean-slate": "\u{2728}",
    "speed-scan": "\u{26A1}",
    "full-send": "\u{1F680}",
    "zero-loss": "\u{1F3AF}",
    "lens-hog": "\u{1F4F7}",
    "battery-pack": "\u{1F50B}",
    "shift-starter": "\u{1F3C1}",
    "iron-worker": "\u{1F4AA}",
    "centurion": "\u{1F3DB}",
    "trade-hero": "\u{1F91D}",
    "four-corners": "\u{1F9ED}",
    "weekend-warrior": "\u{1F305}",
    "double-header": "\u{0032}\u{FE0F}\u{20E3}",
    "swiss-army-knife": "\u{1FA9A}",
    "game-day-ready": "\u{1F3DF}",
    "all-sport-athlete": "\u{1F3C5}",
    "road-warrior": "\u{1F68C}",
    "rivalry-week": "\u{1F525}",
    "march-madness": "\u{1F3C0}",
    "camp-randall-regular": "\u{1F3E0}",
    "season-ticket": "\u{1F3AB}",
    "buckys-favorite": "\u{2B50}",
    "hat-trick": "\u{1F3A9}",
    "back-to-back": "\u{23E9}",
    "perfectionist": "\u{1F48E}",
    "ghost": "\u{1F47B}",
    "the-closer": "\u{1F510}",
    "og": "\u{1F3C6}",
    "night-owl": "\u{1F989}",
    "early-bird": "\u{1F426}",
    "snow-day": "\u{2744}",
    "jump-around": "\u{1F3C8}",
    "freshman-year": "\u{1F31F}",
  };
  return icons[slug] ?? "\u{1F3C5}";
}

export default function ProfilePage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [badgeData, setBadgeData] = useState<BadgeData | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (!json?.data) { setLoadError(true); return; }
        setProfile(json.data.user);
        setLocations(json.data.locations);
      })
      .catch(() => setLoadError(true));

    fetch("/api/badges")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (json?.data) setBadgeData(json.data);
      });
  }, []);

  useEffect(() => {
    if (profile?.role !== "ADMIN") return;

    fetch("/api/users")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => setUsers(json?.data || []));
  }, [profile?.role]);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingProfile(true);

    try {
      const form = new FormData(e.currentTarget);
      const payload = {
        name: String(form.get("name") || ""),
        locationId: String(form.get("locationId") || "") || null
      };

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to update profile", "error");
      } else {
        setProfile(json.data);
        toast("Profile saved", "success");
      }
    } catch {
      toast("Network error", "error");
    }
    setSavingProfile(false);
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPassword(true);

    try {
      const form = new FormData(e.currentTarget);
      const currentPassword = String(form.get("currentPassword") || "");
      const newPassword = String(form.get("newPassword") || "");

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_password", currentPassword, newPassword })
      });

      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to update password", "error");
      } else {
        e.currentTarget.reset();
        toast("Password updated", "success");
      }
    } catch {
      toast("Network error", "error");
    }
    setSavingPassword(false);
  }

  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  async function updateRole(userId: string, role: ManagedUser["role"]) {
    setUpdatingRoleId(userId);

    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      });

      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to update role", "error");
        return;
      }

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast("Role updated", "success");
    } finally {
      setUpdatingRoleId(null);
    }
  }

  if (loadError) {
    return <div className="empty-state">Failed to load profile. Please refresh.</div>;
  }
  if (!profile) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="page-header">
        <h1>Profile & Settings</h1>
      </div>

      {/* ── Badges Section ─────────────────────────────── */}
      {badgeData && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h2>Accountability Stats</h2>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 16 }}>
                <StatCard
                  label="Return Rate"
                  value={`${badgeData.stats.returnRate}%`}
                  color={getStatColor(badgeData.stats.returnRate, 95, 85)}
                />
                <StatCard
                  label="Shift Attendance"
                  value={`${badgeData.stats.shiftAttendance}%`}
                  color={getStatColor(badgeData.stats.shiftAttendance, 95, 85)}
                />
                <StatCard
                  label="Items Lost"
                  value={badgeData.stats.itemsLost}
                  color={badgeData.stats.itemsLost === 0 ? "green" : "red"}
                />
                <StatCard
                  label="Overdue Count"
                  value={badgeData.stats.overdueCount}
                  color={badgeData.stats.overdueCount === 0 ? "green" : badgeData.stats.overdueCount <= 2 ? "orange" : "red"}
                />
                <StatCard
                  label="Current Streak"
                  value={badgeData.stats.currentStreak > 0 ? `${badgeData.stats.currentStreak} in a row` : "0"}
                  color={badgeData.stats.currentStreak >= 10 ? "green" : badgeData.stats.currentStreak >= 5 ? "orange" : "text-secondary"}
                />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h2>
                Badges
                <span className="badge badge-gray" style={{ marginLeft: 8 }}>
                  {badgeData.earnedCount} / {badgeData.totalVisible}
                </span>
              </h2>
            </div>
            <div style={{ padding: 16 }}>
              <MilestoneBar milestones={badgeData.milestones} earnedCount={badgeData.earnedCount} />
              {CATEGORY_ORDER.map((cat) => (
                <BadgeGrid key={cat} badges={badgeData.badges} category={cat} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Profile Form ───────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h2>My profile</h2></div>
        <form onSubmit={saveProfile} className="profile-form">
          <label>
            Name
            <input className="form-input" name="name" defaultValue={profile.name} required style={{ width: "100%" }} />
          </label>
          <label>
            Email
            <input className="form-input" value={profile.email} disabled style={{ width: "100%", background: "var(--bg-secondary)" }} />
          </label>
          <label>
            Default location
            <select className="form-select" name="locationId" defaultValue={profile.location?.id || ""} style={{ width: "100%" }}>
              <option value="">None</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" type="submit" disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save profile"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h2>Change password</h2></div>
        <form onSubmit={changePassword} className="profile-form">
          <label>
            Current password
            <input className="form-input" name="currentPassword" type="password" required minLength={8} style={{ width: "100%" }} />
          </label>
          <label>
            New password
            <input className="form-input" name="newPassword" type="password" required minLength={8} style={{ width: "100%" }} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={savingPassword}>
            {savingPassword ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>

      {profile.role === "ADMIN" && (
        <div className="card">
          <div className="card-header"><h2>User roles</h2></div>
          <table className="data-table roles-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Location</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.location || "-"}</td>
                  <td>
                    <select
                      className="form-select"
                      value={user.role}
                      onChange={(e) => updateRole(user.id, e.target.value as ManagedUser["role"])}
                      disabled={updatingRoleId === user.id}
                      style={{ opacity: updatingRoleId === user.id ? 0.6 : 1 }}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="STAFF">Staff</option>
                      <option value="STUDENT">Student</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
