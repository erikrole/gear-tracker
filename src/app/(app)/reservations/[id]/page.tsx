"use client";

import BookingDetailPage from "../../bookings/BookingDetailPage";
import { FadeUp } from "@/components/ui/motion";

export default function ReservationDetailsPage() {
  return <FadeUp><BookingDetailPage kind="RESERVATION" /></FadeUp>;
}
