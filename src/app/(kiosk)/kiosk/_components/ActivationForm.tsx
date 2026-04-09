"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Monitor } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  onActivated: (data: { kioskId: string; name: string; locationName: string }) => void;
};

export function ActivationForm({ onActivated }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter a 6-digit activation code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/kiosk/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });

      if (res.ok) {
        const json = await res.json();
        onActivated({
          kioskId: json.kioskId,
          name: json.name,
          locationName: json.location.name,
        });
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.error || "Invalid activation code");
        setCode("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <Monitor className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Activate Kiosk</h1>
          <p className="text-muted-foreground mt-2">
            Enter the 6-digit activation code from Settings to set up this device.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(v);
              setError("");
            }}
            className="text-center text-3xl font-mono tracking-[0.4em] h-16"
            autoFocus
            disabled={loading}
          />

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-lg"
            disabled={loading || code.length !== 6}
          >
            {loading && <Spinner data-icon="inline-start" />}
            Activate
          </Button>
        </form>
      </div>
    </div>
  );
}
