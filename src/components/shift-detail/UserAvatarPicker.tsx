"use client";

import { useMemo, useState } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  filterCandidatesByConflict,
  type CandidateConflictFilter,
} from "@/lib/assignment-conflict-review";

const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

export type PickerUser = {
  id: string;
  name: string;
  role: string;
  primaryArea: string | null;
  avatarUrl?: string | null;
};

type Props = {
  users: PickerUser[];
  loading: boolean;
  loadError?: false | "network" | "server";
  onRetry?: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (userId: string) => void;
  disabled: boolean;
  /** Map of userId to conflict note for users with scheduling conflicts */
  conflictMap?: Record<string, string>;
  conflictsLoading?: boolean;
};

export function UserAvatarPicker({
  users,
  loading,
  loadError = false,
  onRetry,
  search,
  onSearchChange,
  onSelect,
  disabled,
  conflictMap,
  conflictsLoading,
}: Props) {
  const [conflictFilter, setConflictFilter] = useState<CandidateConflictFilter>("all");
  const canFilterConflicts = Boolean(conflictMap);
  const filteredUsers = useMemo(
    () => filterCandidatesByConflict(users, conflictMap, conflictFilter),
    [conflictFilter, conflictMap, users],
  );
  const conflictCount = users.reduce((count, user) => count + (conflictMap?.[user.id] ? 1 : 0), 0);
  const cleanCount = users.length - conflictCount;

  return (
    <>
      <Input
        id="user-avatar-picker-search"
        name="user-avatar-picker-search"
        type="text"
        className="mb-2 h-9 text-sm"
        placeholder="Search all users..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        autoFocus
      />
      {canFilterConflicts && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <ToggleGroup
            type="single"
            value={conflictFilter}
            onValueChange={(value) => {
              if (value) setConflictFilter(value as CandidateConflictFilter);
            }}
            className="gap-1"
            aria-label="Filter assignment candidates by conflict state"
          >
            <ToggleGroupItem value="all" className="h-8 px-2 text-[11px]">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="conflicts" className="h-8 px-2 text-[11px]">
              Conflicts
            </ToggleGroupItem>
            <ToggleGroupItem value="clean" className="h-8 px-2 text-[11px]">
              Clean
            </ToggleGroupItem>
          </ToggleGroup>
          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
            {conflictCount} conflict{conflictCount === 1 ? "" : "s"} · {cleanCount} clean
          </span>
        </div>
      )}
      {loading ? (
        <p className="text-xs text-muted-foreground p-2">Loading users...</p>
      ) : loadError ? (
        <Alert variant="destructive" className="p-3">
          <AlertDescription className="space-y-2 text-xs">
            <span className="block">
              {loadError === "network"
                ? "Could not reach the server. Retry before assigning this slot."
                : "Could not load assignable users. Retry before assigning this slot."}
            </span>
            {onRetry && (
              <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={onRetry}>
                Retry users
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : filteredUsers.length === 0 ? (
        <p className="text-xs text-muted-foreground p-2">
          {search
            ? "No matching users."
            : conflictFilter === "conflicts"
              ? "No conflicted candidates for this slot."
              : conflictFilter === "clean"
                ? "No clean candidates for this slot."
                : "No active users found."}
        </p>
      ) : (
        <ScrollArea className="max-h-52">
          {filteredUsers.map((u) => {
            const conflict = conflictMap?.[u.id];
            return (
              <Button
                key={u.id}
                type="button"
                variant="ghost"
                className="min-h-10 w-full justify-start gap-2 p-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                onClick={() => onSelect(u.id)}
                disabled={disabled}
                title={conflict ?? undefined}
              >
                <div className="relative shrink-0">
	                  <UserAvatar name={u.name} avatarUrl={u.avatarUrl} size="default" />
	                  {conflict && (
	                    <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-background bg-[var(--orange)]" />
	                  )}
	                </div>
	                <div className="min-w-0 flex-1">
	                  <div className="truncate font-medium text-xs">{u.name}</div>
	                  <div className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
	                    {u.role === "STUDENT" ? "Student" : "Staff"}
	                    {u.primaryArea ? ` · ${AREA_LABELS[u.primaryArea] ?? u.primaryArea}` : ""}
	                    {conflict && (
	                      <Badge variant="orange" size="sm" className="ml-1 px-1 py-0 text-[9px]">
	                        Conflict
	                      </Badge>
	                    )}
	                  </div>
	                </div>
	              </Button>
            );
          })}
        </ScrollArea>
      )}
      {conflictsLoading && (
        <p className="text-[10px] text-muted-foreground px-1.5 mt-1">Checking availability...</p>
      )}
    </>
  );
}
