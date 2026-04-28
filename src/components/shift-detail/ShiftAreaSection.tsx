import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusIcon } from "lucide-react";
import { ShiftSlotCard } from "./ShiftSlotCard";
import type { PickerUser } from "./UserAvatarPicker";

const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

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

type Shift = {
  id: string;
  area: string;
  workerType: string;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  assignments: ShiftAssignment[];
};

type Props = {
  area: string;
  shifts: Shift[];
  isStaff: boolean;
  currentUserId?: string;
  acting: string | null;
  pickerShiftId: string | null;
  pickerUsers: PickerUser[];
  pickerLoading: boolean;
  pickerSearch: string;
  onPickerSearchChange: (value: string) => void;
  onOpenPicker: (shiftId: string) => void;
  onClosePicker: () => void;
  onAddShift: (workerType: string) => void;
  onDeleteShift: (shiftId: string, hasAssignment: boolean) => void;
  onAssign: (shiftId: string, userId: string) => void;
  onRemove: (assignmentId: string) => void;
  onApprove: (assignmentId: string) => void;
  onDecline: (assignmentId: string) => void;
  onRequest: (shiftId: string) => void;
  onPostTrade?: (assignmentId: string) => void;
  showAttendance?: boolean;
  onSetAttendance?: (assignmentId: string, attended: boolean | null) => void;
};

export function ShiftAreaSection({
  area,
  shifts,
  isStaff,
  currentUserId,
  acting,
  pickerShiftId,
  pickerUsers,
  pickerLoading,
  pickerSearch,
  onPickerSearchChange,
  onOpenPicker,
  onClosePicker,
  onAddShift,
  onDeleteShift,
  onAssign,
  onRemove,
  onApprove,
  onDecline,
  onRequest,
  onPostTrade,
  showAttendance,
  onSetAttendance,
}: Props) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {AREA_LABELS[area] ?? area}
          {shifts.length > 0 && (
            <span className="ml-1.5 text-xs font-normal">({shifts.length})</span>
          )}
        </h3>
        {isStaff && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                disabled={acting !== null}
              >
                <PlusIcon className="size-3.5 mr-0.5" />
                Shift
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => onAddShift("ST")}>
                Student
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddShift("FT")}>
                Full-time
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {shifts.length === 0 ? (
        <p className="text-xs text-muted-foreground mb-2">No shifts configured</p>
      ) : (
        shifts.map((shift) => {
          const activeAssignment = shift.assignments.find(
            (a) => a.status === "DIRECT_ASSIGNED" || a.status === "APPROVED"
          );
          const pendingRequests = shift.assignments.filter(
            (a) => a.status === "REQUESTED"
          );

          return (
            <ShiftSlotCard
              key={shift.id}
              shiftId={shift.id}
              workerType={shift.workerType}
              activeAssignment={activeAssignment ?? null}
              pendingRequests={pendingRequests}
              isStaff={isStaff}
              currentUserId={currentUserId}
              acting={acting}
              pickerOpen={pickerShiftId === shift.id}
              pickerUsers={pickerUsers}
              pickerLoading={pickerLoading}
              pickerSearch={pickerSearch}
              onPickerSearchChange={onPickerSearchChange}
              onOpenPicker={() => onOpenPicker(shift.id)}
              onClosePicker={onClosePicker}
              onAssign={(userId) => onAssign(shift.id, userId)}
              onRemove={onRemove}
              onApprove={onApprove}
              onDecline={onDecline}
              onRequest={() => onRequest(shift.id)}
              onDeleteShift={() => onDeleteShift(shift.id, !!activeAssignment)}
              onPostTrade={onPostTrade}
              showAttendance={showAttendance}
              onSetAttendance={onSetAttendance}
            />
          );
        })
      )}
    </div>
  );
}
