"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/avatar";

type KioskUser = { id: string; name: string; avatarUrl: string | null };

type Props = {
  users: KioskUser[];
  onSelect: (user: KioskUser) => void;
  loading?: boolean;
};

export function AvatarGrid({ users, onSelect, loading }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q));
  }, [users, search]);

  if (loading) {
    return (
      <div className="flex h-full flex-col gap-3 px-4 py-2">
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="grid flex-1 grid-cols-4 content-start gap-2">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 rounded-xl p-3"
              style={{ background: "#131316" }}
            >
              <Skeleton className="size-[72px] rounded-full" />
              <Skeleton className="h-3 w-14 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 px-4 py-2">
      {/* Search — pinned at top */}
      <div className="relative shrink-0">
        <Search
          className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/25"
        />
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg pl-9 pr-3 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:ring-1"
          style={{
            background: "#1a1a1e",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(197,5,12,0.50)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
        />
      </div>

      {/* Roster grid */}
      <div className="grid min-h-0 flex-1 grid-cols-4 content-start gap-2 overflow-y-auto">
        {filtered.map((user) => {
          const firstName = user.name.split(" ")[0];
          return (
            <button
              key={user.id}
              type="button"
              onClick={() => onSelect(user)}
              className="group flex flex-col items-center gap-2 rounded-xl p-3 transition-all duration-150"
              style={{
                background: "#131316",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#1e1e24";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(197,5,12,0.40)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#131316";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)";
              }}
              onTouchStart={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#1e1e24";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(197,5,12,0.40)";
              }}
            >
              <Avatar className="size-[72px] ring-2 ring-transparent ring-offset-2 ring-offset-[#131316] group-active:ring-[#c5050c] transition-all">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                ) : null}
                <AvatarFallback
                  className="text-lg font-bold"
                  style={{
                    background: "#252530",
                    color: "rgba(255,255,255,0.75)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span
                className="max-w-[90px] truncate text-center text-xs uppercase text-white/80"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                }}
              >
                {firstName}
              </span>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-4 flex flex-col items-center justify-center gap-1 py-12">
            <p className="text-sm text-white/30">No users found</p>
            <p className="text-xs text-white/20">&ldquo;{search}&rdquo;</p>
          </div>
        )}
      </div>
    </div>
  );
}
