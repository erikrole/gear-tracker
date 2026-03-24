import { redirect } from "next/navigation";

export default function ReservationsPage() {
  redirect("/bookings?tab=reservations");
}
