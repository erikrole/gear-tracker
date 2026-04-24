"use client";

import { useState } from "react";
import { Copy, Check, KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import type { MyLicense } from "./types";
import { ReleaseDialog } from "./ReleaseDialog";

type Props = {
  license: MyLicense;
  onReleased: () => void;
};

export function MyLicensePanel({ license, onReleased }: Props) {
  const [copied, setCopied] = useState(false);
  const [showRelease, setShowRelease] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(license.code);
    setCopied(true);
    toast.success("License code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 mb-6">
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4 pb-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 shrink-0">
            <KeyRound className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Your license</span>
          </div>
          <code className="font-mono text-sm font-semibold tracking-widest flex-1">
            {license.code}
          </code>
          {license.claimedAt && (
            <span className="text-xs text-muted-foreground shrink-0">
              Claimed {formatRelativeTime(license.claimedAt, new Date())}
            </span>
          )}
          <div className="flex items-center gap-2 shrink-0">
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
              Return
            </Button>
          </div>
        </CardContent>
      </Card>

      <ReleaseDialog
        open={showRelease}
        onOpenChange={setShowRelease}
        licenseId={license.id}
        onReleased={onReleased}
      />
    </>
  );
}
