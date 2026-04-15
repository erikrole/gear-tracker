"use client";

import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import type { ShiftGroupSummary, CommandCenterData } from "../_utils";
import { AREA_LABELS } from "../_utils";

type ShiftCoverageCardProps = {
  shiftGroup: ShiftGroupSummary;
  commandCenter: CommandCenterData | null;
  currentUserRole: string;
  /** ID of the action currently in flight (global spam-click guard) */
  acting: string | null;
  /** URL search params for linking to checkout/reservation pages */
  linkParams: {
    titleParam: string;
    dateParam: string;
    endParam: string;
    locationParam: string;
    eventParam: string;
  };
  onManageShifts: () => void;
  onNudge: (assignmentId: string, userName: string) => void;
};

export function ShiftCoverageCard({
  shiftGroup,
  commandCenter,
  currentUserRole,
  acting,
  linkParams,
  onManageShifts,
  onNudge,
}: ShiftCoverageCardProps) {
  const { titleParam, dateParam, endParam, locationParam, eventParam } = linkParams;
  const isStaffOrAdmin = currentUserRole === "STAFF" || currentUserRole === "ADMIN";

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Shift Coverage</CardTitle>
        <Button variant="outline" size="sm" onClick={onManageShifts}>
          Manage shifts
        </Button>
      </CardHeader>
      <CardContent>
        {shiftGroup.isPremier && (
          <div className="mb-3">
            <Badge variant="blue">Premier Event</Badge>
            <span className="text-xs text-muted-foreground ml-1.5">Students can request shifts</span>
          </div>
        )}

        {/* Staff/admin: enhanced view with gear status */}
        {commandCenter && commandCenter.shifts.length > 0 && isStaffOrAdmin ? (
          <>
            {(commandCenter.gearSummary.byStatus.draft > 0 || commandCenter.gearSummary.byStatus.reserved > 0 || commandCenter.gearSummary.byStatus.checkedOut > 0 || commandCenter.gearSummary.byStatus.completed > 0) && (
              <div className="flex gap-2 flex-wrap mb-4">
                {commandCenter.gearSummary.byStatus.draft > 0 && <Badge variant="gray">{commandCenter.gearSummary.byStatus.draft} Draft</Badge>}
                {commandCenter.gearSummary.byStatus.reserved > 0 && <Badge variant="orange">{commandCenter.gearSummary.byStatus.reserved} Reserved</Badge>}
                {commandCenter.gearSummary.byStatus.checkedOut > 0 && <Badge variant="green">{commandCenter.gearSummary.byStatus.checkedOut} Checked out</Badge>}
                {commandCenter.gearSummary.byStatus.completed > 0 && <Badge variant="blue">{commandCenter.gearSummary.byStatus.completed} Returned</Badge>}
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Gear</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commandCenter.shifts.map((shift) => {
                  const hasMissingGear = shift.assignment && commandCenter.missingGear.some(
                    (m) => m.shiftId === shift.id
                  );
                  return (
                    <TableRow key={shift.id}>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          {AREA_LABELS[shift.area] ?? shift.area}
                          {shift.workerType === "FT" && <Badge variant="gray" size="sm">FT</Badge>}
                        </span>
                      </TableCell>
                      <TableCell>{shift.assignment ? shift.assignment.userName : <span className="text-muted-foreground">&mdash;</span>}</TableCell>
                      <TableCell>
                        {shift.assignment ? (
                          <Badge variant="green">Filled</Badge>
                        ) : shift.pendingRequests > 0 ? (
                          <Badge variant="orange">{shift.pendingRequests} req</Badge>
                        ) : (
                          <Badge variant="red">Open</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!shift.assignment ? (
                          <span className="text-muted-foreground">&mdash;</span>
                        ) : hasMissingGear ? (
                          <Badge variant="red">None</Badge>
                        ) : shift.assignment.linkedBookingId ? (
                          <Badge variant="green">Linked</Badge>
                        ) : (
                          <Badge variant="orange">Unlinked</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {commandCenter.missingGear.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm mb-2">
                  Missing Gear ({commandCenter.missingGear.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {commandCenter.missingGear.map((m) => (
                    <div
                      key={`${m.shiftId}-${m.userId}`}
                      className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg text-sm"
                    >
                      <div>
                        <strong>{m.userName}</strong>
                        <span className="text-muted-foreground ml-2">
                          {AREA_LABELS[m.area] ?? m.area}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={acting !== null}
                          onClick={() => onNudge(m.assignmentId, m.userName)}
                        >
                          {acting === m.assignmentId ? "Sending..." : "Nudge"}
                        </Button>
                        <Button size="sm" asChild>
                          <Link
                            href={`/checkouts?create=true&title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}${eventParam}&requesterUserId=${m.userId}`}
                          >
                            Create checkout
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Non-staff: basic shift table */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shiftGroup.shifts.map((shift) => {
                const activeAssignment = shift.assignments.find(
                  (a) => a.status === "DIRECT_ASSIGNED" || a.status === "APPROVED"
                );
                const pendingCount = shift.assignments.filter((a) => a.status === "REQUESTED").length;
                return (
                  <TableRow key={shift.id}>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {AREA_LABELS[shift.area] ?? shift.area}
                        {shift.workerType === "FT" && <Badge variant="gray" size="sm">FT</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>
                      {activeAssignment ? (
                        <span className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="text-[10px] font-medium">
                              {getInitials(activeAssignment.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          {activeAssignment.user.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {activeAssignment ? (
                        <Badge variant="green">Filled</Badge>
                      ) : pendingCount > 0 ? (
                        <Badge variant="orange">{pendingCount} request{pendingCount > 1 ? "s" : ""}</Badge>
                      ) : (
                        <Badge variant="red">Open</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
