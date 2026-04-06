import { redirect } from "next/navigation";

/** Old /events route redirects to unified /schedule page */
export default function EventsRedirect() {
  redirect("/schedule");
}
