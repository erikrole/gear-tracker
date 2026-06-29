"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COPY_RESET_MS = 1600;

export function ServerPathCopy({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = window.setTimeout(() => setCopied(false), COPY_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      aria-label={`Copy server path ${path}`}
      aria-pressed={copied}
      className={cn(
        "h-10 min-w-0 max-w-full justify-start gap-2 overflow-hidden px-3 font-mono text-[11px] leading-none",
        "sm:max-w-[24rem]",
      )}
      title={path}
    >
      {copied ? (
        <CheckIcon data-icon="inline-start" aria-hidden="true" />
      ) : (
        <CopyIcon data-icon="inline-start" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate text-left">{path}</span>
      <span
        className={cn(
          "shrink-0 text-[10px] font-medium uppercase tracking-normal",
          copied ? "text-foreground" : "text-muted-foreground",
        )}
        aria-live="polite"
      >
        {copied ? "Copied" : "Copy"}
      </span>
    </Button>
  );
}
