import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  search,
  onSearchChange,
  onSelect,
  disabled,
  conflictMap,
  conflictsLoading,
}: Props) {
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
      {loading ? (
        <p className="text-xs text-muted-foreground p-2">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="text-xs text-muted-foreground p-2">
          {search ? "No matching users." : "No active users found."}
        </p>
      ) : (
        <ScrollArea className="max-h-52">
          {users.map((u) => {
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
