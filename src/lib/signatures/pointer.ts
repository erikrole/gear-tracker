/**
 * Web Pointer Events expose the class of input, not a cryptographic stylus
 * identity. The product contract is deliberately pen-class: Safari pen input
 * may draw; every other pointer type is ignored by the canvas.
 */
export function acceptsSignaturePointer(pointerType: string): boolean {
  return pointerType === "pen";
}

export function appendCoalescedPointerEvents(
  event: Pick<PointerEvent, "getCoalescedEvents">,
): PointerEvent[] {
  const events = event.getCoalescedEvents?.();
  if (!events || events.length === 0) return [event as PointerEvent];

  // Safari may return only the historical coalesced points. Keep the
  // dispatched point as the final point when it is not already represented so
  // the visible stroke never lags behind the Pencil tip.
  const last = events.at(-1);
  const current = event as PointerEvent;
  if (
    last &&
    last.pointerId === current.pointerId &&
    last.clientX === current.clientX &&
    last.clientY === current.clientY
  ) {
    return events;
  }
  return [...events, current];
}
