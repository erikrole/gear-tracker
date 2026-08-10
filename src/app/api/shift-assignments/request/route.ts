import { withAuth } from "@/lib/api";
import { handleOpenShiftPickup } from "../pickup/handler";

// Compatibility alias for older web/native clients. New UI calls `/pickup`.
// Both routes intentionally execute the same instant DIRECT_ASSIGNED claim;
// this endpoint must never recreate REQUESTED assignment rows.
export const POST = withAuth(handleOpenShiftPickup);
