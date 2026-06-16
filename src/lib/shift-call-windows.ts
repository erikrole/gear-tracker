export type CallWindowSource = "assignment" | "slot" | "default";

type ShiftWindowLike = {
  startsAt: string | Date;
  endsAt: string | Date;
  callStartsAt?: string | Date | null;
  callEndsAt?: string | Date | null;
};

type AssignmentWindowLike = {
  callStartsAt?: string | Date | null;
  callEndsAt?: string | Date | null;
} | null | undefined;

export type EffectiveCallWindow = {
  startsAt: string;
  endsAt: string;
  source: CallWindowSource;
};

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function effectiveCallWindow(
  shift: ShiftWindowLike,
  assignment?: AssignmentWindowLike,
): EffectiveCallWindow {
  if (assignment?.callStartsAt && assignment.callEndsAt) {
    return {
      startsAt: iso(assignment.callStartsAt),
      endsAt: iso(assignment.callEndsAt),
      source: "assignment",
    };
  }

  if (shift.callStartsAt && shift.callEndsAt) {
    return {
      startsAt: iso(shift.callStartsAt),
      endsAt: iso(shift.callEndsAt),
      source: "slot",
    };
  }

  return {
    startsAt: iso(shift.startsAt),
    endsAt: iso(shift.endsAt),
    source: "default",
  };
}

export function callWindowSourceLabel(source: CallWindowSource): string {
  if (source === "assignment") return "Personal";
  if (source === "slot") return "Slot";
  return "Default";
}

export function formatCallWindowTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCallWindowDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sameLocalDay(startIso: string, endIso: string): boolean {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  );
}

export function isMidnightToMidnightWindow(window: Pick<EffectiveCallWindow, "startsAt" | "endsAt">): boolean {
  const start = new Date(window.startsAt);
  const end = new Date(window.endsAt);
  return (
    start.getUTCHours() === 0 &&
    start.getUTCMinutes() === 0 &&
    start.getUTCSeconds() === 0 &&
    start.getUTCMilliseconds() === 0 &&
    end.getUTCHours() === 0 &&
    end.getUTCMinutes() === 0 &&
    end.getUTCSeconds() === 0 &&
    end.getUTCMilliseconds() === 0
  );
}

export function formatCallWindow(window: Pick<EffectiveCallWindow, "startsAt" | "endsAt">): string {
  const start = sameLocalDay(window.startsAt, window.endsAt)
    ? formatCallWindowTime(window.startsAt)
    : formatCallWindowDateTime(window.startsAt);
  const end = sameLocalDay(window.startsAt, window.endsAt)
    ? formatCallWindowTime(window.endsAt)
    : formatCallWindowDateTime(window.endsAt);
  return start === end ? start : `${start} - ${end}`;
}

export function formatCallWindowLabel(window: Pick<EffectiveCallWindow, "startsAt" | "endsAt">): string {
  return `Call ${formatCallWindow(window)}`;
}

export function toDateTimeLocalValue(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function dateTimeLocalToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function callWindowKey(window: Pick<EffectiveCallWindow, "startsAt" | "endsAt">): string {
  return `${new Date(window.startsAt).getTime()}|${new Date(window.endsAt).getTime()}`;
}

export function summarizeEffectiveCallWindows(
  windows: EffectiveCallWindow[],
  options: { hideDefaultAllDayWindows?: boolean } = {},
): {
  label: string | null;
  title: string | null;
  mixed: boolean;
} {
  const visibleWindows = options.hideDefaultAllDayWindows
    ? windows.filter((window) => !(window.source === "default" && isMidnightToMidnightWindow(window)))
    : windows;

  if (visibleWindows.length === 0) return { label: null, title: null, mixed: false };
  const unique = new Map<string, EffectiveCallWindow>();
  for (const window of visibleWindows) unique.set(callWindowKey(window), window);
  const values = [...unique.values()];
  if (values.length === 1) {
    return {
      label: formatCallWindowLabel(values[0]!),
      title: `${callWindowSourceLabel(values[0]!.source)} call window`,
      mixed: false,
    };
  }
  return {
    label: "Mixed call windows",
    title: values.map((window) => `${callWindowSourceLabel(window.source)}: ${formatCallWindow(window)}`).join(", "),
    mixed: true,
  };
}
