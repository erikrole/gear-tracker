import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getInitials, getAvatarColor } from "@/lib/avatar";

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
};

export function UserAvatarPicker({ users, loading, search, onSearchChange, onSelect, disabled }: Props) {
  return (
    <>
      <Input
        type="text"
        className="mb-2 h-8 text-xs"
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
        <ScrollArea className="max-h-52 space-y-0.5">
          {users.map((u) => (
            <button
              key={u.id}
              className="w-full flex items-center gap-2 p-1.5 rounded-md text-left text-sm hover:bg-accent transition-colors disabled:opacity-50"
              onClick={() => onSelect(u.id)}
              disabled={disabled}
            >
              <Avatar className="size-7 shrink-0">
                {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name} />}
                <AvatarFallback className={`text-xs font-medium ${getAvatarColor(u.name)}`}>
                  {getInitials(u.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate font-medium text-xs">{u.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {u.role === "STUDENT" ? "Student" : "Staff"}
                  {u.primaryArea ? ` · ${AREA_LABELS[u.primaryArea] ?? u.primaryArea}` : ""}
                </div>
              </div>
            </button>
          ))}
        </ScrollArea>
      )}
    </>
  );
}
