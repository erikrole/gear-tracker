"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Archive, Check, CircleHelp, Download, FilePenLine, RefreshCw, RotateCcw, Settings2, ShieldCheck, Trash2, UserRound, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { FadeUp } from "@/components/ui/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import EmptyState from "@/components/EmptyState";
import { OperationalRowActions } from "@/components/OperationalRowActions";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { compareSignatureRosterMembers } from "@/lib/signatures/roster";
import { SIGNATURE_CREATIVE_STAFF_SPORT_CODE, SIGNATURE_MBB_SPORT_CODE } from "@/lib/signatures/types";

type Member = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  title: string | null;
  roleGroup: "PLAYER" | "COACHING_STAFF" | "CREATIVE_STAFF" | "SUPPORT_STAFF";
  sourceOrder: number | null;
  required: boolean;
  active: boolean;
  captureVersion: number;
  settingsVersion: number;
  artifact: { id: string; width: number; height: number; committedAt: string | null } | null;
};

type Collection = {
  id: string;
  sportCode: string;
  season: string;
  status: "OPEN" | "ARCHIVED";
  collectionVersion: number;
  settingsVersion: number;
  penSettings: { strokeColor: string; strokeWidth: number; cropPadding: number; maxWidth: number; maxHeight: number };
  completeness: { complete: number; required: number; percent: number };
  members: Member[];
};

function roleLabel(role: Member["roleGroup"]) {
  if (role === "PLAYER") return "Player";
  if (role === "COACHING_STAFF") return "Coaching staff";
  if (role === "CREATIVE_STAFF") return "Creative staff";
  return "Support staff";
}

const GROUP_META: Record<Member["roleGroup"], { label: string; icon: typeof UserRound }> = {
  PLAYER: { label: "Players", icon: UserRound },
  COACHING_STAFF: { label: "Coaching staff", icon: ShieldCheck },
  CREATIVE_STAFF: { label: "Creative staff", icon: UsersRound },
  SUPPORT_STAFF: { label: "Support staff", icon: UsersRound },
};

function collectionTitle(sportCode: string) {
  if (sportCode === SIGNATURE_MBB_SPORT_CODE) return "Men’s Basketball signatures";
  if (sportCode === SIGNATURE_CREATIVE_STAFF_SPORT_CODE) return "Creative staff signatures";
  return `${sportCode} signatures`;
}

async function mutate(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (handleAuthRedirect(response)) throw new Error("Session expired");
  if (!response.ok) throw new Error(await parseErrorMessage(response, "Signature action failed"));
  return response.json() as Promise<Record<string, unknown>>;
}

export default function SignatureCollectionPage({ collectionId }: { collectionId: string }) {
  const { data: collection, loading, error, reload } = useFetch<Collection>({ url: `/api/signatures/collections/${collectionId}` });
  const { data: me } = useFetch<{ id: string; role: "ADMIN" | "STAFF" | "STUDENT" | "COLLABORATOR" }>({
    url: "/api/me",
    refetchOnFocus: false,
    transform: (json) => json.user as { id: string; role: "ADMIN" | "STAFF" | "STUDENT" | "COLLABORATOR" },
  });
  const isAdmin = me?.role === "ADMIN";
  const canReconcile = me?.role === "ADMIN" || me?.role === "STAFF";
  const [group, setGroup] = useState<"ALL" | Member["roleGroup"]>("ALL");
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncingCreativeStaff, setSyncingCreativeStaff] = useState(false);
  const [settings, setSettings] = useState<Collection["penSettings"] | null>(null);
  const isCreativeStaffRoster = collection?.sportCode === SIGNATURE_CREATIVE_STAFF_SPORT_CODE;
  const rosterGroupOrder = useMemo<Member["roleGroup"][]>(
    () => isCreativeStaffRoster ? ["CREATIVE_STAFF"] : ["PLAYER", "COACHING_STAFF", "SUPPORT_STAFF"],
    [isCreativeStaffRoster],
  );

  useEffect(() => {
    setGroup("ALL");
  }, [collection?.id]);

  const groupSections = useMemo(() => rosterGroupOrder
    .map((roleGroup) => {
      const members = (collection?.members ?? []).filter((member) => member.active && member.roleGroup === roleGroup).sort(compareSignatureRosterMembers);
      const complete = members.filter((member) => member.artifact).length;
      const required = members.filter((member) => member.required).length;
      const denominator = required || members.length;
      return {
        roleGroup,
        members,
        complete,
        required,
        percent: denominator === 0 ? 100 : Math.round((complete / denominator) * 100),
      };
    })
    .filter((section) => (group === "ALL" || section.roleGroup === group) && (section.members.length > 0 || (isCreativeStaffRoster && section.roleGroup === "CREATIVE_STAFF"))), [collection?.members, group, isCreativeStaffRoster, rosterGroupOrder]);
  const effectiveSettings = settings ?? collection?.penSettings;

  async function saveSettings() {
    if (!collection || !effectiveSettings) return;
    setSavingSettings(true);
    try {
      await mutate(`/api/signatures/collections/${collection.id}`, "PATCH", { ...effectiveSettings, expectedCollectionVersion: collection.collectionVersion, expectedSettingsVersion: collection.settingsVersion });
      setSettings(null);
      reload();
      toast.success("Pen settings saved");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Pen settings were not saved");
    } finally {
      setSavingSettings(false);
    }
  }

  async function remove(member: Member) {
    if (!collection || !member.artifact || !window.confirm(`Remove ${member.name}'s current signature?`)) return;
    try {
      await mutate(`/api/signatures/collections/${collection.id}/capture/${member.id}`, "DELETE", { expectedCaptureVersion: member.captureVersion });
      reload();
      toast.success(`${member.name}'s signature was removed`);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Signature was not removed");
    }
  }

  async function toggleRequired(member: Member) {
    if (!collection) return;
    try {
      await mutate(`/api/signatures/collections/${collection.id}/members/${member.id}/required`, "PATCH", { required: !member.required, expectedCollectionVersion: collection.collectionVersion });
      reload();
      toast.success(`${member.name} is now ${member.required ? "optional" : "required"}`);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Required state was not changed");
    }
  }

  async function syncCreativeStaff() {
    if (!collection) return;
    setSyncingCreativeStaff(true);
    try {
      const result = await mutate(`/api/signatures/collections/${collection.id}/creative-staff`, "POST", { expectedCollectionVersion: collection.collectionVersion });
      reload();
      toast.success(result.unchanged ? "Creative staff is up to date" : "Creative staff added");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Creative staff was not updated");
    } finally {
      setSyncingCreativeStaff(false);
    }
  }

  async function resetCollection() {
    if (!collection || !window.confirm("Reset every captured signature in this collection? Files will be queued for cleanup.")) return;
    try {
      await mutate(`/api/signatures/collections/${collection.id}/reset`, "POST", { expectedCollectionVersion: collection.collectionVersion });
      reload();
      toast.success("Collection reset");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Collection was not reset");
    }
  }

 async function archiveCollection() {
   if (!collection || !window.confirm("Archive this collection? It will become read-only.")) return;
   try {
      await mutate("/api/signatures/collections/" + collection.id + "/archive", "POST", { expectedCollectionVersion: collection.collectionVersion });
     reload();
     toast.success("Collection archived");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Collection was not archived");
    }
  }

  if (loading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading signature roster…</CardContent></Card>;
  if (error || !collection) return <EmptyState icon="wifi-off" title="Couldn’t load this signature collection" description="The collection may have moved or the connection failed." actionLabel="Retry" onAction={reload} />;

  return (
    <FadeUp>
     <PageHeader
       title={collectionTitle(collection.sportCode)}
        description={isCreativeStaffRoster ? `${collection.season} internal roster` : `${collection.season} roster`}
     >
        <Button variant="outline" size="sm" className="h-10" onClick={reload} disabled={loading}><RefreshCw data-icon="inline-start" />Refresh</Button>
        {isAdmin && collection.status === "OPEN" && <Button variant="outline" size="sm" className="h-10" onClick={archiveCollection}><Archive data-icon="inline-start" />Archive</Button>}
      </PageHeader>

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/15 pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
             <div>
               <CardTitle className="text-base">Collection readiness</CardTitle>
             </div>
              <Badge variant={collection.completeness.percent === 100 ? "green" : "outline"} className="h-7 px-3">
                {collection.completeness.percent === 100 ? <Check aria-hidden="true" /> : null}
                {collection.completeness.percent}% ready
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="grid grid-cols-3 divide-x rounded-md border bg-background/50">
              <div className="p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Signed</p><p className="mt-1 text-xl font-semibold tabular-nums">{collection.completeness.complete}</p></div>
              <div className="p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Required</p><p className="mt-1 text-xl font-semibold tabular-nums">{collection.completeness.required}</p></div>
              <div className="p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Remaining</p><p className="mt-1 text-xl font-semibold tabular-nums">{Math.max(0, collection.completeness.required - collection.completeness.complete)}</p></div>
            </div>
            <div aria-label={`${collection.completeness.percent}% of required signatures saved`}>
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground"><span>Server-confirmed signatures</span><span className="tabular-nums">{collection.completeness.complete}/{collection.completeness.required}</span></div>
             <Progress value={collection.completeness.percent} className="h-2.5" />
           </div>
         </CardContent>
        </Card>

       <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <div>
            <h2 className="text-lg font-semibold">Roster</h2>
         </div>
          {!isCreativeStaffRoster && (
            <Select value={group} onValueChange={(value) => setGroup(value as typeof group)}>
              <SelectTrigger className="h-10 w-full sm:w-52" aria-label="Filter signature roster"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All roster groups</SelectItem><SelectItem value="PLAYER">Players</SelectItem><SelectItem value="COACHING_STAFF">Coaching staff</SelectItem><SelectItem value="SUPPORT_STAFF">Support staff</SelectItem></SelectContent>
            </Select>
          )}
        </div>

        {groupSections.length === 0 ? <EmptyState icon="users" title="No roster members in this view" description="Try another roster group." /> : (
         <div className="space-y-7">
           {groupSections.map((section) => {
              const meta = GROUP_META[section.roleGroup];
              const Icon = meta.icon;
             return (
               <section key={section.roleGroup} aria-labelledby={`signature-group-${section.roleGroup.toLowerCase()}`}>
                  <div className="mb-2 flex flex-col gap-2 border-b pb-2 sm:flex-row sm:items-end sm:justify-between">
                   <div className="flex items-start gap-3">
                     <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground"><Icon className="size-5" aria-hidden="true" /></div>
                     <div>
                       <div className="flex flex-wrap items-center gap-2"><h3 id={`signature-group-${section.roleGroup.toLowerCase()}`} className="text-base font-semibold">{meta.label}</h3><Badge variant="outline" size="sm">{section.members.length}</Badge></div>
                     </div>
                   </div>
                    <div className="sm:text-right"><p className="text-sm font-semibold tabular-nums">{section.members.length === 0 ? "Not added" : `${section.complete}/${section.required || section.members.length} signed`}</p><p className="text-xs text-muted-foreground">{section.members.length === 0 ? "Internal staff" : section.required ? `${section.percent}% of required` : "Optional group"}</p></div>
                  </div>
                 {section.members.length === 0 ? (
                   <Card className="border-dashed bg-muted/15">
                     <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                       <div>
                         <p className="font-medium">No Creative staff added</p>
                         <p className="mt-1 text-sm text-muted-foreground">Add full-time Video, Photo, and Graphics staff with active site accounts.</p>
                       </div>
                       {canReconcile && collection.status === "OPEN" && <Button size="sm" variant="outline" className="h-10 shrink-0" onClick={syncCreativeStaff} disabled={syncingCreativeStaff}>{syncingCreativeStaff ? "Syncing…" : "Add Creative staff"}</Button>}
                     </CardContent>
                   </Card>
                 ) : (
                 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                   {section.members.map((member) => (
                     <Card key={member.id} className={member.artifact ? "border-emerald-500/50 bg-emerald-500/[0.06]" : "bg-muted/20"}>
                        <CardContent className="flex min-h-[164px] flex-col gap-3 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className={member.artifact ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white" : "flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground"} aria-label={member.jerseyNumber === null ? "No jersey number" : `Jersey ${member.jerseyNumber}`}>
                                {member.jerseyNumber ?? <UserRound className="size-4" aria-hidden="true" />}
                              </div>
                              <div className="min-w-0"><p className="truncate font-semibold">{member.name}</p><p className="truncate text-xs text-muted-foreground">{member.title || roleLabel(member.roleGroup)}</p></div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Badge variant={member.required ? "outline" : "secondary"} className="text-[10px]">{member.required ? "Required" : "Optional"}</Badge>
                              {member.artifact && (
                                <OperationalRowActions label={`Actions for ${member.name}'s signature`}>
                                  {collection.status === "OPEN" && (
                                    <DropdownMenuItem asChild>
                                      <Link href={`/signatures/${collection.id}/capture/${member.id}`}><FilePenLine />Replace signature</Link>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem asChild>
                                    <a href={`/api/signatures/artifacts/${member.artifact.id}/png`} target="_blank" rel="noreferrer"><Download />Download PNG</a>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <a href={`/api/signatures/artifacts/${member.artifact.id}/svg`}><Download />Download SVG</a>
                                  </DropdownMenuItem>
                                  {collection.status === "OPEN" && <DropdownMenuItem variant="destructive" onSelect={() => remove(member)}><Trash2 />Remove signature</DropdownMenuItem>}
                                  {isAdmin && collection.status === "OPEN" && <DropdownMenuItem onSelect={() => toggleRequired(member)}>{member.required ? "Make optional" : "Require"}</DropdownMenuItem>}
                                </OperationalRowActions>
                              )}
                            </div>
                          </div>
                          {member.artifact ? (
                            <div className="flex min-h-[92px] flex-1 items-center rounded-md border border-emerald-500/20 bg-background/70 px-3 py-2">
                              <Image
                                src={`/api/signatures/artifacts/${member.artifact.id}/png`}
                                alt={`${member.name} signature`}
                                width={member.artifact.width}
                                height={member.artifact.height}
                                unoptimized
                                className="max-h-[84px] w-full object-contain object-left"
                                decoding="async"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground"><CircleHelp className="size-3.5" aria-hidden="true" />Needs signature</div>
                              <div className="mt-auto flex flex-wrap items-center gap-2">
                                {collection.status === "OPEN" && <Button size="sm" variant="brand" className="h-10" asChild><Link href={`/signatures/${collection.id}/capture/${member.id}`}><FilePenLine data-icon="inline-start" />Capture signature</Link></Button>}
                                {isAdmin && collection.status === "OPEN" && <Button size="sm" variant="ghost" className="h-10" onClick={() => toggleRequired(member)}>{member.required ? "Make optional" : "Require"}</Button>}
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                 </div>
                 )}
               </section>
              );
            })}
          </div>
        )}

       {isAdmin && collection.status === "OPEN" && (
         <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Settings2 className="size-4" />Admin capture settings</CardTitle><p className="text-sm text-muted-foreground">Settings lock after the first saved signature.</p></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-2"><Label htmlFor="signature-color">Pen color</Label><Input id="signature-color" type="color" className="h-10 p-1" value={effectiveSettings?.strokeColor ?? "#111827"} onChange={(event) => setSettings({ ...(effectiveSettings ?? collection.penSettings), strokeColor: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="signature-width">Stroke width</Label><Input id="signature-width" type="number" min={1} max={24} value={effectiveSettings?.strokeWidth ?? 4} onChange={(event) => setSettings({ ...(effectiveSettings ?? collection.penSettings), strokeWidth: Number(event.target.value) })} /></div>
                <div className="space-y-2"><Label htmlFor="signature-padding">Crop padding</Label><Input id="signature-padding" type="number" min={0} max={128} value={effectiveSettings?.cropPadding ?? 24} onChange={(event) => setSettings({ ...(effectiveSettings ?? collection.penSettings), cropPadding: Number(event.target.value) })} /></div>
                <div className="space-y-2"><Label htmlFor="signature-width-limit">Max width</Label><Input id="signature-width-limit" type="number" min={128} max={2000} value={effectiveSettings?.maxWidth ?? 1600} onChange={(event) => setSettings({ ...(effectiveSettings ?? collection.penSettings), maxWidth: Number(event.target.value) })} /></div>
                <div className="space-y-2"><Label htmlFor="signature-height-limit">Max height</Label><Input id="signature-height-limit" type="number" min={128} max={2000} value={effectiveSettings?.maxHeight ?? 900} onChange={(event) => setSettings({ ...(effectiveSettings ?? collection.penSettings), maxHeight: Number(event.target.value) })} /></div>
              </div>
              <Separator />
              <div className="flex flex-wrap gap-2"><Button className="h-10" onClick={saveSettings} disabled={savingSettings || !settings}>Save settings</Button><Button variant="outline" className="h-10" onClick={resetCollection}><RotateCcw data-icon="inline-start" />Reset all captures</Button></div>
            </CardContent>
          </Card>
        )}
      </div>
    </FadeUp>
  );
}
