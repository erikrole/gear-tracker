export type BookingDisplayKind = "CHECKOUT" | "RESERVATION";

export type BookingStatusBadgeVariant = "gray" | "blue" | "green" | "purple" | "red" | "orange";

export type BookingStatusDisplay = {
  label: string;
  variant: BookingStatusBadgeVariant;
};

export type BookingStatusVisual = BookingStatusDisplay & {
  dot: string;
  rowClass: string;
  titleClass: string;
};

const DOT_BY_VARIANT: Record<BookingStatusBadgeVariant, string> = {
  gray: "var(--text-muted)",
  blue: "var(--blue)",
  green: "var(--green)",
  purple: "var(--purple)",
  red: "var(--red)",
  orange: "var(--orange)",
};

export function operationalBookingStatus(
  booking: { kind: string; status: string; startsAt: string | Date },
  now = new Date(),
): string {
  if (
    booking.kind === "RESERVATION"
    && booking.status === "BOOKED"
    && new Date(booking.startsAt) <= now
  ) {
    return "PENDING_PICKUP";
  }
  return booking.status;
}

export function bookingStatusLabel(status: string, kind?: BookingDisplayKind): string {
  void kind;

  switch (status) {
    case "DRAFT":
      return "Draft";
    case "BOOKED":
      return "Reserved";
    case "PENDING_PICKUP":
      return "Pending Pickup";
    case "OPEN":
      return "Checked Out";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status.charAt(0) + status.slice(1).toLowerCase();
  }
}

export function bookingStatusBadgeVariant(status: string, kind?: BookingDisplayKind): BookingStatusBadgeVariant {
  void kind;

  switch (status) {
    case "BOOKED":
      return "purple";
    case "OPEN":
      return "blue";
    case "PENDING_PICKUP":
      return "orange";
    case "CANCELLED":
    case "DRAFT":
    case "COMPLETED":
    default:
      return "gray";
  }
}

export function bookingStatusDisplay(status: string, kind?: BookingDisplayKind): BookingStatusDisplay {
  return {
    label: bookingStatusLabel(status, kind),
    variant: bookingStatusBadgeVariant(status, kind),
  };
}

export function bookingStatusDotColor(variant: BookingStatusBadgeVariant): string {
  return DOT_BY_VARIANT[variant];
}

export function bookingStatusDotClassName(variant: BookingStatusBadgeVariant): string {
  switch (variant) {
    case "blue":
      return "bg-[var(--blue)]";
    case "green":
      return "bg-[var(--green)]";
    case "purple":
      return "bg-[var(--purple)]";
    case "red":
      return "bg-[var(--red)]";
    case "orange":
      return "bg-[var(--orange)]";
    case "gray":
    default:
      return "bg-muted-foreground";
  }
}

export function bookingStatusVisual(
  status: string,
  options: { overdue?: boolean; kind?: BookingDisplayKind } = {},
): BookingStatusVisual {
  if (options.overdue) {
    return {
      label: "Overdue",
      variant: "red",
      dot: DOT_BY_VARIANT.red,
      rowClass: "",
      titleClass: "text-destructive",
    };
  }

  const display = bookingStatusDisplay(status, options.kind);
  const terminalClasses = terminalStatusClasses(status);
  return {
    ...display,
    dot: bookingStatusDotColor(display.variant),
    ...terminalClasses,
  };
}

function terminalStatusClasses(status: string): Pick<BookingStatusVisual, "rowClass" | "titleClass"> {
  switch (status) {
    case "DRAFT":
      return { rowClass: "", titleClass: "text-muted-foreground" };
    case "CANCELLED":
      return { rowClass: "", titleClass: "line-through text-muted-foreground" };
    case "COMPLETED":
      return { rowClass: "", titleClass: "text-muted-foreground" };
    default:
      return { rowClass: "", titleClass: "" };
  }
}
