"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SignatureAthleteProfileValues = {
  birthday: string | null;
  hometown: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  xHandle: string | null;
};

type SignatureAthleteProfileFormProps = {
  initialValues: SignatureAthleteProfileValues;
  busy?: boolean;
  submitLabel?: string;
  onSubmit: (values: { birthday: string; hometown: string; instagramHandle: string; tiktokHandle: string; xHandle: string }) => Promise<void>;
  onCancel?: () => void;
};

export function SignatureAthleteProfileForm({
  initialValues,
  busy = false,
  submitLabel = "Save athlete profile",
  onSubmit,
  onCancel,
}: SignatureAthleteProfileFormProps) {
  const [birthday, setBirthday] = useState(initialValues.birthday ?? "");
  const [hometown, setHometown] = useState(initialValues.hometown ?? "");
  const [instagramHandle, setInstagramHandle] = useState(initialValues.instagramHandle ?? "");
  const [tiktokHandle, setTiktokHandle] = useState(initialValues.tiktokHandle ?? "");
  const [xHandle, setXHandle] = useState(initialValues.xHandle ?? "");

  useEffect(() => {
    setBirthday(initialValues.birthday ?? "");
    setHometown(initialValues.hometown ?? "");
    setInstagramHandle(initialValues.instagramHandle ?? "");
    setTiktokHandle(initialValues.tiktokHandle ?? "");
    setXHandle(initialValues.xHandle ?? "");
  }, [initialValues]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({ birthday, hometown, instagramHandle, tiktokHandle, xHandle });
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div>
        <p className="font-semibold">Website profile</p>
        <p className="mt-1 text-sm text-muted-foreground">Birthday and hometown are required. Social handles are optional; enter handles only, not links.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="athlete-birthday">Full birthday <span className="text-destructive">*</span></Label>
          <Input id="athlete-birthday" type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} required disabled={busy} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="athlete-hometown">Hometown <span className="text-destructive">*</span></Label>
          <Input
            id="athlete-hometown"
            name="hometown"
            value={hometown}
            onChange={(event) => setHometown(event.target.value)}
            maxLength={160}
            required
            disabled={busy}
            placeholder="Madison, Wis."
            autoComplete="address-level2"
            autoCapitalize="words"
            aria-describedby="athlete-hometown-help"
          />
          <p id="athlete-hometown-help" className="text-xs text-muted-foreground">When available, the official roster pre-fills this value. You can edit it before saving.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold">Social handles <span className="font-normal text-muted-foreground">(optional)</span></p>
          <p className="mt-1 text-xs text-muted-foreground">Use a username such as <span className="font-medium">@badger</span>. Do not paste a URL.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="athlete-instagram">Instagram</Label>
            <Input id="athlete-instagram" value={instagramHandle} onChange={(event) => setInstagramHandle(event.target.value)} maxLength={80} placeholder="@username" disabled={busy} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="athlete-tiktok">TikTok</Label>
            <Input id="athlete-tiktok" value={tiktokHandle} onChange={(event) => setTiktokHandle(event.target.value)} maxLength={80} placeholder="@username" disabled={busy} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="athlete-x">X / Twitter</Label>
            <Input id="athlete-x" value={xHandle} onChange={(event) => setXHandle(event.target.value)} maxLength={80} placeholder="@username" disabled={busy} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" className="h-11" onClick={onCancel} disabled={busy}>Cancel</Button>}
        <Button type="submit" className="h-11" loading={busy} disabled={busy || !birthday || !hometown}>{submitLabel}</Button>
      </div>
    </form>
  );
}
