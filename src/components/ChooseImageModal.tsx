"use client";

import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseButton,
  DialogBody,
} from "@/components/ui/dialog";
import { useConfirm } from "./ConfirmDialog";
import { useToast } from "./Toast";

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
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to save image URL");
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
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Upload failed");
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
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to remove image");
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
          <DialogCloseButton />
        </DialogHeader>
        <DialogBody className="pb-6">
          {/* Tabs */}
          <div className="tabs mb-16">
            <button className={`tab ${tab === "url" ? "active" : ""}`} onClick={() => setTab("url")}>
              Paste URL
            </button>
            <button className={`tab ${tab === "upload" ? "active" : ""}`} onClick={() => setTab("upload")}>
              Upload
            </button>
          </div>

          {/* Paste URL tab */}
          {tab === "url" && (
            <div>
              <input
                type="url"
                className="form-input"
                placeholder="https://example.com/product-image.jpg"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                style={{ width: "100%" }}
              />
              {urlPreview && (
                <div className="image-preview-container mt-16">
                  <img
                    src={urlPreview}
                    alt="Preview"
                    onError={() => { setUrlError(true); setUrlPreview(null); }}
                    onLoad={() => setUrlError(false)}
                  />
                </div>
              )}
              {urlError && <p className="text-sm mt-8" style={{ color: "var(--red)" }}>Could not load image from this URL</p>}
              <div className="flex-end gap-8 mt-16">
                {currentImageUrl && (
                  <button className="btn btn-danger" onClick={removeImage} disabled={saving} style={{ marginRight: "auto" }}>
                    Remove
                  </button>
                )}
                <button className="btn" onClick={handleClose}>Cancel</button>
                <button className="btn btn-primary" onClick={saveUrl} disabled={!urlPreview || urlError || saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Upload tab */}
          {tab === "upload" && (
            <div>
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
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-tertiary)", marginBottom: 8 }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    <p className="text-sm text-secondary mb-8">Drop an image here</p>
                    <span className="btn btn-sm">Pick from computer</span>
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
              {fileError && <p className="text-sm mt-8" style={{ color: "var(--red)" }}>{fileError}</p>}
              <div className="flex-end gap-8 mt-16">
                {currentImageUrl && (
                  <button className="btn btn-danger" onClick={removeImage} disabled={saving} style={{ marginRight: "auto" }}>
                    Remove
                  </button>
                )}
                <button className="btn" onClick={handleClose}>Cancel</button>
                <button className="btn btn-primary" onClick={uploadFile} disabled={!file || !!fileError || saving}>
                  {saving ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
