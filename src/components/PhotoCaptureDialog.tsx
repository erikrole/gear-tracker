"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@/components/ui/dialog";
import { Loader2Icon } from "lucide-react";
import PhotoCapture from "@/components/PhotoCapture";

type PhotoCaptureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkoutId: string;
  phase: "CHECKOUT" | "CHECKIN";
  /** Called after photo is successfully uploaded */
  onPhotoUploaded: () => void;
};

/**
 * Full-screen dialog that captures a condition photo and uploads it
 * before allowing checkout/checkin completion.
 */
export default function PhotoCaptureDialog({
  open,
  onOpenChange,
  checkoutId,
  phase,
  onPhotoUploaded,
}: PhotoCaptureDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleCapture(file: File) {
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/checkouts/${checkoutId}/photo?phase=${phase}`,
        { method: "POST", body: formData },
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as Record<string, string>).error || "Failed to upload photo",
        );
      }

      onPhotoUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const label = phase === "CHECKOUT" ? "checkout" : "check-in";

  return (
    <Dialog open={open} onOpenChange={uploading ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg max-md:max-w-full max-md:h-full max-md:rounded-none max-md:border-none">
        <DialogHeader>
          <DialogTitle>Photo required</DialogTitle>
          <DialogDescription>
            Take a photo of the equipment to document its condition before completing {label}.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-2">
          {uploading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Uploading photo...</span>
            </div>
          ) : (
            <PhotoCapture onCapture={handleCapture} disabled={uploading} />
          )}

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
