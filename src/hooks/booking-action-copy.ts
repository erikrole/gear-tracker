type BookingKind = "CHECKOUT" | "RESERVATION";

function bookingLabel(kind: BookingKind) {
  return kind === "CHECKOUT" ? "checkout" : "reservation";
}

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getBookingCancelCopy(kind: BookingKind, title?: string | null) {
  const label = bookingLabel(kind);
  const subject = title ? `"${title}"` : `this ${label}`;

  return {
    title: `Cancel ${label}?`,
    message: `Cancel ${subject} and release its equipment commitments. The record stays in history, and the ${label} cannot be reopened.`,
    confirmLabel: `Cancel ${label}`,
    success: `${sentenceCase(label)} cancelled`,
  };
}
