"use client";

import { useEffect, useState } from "react";
import { Check, X, ExternalLink } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { useSaveField } from "@/components/SaveableField";
import type { BulkSkuDetail } from "./types";

type DepartmentOption = { id: string; name: string };

function normalizeExternalUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error("Enter a valid http or https URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Enter a valid http or https URL");
  }
  return parsed.toString();
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between px-4 py-3 border-b border-border/50 last:border-0 gap-4">
      <span className="text-sm text-muted-foreground shrink-0 w-36 pt-0.5">{label}</span>
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
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  useEffect(() => {
    fetch("/api/departments")
      .then((res) => res.ok ? parseJsonSafely<{ data?: DepartmentOption[] }>(res) : null)
      .then((json) => { if (json?.data) setDepartments(json.data); })
      .catch(() => {});
  }, []);

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
    const json = await parseJsonSafely<{ data?: Partial<BulkSkuDetail> }>(res);
    if (!json?.data) {
      throw new Error(`Update saved, but ${field} response was incomplete. Refresh and try again.`);
    }
    onFieldSaved(json.data);
  }

  async function saveDepartment(name: string) {
    const dept = departments.find((d) => d.name === name);
    await patchField("departmentId", dept?.id ?? null);
  }

  return (
    <Card className="details-card">
      {/* ── Identity ─────────────────────────────── */}
      <InfoRow label="Name">
        {canEdit ? (
          <EditableText
            value={sku.name}
            id="bulk-sku-name"
            name="name"
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

      <InfoRow label="Department">
        {canEdit ? (
          <DepartmentSelect
            value={sku.department?.name ?? ""}
            options={departments}
            id="bulk-sku-department"
            name="department"
            onSave={saveDepartment}
          />
        ) : (
          <span className="text-sm">{sku.department?.name ?? <span className="text-muted-foreground">—</span>}</span>
        )}
      </InfoRow>

      {/* ── Procurement ───────────────────────────── */}
      <InfoRow label="Purchase link">
        {canEdit ? (
          <EditableText
            value={sku.purchaseLink ?? ""}
            placeholder="https://..."
            id="bulk-sku-purchase-link"
            name="purchaseLink"
            onSave={(v) => patchField("purchaseLink", v ? normalizeExternalUrl(v) : null)}
            linkHref={sku.purchaseLink}
          />
        ) : sku.purchaseLink ? (
          <a
            href={sku.purchaseLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="size-3.5 shrink-0" />
            View link
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </InfoRow>

      <InfoRow label="Purchase price">
        {canEdit ? (
          <EditableDecimal
            value={sku.purchasePrice ?? ""}
            id="bulk-sku-purchase-price"
            name="purchasePrice"
            onSave={(v) => patchField("purchasePrice", v ? parseFloat(v) : null)}
          />
        ) : (
          <span className="text-sm">
            {sku.purchasePrice
              ? `$${parseFloat(sku.purchasePrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : <span className="text-muted-foreground">—</span>
            }
          </span>
        )}
      </InfoRow>

      {/* ── Configuration ─────────────────────────── */}
      <InfoRow label="Low-stock threshold">
        {canEdit ? (
          <div className="flex flex-col items-end gap-0.5">
            <EditableNumber
              value={sku.minThreshold}
              id="bulk-sku-min-threshold"
              name="minThreshold"
              onSave={(v) => patchField("minThreshold", v)}
            />
            <span className="text-xs text-muted-foreground">
              {sku.minThreshold === 0
                ? "No minimum — low-stock alert disabled"
                : "Low-stock alert triggers below this"}
            </span>
          </div>
        ) : (
          <span className="text-sm">
            {sku.minThreshold === 0
              ? <span className="text-muted-foreground">No minimum</span>
              : sku.minThreshold}
          </span>
        )}
      </InfoRow>

      <InfoRow label="QR code">
        {canEdit ? (
          <EditableText
            value={sku.binQrCodeValue}
            id="bulk-sku-bin-qr-code"
            name="binQrCodeValue"
            onSave={(v) => patchField("binQrCodeValue", v)}
            mono
          />
        ) : (
          <span className="text-sm font-mono">{sku.binQrCodeValue}</span>
        )}
      </InfoRow>

      <InfoRow label="Tracking">
        <Badge variant={sku.trackByNumber ? "secondary" : "outline"} className="text-xs">
          {sku.trackByNumber ? "Units" : "Quantity"}
        </Badge>
      </InfoRow>

      {/* ── Notes ─────────────────────────────────── */}
      <InfoRow label="Notes">
        {canEdit ? (
          <EditableTextarea
            value={sku.notes ?? ""}
            placeholder="Add notes…"
            id="bulk-sku-notes"
            name="notes"
            onSave={(v) => patchField("notes", v || null)}
          />
        ) : (
          <span className="text-sm whitespace-pre-wrap text-right">
            {sku.notes ?? <span className="text-muted-foreground">—</span>}
          </span>
        )}
      </InfoRow>
    </Card>
  );
}

/* ── Editable primitives ─────────────────────────────────── */

function EditableText({
  value,
  onSave,
  placeholder,
  id,
  name,
  mono,
  linkHref,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  id?: string;
  name?: string;
  mono?: boolean;
  linkHref?: string | null;
}) {
  const [draft, setDraft] = useState(value);
  const { status, save } = useSaveField(onSave);
  const saving = status === "saving";

  return (
    <div className="flex items-center justify-end gap-1">
      {linkHref && (
        <a
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors shrink-0"
          tabIndex={-1}
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
      <input
        id={id}
        name={name}
        autoComplete={name === "purchaseLink" ? "url" : "off"}
        disabled={saving}
        className={`text-right text-sm bg-transparent border-b border-transparent hover:border-border focus:border-border focus:outline-none transition-colors py-0.5 max-w-64 ${mono ? "font-mono" : ""}`}
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
  id,
  name,
}: {
  value: number;
  onSave: (v: number) => Promise<void>;
  id?: string;
  name?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const { status, save } = useSaveField((v) => onSave(Number(v)));
  const saving = status === "saving";

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        id={id}
        name={name}
        autoComplete="off"
        type="number"
        min={0}
        disabled={saving}
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

function EditableDecimal({
  value,
  onSave,
  id,
  name,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  id?: string;
  name?: string;
}) {
  const [draft, setDraft] = useState(value);
  const { status, save } = useSaveField(onSave);
  const saving = status === "saving";

  return (
    <div className="flex items-center justify-end gap-1">
      <span className="text-sm text-muted-foreground">$</span>
      <input
        id={id}
        name={name}
        autoComplete="off"
        type="number"
        min={0}
        step={0.01}
        disabled={saving}
        className="w-28 text-right text-sm bg-transparent border-b border-transparent hover:border-border focus:border-border focus:outline-none transition-colors py-0.5"
        value={draft}
        placeholder="0.00"
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

function EditableTextarea({
  value,
  onSave,
  placeholder,
  id,
  name,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  id?: string;
  name?: string;
}) {
  const [draft, setDraft] = useState(value);
  const { status, save } = useSaveField(onSave);
  const saving = status === "saving";

  return (
    <div className="flex flex-col items-end gap-1 w-full">
      <textarea
        id={id}
        name={name}
        autoComplete="off"
        disabled={saving}
        className="w-full text-right text-sm bg-transparent border-b border-transparent hover:border-border focus:border-border focus:outline-none transition-colors py-0.5 resize-none min-h-[60px]"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value) save(draft); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setDraft(value);
        }}
      />
      <SaveIndicator status={status} />
    </div>
  );
}

function DepartmentSelect({
  value,
  options,
  id,
  name,
  onSave,
}: {
  value: string;
  options: DepartmentOption[];
  id: string;
  name: string;
  onSave: (v: string) => Promise<void>;
}) {
  const { status, save } = useSaveField(onSave);
  const saving = status === "saving";

  return (
    <div className="flex items-center justify-end gap-1">
      <NativeSelect
        id={id}
        name={name}
        disabled={saving}
        className="text-sm text-right h-7 border-0 bg-transparent hover:bg-muted/50 transition-colors cursor-pointer pr-6"
        value={value}
        onChange={(e) => save(e.target.value)}
      >
        <option value="">— None —</option>
        {options.map((d) => (
          <option key={d.id} value={d.name}>{d.name}</option>
        ))}
      </NativeSelect>
      <SaveIndicator status={status} />
    </div>
  );
}
