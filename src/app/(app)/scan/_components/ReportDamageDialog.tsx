"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CameraIcon, ImageIcon, XIcon } from "lucide-react";

type ReportDamageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetTag: string;
  onConfirm: (description: string, file?: File | null) => void;
  submitting?: boolean;
};

export function ReportDamageDialog({
  open,
  onOpenChange,
  assetTag,
  onConfirm,
  submitting,
}: ReportDamageDialogProps) {
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function reset() {
    setDescription("");
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }

  function handleFileSelect(nextFile: File | null | undefined) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!nextFile) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  }

  function handleConfirm() {
    onConfirm(description, file);
    reset();
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Damage</DialogTitle>
          <DialogDescription>
            Report <span className="font-semibold text-[var(--foreground)]">{assetTag}</span> as
            damaged. A supervisor will be notified.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Describe what happened..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFileSelect(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-2">
          {previewUrl ? (
            <div className="flex items-center gap-3">
              <div
                className="size-16 shrink-0 rounded-md bg-cover bg-center outline outline-1 outline-black/10 dark:outline-white/10"
                style={{ backgroundImage: `url(${previewUrl})` }}
                aria-label="Damage photo preview"
                role="img"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{file?.name}</div>
                <div className="text-xs text-muted-foreground">Photo evidence attached</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => handleFileSelect(null)}
                disabled={submitting}
                aria-label="Remove attached photo"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className="flex min-h-16 w-full items-center justify-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              <ImageIcon className="size-4" />
              Add damage photo
            </button>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          {!previewUrl && (
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              <CameraIcon className="mr-2 size-4" />
              Photo
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || !description.trim()}
          >
            {submitting ? "Reporting..." : "Report Damage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
