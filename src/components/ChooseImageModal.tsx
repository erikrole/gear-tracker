"use client";

import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseButton,
  DialogDescription,
  DialogBody,
} from "@/components/ui/dialog";
import { ImageIcon } from "lucide-react";
import { useConfirm } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { parseErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Props = {
  open: boolean;
  onClose: () => void;
  assetId: string;
  currentImageUrl: string | null;
  onImageChanged: (newUrl: string | null) => void;
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE = 4.5 * 1024 * 1024;

export default function ChooseImageModal({ open, onClose, assetId, currentImageUrl, onImageChanged }: Props) {
  const [tab, setTab] = useState<"url" | "upload">("url");
  const [url, setUrl] = useState("");
  const [urlPreview, setUrlPreview] = useState<string | null>(null);
  const [urlError, setUrlError] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const { toast } = useToast();

  const reset = useCallback(() => {
    setUrl("");
    setUrlPreview(null);
    setUrlError(false);
    setFile(null);
    setFilePreview(null);
    setFileError("");
    setSaving(false);
    setDragging(false);
  }, []);

  function handleClose() {
    reset();
    onClose();
  }

  function handleUrlChange(value: string) {
    setUrl(value);
    setUrlError(false);
    if (value.startsWith("https://") && value.length > 10) {
      setUrlPreview(value);
    } else {
      setUrlPreview(null);
    }
  }

  function validateFile(f: File): string | null {
    if (!ALLOWED_TYPES.has(f.type)) return "File must be JPEG, PNG, WebP, or GIF";
    if (f.size > MAX_SIZE) return "File must be under 4.5 MB";
    return null;
  }

  function handleFileSelect(f: File) {
    const err = validateFile(f);
    if (err) {
      setFileError(err);
      setFile(null);
      setFilePreview(null);
      return;
    }
    setFileError("");
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setFilePreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  async function saveUrl() {
    if (!urlPreview) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/image`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlPreview }),
      });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to save image URL");
        throw new Error(msg);
      }
      const json = await res.json();
      toast("Image updated", "success");
      onImageChanged(json.imageUrl);
      handleClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save image", "error");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile() {
    if (!file) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/assets/${assetId}/image`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Upload failed");
        throw new Error(msg);
      }
      const json = await res.json();
      toast("Image uploaded", "success");
      onImageChanged(json.imageUrl);
      handleClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeImage() {
    const ok = await confirm({
      title: "Remove image",
      message: "Remove the image from this item?",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/image`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to remove image");
        throw new Error(msg);
      }
      toast("Image removed", "success");
      onImageChanged(null);
      handleClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to remove image", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose image</DialogTitle>
          <DialogDescription className="sr-only">Upload or paste a URL for the item image</DialogDescription>
          <DialogCloseButton />
        </DialogHeader>
        <DialogBody className="pb-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "url" | "upload")}>
            <TabsList className="mb-1">
              <TabsTrigger value="url">Paste URL</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>

            {/* Paste URL tab */}
            <TabsContent value="url">
              <Input
                type="url"
                placeholder="https://example.com/product-image.jpg"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                style={{ width: "100%" }}
              />
              {urlPreview && (
                <div className="image-preview-container mt-4">
                  <img
                    src={urlPreview}
                    alt="Preview"
                    onError={() => { setUrlError(true); setUrlPreview(null); }}
                    onLoad={() => setUrlError(false)}
                  />
                </div>
              )}
              {urlError && <p className="text-sm mt-2" style={{ color: "var(--red)" }}>Could not load image from this URL</p>}
              <div className="flex-end gap-2 mt-4">
                {currentImageUrl && (
                  <Button variant="destructive" onClick={removeImage} disabled={saving} className="mr-auto">
                    Remove
                  </Button>
                )}
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={saveUrl} disabled={!urlPreview || urlError || saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </TabsContent>

            {/* Upload tab */}
            <TabsContent value="upload">
              <div
                className={`image-drop-zone ${dragging ? "dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {filePreview ? (
                  <img src={filePreview} alt="Preview" className="image-drop-zone-preview" />
                ) : (
                  <div className="text-center">
                    <ImageIcon className="size-12 text-[var(--text-tertiary)] mb-2" />
                    <p className="text-sm text-secondary mb-2">Drop an image here</p>
                    <Button variant="outline" size="sm" asChild><span>Pick from computer</span></Button>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
              {fileError && <p className="text-sm mt-2" style={{ color: "var(--red)" }}>{fileError}</p>}
              <div className="flex-end gap-2 mt-4">
                {currentImageUrl && (
                  <Button variant="destructive" onClick={removeImage} disabled={saving} className="mr-auto">
                    Remove
                  </Button>
                )}
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={uploadFile} disabled={!file || !!fileError || saving}>
                  {saving ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
