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
import { AlertTriangle, PlusIcon, XIcon } from "lucide-react";
import { CallWindowEditor } from "./CallWindowEditor";
import { UserAvatarPicker, type PickerUser } from "./UserAvatarPicker";
import { effectiveCallWindow, isInheritedFullDayCallWindow } from "@/lib/shift-call-windows";
import { shiftWorkerLabelForProfile, shiftWorkerSlotLabel } from "@/lib/shift-display";

type ShiftUser = {
  id: string;
  name: string;
  role?: string;
  staffingType?: string | null;
  avatarUrl?: string | null;
};

type ShiftAssignment = {
  id: string;
  status: string;
  hasConflict?: boolean;
  conflictNote?: string | null;
  callStartsAt?: string | null;
  callEndsAt?: string | null;
  callNote?: string | null;
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
  startsAt: string;
  endsAt: string;
  callStartsAt?: string | null;
  callEndsAt?: string | null;
  eventAllDay?: boolean;
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
  onCallWindowSaved?: () => void;
};

export function ShiftSlotCard({
  shiftId,
  workerType,
  startsAt,
  endsAt,
  callStartsAt,
  callEndsAt,
  eventAllDay = false,
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
  onCallWindowSaved,
}: Props) {
  const isAssigned = !!activeAssignment;
  const userHasRequested = pendingRequests.some((a) => a.user.id === currentUserId);
  const isMyAssignment = activeAssignment?.user.id === currentUserId;
  const shiftWindow = { startsAt, endsAt, callStartsAt, callEndsAt };
  const slotWindow = effectiveCallWindow(shiftWindow);
  const assignmentWindow = activeAssignment ? effectiveCallWindow(shiftWindow, activeAssignment) : null;
  const showSlotWindow = !isAssigned && !eventAllDay && !isInheritedFullDayCallWindow(slotWindow);
  const showAssignmentWindow = Boolean(
    assignmentWindow && !eventAllDay && !isInheritedFullDayCallWindow(assignmentWindow),
  );
  const roleBadgeLabel = activeAssignment
    ? shiftWorkerLabelForProfile(activeAssignment.user) ?? "Assigned"
    : shiftWorkerSlotLabel(workerType);

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
          {/* Header: status badge + assigned role or open planned slot */}
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
              <Badge variant="gray" size="sm">{roleBadgeLabel}</Badge>
            </div>
            {showSlotWindow && (
              <CallWindowEditor
                target={isStaff ? { type: "slot", id: shiftId } : undefined}
                effectiveWindow={slotWindow}
                overrideWindow={{ startsAt: callStartsAt ?? null, endsAt: callEndsAt ?? null }}
                onSaved={onCallWindowSaved}
                disabled={acting !== null}
                compact
              />
            )}
            {isStaff && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 text-muted-foreground hover:text-destructive"
                    onClick={onDeleteShift}
                    disabled={acting !== null}
                    aria-label="Remove shift"
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
                      className="h-9 px-2 text-xs text-destructive"
                      onClick={() => onRemove(activeAssignment.id)}
                      disabled={acting !== null}
                    >
                      {acting === activeAssignment.id ? "..." : "Remove"}
                    </Button>
                  )}
                </div>
              </div>
              {showAssignmentWindow && assignmentWindow && (
                <div className="mt-1.5 pl-9">
                  <CallWindowEditor
                    target={isStaff ? { type: "assignment", id: activeAssignment.id } : undefined}
                    effectiveWindow={assignmentWindow}
                    overrideWindow={{ startsAt: activeAssignment.callStartsAt ?? null, endsAt: activeAssignment.callEndsAt ?? null }}
                    onSaved={onCallWindowSaved}
                    disabled={acting !== null}
                    compact
                  />
                </div>
              )}

              {/* Post for trade (own shift, student only) */}
              {!isStaff && onPostTrade && isMyAssignment && (
                <div className="mt-1.5 pl-9">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 text-xs"
                    onClick={() => onPostTrade(activeAssignment.id)}
                    disabled={acting !== null}
                  >
                    Post for trade
                  </Button>
                </div>
              )}
            </>
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
                        className="h-10 px-3 text-xs"
                        onClick={() => onApprove(req.id)}
                        disabled={acting !== null}
                      >
                        {acting === req.id ? "..." : "Approve"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 px-3 text-xs text-destructive"
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

          {/* Empty slot - assign staff-side or let students request student slots. */}
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
                      className="group flex min-h-10 w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-[background-color,color,scale] hover:bg-muted/50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                      disabled={acting !== null}
                    >
                      <div className="size-7 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/25 group-hover:border-primary/50 flex items-center justify-center transition-colors">
                        <PlusIcon className="size-3 text-muted-foreground/35 group-hover:text-primary transition-colors" />
                      </div>
                      <span className="text-sm text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                        Assign someone...
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
                      slotWorkerType={workerType}
                    />
                  </PopoverContent>
                </Popover>
              )}
              {!isStaff && workerType === "ST" && !userHasRequested && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 h-10 text-xs"
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
