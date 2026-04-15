import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { AlertTriangle, PlusIcon, XIcon } from "lucide-react";
import { getInitials } from "@/lib/avatar";
import { UserAvatarPicker, type PickerUser } from "./UserAvatarPicker";

type ShiftUser = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

type ShiftAssignment = {
  id: string;
  status: string;
  hasConflict?: boolean;
  conflictNote?: string | null;
  user: ShiftUser;
};

const WORKER_LABELS: Record<string, string> = {
  FT: "Full-time",
  ST: "Student",
};

const STATUS_BADGES: Record<string, string> = {
  DIRECT_ASSIGNED: "blue",
  REQUESTED: "orange",
  APPROVED: "green",
  DECLINED: "red",
  SWAPPED: "gray",
};

type Props = {
  shiftId: string;
  workerType: string;
  activeAssignment: ShiftAssignment | null;
  pendingRequests: ShiftAssignment[];
  isStaff: boolean;
  isPremier: boolean;
  currentUserId?: string;
  acting: string | null;
  // Picker state
  pickerOpen: boolean;
  pickerUsers: PickerUser[];
  pickerLoading: boolean;
  pickerSearch: string;
  onPickerSearchChange: (value: string) => void;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  // Actions
  onAssign: (userId: string) => void;
  onRemove: (assignmentId: string) => void;
  onApprove: (assignmentId: string) => void;
  onDecline: (assignmentId: string) => void;
  onRequest: () => void;
  onDeleteShift: () => void;
};

export function ShiftSlotCard({
  shiftId,
  workerType,
  activeAssignment,
  pendingRequests,
  isStaff,
  isPremier,
  currentUserId,
  acting,
  pickerOpen,
  pickerUsers,
  pickerLoading,
  pickerSearch,
  onPickerSearchChange,
  onOpenPicker,
  onClosePicker,
  onAssign,
  onRemove,
  onApprove,
  onDecline,
  onRequest,
  onDeleteShift,
}: Props) {
  const isAssigned = !!activeAssignment;
  const userHasRequested = pendingRequests.some((a) => a.user.id === currentUserId);

  return (
    <Card
      elevation="flat"
      className={`p-3 mb-2 ${isAssigned ? "border-[var(--green)]/20 bg-[var(--green-bg)]" : ""}`}
    >
      {/* Header: worker type + status badge + delete */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">
          {WORKER_LABELS[workerType] ?? workerType}
        </span>
        <div className="flex items-center gap-1">
          {isAssigned ? (
            <Badge variant="green" size="sm">Filled</Badge>
          ) : pendingRequests.length > 0 ? (
            <Badge variant="orange" size="sm">
              {pendingRequests.length} request{pendingRequests.length > 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge variant="red" size="sm">Open</Badge>
          )}
          {isStaff && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={onDeleteShift}
                  disabled={acting !== null}
                >
                  <XIcon className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove shift</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Active assignment */}
      {activeAssignment && (
        <div className="flex items-center justify-between">
          <span className="text-sm flex items-center gap-2">
            <Avatar className="size-7">
              {activeAssignment.user.avatarUrl && (
                <AvatarImage src={activeAssignment.user.avatarUrl} alt={activeAssignment.user.name} />
              )}
              <AvatarFallback className="text-xs font-medium">
                {getInitials(activeAssignment.user.name)}
              </AvatarFallback>
            </Avatar>
            {activeAssignment.user.name}
            {activeAssignment.hasConflict && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="size-3.5 text-amber-500 shrink-0" aria-label="Schedule conflict" />
                </TooltipTrigger>
                <TooltipContent>
                  {activeAssignment.conflictNote ?? "Schedule conflict"}
                </TooltipContent>
              </Tooltip>
            )}
          </span>
          <div className="flex items-center gap-1">
            <Badge variant={(STATUS_BADGES[activeAssignment.status] ?? "gray") as BadgeProps["variant"]} size="sm">
              {activeAssignment.status.replace("_", " ")}
            </Badge>
            {isStaff && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive"
                onClick={() => onRemove(activeAssignment.id)}
                disabled={acting !== null}
              >
                {acting === activeAssignment.id ? "..." : "Remove"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {pendingRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Avatar className="size-6">
                  <AvatarFallback className="text-xs font-medium">
                    {getInitials(req.user.name)}
                  </AvatarFallback>
                </Avatar>
                {req.user.name}
              </span>
              {isStaff && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onApprove(req.id)}
                    disabled={acting !== null}
                  >
                    {acting === req.id ? "..." : "Approve"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive"
                    onClick={() => onDecline(req.id)}
                    disabled={acting !== null}
                  >
                    Decline
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Assignment actions */}
      {!isAssigned && (
        <div className="flex items-center gap-1 mt-2">
          {isStaff && (
            <Popover
              open={pickerOpen}
              onOpenChange={(open) => {
                if (open) onOpenPicker();
                else onClosePicker();
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <PlusIcon className="size-3" />
                  Assign
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <UserAvatarPicker
                  users={pickerUsers}
                  loading={pickerLoading}
                  search={pickerSearch}
                  onSearchChange={onPickerSearchChange}
                  onSelect={(userId) => onAssign(userId)}
                  disabled={acting !== null}
                />
              </PopoverContent>
            </Popover>
          )}
          {!isStaff && isPremier && !userHasRequested && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={onRequest}
              disabled={acting !== null}
            >
              {acting === shiftId ? "Requesting..." : "Request this shift"}
            </Button>
          )}
          {userHasRequested && (
            <span className="text-xs text-muted-foreground">You have requested this shift</span>
          )}
        </div>
      )}
    </Card>
  );
}
