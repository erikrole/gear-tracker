export const SERIALIZED_TURNAROUND_BUFFER_MINUTES = 60;

export function serializedTurnaroundBufferMs() {
  return SERIALIZED_TURNAROUND_BUFFER_MINUTES * 60_000;
}

export function subtractSerializedTurnaroundBuffer(startsAt: Date) {
  return new Date(startsAt.getTime() - serializedTurnaroundBufferMs());
}

export function hasSerializedTurnaroundBuffer(args: {
  previousEndsAt: Date | number;
  nextStartsAt: Date | number;
}) {
  const previousEndsAt = args.previousEndsAt instanceof Date ? args.previousEndsAt.getTime() : args.previousEndsAt;
  const nextStartsAt = args.nextStartsAt instanceof Date ? args.nextStartsAt.getTime() : args.nextStartsAt;
  return previousEndsAt + serializedTurnaroundBufferMs() <= nextStartsAt;
}
