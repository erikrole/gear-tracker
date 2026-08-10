import { withAuth } from "@/lib/api";
import { handleOpenShiftPickup } from "./handler";

export const POST = withAuth(handleOpenShiftPickup);
