"use client";

import { useState } from "react";
import { Copy, Check, Clock3, KeyRound, LogOut, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MyLicense } from "./types";
import { ReleaseDialog } from "./ReleaseDialog";
import { MyLicenseHistoryDialog } from "./MyLicenseHistoryDialog";

type Props = {
  license: MyLicense;
  isStaff: boolean;
  onReleased: () => void;
};

export function MyLicensePanel({ license, isStaff, onReleased }: Props) {
  const [copied, setCopied] = useState(false);
  const [showRelease, setShowRelease] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function handleCopy() {
    if (!navigator.clipboard?.writeText) {
      toast.error("Copy failed. Select the visible license code and copy it manually.");
      return;
    }
    try {
      await navigator.clipboard.writeText(license.code);
      setCopied(true);
      toast.success("License code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed. Select the visible license code and copy it manually.");
    }
  }

  const expiryMs = license.expiresAt ? new Date(license.expiresAt).getTime() : null;
  const isExpired = expiryMs != null && expiryMs < Date.now();
  const daysLeft = expiryMs != null ? Math.ceil((expiryMs - Date.now()) / 86_400_000) : null;
  const isExpiringSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 30;

  const headerLabel = isStaff ? "Custody" : "Your license";
  const releaseLabel = isStaff ? "Release" : "Return";
  const timeLabel = isStaff ? "Held since" : "Claimed";
  const cardToneClass = isExpired
    ? "border-destructive/40 bg-destructive/5"
    : isExpiringSoon
      ? "border-[var(--orange)]/40 bg-[var(--orange-bg)]"
      : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30";
  const headerToneClass = isExpired
    ? "text-destructive"
    : isExpiringSoon
      ? "text-[var(--orange-text)]"
      : "text-green-700 dark:text-green-400";

  return (
    <>
      <Card className={cn("mb-6", cardToneClass)}>
        <CardContent className="flex flex-col gap-3 pt-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className={cn("flex items-center gap-2 shrink-0", headerToneClass)}>
              <KeyRound className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">{headerLabel}</span>
            </div>
            <code className="font-mono text-sm font-semibold tracking-widest flex-1">
              {license.code}
            </code>
            {license.claimedAt && (
              <span className="text-xs text-muted-foreground shrink-0">
                {timeLabel} {formatRelativeTime(license.claimedAt, new Date())}
              </span>
            )}
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowHistory(true)} className="gap-1.5">
                <Clock3 className="size-3.5" />
                History
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRelease(true)}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <LogOut className="size-3.5" />
                {releaseLabel}
              </Button>
            </div>
          </div>

          {(isExpired || isExpiringSoon) && (
            <div
              className={
                "flex items-center gap-1.5 text-xs " +
                (isExpired
                  ? "text-destructive"
                  : "text-[var(--orange-text)]")
              }
            >
              <AlertTriangle className="size-3.5" />
              {isExpired
                ? "This license has expired — renew to keep using it."
                : `License expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`}
            </div>
          )}
        </CardContent>
      </Card>

      <ReleaseDialog
        open={showRelease}
        onOpenChange={setShowRelease}
        licenseId={license.id}
        onReleased={onReleased}
      />
      <MyLicenseHistoryDialog open={showHistory} onOpenChange={setShowHistory} />
    </>
  );
}
