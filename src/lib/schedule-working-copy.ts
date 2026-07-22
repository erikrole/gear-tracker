import { ShiftArea, ShiftWorkerType } from "@prisma/client";
import { z } from "zod";

const isoDate = z.string().datetime({ offset: true });

export const workingAssignmentSchema = z.object({
  sourceAssignmentId: z.string().min(1).nullable(),
  userId: z.string().min(1),
  status: z.enum(["DIRECT_ASSIGNED", "APPROVED"]),
  callStartsAt: isoDate.nullable(),
  callEndsAt: isoDate.nullable(),
  callNote: z.string().max(5000).nullable(),
  activeTradeId: z.string().min(1).nullable(),
  bookingCount: z.number().int().min(0),
});

export const workingSlotSchema = z.object({
  key: z.string().min(1),
  sourceShiftId: z.string().min(1).nullable(),
  area: z.nativeEnum(ShiftArea),
  workerType: z.nativeEnum(ShiftWorkerType),
  startsAt: isoDate,
  endsAt: isoDate,
  callStartsAt: isoDate.nullable(),
  callEndsAt: isoDate.nullable(),
  notes: z.string().max(5000).nullable(),
  assignmentHistoryCount: z.number().int().min(0).default(0),
  assignment: workingAssignmentSchema.nullable(),
});

export const workingSchedulePayloadSchema = z.object({
  eventStartsAt: isoDate,
  eventEndsAt: isoDate,
  slots: z.array(workingSlotSchema).max(250),
}).superRefine((payload, ctx) => {
  if (new Date(payload.eventEndsAt) <= new Date(payload.eventStartsAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Event end must be after event start" });
  }

  const keys = new Set<string>();
  for (const [index, slot] of payload.slots.entries()) {
    if (keys.has(slot.key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slots", index, "key"],
        message: "Working slot keys must be unique",
      });
    }
    keys.add(slot.key);
    if (new Date(slot.endsAt) <= new Date(slot.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slots", index, "endsAt"],
        message: "Shift end must be after shift start",
      });
    }
    if (Boolean(slot.callStartsAt) !== Boolean(slot.callEndsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slots", index],
        message: "Call start and end must both be set or both be empty",
      });
    }
    if (slot.callStartsAt && slot.callEndsAt && new Date(slot.callEndsAt) <= new Date(slot.callStartsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slots", index, "callEndsAt"],
        message: "Call end must be after call start",
      });
    }
  }
});

export type WorkingSchedulePayload = z.infer<typeof workingSchedulePayloadSchema>;
export type WorkingScheduleSlot = z.infer<typeof workingSlotSchema>;

export const workingScheduleCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("adjustSlots"),
    area: z.nativeEnum(ShiftArea),
    workerType: z.nativeEnum(ShiftWorkerType),
    delta: z.union([z.literal(-1), z.literal(1)]),
  }),
  z.object({
    type: z.literal("convertSlot"),
    slotKey: z.string().min(1),
    workerType: z.nativeEnum(ShiftWorkerType),
  }),
  z.object({
    type: z.literal("assign"),
    slotKey: z.string().min(1),
    userId: z.string().min(1),
  }),
  z.object({
    type: z.literal("unassign"),
    slotKey: z.string().min(1),
  }),
  z.object({
    type: z.literal("removeSlot"),
    slotKey: z.string().min(1),
  }),
  z.object({
    type: z.literal("setCallWindow"),
    slotKey: z.string().min(1),
    callStartsAt: isoDate.nullable(),
    callEndsAt: isoDate.nullable(),
  }),
]);

export type WorkingScheduleCommand = z.infer<typeof workingScheduleCommandSchema>;

export type WorkingScheduleChanges = {
  addedSlots: number;
  removedSlots: number;
  convertedSlots: number;
  assignmentChanges: number;
  callWindowChanges: number;
  total: number;
};

export function summarizeWorkingScheduleChanges(
  published: WorkingSchedulePayload,
  working: WorkingSchedulePayload,
): WorkingScheduleChanges {
  const publishedById = new Map(
    published.slots
      .filter((slot): slot is WorkingScheduleSlot & { sourceShiftId: string } => Boolean(slot.sourceShiftId))
      .map((slot) => [slot.sourceShiftId, slot]),
  );
  const workingById = new Map(
    working.slots
      .filter((slot): slot is WorkingScheduleSlot & { sourceShiftId: string } => Boolean(slot.sourceShiftId))
      .map((slot) => [slot.sourceShiftId, slot]),
  );

  const addedSlots = working.slots.filter((slot) => !slot.sourceShiftId).length;
  const removedSlots = [...publishedById.keys()].filter((id) => !workingById.has(id)).length;
  let convertedSlots = 0;
  let assignmentChanges = 0;
  let callWindowChanges = 0;

  for (const [id, slot] of workingById) {
    const previous = publishedById.get(id);
    if (!previous) continue;
    if (previous.workerType !== slot.workerType) convertedSlots += 1;
    if (
      previous.callStartsAt !== slot.callStartsAt
      || previous.callEndsAt !== slot.callEndsAt
    ) {
      callWindowChanges += 1;
    }
    if (
      previous.assignment?.userId !== slot.assignment?.userId
      || previous.assignment?.callStartsAt !== slot.assignment?.callStartsAt
      || previous.assignment?.callEndsAt !== slot.assignment?.callEndsAt
      || previous.assignment?.callNote !== slot.assignment?.callNote
    ) {
      assignmentChanges += 1;
    }
  }

  return {
    addedSlots,
    removedSlots,
    convertedSlots,
    assignmentChanges,
    callWindowChanges,
    total: addedSlots + removedSlots + convertedSlots + assignmentChanges + callWindowChanges,
  };
}

export function applyWorkingScheduleCommand(
  payload: WorkingSchedulePayload,
  command: WorkingScheduleCommand,
  createKey: () => string,
): WorkingSchedulePayload {
  const next = structuredClone(payload);

  if (command.type === "adjustSlots") {
    if (command.delta === 1) {
      const peer = [...next.slots].reverse().find((slot) =>
        slot.area === command.area && slot.workerType === command.workerType,
      );
      next.slots.push({
        key: createKey(),
        sourceShiftId: null,
        area: command.area,
        workerType: command.workerType,
        startsAt: peer?.startsAt ?? next.eventStartsAt,
        endsAt: peer?.endsAt ?? next.eventEndsAt,
        callStartsAt: peer?.callStartsAt ?? null,
        callEndsAt: peer?.callEndsAt ?? null,
        notes: null,
        assignmentHistoryCount: 0,
        assignment: null,
      });
    } else {
      const removableIndex = next.slots.findLastIndex((slot) =>
        slot.area === command.area
        && slot.workerType === command.workerType
        && slot.assignment === null
        && slot.assignmentHistoryCount === 0,
      );
      if (removableIndex === -1) {
        throw new Error("UNASSIGN_BEFORE_REDUCING");
      }
      next.slots.splice(removableIndex, 1);
    }
  } else if (command.type === "convertSlot") {
    const slot = next.slots.find((candidate) => candidate.key === command.slotKey);
    if (!slot) throw new Error("WORKING_SLOT_NOT_FOUND");
    if (slot.workerType === command.workerType) return next;
    if (slot.assignment || slot.assignmentHistoryCount > 0) {
      throw new Error("UNASSIGN_BEFORE_CONVERTING");
    }
    slot.workerType = command.workerType;
  } else if (command.type === "assign") {
    const slot = next.slots.find((candidate) => candidate.key === command.slotKey);
    if (!slot) throw new Error("WORKING_SLOT_NOT_FOUND");
    if (slot.assignment) throw new Error("WORKING_SLOT_ALREADY_ASSIGNED");
    slot.assignment = {
      sourceAssignmentId: null,
      userId: command.userId,
      status: "DIRECT_ASSIGNED",
      callStartsAt: null,
      callEndsAt: null,
      callNote: null,
      activeTradeId: null,
      bookingCount: 0,
    };
  } else if (command.type === "unassign") {
    const slot = next.slots.find((candidate) => candidate.key === command.slotKey);
    if (!slot) throw new Error("WORKING_SLOT_NOT_FOUND");
    if (!slot.assignment) throw new Error("WORKING_SLOT_NOT_ASSIGNED");
    if (slot.assignment.activeTradeId) throw new Error("CANCEL_TRADE_BEFORE_UNASSIGNING");
    if (slot.assignment.bookingCount > 0) throw new Error("UNLINK_BOOKING_BEFORE_UNASSIGNING");
    slot.assignment = null;
  } else if (command.type === "removeSlot") {
    const slotIndex = next.slots.findIndex((candidate) => candidate.key === command.slotKey);
    if (slotIndex === -1) throw new Error("WORKING_SLOT_NOT_FOUND");
    const slot = next.slots[slotIndex]!;
    if (slot.assignment || slot.assignmentHistoryCount > 0) {
      throw new Error("UNASSIGN_BEFORE_REDUCING");
    }
    next.slots.splice(slotIndex, 1);
  } else {
    const slot = next.slots.find((candidate) => candidate.key === command.slotKey);
    if (!slot) throw new Error("WORKING_SLOT_NOT_FOUND");
    slot.callStartsAt = command.callStartsAt;
    slot.callEndsAt = command.callEndsAt;
  }

  return workingSchedulePayloadSchema.parse(next);
}
