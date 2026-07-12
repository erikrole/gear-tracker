import { redirect } from "next/navigation";

// Fix Today merged into the consolidated Operations page.
export default function AdminFixTodayPage() {
  redirect("/operations");
}
