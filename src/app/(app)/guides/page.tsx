"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Role, ShiftArea } from "@prisma/client";
import {
  BookOpenTextIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  CameraIcon,
  ClockIcon,
  FileTextIcon,
  FolderTreeIcon,
  HardDriveIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
  PaletteIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  SlackIcon,
  SparklesIcon,
  TargetIcon,
  VideoIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { UserAvatar } from "@/components/UserAvatar";
import { useFetch } from "@/hooks/use-fetch";
import { getGuideFreshness } from "@/lib/guide-freshness";
import type { GuideListItem } from "@/lib/guides";
import { cn } from "@/lib/utils";

type MeResponse = { id: string; role: Role };
type ContactUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  slackHandle: string | null;
  slackProfileUrl: string | null;
  primaryArea: ShiftArea | null;
  location: string | null;
  avatarUrl: string | null;
  active?: boolean;
  title: string | null;
  gradYear: number | null;
  studentYearOverride: "FRESHMAN" | "SOPHOMORE" | "JUNIOR" | "SENIOR" | "GRAD" | null;
};

type ContactUsersResponse = {
  data: ContactUser[];
  total: number;
};

type ContactRoleFilter = "ALL" | Role;
type ContactAreaFilter = "ALL" | ShiftArea | "UNASSIGNED";
type ContactHygieneFilter = "ALL" | "MISSING_PHONE" | "MISSING_SLACK";

type QuickFilter =
  | "area-video"
  | "area-photo"
  | "area-graphics"
  | "area-comms"
  | "contacts"
  | "building-numbers"
  | "media-drive"
  | "server-paths"
  | "recent"
  | "my-area";

const AREA_QUICK_CARDS = [
  {
    key: "area-video" as const,
    area: ShiftArea.VIDEO,
    title: "Video",
    detail: "Capture, ingest, editing, delivery, and game-day video workflows",
    icon: VideoIcon,
  },
  {
    key: "area-photo" as const,
    area: ShiftArea.PHOTO,
    title: "Photo",
    detail: "Ingest, culling, metadata, exports, and photo operations",
    icon: CameraIcon,
  },
  {
    key: "area-graphics" as const,
    area: ShiftArea.GRAPHICS,
    title: "Graphics",
    detail: "Templates, brand assets, exports, requests, and delivery rules",
    icon: PaletteIcon,
  },
  {
    key: "area-comms" as const,
    area: ShiftArea.COMMS,
    title: "Comms",
    detail: "Communications workflows, contacts, approvals, and handoffs",
    icon: MessageSquareIcon,
  },
];

const REFERENCE_QUICK_CARDS = [
  {
    key: "contacts" as const,
    category: "contacts",
    title: "Contacts",
    detail: "Staff, vendors, escalation owners, and emergency numbers",
    icon: PhoneIcon,
  },
  {
    key: "building-numbers" as const,
    category: "building numbers",
    title: "Building Numbers",
    detail: "Facility phone numbers, room numbers, codes, and location notes",
    icon: Building2Icon,
  },
  {
    key: "media-drive" as const,
    category: "media drive",
    title: "Media Drive",
    detail: "Server overview, access notes, folder map, and ownership rules",
    icon: HardDriveIcon,
  },
  {
    key: "server-paths" as const,
    category: "server paths",
    title: "Server Paths",
    detail: "Copyable exact paths for recurring workflows and deliveries",
    icon: FolderTreeIcon,
  },
];

const CONTACT_ROLE_FILTERS: { value: ContactRoleFilter; label: string }[] = [
  { value: "ALL", label: "All roles" },
  { value: Role.STAFF, label: "Staff" },
  { value: Role.STUDENT, label: "Students" },
  { value: Role.ADMIN, label: "Admins" },
];

const CONTACT_AREA_FILTERS: { value: ContactAreaFilter; label: string }[] = [
  { value: "ALL", label: "All areas" },
  { value: ShiftArea.VIDEO, label: "Video" },
  { value: ShiftArea.PHOTO, label: "Photo" },
  { value: ShiftArea.GRAPHICS, label: "Graphics" },
  { value: ShiftArea.COMMS, label: "Comms" },
  { value: "UNASSIGNED", label: "No area" },
];

const CONTACT_HYGIENE_FILTERS: { value: ContactHygieneFilter; label: string }[] = [
  { value: "ALL", label: "All contacts" },
  { value: "MISSING_PHONE", label: "Missing phone" },
  { value: "MISSING_SLACK", label: "Missing Slack" },
];

const VIEW_PARAM_TO_QUICK_FILTER: Record<string, QuickFilter> = {
  contacts: "contacts",
  "building-numbers": "building-numbers",
  "media-drive": "media-drive",
  "server-paths": "server-paths",
  recent: "recent",
  "my-area": "my-area",
};

const QUICK_FILTER_TO_VIEW_PARAM: Partial<Record<QuickFilter, string>> = {
  contacts: "contacts",
  "building-numbers": "building-numbers",
  "media-drive": "media-drive",
  "server-paths": "server-paths",
  recent: "recent",
  "my-area": "my-area",
};

const AREA_PARAM_TO_QUICK_FILTER: Record<string, QuickFilter> = {
  video: "area-video",
  photo: "area-photo",
  graphics: "area-graphics",
  comms: "area-comms",
};

const QUICK_FILTER_TO_AREA_PARAM: Partial<Record<QuickFilter, string>> = {
  "area-video": "video",
  "area-photo": "photo",
  "area-graphics": "graphics",
  "area-comms": "comms",
};

function quickFilterFromParams(params: { get(name: string): string | null }) {
  const view = params.get("view")?.trim().toLowerCase();
  if (view && VIEW_PARAM_TO_QUICK_FILTER[view]) {
    return VIEW_PARAM_TO_QUICK_FILTER[view];
  }

  const area = params.get("area")?.trim().toLowerCase();
  if (area && AREA_PARAM_TO_QUICK_FILTER[area]) {
    return AREA_PARAM_TO_QUICK_FILTER[area];
  }

  return null;
}

function guideSearchText(guide: GuideListItem) {
  return [guide.title, guide.category, guide.author.name, guide.summary]
    .join(" ")
    .toLowerCase();
}

function contactSearchText(user: ContactUser) {
  return [
    user.name,
    user.email,
    user.phone,
    user.slackHandle,
    user.slackProfileUrl,
    user.title,
    user.role,
    user.primaryArea,
    user.location,
    user.gradYear ? String(user.gradYear) : null,
    user.studentYearOverride,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatShortDate(value: Date | string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function normalizeCategory(category: string) {
  return category.trim().toLowerCase();
}

function formatArea(area: ShiftArea | null) {
  if (!area) return null;
  const labels: Record<ShiftArea, string> = {
    VIDEO: "Video",
    PHOTO: "Photo",
    GRAPHICS: "Graphics",
    COMMS: "Comms",
  };
  return labels[area];
}

function formatRole(role: Role) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function formatStudentYear(user: ContactUser) {
  if (user.studentYearOverride) {
    return user.studentYearOverride.charAt(0) + user.studentYearOverride.slice(1).toLowerCase();
  }
  if (!user.gradYear) return null;
  return `Class of ${user.gradYear}`;
}

function contactSubtitle(user: ContactUser) {
  return user.role === Role.STUDENT
    ? formatStudentYear(user)
    : user.title;
}

function hasSlackContact(user: ContactUser) {
  return Boolean(displaySlackHandle(user.slackHandle) || user.slackProfileUrl);
}

function displaySlackHandle(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().replace(/^@+/, "");
  return normalized ? `@${normalized}` : null;
}

function GuideCard({ guide, compact = false }: { guide: GuideListItem; compact?: boolean }) {
  const freshness = getGuideFreshness(guide);

  return (
    <Link
      href={`/guides/${guide.slug}`}
      className={cn(
        "group flex flex-col rounded-lg border bg-card p-4 transition-[border-color,box-shadow,scale] hover:border-foreground/30 hover:shadow-sm active:scale-[0.99]",
        compact ? "min-h-36" : "min-h-40",
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {guide.featured ? <SparklesIcon className="size-4" /> : <FileTextIcon className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-foreground">
              {guide.title}
            </span>
            {!guide.published && (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                Draft
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {guide.category}
            </Badge>
            <Badge variant={guide.featured ? "purple" : "outline"} className="text-[10px]">
              {guide.personalizationReason}
            </Badge>
            <Badge
              variant={freshness.status === "verified" ? "green" : "orange"}
              className="text-[10px]"
              title={freshness.detail}
            >
              {freshness.label}
            </Badge>
          </div>
        </div>
      </div>
      <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
        {guide.summary || "No preview text yet."}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{guide.author.name}</span>
        <span className="shrink-0 tabular-nums">{formatShortDate(guide.updatedAt)}</span>
      </div>
      {guide.lastVerifiedAt && (
        <div className="mt-2 text-xs text-muted-foreground">
          {freshness.detail}
          {guide.lastVerifiedBy ? ` by ${guide.lastVerifiedBy.name}` : ""}
        </div>
      )}
    </Link>
  );
}

export default function GuidesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const activeCategory = searchParams.get("category") ?? "All";
  const quickFilter = quickFilterFromParams(searchParams);
  const [contactRoleFilter, setContactRoleFilter] = useState<ContactRoleFilter>("ALL");
  const [contactAreaFilter, setContactAreaFilter] = useState<ContactAreaFilter>("ALL");
  const [contactHygieneFilter, setContactHygieneFilter] = useState<ContactHygieneFilter>("ALL");

  const replaceGuideParams = (mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams.toString());
    mutate(next);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const setSearchParam = (value: string) => {
    replaceGuideParams((params) => {
      const trimmed = value.trimStart();
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
    });
  };

  const setCategoryParam = (category: string) => {
    replaceGuideParams((params) => {
      params.delete("view");
      params.delete("area");
      if (category === "All") {
        params.delete("category");
      } else {
        params.set("category", category);
      }
    });
  };

  const setQuickFilterParam = (key: QuickFilter | null) => {
    replaceGuideParams((params) => {
      params.delete("category");
      params.delete("view");
      params.delete("area");

      if (!key || quickFilter === key) return;

      const view = QUICK_FILTER_TO_VIEW_PARAM[key];
      const area = QUICK_FILTER_TO_AREA_PARAM[key];
      if (view) params.set("view", view);
      if (area) params.set("area", area);
    });
  };

  const { data: guides, loading: guidesLoading } = useFetch<GuideListItem[]>({
    url: "/api/guides",
    transform: (json) => (json as { data: GuideListItem[] }).data ?? [],
  });

  const { data: meData } = useFetch<MeResponse>({
    url: "/api/me",
    transform: (json) => (json as { user: MeResponse }).user,
  });

  const isStaffOrAdmin =
    meData?.role === Role.STAFF || meData?.role === Role.ADMIN;

  const { data: contactUsers, loading: contactsLoading } = useFetch<ContactUsersResponse>({
    url: "/api/users?limit=200&sort=name",
    refetchOnFocus: true,
    transform: (json) => json as unknown as ContactUsersResponse,
  });

  const showContactsDirectory =
    quickFilter === "contacts" || activeCategory === "Contacts";

  const categories = useMemo(() => {
    if (!guides) return [];
    const seen = new Set<string>();
    for (const guide of guides) seen.add(guide.category);
    return [...seen].sort();
  }, [guides]);

  const featuredGuides = useMemo(() => {
    if (!guides) return [];
    const curated = guides.filter((guide) => guide.featured);
    return (curated.length > 0 ? curated : guides).slice(0, 4);
  }, [guides]);

  const quickCards = useMemo(() => {
    const all = guides ?? [];
    const areaCards = AREA_QUICK_CARDS.map((card) => ({
      ...card,
      count: all.filter((guide) => guide.targetAreas.includes(card.area)).length,
    }));
    const referenceCards = REFERENCE_QUICK_CARDS.map((card) => ({
      ...card,
      count: card.key === "contacts"
        ? contactUsers?.total ?? all.filter((guide) => normalizeCategory(guide.category) === card.category).length
        : all.filter((guide) => normalizeCategory(guide.category) === card.category).length,
    }));
    const myArea = all.filter((guide) => guide.targetAreas.length > 0 && guide.personalizationReason !== "General");
    const recent = [...all].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const utilityCards = [
      { key: "recent" as const, title: "Recently Updated", detail: recent[0] ? `Latest: ${recent[0].title}` : "No updates yet", count: recent.length, icon: ClockIcon },
      { key: "my-area" as const, title: "My Area", detail: "Video, Photo, Graphics, or Comms matches", count: myArea.length, icon: TargetIcon },
    ];

    return { areaCards, referenceCards, utilityCards };
  }, [guides, contactUsers?.total]);

  const quickCardLookup = useMemo(() => {
    const cards = [
      ...quickCards.areaCards,
      ...quickCards.referenceCards,
      ...quickCards.utilityCards,
    ];
    return new Map(cards.map((card) => [card.key, card]));
  }, [quickCards]);

  const filtered = useMemo(() => {
    if (!guides) return [];
    const source = quickFilter === "recent"
      ? [...guides].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      : guides;
    const query = search.trim().toLowerCase();
    return source.filter((guide) => {
      const matchesSearch = !query || guideSearchText(guide).includes(query);
      const matchesCategory =
        activeCategory === "All" || guide.category === activeCategory;
      const matchesQuickFilter =
        quickFilter === null ||
        (quickFilter === "area-video" && guide.targetAreas.includes(ShiftArea.VIDEO)) ||
        (quickFilter === "area-photo" && guide.targetAreas.includes(ShiftArea.PHOTO)) ||
        (quickFilter === "area-graphics" && guide.targetAreas.includes(ShiftArea.GRAPHICS)) ||
        (quickFilter === "area-comms" && guide.targetAreas.includes(ShiftArea.COMMS)) ||
        (quickFilter === "contacts" && normalizeCategory(guide.category) === "contacts") ||
        (quickFilter === "building-numbers" && normalizeCategory(guide.category) === "building numbers") ||
        (quickFilter === "media-drive" && normalizeCategory(guide.category) === "media drive") ||
        (quickFilter === "server-paths" && normalizeCategory(guide.category) === "server paths") ||
        quickFilter === "recent" ||
        (quickFilter === "my-area" && guide.targetAreas.length > 0 && guide.personalizationReason !== "General");
      return matchesSearch && matchesCategory && matchesQuickFilter;
    });
  }, [guides, search, activeCategory, quickFilter]);

  const filteredContactUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const users = contactUsers?.data ?? [];
    return users.filter((user) => {
      const matchesSearch = !query || contactSearchText(user).includes(query);
      const matchesRole = contactRoleFilter === "ALL" || user.role === contactRoleFilter;
      const matchesArea =
        contactAreaFilter === "ALL" ||
        (contactAreaFilter === "UNASSIGNED" ? !user.primaryArea : user.primaryArea === contactAreaFilter);
      const matchesHygiene =
        contactHygieneFilter === "ALL" ||
        (contactHygieneFilter === "MISSING_PHONE" && !user.phone) ||
        (contactHygieneFilter === "MISSING_SLACK" && !hasSlackContact(user));
      return matchesSearch && matchesRole && matchesArea && matchesHygiene;
    });
  }, [contactUsers, search, contactRoleFilter, contactAreaFilter, contactHygieneFilter]);

  const contactStats = useMemo(() => {
    const users = contactUsers?.data ?? [];
    return {
      visible: filteredContactUsers.length,
      total: users.length,
      missingPhone: users.filter((user) => !user.phone).length,
      missingSlack: users.filter((user) => !hasSlackContact(user)).length,
    };
  }, [contactUsers, filteredContactUsers.length]);

  const clearFilters = () => {
    router.replace(pathname, { scroll: false });
    setContactRoleFilter("ALL");
    setContactAreaFilter("ALL");
    setContactHygieneFilter("ALL");
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Guides"
        description="Role-aware knowledge base for Creative area guides, contacts, building numbers, Media Drive, server paths, SOPs, and general operations."
      >
        {isStaffOrAdmin && (
          <Button asChild size="sm">
            <Link href="/guides/new">
              <PlusIcon className="size-4 mr-1.5" />
              New Guide
            </Link>
          </Button>
        )}
      </PageHeader>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <SparklesIcon className="size-4 text-muted-foreground" />
              Featured for you
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin-curated entries come first, then your role and Creative area shape the order.
            </p>
          </div>
          {!guidesLoading && guides && (
            <Badge variant="outline" className="shrink-0 tabular-nums">
              {guides.length} {guides.length === 1 ? "entry" : "entries"}
            </Badge>
          )}
        </div>

        {guidesLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-lg" />
            ))}
          </div>
        ) : featuredGuides.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featuredGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} compact />
            ))}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">Browse by area</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Jump into guides by Creative discipline. Personalized ranking still controls the order inside each area.
          </p>
        </div>
        <QuickCardGrid
          cards={quickCards.areaCards}
          activeKey={quickFilter}
          onToggle={setQuickFilterParam}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">Reference library</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep always-needed operational facts one tap away from longer workflow guides.
          </p>
        </div>
        <QuickCardGrid
          cards={quickCards.referenceCards}
          activeKey={quickFilter}
          onToggle={setQuickFilterParam}
        />
      </section>

      <QuickCardGrid
        cards={quickCards.utilityCards}
        activeKey={quickFilter}
        className="md:grid-cols-2 xl:grid-cols-2"
        onToggle={setQuickFilterParam}
      />

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BookOpenTextIcon className="size-4 text-muted-foreground" />
              Browse knowledge base
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Search across titles, categories, authors, and guide text. Cards keep the personalized order inside your filters.
            </p>
          </div>
          {(search || activeCategory !== "All" || quickFilter) && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            id="guides-search"
            name="guides-search"
            placeholder="Search titles, categories, authors, and text..."
            value={search}
            onChange={(event) => setSearchParam(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {!guidesLoading && categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {["All", ...categories].map((category) => (
            <button
              key={category}
              onClick={() => setCategoryParam(category)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeCategory === category
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground",
              )}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {quickFilter && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Filtered by {quickCardLookup.get(quickFilter)?.title}</span>
          <Button variant="ghost" size="sm" onClick={() => setQuickFilterParam(null)}>
            Show all
          </Button>
        </div>
      )}

      {showContactsDirectory && (
        <LiveContactsDirectory
          users={filteredContactUsers}
          loading={contactsLoading}
          total={contactUsers?.total ?? 0}
          hasGuideResults={filtered.length > 0}
          search={search}
          roleFilter={contactRoleFilter}
          areaFilter={contactAreaFilter}
          hygieneFilter={contactHygieneFilter}
          onRoleFilterChange={setContactRoleFilter}
          onAreaFilterChange={setContactAreaFilter}
          onHygieneFilterChange={setContactHygieneFilter}
          stats={contactStats}
          canSeeContactHygiene={isStaffOrAdmin}
        />
      )}

      {guidesLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        showContactsDirectory ? null :
        search || activeCategory !== "All" || quickFilter ? (
          <EmptyState
            icon="search"
            title="No knowledge base entries match your filters"
            description="Try a different keyword, category, contact name, path fragment, or priority card."
            actionLabel="Clear filters"
            onAction={clearFilters}
          />
        ) : (
          <EmptyState
            icon="folder"
            title="No knowledge base entries yet"
            description={
              isStaffOrAdmin
                ? "Add the first contact list, server path, SOP, or general reference note."
                : "Check back later for Creative operations references."
            }
            actionLabel={isStaffOrAdmin ? "New Entry" : undefined}
            actionHref={isStaffOrAdmin ? "/guides/new" : undefined}
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      )}
    </div>
  );
}

function LiveContactsDirectory({
  users,
  loading,
  total,
  hasGuideResults,
  search,
  roleFilter,
  areaFilter,
  hygieneFilter,
  onRoleFilterChange,
  onAreaFilterChange,
  onHygieneFilterChange,
  stats,
  canSeeContactHygiene,
}: {
  users: ContactUser[];
  loading: boolean;
  total: number;
  hasGuideResults: boolean;
  search: string;
  roleFilter: ContactRoleFilter;
  areaFilter: ContactAreaFilter;
  hygieneFilter: ContactHygieneFilter;
  onRoleFilterChange: (value: ContactRoleFilter) => void;
  onAreaFilterChange: (value: ContactAreaFilter) => void;
  onHygieneFilterChange: (value: ContactHygieneFilter) => void;
  stats: {
    visible: number;
    total: number;
    missingPhone: number;
    missingSlack: number;
  };
  canSeeContactHygiene: boolean;
}) {
  const hasContactFilters =
    roleFilter !== "ALL" || areaFilter !== "ALL" || hygieneFilter !== "ALL";

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <PhoneIcon className="size-4 text-muted-foreground" />
            Team contacts
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pulled from active user profiles. Update someone&apos;s phone, title, area, or location on their user profile and this directory follows.
          </p>
        </div>
        {!loading && (
          <div className="flex flex-wrap items-center gap-2">
            {canSeeContactHygiene && stats.missingPhone > 0 && (
              <Badge variant="outline" className="tabular-nums">
                {stats.missingPhone} missing phone
              </Badge>
            )}
            {canSeeContactHygiene && stats.missingSlack > 0 && (
              <Badge variant="outline" className="tabular-nums">
                {stats.missingSlack} missing Slack
              </Badge>
            )}
            <Badge variant="secondary" className="tabular-nums">
              {stats.visible}/{total} shown
            </Badge>
          </div>
        )}
      </div>

      {!loading && (
        <ContactDirectoryFilters
          roleFilter={roleFilter}
          areaFilter={areaFilter}
          hygieneFilter={hygieneFilter}
          onRoleFilterChange={onRoleFilterChange}
          onAreaFilterChange={onAreaFilterChange}
          onHygieneFilterChange={onHygieneFilterChange}
          canSeeContactHygiene={canSeeContactHygiene}
        />
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
          {search.trim() || hasContactFilters
            ? "No active users match these Contacts filters."
            : "No active users are available for the live contact directory."}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => (
            <ContactCard key={user.id} user={user} />
          ))}
        </div>
      )}

      {hasGuideResults && (
        <p className="text-xs text-muted-foreground">
          Authored Contacts guides are listed below for vendor numbers, escalation notes, and anything that does not belong on a user profile.
        </p>
      )}
    </section>
  );
}

function ContactDirectoryFilters({
  roleFilter,
  areaFilter,
  hygieneFilter,
  onRoleFilterChange,
  onAreaFilterChange,
  onHygieneFilterChange,
  canSeeContactHygiene,
}: {
  roleFilter: ContactRoleFilter;
  areaFilter: ContactAreaFilter;
  hygieneFilter: ContactHygieneFilter;
  onRoleFilterChange: (value: ContactRoleFilter) => void;
  onAreaFilterChange: (value: ContactAreaFilter) => void;
  onHygieneFilterChange: (value: ContactHygieneFilter) => void;
  canSeeContactHygiene: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-md bg-muted/30 p-3 md:grid-cols-2 xl:grid-cols-3">
      <ContactFilterGroup
        label="Role"
        options={CONTACT_ROLE_FILTERS}
        value={roleFilter}
        onChange={onRoleFilterChange}
      />
      <ContactFilterGroup
        label="Area"
        options={CONTACT_AREA_FILTERS}
        value={areaFilter}
        onChange={onAreaFilterChange}
      />
      {canSeeContactHygiene && (
        <ContactFilterGroup
          label="Cleanup"
          options={CONTACT_HYGIENE_FILTERS}
          value={hygieneFilter}
          onChange={onHygieneFilterChange}
        />
      )}
    </div>
  );
}

function ContactFilterGroup<TValue extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: TValue; label: string }[];
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? "secondary" : "outline"}
            size="sm"
            className="h-10 rounded-md px-3 text-xs active:scale-[0.96] transition-transform"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ContactCard({ user }: { user: ContactUser }) {
  const subtitle = contactSubtitle(user);
  const area = formatArea(user.primaryArea);
  const slackHandle = displaySlackHandle(user.slackHandle);

  return (
    <article className="flex min-h-32 flex-col rounded-lg border bg-background p-4 transition-[border-color,box-shadow] hover:border-foreground/30 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <UserAvatar
          name={user.name}
          avatarUrl={user.avatarUrl}
          size="lg"
          className="shrink-0 ring-1 ring-border"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold leading-tight">
                {user.name}
              </h3>
              {subtitle && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {formatRole(user.role)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mt-4 grid flex-1 content-start gap-2 text-xs text-muted-foreground">
        <ContactLine icon={MailIcon} label={user.email} href={`mailto:${user.email}`} />
        <ContactLine
          icon={PhoneIcon}
          label={user.phone || "No phone on profile"}
          href={user.phone ? `tel:${user.phone.replace(/[^\d+]/g, "")}` : undefined}
        />
        <ContactLine
          icon={SlackIcon}
          label={slackHandle || (user.slackProfileUrl ? "Slack profile" : "No Slack on profile")}
          href={user.slackProfileUrl ?? undefined}
        />
        <div className="flex min-w-0 flex-wrap gap-2">
          {area && (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-muted px-2 py-1">
              <BriefcaseBusinessIcon className="size-3.5 shrink-0" />
              <span className="truncate">{area}</span>
            </span>
          )}
          {user.location && (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-muted px-2 py-1">
              <MapPinIcon className="size-3.5 shrink-0" />
              <span className="truncate">{user.location}</span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Button asChild variant="outline" size="sm" className="h-8 w-full justify-center">
          <Link href={`/users/${user.id}`}>View profile</Link>
        </Button>
      </div>
    </article>
  );
}

function ContactLine({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof PhoneIcon;
  label: string;
  href?: string;
}) {
  const content = (
    <>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </>
  );

  if (!href) {
    return <div className="flex min-w-0 items-center gap-2">{content}</div>;
  }

  return (
    <span
      className="flex min-w-0 items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
    >
      <a href={href} className="flex min-w-0 items-center gap-2">
        {content}
      </a>
    </span>
  );
}

function QuickCardGrid({
  cards,
  activeKey,
  className,
  onToggle,
}: {
  cards: Array<{
    key: QuickFilter;
    title: string;
    detail: string;
    count: number;
    icon: typeof PhoneIcon;
  }>;
  activeKey: QuickFilter | null;
  className?: string;
  onToggle: (key: QuickFilter) => void;
}) {
  return (
    <div className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-4", className)}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.key}
            role="button"
            tabIndex={0}
            elevation="flat"
            className={cn(
              "cursor-pointer border-border/60 transition-[border-color,background-color,scale] hover:border-foreground/30 hover:bg-muted/20 active:scale-[0.99]",
              activeKey === card.key && "border-foreground/40 bg-muted/30",
            )}
            onClick={() => onToggle(card.key)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggle(card.key);
              }
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{card.title}</span>
                </span>
                <Badge variant="secondary" className="tabular-nums">
                  {card.count}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="line-clamp-2 text-sm text-muted-foreground">{card.detail}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
