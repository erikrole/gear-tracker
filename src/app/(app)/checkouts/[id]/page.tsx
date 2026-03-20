"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import DataList from "@/components/DataList";
import type { CheckoutAction } from "@/lib/booking-actions";
import { formatDateTime } from "@/lib/format";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";

type Checkout = {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  location: { name: string };
  requester: { id: string; name: string; email: string };
  serializedItems: Array<{ id: string; allocationStatus: string; asset: { id: string; assetTag: string; brand: string; model: string; serialNumber: string } }>;
  bulkItems: Array<{ id: string; bulkSku: { name: string }; plannedQuantity: number; checkedOutQuantity: number | null; checkedInQuantity: number | null }>;
  allowedActions: CheckoutAction[];
};

const statusBadgeVariant: Record<string, BadgeProps["variant"]> = {
  DRAFT: "gray",
  BOOKED: "blue",
  OPEN: "green",
  COMPLETED: "purple",
  CANCELLED: "red",
};

export default function CheckoutDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [showExtend, setShowExtend] = useState(false);
  const [extendDate, setExtendDate] = useState("");
  const [checkinIds, setCheckinIds] = useState<Set<string>>(new Set());
  const [bulkReturnQty, setBulkReturnQty] = useState<Record<string, number>>({});

  const reload = useCallback(() => {
    setActionError("");
    fetch(`/api/checkouts/${id}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json) => { if (json?.data) setCheckout(json.data); else setFetchError(true); })
      .catch(() => setFetchError(true));
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  async function handleCancel() {
    const ok = await confirm({
      title: "Cancel checkout",
      message: "Cancel this checkout? This action cannot be undone.",
      confirmLabel: "Cancel checkout",
      variant: "danger",
    });
    if (!ok) return;
    setActionLoading("cancel");
    setActionError("");
    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Cancel failed", "error");
      } else {
        reload();
      }
    } catch {
      toast("Network error — please try again.", "error");
    }
    setActionLoading(null);
  }

  async function handleExtend() {
    if (!extendDate) return;
    setActionLoading("extend");
    setActionError("");
    try {
      const res = await fetch(`/api/bookings/${id}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endsAt: new Date(extendDate).toISOString() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        let msg = (json as Record<string, string>).error || "Extend failed";
        // Show conflict details if available
        const conflicts = (json as Record<string, unknown>).data as { conflicts?: Array<{ assetTag?: string; title?: string }> } | undefined;
        if (conflicts?.conflicts?.length) {
          const names = conflicts.conflicts.slice(0, 3).map((c) => c.assetTag || c.title || "item").join(", ");
          msg += ` — conflicts with: ${names}`;
          if (conflicts.conflicts.length > 3) msg += ` and ${conflicts.conflicts.length - 3} more`;
        }
        setActionError(msg);
      } else {
        setShowExtend(false);
        setExtendDate("");
        reload();
      }
    } catch {
      setActionError("Network error \u2014 please try again.");
    }
    setActionLoading(null);
  }

  async function handleCheckinSelected() {
    if (checkinIds.size === 0) return;
    setActionLoading("checkin");
    setActionError("");
    try {
      const res = await fetch(`/api/checkouts/${id}/checkin-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds: Array.from(checkinIds) }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setActionError((json as Record<string, string>).error || "Check in failed");
      } else {
        setCheckinIds(new Set());
        reload();
      }
    } catch {
      setActionError("Network error \u2014 please try again.");
    }
    setActionLoading(null);
  }

  async function handleCompleteCheckin() {
    const ok = await confirm({
      title: "Complete check in",
      message: "Complete check in? Any items not yet returned will be flagged.",
      confirmLabel: "Complete check in",
    });
    if (!ok) return;
    setActionLoading("complete-checkin");
    setActionError("");
    try {
      const res = await fetch(`/api/checkouts/${id}/complete-checkin`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setActionError((json as Record<string, string>).error || "Complete check in failed");
      } else {
        reload();
      }
    } catch {
      setActionError("Network error \u2014 please try again.");
    }
    setActionLoading(null);
  }

  async function handleBulkReturn(bulkItemId: string) {
    const qty = bulkReturnQty[bulkItemId];
    if (!qty || qty <= 0) return;
    setActionLoading(`bulk-${bulkItemId}`);
    setActionError("");
    try {
      const res = await fetch(`/api/checkouts/${id}/checkin-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulkItemId, quantity: qty }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setActionError((json as Record<string, string>).error || "Bulk return failed");
      } else {
        setBulkReturnQty((prev) => ({ ...prev, [bulkItemId]: 0 }));
        reload();
      }
    } catch {
      setActionError("Network error \u2014 please try again.");
    }
    setActionLoading(null);
  }

  function handleEdit() {
    router.push(`/checkouts?editId=${id}`);
  }

  if (fetchError) {
    return <div className="py-10 px-5 text-center text-muted-foreground">Checkout not found or failed to load. <Link href="/checkouts">Back to checkouts</Link></div>;
  }

  if (!checkout) {
    return <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>;
  }

  const actions = checkout.allowedActions ?? [];
  const canExtend = actions.includes("extend");
  const canCancel = actions.includes("cancel");
  const canCheckin = actions.includes("checkin");
  const canEdit = actions.includes("edit");
  const canOpen = actions.includes("open");
  const isOpen = checkout.status === "OPEN";
  const isOverdue = isOpen && new Date(checkout.endsAt) < new Date();

  return (
    <>
      <div className="breadcrumb"><Link href="/checkouts">Checkouts</Link> <span>{"\u203a"}</span> {checkout.title}</div>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1>{checkout.title}</h1>
          <Badge variant={statusBadgeVariant[checkout.status] || "gray"}>{checkout.status.toLowerCase()}</Badge>
          {isOverdue && <Badge variant="red">overdue</Badge>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={handleEdit} disabled={!!actionLoading}>Edit</Button>
          )}
          {canExtend && (
            <Button variant="outline" size="sm" onClick={() => setShowExtend((v) => !v)} disabled={!!actionLoading}>
              Extend
            </Button>
          )}
          {canCheckin && (
            <Button variant="outline" size="sm" onClick={handleCompleteCheckin} disabled={!!actionLoading}>
              {actionLoading === "complete-checkin" ? "Completing..." : "Complete check in"}
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" size="sm" onClick={handleCancel} disabled={!!actionLoading}>
              {actionLoading === "cancel" ? "Cancelling..." : "Cancel"}
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="alert-error">{actionError}</div>
      )}

      {/* Scan action buttons */}
      {(isOpen || canOpen) && (
        <div style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}>
          {isOpen && (
            <Button asChild style={{ padding: "12px 20px", fontSize: "var(--text-md)", fontWeight: 600, minHeight: 48 }}>
              <Link href={`/scan?checkout=${id}&phase=CHECKOUT`} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
                Scan Items Out
              </Link>
            </Button>
          )}
          {canCheckin && (
            <Button variant="outline" asChild style={{ padding: "12px 20px", fontSize: "var(--text-md)", fontWeight: 600, minHeight: 48, background: "var(--green-bg)", color: "var(--green)" }}>
              <Link href={`/scan?checkout=${id}&phase=CHECKIN`} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
                Scan Items In
              </Link>
            </Button>
          )}
        </div>
      )}

      {showExtend && (
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>New end date:</label>
            <input
              type="datetime-local"
              value={extendDate}
              onChange={(e) => setExtendDate(e.target.value)}
              min={checkout.endsAt.slice(0, 16)}
              style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6 }}
            />
            <Button size="sm" onClick={handleExtend} disabled={!extendDate || !!actionLoading}>
              {actionLoading === "extend" ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowExtend(false); setExtendDate(""); }}>Cancel</Button>
          </div>
        </Card>
      )}

      <div className="details-grid">
        <Card className="details-card">
          <CardHeader><CardTitle>Checkout details</CardTitle></CardHeader>
          <div style={{ padding: 16 }}>
            <DataList
              items={[
                { label: "Name", value: checkout.title },
                { label: "Location", value: checkout.location?.name ?? "\u2014" },
                { label: "From", value: formatDateTime(checkout.startsAt) },
                { label: "To", value: formatDateTime(checkout.endsAt) },
                { label: "User", value: <>{checkout.requester?.name ?? "Unknown"} <span className="muted">({checkout.requester?.email ?? ""})</span></> },
              ]}
            />
          </div>
        </Card>

        <Card className="details-card">
          <CardHeader style={{ justifyContent: "space-between" }}>
            <CardTitle>Equipment</CardTitle>
            {canCheckin && checkinIds.size > 0 && (
              <Button size="sm" onClick={handleCheckinSelected} disabled={!!actionLoading}>
                {actionLoading === "checkin" ? "Returning..." : `Return ${checkinIds.size} item${checkinIds.size > 1 ? "s" : ""}`}
              </Button>
            )}
          </CardHeader>
          {checkout.serializedItems.length === 0 && checkout.bulkItems.length === 0 ? (
            <div className="py-10 px-5 text-center text-muted-foreground">No items in this checkout.</div>
          ) : (
            <div>
              {checkout.serializedItems.map((item) => {
                const returned = item.allocationStatus === "returned";
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border)",
                      background: returned ? "var(--green-bg)" : "white",
                      minHeight: 52,
                    }}
                  >
                    {canCheckin && !returned && (
                      <input
                        type="checkbox"
                        checked={checkinIds.has(item.asset.id)}
                        onChange={() => {
                          setCheckinIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.asset.id)) next.delete(item.asset.id);
                            else next.add(item.asset.id);
                            return next;
                          });
                        }}
                        style={{ width: 20, height: 20, flexShrink: 0 }}
                      />
                    )}
                    {returned && (
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: "var(--green)", color: "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "var(--text-xs)", fontWeight: 700, flexShrink: 0,
                      }}>
                        {"\u2713"}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/items/${item.asset.id}`} style={{ fontWeight: 600, color: "var(--blue)", textDecoration: "none" }}>
                        {item.asset.assetTag}
                      </Link>
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                        {item.asset.brand} {item.asset.model}
                      </div>
                    </div>
                    {returned ? (
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--green)", flexShrink: 0 }}>Returned</span>
                    ) : (
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontFamily: "monospace", flexShrink: 0 }}>
                        {item.asset.serialNumber}
                      </span>
                    )}
                  </div>
                );
              })}
              {checkout.bulkItems.map((item) => {
                const outQty = item.checkedOutQuantity ?? item.plannedQuantity;
                const inQty = item.checkedInQuantity ?? 0;
                const allReturned = inQty >= outQty;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border)",
                      background: allReturned ? "var(--green-bg)" : "white",
                      minHeight: 52,
                    }}
                  >
                    {canCheckin && !allReturned && <div style={{ width: 20 }} />}
                    {allReturned && (
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: "var(--green)", color: "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "var(--text-xs)", fontWeight: 700, flexShrink: 0,
                      }}>
                        {"\u2713"}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{item.bulkSku?.name ?? "Unknown"}</div>
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                        {inQty > 0
                          ? `${inQty} / ${outQty} returned`
                          : `Qty: ${outQty}`
                        }
                      </div>
                    </div>
                    {allReturned ? (
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--green)", flexShrink: 0 }}>Returned</span>
                    ) : canCheckin ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <input
                          type="number"
                          min={1}
                          max={outQty - inQty}
                          value={bulkReturnQty[item.id] || ""}
                          onChange={(e) => setBulkReturnQty((prev) => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                          placeholder={String(outQty - inQty)}
                          style={{ width: 60, padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4, textAlign: "center" }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!bulkReturnQty[item.id] || actionLoading === `bulk-${item.id}`}
                          onClick={() => handleBulkReturn(item.id)}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          {actionLoading === `bulk-${item.id}` ? "..." : "Return"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
