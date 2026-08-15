"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArrowRight, Eye, EyeOff, FolderPen, RefreshCw, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { FadeUp } from "@/components/ui/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/EmptyState";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { DEFAULT_SIGNATURE_SEASON, SIGNATURE_CREATIVE_STAFF_SPORT_CODE, SIGNATURE_MBB_SPORT_CODE } from "@/lib/signatures/types";

type Collection = {
  id: string;
  sportCode: string;
  season: string;
  status: "OPEN" | "ARCHIVED";
  collectionVersion: number;
  activeMemberCount: number;
  completeness: { complete: number; required: number; percent: number };
  updatedAt: string;
};

type Preview = {
  collectionId: string;
  collectionVersion: number;
  snapshotId: string;
  candidateCount: number;
  alreadyApplied?: boolean;
  sourceHash: string;
  entries: Array<{ name: string; roleGroup: string; jerseyNumber: number | null }>;
};

function collectionLabel(sportCode: string) {
  if (sportCode === SIGNATURE_MBB_SPORT_CODE) return "Men’s Basketball";
  if (sportCode === SIGNATURE_CREATIVE_STAFF_SPORT_CODE) return "Creative staff";
  return sportCode;
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (handleAuthRedirect(response)) throw new Error("Session expired");
  if (!response.ok) throw new Error(await parseErrorMessage(response, "Signature request failed"));
  return response.json() as Promise<Record<string, unknown>>;
}

export default function SignatureCollectionsPage({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [season, setSeason] = useState(DEFAULT_SIGNATURE_SEASON);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [working, setWorking] = useState(false);
  const [workingCollectionId, setWorkingCollectionId] = useState<string | null>(null);
  const { data, loading, error, reload } = useFetch<Collection[]>({
    url: "/api/signatures/collections" + (showArchived ? "?includeArchived=true" : ""),
    transform: (json) => (json.collections as Collection[]) ?? [],
  });
  const collections = data ?? [];

  async function previewRoster() {
    setWorking(true);
    try {
      const result = await postJson("/api/signatures/import/preview", { season });
      setPreview(result as unknown as Preview);
      toast.success("Roster preview ready: " + result.candidateCount + " members");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Roster preview failed");
    } finally {
      setWorking(false);
    }
  }

  async function applyPreview() {
    if (!preview) return;
    setWorking(true);
    try {
      await postJson("/api/signatures/import/apply", {
        snapshotId: preview.snapshotId,
        expectedCollectionVersion: preview.collectionVersion,
      });
      setPreview(null);
      reload();
      toast.success("Roster applied");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Roster apply failed");
    } finally {
      setWorking(false);
    }
  }

  async function archiveCollection(collection: Collection) {
    if (!window.confirm("Remove " + collection.season + " from active signature rosters? It will remain available as read-only history.")) return;
    setWorkingCollectionId(collection.id);
    try {
      await postJson("/api/signatures/collections/" + collection.id + "/archive", {
        expectedCollectionVersion: collection.collectionVersion,
      });
      reload();
      toast.success(collection.season + " was archived");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Collection was not archived");
    } finally {
      setWorkingCollectionId(null);
    }
  }

  async function restoreCollection(collection: Collection) {
    if (!window.confirm("Restore " + collection.season + " to active signature rosters?")) return;
    setWorkingCollectionId(collection.id);
    try {
      await postJson("/api/signatures/collections/" + collection.id + "/restore", {
        expectedCollectionVersion: collection.collectionVersion,
      });
      reload();
      toast.success(collection.season + " was restored");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Collection was not restored");
    } finally {
      setWorkingCollectionId(null);
    }
  }

  async function syncCreativeStaff(collection: Collection) {
    setWorkingCollectionId(collection.id);
    try {
      const result = await postJson(`/api/signatures/collections/${collection.id}/creative-staff`, {
        expectedCollectionVersion: collection.collectionVersion,
      });
      reload();
      toast.success(result.unchanged ? "Creative staff is up to date" : "Creative staff added");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Creative staff was not updated");
    } finally {
      setWorkingCollectionId(null);
    }
  }

  return (
    <FadeUp>
      <PageHeader title="Signatures" description="Private player and staff rosters.">
        <Button variant="outline" size="sm" className="h-10" onClick={reload} disabled={loading || Boolean(workingCollectionId)}>
          <RefreshCw data-icon="inline-start" className={loading ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="signature-collections-heading">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="signature-collections-heading" className="text-lg font-semibold">Rosters</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <Button variant="ghost" size="sm" className="h-10" onClick={() => setShowArchived((value) => !value)}>
                  {showArchived ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
                  {showArchived ? "Hide archived" : "Show archived"}
                </Button>
              )}
              <Select onValueChange={(value) => router.push("/signatures/" + value)}>
                <SelectTrigger className="h-10 w-44" aria-label="Choose a signature roster"><SelectValue placeholder="Choose roster" /></SelectTrigger>
                <SelectContent>{collections.map((collection) => <SelectItem key={collection.id} value={collection.id}>{collectionLabel(collection.sportCode)} · {collection.season}</SelectItem>)}</SelectContent>
              </Select>
              <Badge variant="outline">{collections.length} {collections.length === 1 ? "roster" : "rosters"}</Badge>
            </div>
          </div>

          {loading && <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading rosters…</CardContent></Card>}
          {!loading && error && <EmptyState icon="wifi-off" title="Couldn’t load rosters" description="Try again before importing a roster." actionLabel="Retry" onAction={reload} />}
          {!loading && !error && collections.length === 0 && (
            <Card>
              <CardContent className="p-2">
                <EmptyState
                  icon="folder"
                  title={showArchived ? "No rosters" : "No active rosters"}
                  description={showArchived ? "No signature collections are available." : "Archived years are hidden. Import a roster to start a new season."}
                />
              </CardContent>
            </Card>
          )}
          {!loading && !error && collections.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {collections.map((collection) => {
                const isWorking = workingCollectionId === collection.id;
                const isCreativeStaffRoster = collection.sportCode === SIGNATURE_CREATIVE_STAFF_SPORT_CODE;
                const hasSyncedMembers = collection.activeMemberCount > 0;
                return (
                  <Card key={collection.id} className={collection.status === "ARCHIVED" ? "h-full opacity-75" : "h-full"}>
                    <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base">
                          <Link href={"/signatures/" + collection.id} className="inline-flex items-center gap-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {isCreativeStaffRoster && <UsersRound className="size-4 text-muted-foreground" aria-hidden="true" />}
                            {collectionLabel(collection.sportCode)}
                          </Link>
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{isCreativeStaffRoster ? "Internal staff roster" : `${collection.season} roster`}</p>
                      </div>
                      <Badge variant={collection.status === "OPEN" ? "default" : "outline"}>{collection.status === "OPEN" ? "Open" : "Archived"}</Badge>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{isCreativeStaffRoster && !hasSyncedMembers ? "Roster status" : "Complete"}</span>
                        <span className="font-semibold tabular-nums">{isCreativeStaffRoster && !hasSyncedMembers ? "Not synced" : `${collection.completeness.complete}/${collection.completeness.required}`}</span>
                      </div>
                      <Progress value={collection.completeness.percent} className="mt-2 h-2" />
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{isCreativeStaffRoster && !hasSyncedMembers ? "Add staff to begin" : `${collection.completeness.percent}% ready`}</span>
                        <Link href={"/signatures/" + collection.id} className="inline-flex items-center gap-1 font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          Open roster <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                      {isCreativeStaffRoster && collection.status === "OPEN" && (
                        <Button
                          variant="outline"
                          className="mt-4 h-10 w-full"
                          onClick={() => syncCreativeStaff(collection)}
                          disabled={isWorking}
                        >
                          {isWorking ? "Syncing…" : hasSyncedMembers ? "Sync staff" : "Add staff"}
                        </Button>
                      )}
                      {isAdmin && (
                        <div className="mt-3 border-t pt-3">
                          {collection.status === "OPEN" ? (
                            <Button variant="ghost" size="sm" className="h-10 px-0 text-muted-foreground hover:text-foreground" onClick={() => archiveCollection(collection)} disabled={isWorking}>
                              <Archive data-icon="inline-start" />{isWorking ? "Archiving…" : "Archive year"}
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-10 px-0 text-muted-foreground hover:text-foreground" onClick={() => restoreCollection(collection)} disabled={isWorking}>
                              <Archive data-icon="inline-start" />{isWorking ? "Restoring…" : "Restore year"}
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><FolderPen className="size-4 text-[var(--wi-red)]" />Import roster</CardTitle>
            <p className="text-sm text-muted-foreground">UWBadgers · Men’s Basketball</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="signature-season">Season</Label>
              <Input id="signature-season" value={season} onChange={(event) => setSeason(event.target.value)} placeholder="2026-27" inputMode="numeric" />
            </div>
            <Button className="h-10 w-full" onClick={previewRoster} disabled={working || !/^\d{4}-\d{2}$/.test(season)}>
              {working ? "Checking roster…" : "Preview roster"}
            </Button>
            {preview && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{preview.candidateCount} members found</p>
                <p className="mt-1 text-xs text-muted-foreground">{preview.alreadyApplied ? "This roster is already applied." : "Duplicates are removed by source profile."}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="h-10" onClick={applyPreview} disabled={working || preview.alreadyApplied}>Apply roster</Button>
                  <Button size="sm" variant="outline" className="h-10" onClick={() => setPreview(null)} disabled={working}>Dismiss</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </FadeUp>
  );
}
