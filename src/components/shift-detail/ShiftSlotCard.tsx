import { UserAvatar } from "@/components/UserAvatar";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { AlertTriangle, CheckIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
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
  attended?: boolean | null;
  user: ShiftUser;
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
  // Trade
  onPostTrade?: (assignmentId: string) => void;
  // Attendance (post-event, staff only)
  showAttendance?: boolean;
  onSetAttendance?: (assignmentId: string, attended: boolean | null) => void;
};

export function ShiftSlotCard({
  shiftId,
  workerType,
  activeAssignment,
  pendingRequests,
  isStaff,
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
  onPostTrade,
  showAttendance,
  onSetAttendance,
}: Props) {
  const isAssigned = !!activeAssignment;
  const userHasRequested = pendingRequests.some((a) => a.user.id === currentUserId);
  const isMyAssignment = activeAssignment?.user.id === currentUserId;

  const contextItems = (
    <ContextMenuContent className="w-48">
      {isStaff && isAssigned && (
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onRemove(activeAssignment!.id)}
          disabled={acting !== null}
        >
          Remove assignment
        </ContextMenuItem>
      )}
      {isStaff && (
        <>
          {isAssigned && <ContextMenuSeparator />}
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onDeleteShift}
            disabled={acting !== null}
          >
            Remove shift
          </ContextMenuItem>
        </>
      )}
      {!isStaff && isMyAssignment && onPostTrade && (
        <ContextMenuItem onClick={() => onPostTrade(activeAssignment!.id)} disabled={acting !== null}>
          Post for trade
        </ContextMenuItem>
      )}
    </ContextMenuContent>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          elevation="flat"
          className={`p-3 mb-2 ${isAssigned ? "border-[var(--green)]/20 bg-[var(--green-bg)]" : ""}`}
        >
          {/* Header: status badge + FT indicator + delete */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              {isAssigned ? (
                <Badge variant="green" size="sm">Filled</Badge>
              ) : pendingRequests.length > 0 ? (
                <Badge variant="orange" size="sm">
                  {pendingRequests.length} request{pendingRequests.length > 1 ? "s" : ""}
                </Badge>
              ) : (
                <Badge variant="red" size="sm">Open</Badge>
              )}
              {workerType === "FT" && (
                <Badge variant="gray" size="sm">Full-time</Badge>
              )}
            </div>
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

          {/* Active assignment */}
          {activeAssignment && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <UserAvatar
                    name={activeAssignment.user.name}
                    avatarUrl={activeAssignment.user.avatarUrl}
                    size="default"
                  />
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

              {/* Post for trade (own shift, student only) */}
              {!isStaff && onPostTrade && isMyAssignment && (
                <div className="mt-1.5 pl-9">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => onPostTrade(activeAssignment.id)}
                    disabled={acting !== null}
                  >
                    Post for trade
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Attendance logging (past events, staff only) */}
          {activeAssignment && showAttendance && onSetAttendance && (
            <div className="flex items-center gap-1 mt-1.5 pl-9">
              <span className="text-xs text-muted-foreground mr-1">Attended:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() =>
                      onSetAttendance(
                        activeAssignment.id,
                        activeAssignment.attended === true ? null : true,
                      )
                    }
                    disabled={acting !== null}
                    className={`flex items-center justify-center size-6 rounded border transition-colors ${
                      activeAssignment.attended === true
                        ? "bg-green-500/15 border-green-500/40 text-green-600"
                        : "border-border text-muted-foreground hover:border-green-400 hover:text-green-600"
                    }`}
                    aria-label="Mark attended"
                  >
                    <CheckIcon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {activeAssignment.attended === true ? "Attended — click to clear" : "Mark attended"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() =>
                      onSetAttendance(
                        activeAssignment.id,
                        activeAssignment.attended === false ? null : false,
                      )
                    }
                    disabled={acting !== null}
                    className={`flex items-center justify-center size-6 rounded border transition-colors ${
                      activeAssignment.attended === false
                        ? "bg-red-500/15 border-red-500/40 text-red-600"
                        : "border-border text-muted-foreground hover:border-red-400 hover:text-red-600"
                    }`}
                    aria-label="Mark no-show"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {activeAssignment.attended === false ? "No-show — click to clear" : "Mark no-show"}
                </TooltipContent>
              </Tooltip>
              {activeAssignment.attended == null && (
                <span className="text-[10px] text-muted-foreground/60 ml-0.5">
                  <MinusIcon className="size-3 inline" /> not logged
                </span>
              )}
            </div>
          )}

          {/* Pending requests */}
          {pendingRequests.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <UserAvatar
                      name={req.user.name}
                      avatarUrl={req.user.avatarUrl}
                      size="sm"
                    />
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

          {/* Empty slot — assign (staff) or request (student, ST shifts only) */}
          {!isAssigned && (
            <div className="mt-1">
              {isStaff && (
                <Popover
                  open={pickerOpen}
                  onOpenChange={(open) => {
                    if (open) onOpenPicker();
                    else onClosePicker();
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      className="group flex items-center gap-2 w-full rounded-md px-1 py-1 hover:bg-muted/50 transition-colors text-left"
                      disabled={acting !== null}
                    >
                      <div className="size-7 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/25 group-hover:border-primary/50 flex items-center justify-center transition-colors">
                        <PlusIcon className="size-3 text-muted-foreground/35 group-hover:text-primary transition-colors" />
                      </div>
                      <span className="text-sm text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                        Assign someone…
                      </span>
                    </button>
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
              {!isStaff && workerType === "ST" && !userHasRequested && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs mt-1"
                  onClick={onRequest}
                  disabled={acting !== null}
                >
                  {acting === shiftId ? "Requesting..." : "Request this shift"}
                </Button>
              )}
              {userHasRequested && (
                <span className="text-xs text-muted-foreground pl-1">You have requested this shift</span>
              )}
            </div>
          )}
        </Card>
      </ContextMenuTrigger>
      {contextItems}
    </ContextMenu>
  );
}
