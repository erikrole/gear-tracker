import { describe, expect, it, vi } from "vitest";
import { updateShiftAssignmentConflictsTx } from "@/lib/services/shift-assignment-conflicts";

describe("updateShiftAssignmentConflictsTx", () => {
  it("skips the database when there are no assignments to refresh", async () => {
    const executeRaw = vi.fn();

    await updateShiftAssignmentConflictsTx({ $executeRaw: executeRaw } as never, [], true);

    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("batches distinct assignment results into one acknowledgement-aware update", async () => {
    const executeRaw = vi.fn().mockResolvedValue(2);

    await updateShiftAssignmentConflictsTx({ $executeRaw: executeRaw } as never, [
      { id: "assignment-1", hasConflict: true, conflictNote: "Class overlap" },
      { id: "assignment-2", hasConflict: false, conflictNote: null },
    ], true);

    expect(executeRaw).toHaveBeenCalledOnce();
    const query = executeRaw.mock.calls[0]![0] as { sql: string; values: unknown[] };
    expect(query.sql).toContain('UPDATE "shift_assignments"');
    expect(query.sql).toContain("FROM (VALUES");
    expect(query.values).toEqual([
      true,
      true,
      "assignment-1",
      true,
      "Class overlap",
      "assignment-2",
      false,
      null,
    ]);
  });

  it("rejects a partial batch update so the surrounding transaction cannot commit stale state", async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);

    await expect(updateShiftAssignmentConflictsTx({ $executeRaw: executeRaw } as never, [
      { id: "assignment-1", hasConflict: false, conflictNote: null },
      { id: "assignment-2", hasConflict: false, conflictNote: null },
    ], false)).rejects.toThrow("changed during conflict refresh");
  });
});
