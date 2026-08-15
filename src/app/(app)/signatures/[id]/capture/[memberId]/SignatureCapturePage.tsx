"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, Eraser, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { acceptsSignaturePointer, appendCoalescedPointerEvents } from "@/lib/signatures/pointer";
import { buildSignatureDraft, deleteSignatureDraft, loadSignatureDraft, saveSignatureDraft, signatureDraftKey, type SignatureDraftStroke } from "@/lib/signatures/drafts";

type Member = { id: string; name: string; jerseyNumber: number | null; title: string | null; roleGroup: string; active: boolean; captureVersion: number; settingsVersion: number; artifact: { id: string } | null };
type Collection = { id: string; season: string; status: "OPEN" | "ARCHIVED"; settingsVersion: number; penSettings: { strokeColor: string; strokeWidth: number; cropPadding: number; maxWidth: number; maxHeight: number }; members: Member[] };

function pointForEvent(event: PointerEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)) };
}

function drawStrokes(canvas: HTMLCanvasElement, strokes: SignatureDraftStroke[], color: string, strokeWidth: number) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  context.strokeStyle = color;
  context.lineWidth = strokeWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    const first = stroke.points[0];
    if (!first) continue;
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
  }
}

export default function SignatureCapturePage({ collectionId, memberId, userId }: { collectionId: string; memberId: string; userId: string }) {
  const router = useRouter();
  const { data: collection, loading, error } = useFetch<Collection>({ url: `/api/signatures/collections/${collectionId}` });
  const member = collection?.members.find((candidate) => candidate.id === memberId) ?? null;
  const settings = collection?.penSettings;
  const draftKey = useMemo(() => collection && member ? signatureDraftKey(userId, collection.id, member.id, member.settingsVersion) : null, [collection, member, userId]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const activePointerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const strokesRef = useRef<SignatureDraftStroke[]>([]);
  const [strokes, setStrokes] = useState<SignatureDraftStroke[]>([]);
  const [redoStack, setRedoStack] = useState<SignatureDraftStroke[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Apple Pencil required for drawing");

  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  useEffect(() => {
    if (!canvasRef.current || !settings) return;
    const canvas = canvasRef.current;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const previous = canvasSizeRef.current;
      let nextStrokes = strokesRef.current;
      if (previous.width > 0 && previous.height > 0 && (previous.width !== rect.width || previous.height !== rect.height)) {
        nextStrokes = nextStrokes.map((stroke) => ({ points: stroke.points.map((point) => ({ x: point.x * rect.width / previous.width, y: point.y * rect.height / previous.height })) }));
        strokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
      }
      canvasSizeRef.current = { width: rect.width, height: rect.height };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      drawStrokes(canvas, nextStrokes, settings.strokeColor, settings.strokeWidth);
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    return () => { observer?.disconnect(); window.removeEventListener("resize", resize); window.removeEventListener("orientationchange", resize); };
  }, [settings]);

  useEffect(() => {
    if (!draftKey) return;
    setDraftLoaded(false);
    let cancelled = false;
    loadSignatureDraft(draftKey).then((draft) => {
      if (!cancelled && draft) {
        setStrokes(draft.strokes);
        setMessage("Recovered a local draft from this iPad");
      }
      if (!cancelled) setDraftLoaded(true);
    }).catch(() => { if (!cancelled) setDraftLoaded(true); });
    return () => { cancelled = true; };
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !settings || !draftLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (strokes.length === 0) {
      deleteSignatureDraft(draftKey).catch(() => undefined);
      return;
    }
    saveTimerRef.current = setTimeout(() => {
      saveSignatureDraft(buildSignatureDraft({ key: draftKey, userId, collectionId, memberId, settingsVersion: member?.settingsVersion ?? collection?.settingsVersion ?? 1, strokes })).catch(() => undefined);
    }, 400);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [collectionId, draftKey, draftLoaded, member?.settingsVersion, memberId, settings, strokes, userId, collection?.settingsVersion]);

  useEffect(() => { if (canvasRef.current && settings) drawStrokes(canvasRef.current, strokes, settings.strokeColor, settings.strokeWidth); }, [settings, strokes]);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!acceptsSignaturePointer(event.pointerType)) { setMessage("Touch and mouse do not draw here — use Apple Pencil"); return; }
    event.preventDefault();
    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointForEvent(event.nativeEvent, event.currentTarget);
    setRedoStack([]);
    setStrokes((current) => [...current, { points: [point] }]);
    setMessage("Drawing with pen input");
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== event.pointerId || !acceptsSignaturePointer(event.pointerType)) return;
    event.preventDefault();
    const points = appendCoalescedPointerEvents(event.nativeEvent).map((coalesced) => pointForEvent(coalesced, event.currentTarget));
    setStrokes((current) => {
      if (current.length === 0) return current;
      const next = current.slice();
      const last = next.at(-1)!;
      next[next.length - 1] = { points: [...last.points, ...points] };
      return next;
    });
  }

  function endPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer may already be released */ }
  }

  function undo() {
    setStrokes((current) => { if (current.length === 0) return current; const next = current.slice(); const removed = next.pop()!; setRedoStack((redo) => [...redo, removed]); return next; });
  }

  function redo() {
    setRedoStack((current) => { if (current.length === 0) return current; const next = current.slice(); const restored = next.pop()!; setStrokes((strokesValue) => [...strokesValue, restored]); return next; });
  }

  function reset() {
    setStrokes([]); setRedoStack([]); setMessage("Canvas reset — Apple Pencil required for drawing");
  }

  async function save() {
    if (!collection || !member || strokes.length === 0 || saving) return;
    setSaving(true); setMessage("Saving both private signature files…");
    try {
      const response = await fetch(`/api/signatures/collections/${collection.id}/capture/${member.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), expectedCaptureVersion: member.captureVersion, settingsVersion: member.settingsVersion, strokes }) });
      if (handleAuthRedirect(response)) return;
      if (!response.ok) throw new Error(await parseErrorMessage(response, "Signature was not saved"));
      if (draftKey) await deleteSignatureDraft(draftKey).catch(() => undefined);
      toast.success(`${member.name}'s signature saved`);
      router.push(`/signatures/${collection.id}`);
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "Signature was not saved");
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex min-h-[100dvh] items-center justify-center text-sm text-muted-foreground">Loading signer…</div>;
  if (error || !collection || !member || !member.active || !settings || collection.status !== "OPEN") return <div className="flex min-h-[100dvh] items-center justify-center p-6"><Card className="max-w-md p-6 text-sm text-muted-foreground">This signer is unavailable or the collection is archived. <Link href={`/signatures/${collectionId}`} className="font-medium text-foreground underline">Return to roster</Link></Card></div>;

  return (
    <main
      className="min-h-[100dvh] bg-background px-3 py-3 sm:px-5 sm:py-5"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
      }}
    >
      <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-6xl flex-col gap-3 sm:min-h-[calc(100dvh-2.5rem)]">
        <header className="flex shrink-0 items-center justify-between gap-3 rounded-xl border bg-card px-3 py-3 shadow-sm sm:px-5">
          <Button variant="ghost" size="sm" className="h-10" asChild><Link href={`/signatures/${collection.id}`}><ArrowLeft data-icon="inline-start" />Roster</Link></Button>
          <div className="min-w-0 text-center"><p className="truncate text-lg font-semibold">{member.name}</p><p className="text-xs text-muted-foreground">{member.jerseyNumber !== null ? `#${member.jerseyNumber} · ` : ""}{member.title || member.roleGroup.replaceAll("_", " ")} · {collection.season}</p></div>
          <div className="w-[74px] text-right text-xs text-muted-foreground">{strokes.length > 0 ? "Draft ready" : "Blank"}</div>
        </header>
        <section className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:p-5" aria-label={`Signature canvas for ${member.name}`}>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{message}</p><div className="flex items-center gap-1"><Button type="button" variant="outline" size="icon" className="size-10" aria-label="Undo stroke" onClick={undo} disabled={strokes.length === 0}><Undo2 /></Button><Button type="button" variant="outline" size="icon" className="size-10" aria-label="Redo stroke" onClick={redo} disabled={redoStack.length === 0}><Redo2 /></Button><Button type="button" variant="outline" size="sm" className="h-10" onClick={reset} disabled={strokes.length === 0}><Eraser data-icon="inline-start" />Reset</Button></div></div>
          <div className="relative min-h-[280px] flex-1 overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 bg-white dark:bg-slate-50"><canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endPointer} onPointerCancel={endPointer} aria-label="Apple Pencil signature canvas" /></div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Use Apple Pencil to draw. Touch is reserved for controls.</p><div className="flex gap-2"><Button variant="outline" className="h-10" asChild><Link href={`/signatures/${collection.id}`}>Cancel</Link></Button><Button className="h-10 min-w-28" onClick={save} disabled={saving || strokes.length === 0}>{saving ? "Saving…" : <><Check data-icon="inline-start" />Save</>}</Button></div></div>
        </section>
      </div>
    </main>
  );
}
