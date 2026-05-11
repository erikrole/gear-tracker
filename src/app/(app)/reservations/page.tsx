import { redirect } from "next/navigation";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set("tab", "reservations");
  for (const [key, value] of Object.entries(sp)) {
    if (key === "tab") continue;
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    }
  }
  redirect(`/bookings?${params.toString()}`);
}
