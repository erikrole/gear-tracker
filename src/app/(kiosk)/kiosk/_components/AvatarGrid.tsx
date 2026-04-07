"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials, getAvatarColor } from "@/lib/avatar";

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
      <div className="flex h-full flex-col">
        <div className="grid flex-1 grid-cols-5 content-start gap-3 overflow-y-auto p-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="size-[60px] rounded-full" />
              <Skeleton className="h-3 w-14 rounded" />
            </div>
          ))}
        </div>
        <div className="shrink-0 p-3 pt-2">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable avatar grid */}
      <div className="grid flex-1 grid-cols-5 content-start gap-3 overflow-y-auto p-2">
        {filtered.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelect(user)}
            className="flex min-h-[80px] cursor-pointer flex-col items-center gap-1.5 rounded-lg p-1.5 transition-colors active:bg-accent/50 hover:bg-accent/30"
          >
            <Avatar className="size-[60px]">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.name} />
              ) : null}
              <AvatarFallback
                className={`text-base font-semibold ${getAvatarColor(user.name)}`}
              >
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-[80px] truncate text-xs font-medium text-foreground">
              {user.name.split(" ")[0]}
            </span>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-5 py-8 text-center text-sm text-muted-foreground">
            No users found
          </div>
        )}
      </div>

      {/* Search input pinned to bottom */}
      <div className="shrink-0 border-t p-3 pt-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
    </div>
  );
}
