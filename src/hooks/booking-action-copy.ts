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

export function getReservationConvertCopy(title?: string | null) {
  const subject = title ? `"${title}"` : "this reservation";

  return {
    title: "Start checkout from reservation?",
    message: `Create a pending pickup from ${subject}. The reservation closes, and gear custody still begins at kiosk pickup.`,
    confirmLabel: "Start checkout",
    success: "Checkout pending pickup",
    successDescription: "Open the checkout to complete pickup at the kiosk.",
    missingLinkError: "Checkout started, but the response did not include a checkout link. Refresh the page.",
  };
}
