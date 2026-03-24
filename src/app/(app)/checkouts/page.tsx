import { redirect } from "next/navigation";

export default function CheckoutsPage() {
  redirect("/bookings?tab=checkouts");
}
