"use client";

import BookingDetailPage from "../../bookings/BookingDetailPage";
import { FadeUp } from "@/components/ui/motion";

export default function CheckoutDetailsPage() {
  return <FadeUp><BookingDetailPage kind="CHECKOUT" /></FadeUp>;
}
