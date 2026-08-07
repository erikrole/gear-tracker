import { BookingStatus } from "@prisma/client";

/** Booking states that still represent an operational gear commitment. */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.BOOKED,
  BookingStatus.PENDING_PICKUP,
  BookingStatus.OPEN,
];
