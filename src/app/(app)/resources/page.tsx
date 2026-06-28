"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ResourceType, Role, ShiftArea } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  BookOpenIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  ClipboardListIcon,
  FileTextIcon,
  FolderTreeIcon,
  HardDriveIcon,
  LayoutGridIcon,
  ListIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  SlackIcon,
  SparklesIcon,
  UsersIcon,
  VideoIcon,
  WrenchIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import {
  OperationalActiveFilterChips,
  OperationalToolbar,
  type OperationalActiveFilter,
} from "@/components/OperationalToolbar";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFetch } from "@/hooks/use-fetch";
import {
  inferResourceTypeFromCategory,
  RESOURCE_TYPE_DESCRIPTIONS,
  RESOURCE_TYPE_LABELS,
} from "@/lib/guide-categories";
import { getGuideFreshness } from "@/lib/guide-freshness";
import type { GuideListItem } from "@/lib/guides";
import { cn } from "@/lib/utils";
import {
  parseResourceFilter,
  parseResourceLayout,
  parseResourceSort,
  type ResourceFilterKey as FilterKey,
  type ResourceLayoutKey as LayoutKey,
  type ResourceSortKey as SortKey,
} from "./filters";

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

type ScopeOption = {
  value: FilterKey;
  label: string;
  description?: string;
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "personalized", label: "Recommended" },
  { value: "recent", label: "Recently updated" },
  { value: "title", label: "Title A-Z" },
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

const RESOURCE_TYPE_FILTERS: { key: FilterKey; type: ResourceType; icon: LucideIcon }[] = [
  { key: "contacts", type: ResourceType.CONTACTS, icon: PhoneIcon },
  { key: "building-numbers", type: ResourceType.BUILDING_NUMBERS, icon: Building2Icon },
  { key: "media-drive", type: ResourceType.MEDIA_DRIVE, icon: HardDriveIcon },
  { key: "server-paths", type: ResourceType.SERVER_PATHS, icon: FolderTreeIcon },
  { key: "sop", type: ResourceType.SOP, icon: ClipboardListIcon },
  { key: "how-to", type: ResourceType.HOW_TO, icon: BookOpenIcon },
  { key: "troubleshooting", type: ResourceType.TROUBLESHOOTING, icon: WrenchIcon },
  { key: "account-note", type: ResourceType.ACCOUNT_NOTE, icon: BriefcaseBusinessIcon },
  { key: "event-ops", type: ResourceType.EVENT_OPS, icon: VideoIcon },
  { key: "general", type: ResourceType.GENERAL, icon: FileTextIcon },
];

const AREA_FILTERS: (ScopeOption & { area: ShiftArea })[] = [
  { value: "area-video", label: "Video", area: ShiftArea.VIDEO },
  { value: "area-photo", label: "Photo", area: ShiftArea.PHOTO },
  { value: "area-graphics", label: "Graphics", area: ShiftArea.GRAPHICS },
  { value: "area-comms", label: "Comms", area: ShiftArea.COMMS },
];

const SMART_FILTERS: ScopeOption[] = [
  { value: "all", label: "All guides" },
  { value: "recent", label: "Recently updated" },
  { value: "my-area", label: "My area" },
];

const SCOPE_OPTIONS: ScopeOption[] = [
  ...SMART_FILTERS,
  ...RESOURCE_TYPE_FILTERS.map((item) => ({
    value: item.key,
    label: RESOURCE_TYPE_LABELS[item.type],
    description: RESOURCE_TYPE_DESCRIPTIONS[item.type],
  })),
  ...AREA_FILTERS,
];

function resourceTypeOf(guide: GuideListItem) {
  return guide.type ?? inferResourceTypeFromCategory(guide.category);
}

function guideSearchText(guide: GuideListItem) {
  return [
    guide.title,
    guide.category,
    RESOURCE_TYPE_LABELS[resourceTypeOf(guide)],
    guide.author.name,
    guide.summary,
    guide.markdown,
  ].join(" ").toLowerCase();
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

function formatFullDate(value: Date | string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
  return user.role === Role.STUDENT ? formatStudentYear(user) : user.title;
}

function displaySlackHandle(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().replace(/^@+/, "");
  return normalized ? `@${normalized}` : null;
}

function hasSlackContact(user: ContactUser) {
  return Boolean(displaySlackHandle(user.slackHandle) || user.slackProfileUrl);
}

function typeForFilter(filter: FilterKey) {
  return RESOURCE_TYPE_FILTERS.find((item) => item.key === filter)?.type ?? null;
}

function areaForFilter(filter: FilterKey) {
  return AREA_FILTERS.find((item) => item.value === filter)?.area ?? null;
}

function matchesFilter(guide: GuideListItem, filter: FilterKey): boolean {
  if (filter === "all" || filter === "recent") return true;
  if (filter === "my-area") {
    return guide.targetAreas.length > 0 && guide.personalizationReason !== "General";
  }
  const area = areaForFilter(filter);
  if (area) return guide.targetAreas.includes(area);
  const type = typeForFilter(filter);
  if (type) return resourceTypeOf(guide) === type;
  return true;
}

function countMatching(guides: GuideListItem[] | null, filter: FilterKey) {
  if (!guides) return 0;
  if (filter === "all") return guides.length;
  return guides.reduce((sum, guide) => (matchesFilter(guide, filter) ? sum + 1 : sum), 0);
}

function getFilterLabel(filter: FilterKey) {
  return SCOPE_OPTIONS.find((option) => option.value === filter)?.label ?? "Filtered";
}

function audienceLabel(guide: GuideListItem) {
  if (guide.targetRoles.length === 0 && guide.targetAreas.length === 0) return "Everyone";
  const parts = [
    ...guide.targetRoles.map(formatRole),
    ...guide.targetAreas.map((area) => formatArea(area) ?? area),
  ];
  return parts.join(", ");
}

function ResourcesSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-44 rounded-lg" />
      ))}
    </div>
  );
}

function ResourceTypeIcon({ type, className }: { type: ResourceType; className?: string }) {
  const Icon = RESOURCE_TYPE_FILTERS.find((item) => item.type === type)?.icon ?? FileTextIcon;
  return <Icon className={cn("size-4", className)} aria-hidden="true" />;
}

function GuideCard({ guide, compact = false }: { guide: GuideListItem; compact?: boolean }) {
  const type = resourceTypeOf(guide);
  const freshness = getGuideFreshness(guide);

  return (
    <Link
      href={`/resources/${guide.slug}`}
      className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card
        elevation="flat"
        className={cn(
          "h-full min-h-44 transition-[border-color,box-shadow,scale] group-hover:border-foreground/30 group-hover:shadow-sm group-active:scale-[0.99]",
          compact && "min-h-36",
        )}
      >
        <CardHeader className="gap-3 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {guide.featured ? (
                <SparklesIcon className="size-4" aria-hidden="true" />
              ) : (
                <ResourceTypeIcon type={type} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="line-clamp-2 text-sm leading-snug text-foreground">
                {guide.title}
              </CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" size="sm">
                  {RESOURCE_TYPE_LABELS[type]}
                </Badge>
                {!guide.published && (
                  <Badge variant="outline" size="sm">
                    Draft
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-0">
          {!compact && (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground text-pretty">
              {guide.summary || "No preview text yet."}
            </p>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <Badge
              variant={freshness.status === "verified" ? "green" : "orange"}
              size="sm"
              title={freshness.detail}
            >
              {freshness.label}
            </Badge>
            <span className="text-xs text-muted-foreground">{audienceLabel(guide)}</span>
          </div>
        </CardContent>

        <CardFooter className="justify-between gap-3 px-4 pb-4 pt-0 text-xs text-muted-foreground">
          <span className="truncate">By {guide.author.name}</span>
          <span className="shrink-0 tabular-nums" title={`Updated ${formatFullDate(guide.updatedAt)}`}>
            {formatShortDate(guide.updatedAt)}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}

function GuideListRow({ guide }: { guide: GuideListItem }) {
  const type = resourceTypeOf(guide);
  const freshness = getGuideFreshness(guide);

  return (
    <Link
      href={`/resources/${guide.slug}`}
      className="group grid min-h-24 gap-3 rounded-lg border bg-card p-4 text-card-foreground transition-[border-color,box-shadow,scale] hover:border-foreground/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.99] md:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="flex min-w-0 gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <ResourceTypeIcon type={type} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="line-clamp-1 text-sm font-semibold text-foreground">{guide.title}</h3>
            {!guide.published && (
              <Badge variant="outline" size="sm">
                Draft
              </Badge>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground text-pretty">
            {guide.summary || "No preview text yet."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <Badge variant="secondary" size="sm">
          {RESOURCE_TYPE_LABELS[type]}
        </Badge>
        <Badge
          variant={freshness.status === "verified" ? "green" : "orange"}
          size="sm"
          title={freshness.detail}
        >
          {freshness.label}
        </Badge>
        <span className="text-xs text-muted-foreground tabular-nums">{formatShortDate(guide.updatedAt)}</span>
      </div>
    </Link>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function GuideResults({
  guides,
  layout,
  compact = false,
}: {
  guides: GuideListItem[];
  layout: LayoutKey;
  compact?: boolean;
}) {
  if (layout === "list") {
    return (
      <div className="flex flex-col gap-2">
        {guides.map((guide) => (
          <GuideListRow key={guide.id} guide={guide} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {guides.map((guide) => (
        <GuideCard key={guide.id} guide={guide} compact={compact} />
      ))}
    </div>
  );
}

function GuideCollectionTiles({
  guides,
  contactCount,
  activeFilter,
  onSelect,
}: {
  guides: GuideListItem[] | null;
  contactCount: number;
  activeFilter: FilterKey;
  onSelect: (filter: FilterKey) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title="Guide collections"
        description="Start with the focus area, then drill into the smaller Guides that replaced the master doc."
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {RESOURCE_TYPE_FILTERS.map((item) => {
          const authoredCount = countMatching(guides, item.key);
          const count = item.type === ResourceType.CONTACTS ? authoredCount + contactCount : authoredCount;
          const active = activeFilter === item.key;
          const Icon = item.icon;
          return (
            <Button
              key={item.key}
              type="button"
              variant={active ? "secondary" : "outline"}
              className="h-auto min-h-24 justify-start p-3 text-left"
              onClick={() => onSelect(item.key)}
            >
              <span className="flex min-w-0 flex-col gap-2">
                <span className="flex items-center gap-2">
                  <Icon data-icon="inline-start" />
                  <span className="truncate font-semibold">{RESOURCE_TYPE_LABELS[item.type]}</span>
                </span>
                <span className="line-clamp-2 text-xs font-normal text-muted-foreground text-pretty">
                  {RESOURCE_TYPE_DESCRIPTIONS[item.type]}
                </span>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {count} {item.type === ResourceType.CONTACTS
                    ? count === 1 ? "reference" : "references"
                    : count === 1 ? "guide" : "guides"}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}

function AreaGuideLanes({
  guides,
  layout,
  onSelect,
}: {
  guides: GuideListItem[];
  layout: LayoutKey;
  onSelect: (filter: FilterKey) => void;
}) {
  const lanes = AREA_FILTERS.map((option) => {
    const areaGuides = guides.filter((guide) => guide.targetAreas.includes(option.area));
    return { ...option, guides: areaGuides.slice(0, 3), total: areaGuides.length };
  }).filter((lane) => lane.total > 0);

  if (lanes.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Area guide lanes"
        description="Focused Guides grouped by the Creative area they support."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        {lanes.map((lane) => (
          <section key={lane.value} className="flex min-w-0 flex-col gap-3">
            <SectionHeader
              title={`${lane.label} guides`}
              description={`${lane.total} ${lane.total === 1 ? "guide" : "guides"} targeted to ${lane.label}.`}
              action={(
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={() => onSelect(lane.value)}
                >
                  View all
                </Button>
              )}
            />
            <GuideResults guides={lane.guides} layout={layout} compact />
          </section>
        ))}
      </div>
    </section>
  );
}

export default function ResourcesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const activeCategory = searchParams.get("category") ?? "All";
  const activeFilter = parseResourceFilter(searchParams);
  const sort = parseResourceSort(searchParams.get("sort"));
  const layout = parseResourceLayout(searchParams.get("layout"));
  const [contactRoleFilter, setContactRoleFilter] = useState<ContactRoleFilter>("ALL");
  const [contactAreaFilter, setContactAreaFilter] = useState<ContactAreaFilter>("ALL");
  const [contactHygieneFilter, setContactHygieneFilter] = useState<ContactHygieneFilter>("ALL");

  const replaceParams = (mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams.toString());
    mutate(next);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const setSearchParam = (value: string) => {
    replaceParams((params) => {
      const trimmed = value.trimStart();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
    });
  };

  const setFilter = (key: FilterKey) => {
    replaceParams((params) => {
      params.delete("category");
      params.delete("view");
      params.delete("area");
      if (key === "all") params.delete("filter");
      else params.set("filter", key);
    });
  };

  const setSort = (value: SortKey) => {
    replaceParams((params) => {
      if (value === "personalized") params.delete("sort");
      else params.set("sort", value);
    });
  };

  const setLayout = (value: LayoutKey) => {
    replaceParams((params) => {
      if (value === "cards") params.delete("layout");
      else params.set("layout", value);
    });
  };

  const { data: guides, loading: guidesLoading } = useFetch<GuideListItem[]>({
    url: "/api/resources",
    transform: (json) => (json as { data: GuideListItem[] }).data ?? [],
  });

  const { data: meData } = useFetch<MeResponse>({
    url: "/api/me",
    transform: (json) => (json as { user: MeResponse }).user,
  });

  const isStaffOrAdmin = meData?.role === Role.STAFF || meData?.role === Role.ADMIN;

  const { data: contactUsers, loading: contactsLoading } = useFetch<ContactUsersResponse>({
    url: "/api/users?limit=200&sort=name",
    refetchOnFocus: true,
    transform: (json) => json as unknown as ContactUsersResponse,
  });

  const filtered = useMemo(() => {
    if (!guides) return [];
    const query = search.trim().toLowerCase();
    const base = guides.filter((guide) => {
      const matchesSearch = !query || guideSearchText(guide).includes(query);
      const matchesCategory = activeCategory === "All" || guide.category === activeCategory;
      return matchesSearch && matchesCategory && matchesFilter(guide, activeFilter);
    });
    if (sort === "recent" || activeFilter === "recent") {
      return [...base].sort((a, b) => (
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ));
    }
    if (sort === "title") {
      return [...base].sort((a, b) => a.title.localeCompare(b.title));
    }
    return base;
  }, [guides, search, activeCategory, activeFilter, sort]);

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

  const activeFilters: OperationalActiveFilter[] = [
    ...(activeFilter !== "all"
      ? [{
          key: "filter",
          label: getFilterLabel(activeFilter),
          onRemove: () => setFilter("all"),
        }]
      : []),
    ...(activeCategory !== "All"
      ? [{
          key: "category",
          label: activeCategory,
          onRemove: () => {
            replaceParams((params) => params.delete("category"));
          },
        }]
      : []),
    ...(search
      ? [{
          key: "search",
          label: `"${search}"`,
          onRemove: () => setSearchParam(""),
        }]
      : []),
    ...(sort !== "personalized"
      ? [{
          key: "sort",
          label: SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Custom sort",
          onRemove: () => setSort("personalized"),
        }]
      : []),
  ];

  const clearAll = () => {
    router.replace(pathname, { scroll: false });
    setContactRoleFilter("ALL");
    setContactAreaFilter("ALL");
    setContactHygieneFilter("ALL");
  };

  const hasAnyFilter =
    Boolean(search) || activeCategory !== "All" || activeFilter !== "all" || sort !== "personalized";
  const homeView = !hasAnyFilter;
  const totalGuides = guides?.length ?? 0;
  const featuredGuides = homeView
    ? filtered.filter((guide) => guide.featured).slice(0, 6)
    : [];
  const recentGuides = homeView
    ? [...filtered].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 6)
    : [];
  const contactDirectoryVisible =
    activeFilter === "contacts" ||
    homeView ||
    (Boolean(search.trim()) && filteredContactUsers.length > 0);
  const contactDirectoryCompact = activeFilter !== "contacts" && !search.trim();

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Resources"
        description="Focused Creative Guides broken out by area, workflow, contact set, path, and operating reference."
      >
        {isStaffOrAdmin && (
          <Button asChild size="sm" className="h-10">
            <Link href="/resources/new">
              <PlusIcon data-icon="inline-start" />
              New guide
            </Link>
          </Button>
        )}
      </PageHeader>

      <OperationalToolbar aria-label="Guide search and filters">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="resources-search"
              name="resources-search"
              placeholder="Search guides, contacts, paths, workflows, and notes..."
              value={search}
              onChange={(event) => setSearchParam(event.target.value)}
              className="h-10 pl-9"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:shrink-0">
            <Select value={activeFilter} onValueChange={(value) => setFilter(value as FilterKey)}>
              <SelectTrigger className="h-10 lg:w-[210px]" aria-label="Guide focus">
                <SelectValue placeholder="All guides" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Smart</SelectLabel>
                  {SMART_FILTERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Guide focus</SelectLabel>
                  {RESOURCE_TYPE_FILTERS.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {RESOURCE_TYPE_LABELS[item.type]}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Creative area</SelectLabel>
                  {AREA_FILTERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger className="h-10 lg:w-[180px]" aria-label="Sort guides">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Sort</SelectLabel>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <ToggleGroup
              type="single"
              value={layout}
              onValueChange={(value) => {
                if (value) setLayout(value as LayoutKey);
              }}
              className="min-h-10 justify-self-start [&_svg]:size-4"
              aria-label="Guide layout"
            >
              <ToggleGroupItem value="cards" aria-label="Cards" className="min-h-9 px-3">
                <LayoutGridIcon aria-hidden="true" />
                <span className="hidden sm:inline">Cards</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List" className="min-h-9 px-3">
                <ListIcon aria-hidden="true" />
                <span className="hidden sm:inline">List</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {(activeFilters.length > 0 || hasAnyFilter) && (
          <div className="flex flex-wrap items-center gap-2">
            <OperationalActiveFilterChips filters={activeFilters} />
            {hasAnyFilter && (
              <Button variant="ghost" size="sm" className="h-10" onClick={clearAll}>
                Clear all
              </Button>
            )}
            {!guidesLoading && (
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {filtered.length} of {totalGuides} guides
              </span>
            )}
          </div>
        )}
      </OperationalToolbar>

      {homeView && (
        <GuideCollectionTiles
          guides={guides}
          contactCount={contactUsers?.total ?? contactUsers?.data?.length ?? 0}
          activeFilter={activeFilter}
          onSelect={setFilter}
        />
      )}

      {guidesLoading ? (
        <ResourcesSkeleton />
      ) : filtered.length === 0 && !homeView ? (
        <>
          {contactDirectoryVisible && (
            <LiveContactsDirectory
              users={filteredContactUsers}
              loading={contactsLoading}
              total={contactUsers?.total ?? 0}
              search={search}
              roleFilter={contactRoleFilter}
              areaFilter={contactAreaFilter}
              hygieneFilter={contactHygieneFilter}
              onRoleFilterChange={setContactRoleFilter}
              onAreaFilterChange={setContactAreaFilter}
              onHygieneFilterChange={setContactHygieneFilter}
              stats={contactStats}
              canSeeContactHygiene={isStaffOrAdmin}
              compact={contactDirectoryCompact}
              onShowAll={() => setFilter("contacts")}
            />
          )}
          <EmptyState
            icon="search"
            title="No guides match this view"
            description="Try a different keyword, focus area, Creative area, or sort."
            actionLabel="Clear filters"
            onAction={clearAll}
          />
        </>
      ) : homeView ? (
        <div className="flex flex-col gap-8">
          {featuredGuides.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Featured guides"
                description="Curated breakouts worth keeping close."
              />
              <GuideResults guides={featuredGuides} layout={layout} />
            </section>
          )}

          <AreaGuideLanes guides={filtered} layout={layout} onSelect={setFilter} />

          {recentGuides.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Recently updated"
                description="Fresh guide edits and recently verified references."
                action={(
                  <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => setFilter("recent")}>
                    View recent
                  </Button>
                )}
              />
              <GuideResults guides={recentGuides} layout={layout} compact />
            </section>
          )}

          {contactDirectoryVisible && (
            <LiveContactsDirectory
              users={filteredContactUsers}
              loading={contactsLoading}
              total={contactUsers?.total ?? 0}
              search={search}
              roleFilter={contactRoleFilter}
              areaFilter={contactAreaFilter}
              hygieneFilter={contactHygieneFilter}
              onRoleFilterChange={setContactRoleFilter}
              onAreaFilterChange={setContactAreaFilter}
              onHygieneFilterChange={setContactHygieneFilter}
              stats={contactStats}
              canSeeContactHygiene={isStaffOrAdmin}
              compact={contactDirectoryCompact}
              onShowAll={() => setFilter("contacts")}
            />
          )}

          <section className="flex flex-col gap-3">
            <SectionHeader
              title="All guides"
              description="Every published and draft Guide you can access."
            />
            {filtered.length > 0 ? (
              <GuideResults guides={filtered} layout={layout} />
            ) : (
              <EmptyState
                inline
                icon="folder"
                title="No guides yet"
                description="Create focused Guides from the current master doc as each area is ready."
              />
            )}
          </section>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {contactDirectoryVisible && (
            <LiveContactsDirectory
              users={filteredContactUsers}
              loading={contactsLoading}
              total={contactUsers?.total ?? 0}
              search={search}
              roleFilter={contactRoleFilter}
              areaFilter={contactAreaFilter}
              hygieneFilter={contactHygieneFilter}
              onRoleFilterChange={setContactRoleFilter}
              onAreaFilterChange={setContactAreaFilter}
              onHygieneFilterChange={setContactHygieneFilter}
              stats={contactStats}
              canSeeContactHygiene={isStaffOrAdmin}
              compact={contactDirectoryCompact}
              onShowAll={() => setFilter("contacts")}
            />
          )}
          <section className="flex flex-col gap-3">
            <SectionHeader
              title={getFilterLabel(activeFilter)}
              description={
                activeFilter === "contacts"
                  ? "Authored contact Guides are listed here. Live team contacts stay alongside them."
                  : "Filtered Guides from the library."
              }
            />
            <GuideResults guides={filtered} layout={layout} />
          </section>
        </div>
      )}
    </div>
  );
}

function LiveContactsDirectory({
  users,
  loading,
  total,
  search,
  roleFilter,
  areaFilter,
  hygieneFilter,
  onRoleFilterChange,
  onAreaFilterChange,
  onHygieneFilterChange,
  stats,
  canSeeContactHygiene,
  compact,
  onShowAll,
}: {
  users: ContactUser[];
  loading: boolean;
  total: number;
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
  compact: boolean;
  onShowAll: () => void;
}) {
  const shownUsers = compact ? users.slice(0, 6) : users;
  const hasContactFilters = roleFilter !== "ALL" || areaFilter !== "ALL" || hygieneFilter !== "ALL";

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <UsersIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            Team contacts
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">
            Profile-backed contacts support the Guide library without duplicating phone and Slack details in Markdown.
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
              {compact ? Math.min(users.length, 6) : stats.visible}/{total} shown
            </Badge>
          </div>
        )}
      </div>

      {!compact && !loading && (
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
          {Array.from({ length: compact ? 3 : 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : shownUsers.length === 0 ? (
        <EmptyState
          inline
          icon="users"
          title="No contacts match this view"
          description={
            search.trim() || hasContactFilters
              ? "Try a different contact search or filter."
              : "No active users are available for the live contact directory."
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shownUsers.map((user) => (
            <ContactCard key={user.id} user={user} />
          ))}
        </div>
      )}

      {compact && users.length > 6 && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" className="h-10" onClick={onShowAll}>
            Show all contacts
          </Button>
        </div>
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
      <ContactSelect
        label="Role"
        value={roleFilter}
        options={CONTACT_ROLE_FILTERS}
        onChange={onRoleFilterChange}
      />
      <ContactSelect
        label="Area"
        value={areaFilter}
        options={CONTACT_AREA_FILTERS}
        onChange={onAreaFilterChange}
      />
      {canSeeContactHygiene && (
        <ContactSelect
          label="Cleanup"
          value={hygieneFilter}
          options={CONTACT_HYGIENE_FILTERS}
          onChange={onHygieneFilterChange}
        />
      )}
    </div>
  );
}

function ContactSelect<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: { value: TValue; label: string }[];
  onChange: (value: TValue) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <Select value={value} onValueChange={(next) => onChange(next as TValue)}>
        <SelectTrigger className="h-10 bg-background text-foreground" aria-label={`${label} contact filter`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{label}</SelectLabel>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  );
}

function ContactCard({ user }: { user: ContactUser }) {
  const subtitle = contactSubtitle(user);
  const area = formatArea(user.primaryArea);
  const slackHandle = displaySlackHandle(user.slackHandle);

  return (
    <Card elevation="flat" className="min-h-32 transition-[border-color,box-shadow] hover:border-foreground/30 hover:shadow-sm">
      <CardHeader className="p-4 pb-0">
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
                <CardTitle className="truncate text-sm leading-tight">{user.name}</CardTitle>
                {subtitle && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
                )}
              </div>
              <Badge variant="secondary" size="sm" className="shrink-0">
                {formatRole(user.role)}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid flex-1 content-start gap-2 p-4 text-xs text-muted-foreground">
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
              <BriefcaseBusinessIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{area}</span>
            </span>
          )}
          {user.location && (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-muted px-2 py-1">
              <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{user.location}</span>
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="px-4 pb-4 pt-0">
        <Button asChild variant="outline" size="sm" className="h-10 w-full justify-center">
          <Link href={`/users/${user.id}`}>View profile</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function ContactLine({
  icon: Icon,
  label,
  href,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
}) {
  const content = (
    <>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </>
  );

  if (!href) {
    return <div className="flex min-h-6 min-w-0 items-center gap-2">{content}</div>;
  }

  return (
    <a
      href={href}
      className="flex min-h-10 min-w-0 items-center gap-2 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {content}
    </a>
  );
}
