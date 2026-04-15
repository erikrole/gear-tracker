"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { useSaveField } from "@/components/SaveableField";
import type { BulkSkuDetail } from "./types";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0 gap-4">
      <span className="text-sm text-muted-foreground shrink-0 w-32">{label}</span>
      <div className="flex-1 text-right">{children}</div>
    </div>
  );
}

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs shrink-0 ml-1 ${
      status === "saving" ? "text-muted-foreground" :
      status === "saved" ? "text-[var(--green-text)]" :
      "text-destructive"
    }`}>
      {status === "saving" && <><Spinner className="size-3" /><span>Saving</span></>}
      {status === "saved" && <><Check className="size-3" /><span>Saved</span></>}
      {status === "error" && <><X className="size-3" /><span>Failed</span></>}
    </span>
  );
}

export function BulkSkuInfoTab({
  sku,
  canEdit,
  onFieldSaved,
}: {
  sku: BulkSkuDetail;
  canEdit: boolean;
  onFieldSaved: (partial: Partial<BulkSkuDetail>) => void;
}) {
  async function patchField(field: string, value: unknown) {
    const res = await fetch(`/api/bulk-skus/${sku.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (handleAuthRedirect(res)) return;
    if (!res.ok) {
      const msg = await parseErrorMessage(res, `Failed to update ${field}`);
      throw new Error(msg);
    }
    const json = await res.json();
    onFieldSaved(json.data);
  }

  return (
    <Card className="details-card">
      <InfoRow label="Name">
        {canEdit ? (
          <EditableText
            value={sku.name}
            onSave={(v) => patchField("name", v)}
          />
        ) : (
          <span className="text-sm">{sku.name}</span>
        )}
      </InfoRow>

      <InfoRow label="Category">
        <span className="text-sm">{sku.categoryRel?.name || sku.category || "—"}</span>
      </InfoRow>

      <InfoRow label="Location">
        <span className="text-sm">{sku.location.name}</span>
      </InfoRow>

      <InfoRow label="Min threshold">
        {canEdit ? (
          <div className="flex flex-col items-end gap-0.5">
            <EditableNumber
              value={sku.minThreshold}
              onSave={(v) => patchField("minThreshold", v)}
            />
            <span className="text-xs text-muted-foreground">
              {sku.minThreshold === 0 ? "No minimum set — low-stock alert disabled" : "Low-stock alert triggers below this"}
            </span>
          </div>
        ) : (
          <span className="text-sm">
            {sku.minThreshold === 0 ? <span className="text-muted-foreground">No minimum</span> : sku.minThreshold}
          </span>
        )}
      </InfoRow>

      <InfoRow label="Bin QR">
        {canEdit ? (
          <EditableText
            value={sku.binQrCodeValue}
            onSave={(v) => patchField("binQrCodeValue", v)}
            mono
          />
        ) : (
          <span className="text-sm font-mono">{sku.binQrCodeValue}</span>
        )}
      </InfoRow>

      <InfoRow label="Tracked by #">
        <Badge variant={sku.trackByNumber ? "secondary" : "outline"} className="text-xs">
          {sku.trackByNumber ? "Numbered units" : "Quantity only"}
        </Badge>
      </InfoRow>
    </Card>
  );
}

function EditableText({
  value,
  onSave,
  placeholder,
  mono,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const { status, save } = useSaveField(onSave);

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        className={`text-right text-sm bg-transparent border-b border-transparent hover:border-border focus:border-border focus:outline-none transition-colors py-0.5 ${mono ? "font-mono" : ""}`}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value) save(draft); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setDraft(value);
        }}
      />
      <SaveIndicator status={status} />
    </div>
  );
}

function EditableNumber({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(String(value));
  const { status, save } = useSaveField((v) => onSave(Number(v)));

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        type="number"
        min={0}
        className="w-24 text-right text-sm bg-transparent border-b border-transparent hover:border-border focus:border-border focus:outline-none transition-colors py-0.5"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== String(value)) save(draft); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setDraft(String(value));
        }}
      />
      <SaveIndicator status={status} />
    </div>
  );
}
