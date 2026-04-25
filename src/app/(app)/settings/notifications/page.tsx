"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BellOff, Mail, Smartphone, WifiOff } from "lucide-react";
import { FadeUp } from "@/components/ui/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useFetch } from "@/hooks/use-fetch";
import {
  classifyError,
  handleAuthRedirect,
  isAbortError,
  parseErrorMessage,
} from "@/lib/errors";

type Prefs = {
  pausedUntil: string | null;
  channels: { email: boolean; push: boolean };
};

const PAUSE_OPTIONS = [
  { id: "1h",  label: "1 hour",   ms: 60 * 60 * 1000 },
  { id: "1d",  label: "1 day",    ms: 24 * 60 * 60 * 1000 },
  { id: "1w",  label: "1 week",   ms: 7 * 24 * 60 * 60 * 1000 },
];

function formatPausedUntil(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime()) || t.getTime() <= Date.now()) return null;
  return t.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationsSettingsPage() {
  const { data: fetched, loading, error, reload } = useFetch<Prefs>({
    url: "/api/me/notification-preferences",
    returnTo: "/settings/notifications",
    transform: (json) => json.data as Prefs,
  });

  const [local, setLocal] = useState<Prefs | null>(null);
  const [prevFetched, setPrevFetched] = useState(fetched);
  if (fetched !== prevFetched) {
    setPrevFetched(fetched);
    setLocal(null);
  }
  const prefs = local ?? fetched;
  const [saving, setSaving] = useState(false);

  async function save(next: Prefs, { silent = false } = {}) {
    setLocal(next);
    setSaving(true);
    try {
      const res = await fetch("/api/me/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (handleAuthRedirect(res, "/settings/notifications")) return;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to save");
        toast.error(msg);
        reload();
      } else if (!silent) {
        toast.success("Saved", { duration: 1200 });
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You’re offline. Check your connection." : "Failed to save");
      reload();
    }
    setSaving(false);
  }

  function setChannel(channel: "email" | "push", value: boolean) {
    if (!prefs) return;
    save({ ...prefs, channels: { ...prefs.channels, [channel]: value } });
  }

  function pauseFor(ms: number) {
    if (!prefs) return;
    const until = new Date(Date.now() + ms).toISOString();
    save({ ...prefs, pausedUntil: until });
    toast.success(`Paused — quiet until ${new Date(until).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" })}`);
  }

  function resumeNow() {
    if (!prefs) return;
    save({ ...prefs, pausedUntil: null }, { silent: true });
    toast.success("Notifications resumed");
  }

  const sidebar = (
    <div className="sticky top-20 max-lg:static">
      <h2 className="text-2xl font-bold mb-2">Notifications</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Control how and when you receive updates about gear, shifts, and
        reservations. The in-app inbox always stays available regardless of
        these settings.
      </p>
    </div>
  );

  if (loading) {
    return (
      <FadeUp>
        <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
          {sidebar}
          <div className="min-w-0 space-y-3">
            <Skeleton className="h-32 w-full rounded-md" />
            <Skeleton className="h-44 w-full rounded-md" />
          </div>
        </div>
      </FadeUp>
    );
  }

  if (error || !prefs) {
    const Icon = error === "network" ? WifiOff : AlertTriangle;
    return (
      <FadeUp>
        <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
          {sidebar}
          <div className="min-w-0">
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <Icon className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {error === "network"
                    ? "Could not connect to the server."
                    : "Failed to load your preferences."}
                </p>
                <Button variant="outline" onClick={reload}>Retry</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </FadeUp>
    );
  }

  const pausedLabel = formatPausedUntil(prefs.pausedUntil);
  const isPaused = !!pausedLabel;

  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
      {sidebar}

      <div className="min-w-0 space-y-4">
        {/* Pause */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BellOff className="size-4" />
              Quiet hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isPaused ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 p-3">
                <div className="text-sm">
                  <span className="font-medium">Paused</span>
                  <span className="text-muted-foreground"> until {pausedLabel}</span>
                </div>
                <Button size="sm" variant="outline" onClick={resumeNow} disabled={saving}>
                  {saving ? <Spinner /> : "Resume now"}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground m-0">
                  Pause email and push delivery for a stretch — useful during
                  breaks or weekends. The in-app inbox keeps recording everything.
                </p>
                <div className="flex flex-wrap gap-2">
                  {PAUSE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.id}
                      variant="outline"
                      size="sm"
                      onClick={() => pauseFor(opt.ms)}
                      disabled={saving}
                    >
                      Pause {opt.label}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Channels */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery channels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <ChannelRow
              icon={<Mail className="size-4" />}
              label="Email"
              description="Send notifications to your registered email address."
              checked={prefs.channels.email}
              onChange={(v) => setChannel("email", v)}
              disabled={saving || isPaused}
            />
            <div className="border-t border-border my-1" />
            <ChannelRow
              icon={<Smartphone className="size-4" />}
              label="Push"
              description="Send push notifications to your iOS app (requires the app installed and notifications allowed)."
              checked={prefs.channels.push}
              onChange={(v) => setChannel("push", v)}
              disabled={saving || isPaused}
            />
            {isPaused && (
              <p className="text-xs text-muted-foreground pt-2 m-0">
                Channels are temporarily overridden by your active pause.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground m-0">
          Note: in-app notifications always fire and appear in your{" "}
          <a href="/notifications" className="underline">notifications inbox</a>.
        </p>
      </div>
    </div>
    </FadeUp>
  );
}

function ChannelRow({
  icon,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = `notif-${label.toLowerCase()}`;
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex gap-3 min-w-0">
        <span className="text-muted-foreground mt-0.5">{icon}</span>
        <div className="min-w-0">
          <Label htmlFor={id} className="font-medium cursor-pointer">{label}</Label>
          <p className="text-xs text-muted-foreground m-0 mt-0.5">{description}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
