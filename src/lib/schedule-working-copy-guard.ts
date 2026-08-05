import { HttpError } from "@/lib/http";

export const WORKING_COPY_MUTATION_MESSAGE =
  "This event has unpublished Schedule changes. Review or discard the private working schedule before changing live assignments.";

export function assertNoWorkingCopy(
  workingCopy: { version: number } | null | undefined,
): void {
  if (workingCopy) {
    throw new HttpError(409, WORKING_COPY_MUTATION_MESSAGE);
  }
}
