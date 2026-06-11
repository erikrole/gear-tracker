"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Role, ShiftArea } from "@prisma/client";
import {
  BriefcaseBusinessIcon,
  Building2Icon,
  CameraIcon,
  ClockIcon,
  FileTextIcon,
  FilterIcon,
  FolderTreeIcon,
  HardDriveIcon,
  LayersIcon,
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { OperationalActiveFilterChips, type OperationalActiveFilter } from "@/components/OperationalToolbar";
import { UserAvatar } from "@/components/UserAvatar";
import { useFetch } from "@/hooks/use-fetch";
import { getGuideFreshness } from "@/lib/guide-freshness";
import type { GuideListItem } from "@/lib/guides";
import { cn } from "@/lib/utils";
import {
  parseResourceFilter,
  parseResourceSort,
  type ResourceFilterKey as FilterKey,
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

type RailItem = {
  key: FilterKey;
  label: string;
  icon: typeof PhoneIcon;
  category?: string;
  area?: ShiftArea;
};

const AREA_FILTERS: RailItem[] = [
  { key: "area-video", label: "Video", icon: VideoIcon, area: ShiftArea.VIDEO },
  { key: "area-photo", label: "Photo", icon: CameraIcon, area: ShiftArea.PHOTO },
  { key: "area-graphics", label: "Graphics", icon: PaletteIcon, area: ShiftArea.GRAPHICS },
  { key: "area-comms", label: "Comms", icon: MessageSquareIcon, area: ShiftArea.COMMS },
];

const REFERENCE_FILTERS: RailItem[] = [
  { key: "contacts", label: "Contacts", icon: PhoneIcon, category: "contacts" },
  { key: "building-numbers", label: "Building Numbers", icon: Building2Icon, category: "building numbers" },
  { key: "media-drive", label: "Media Drive", icon: HardDriveIcon, category: "media drive" },
  { key: "server-paths", label: "Server Paths", icon: FolderTreeIcon, category: "server paths" },
];

const SMART_FILTERS: RailItem[] = [
  { key: "recent", label: "Recently Updated", icon: ClockIcon },
  { key: "my-area", label: "My Area", icon: TargetIcon },
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

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "personalized", label: "Personalized" },
  { value: "recent", label: "Recently updated" },
  { value: "title", label: "Title A-Z" },
];

function normalizeCategory(category: string) {
  return category.trim().toLowerCase();
}

function guideSearchText(guide: GuideListItem) {
  // Include the full body (markdown) so search matches document content, not
  // just title/category/author/summary. The body is already in the list
  // payload, and this mirrors the server-side `listGuides` search.
  return [guide.title, guide.category, guide.author.name, guide.summary, guide.markdown]
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

function hasSlackContact(user: ContactUser) {
  return Boolean(displaySlackHandle(user.slackHandle) || user.slackProfileUrl);
}

function displaySlackHandle(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().replace(/^@+/, "");
  return normalized ? `@${normalized}` : null;
}

function matchesFilter(guide: GuideListItem, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
    case "recent":
      return true;
    case "my-area":
      return guide.targetAreas.length > 0 && guide.personalizationReason !== "General";
    case "area-video":
      return guide.targetAreas.includes(ShiftArea.VIDEO);
    case "area-photo":
      return guide.targetAreas.includes(ShiftArea.PHOTO);
    case "area-graphics":
      return guide.targetAreas.includes(ShiftArea.GRAPHICS);
    case "area-comms":
      return guide.targetAreas.includes(ShiftArea.COMMS);
    case "contacts":
      return normalizeCategory(guide.category) === "contacts";
    case "building-numbers":
      return normalizeCategory(guide.category) === "building numbers";
    case "media-drive":
      return normalizeCategory(guide.category) === "media drive";
    case "server-paths":
      return normalizeCategory(guide.category) === "server paths";
  }
}

function countMatching(guides: GuideListItem[] | null, filter: FilterKey) {
  if (!guides) return 0;
  if (filter === "all") return guides.length;
  return guides.reduce((sum, g) => (matchesFilter(g, filter) ? sum + 1 : sum), 0);
}

function ResourceCard({ guide }: { guide: GuideListItem }) {
  const freshness = getGuideFreshness(guide);

  return (
    <Link
      href={`/resources/${guide.slug}`}
      className="group flex h-full flex-col rounded-lg border bg-card p-4 transition-[border-color,box-shadow,scale] hover:border-foreground/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.99]"
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
            <div className="flex shrink-0 flex-col items-end gap-1">
              {guide.featured && (
                <Badge variant="purple" className="text-[10px]">
                  Featured
                </Badge>
              )}
              {!guide.published && (
                <Badge variant="outline" className="text-[10px]">
                  Draft
                </Badge>
              )}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {guide.category}
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
        <span className="truncate">{guide.author.name}</span>
        <span className="shrink-0 tabular-nums">{formatShortDate(guide.updatedAt)}</span>
      </div>
    </Link>
  );
}

function RailButton({
  item,
  active,
  count,
  onSelect,
}: {
  item: RailItem;
  active: boolean;
  count: number;
  onSelect: (key: FilterKey) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.key)}
      className={cn(
        "flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] tabular-nums",
          active ? "bg-background text-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function RailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function CategoryButton({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-h-10 w-full items-center rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

function FilterRail({
  guides,
  contactsTotal,
  activeFilter,
  categories,
  activeCategory,
  onFilterSelect,
  onCategorySelect,
}: {
  guides: GuideListItem[] | null;
  contactsTotal: number;
  activeFilter: FilterKey;
  categories: string[];
  activeCategory: string;
  onFilterSelect: (key: FilterKey) => void;
  onCategorySelect: (category: string) => void;
}) {
  const allCount = guides?.length ?? 0;
  const allActive = activeFilter === "all" && activeCategory === "All";

  return (
    <nav aria-label="Resource filters" className="flex flex-col gap-3">
      <RailButton
        item={{ key: "all", label: "All resources", icon: LayersIcon }}
        active={allActive}
        count={allCount}
        onSelect={onFilterSelect}
      />

      <Separator />

      <RailSection title="Smart">
        {SMART_FILTERS.map((item) => (
          <RailButton
            key={item.key}
            item={item}
            active={activeFilter === item.key}
            count={countMatching(guides, item.key)}
            onSelect={onFilterSelect}
          />
        ))}
      </RailSection>

      <RailSection title="By area">
        {AREA_FILTERS.map((item) => (
          <RailButton
            key={item.key}
            item={item}
            active={activeFilter === item.key}
            count={countMatching(guides, item.key)}
            onSelect={onFilterSelect}
          />
        ))}
      </RailSection>

      <RailSection title="Reference">
        {REFERENCE_FILTERS.map((item) => {
          const count = item.key === "contacts" ? contactsTotal : countMatching(guides, item.key);
          return (
            <RailButton
              key={item.key}
              item={item}
              active={activeFilter === item.key}
              count={count}
              onSelect={onFilterSelect}
            />
          );
        })}
      </RailSection>

      {categories.length > 0 && (
        <RailSection title="All categories">
          {categories.map((category) => (
            <CategoryButton
              key={category}
              label={category}
              active={activeCategory === category}
              onSelect={() => onCategorySelect(category)}
            />
          ))}
        </RailSection>
      )}
    </nav>
  );
}

function getFilterLabel(filter: FilterKey) {
  if (filter === "all") return "All resources";
  const all = [...SMART_FILTERS, ...AREA_FILTERS, ...REFERENCE_FILTERS];
  return all.find((i) => i.key === filter)?.label ?? "Filtered";
}

export default function ResourcesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const activeCategory = searchParams.get("category") ?? "All";
  const activeFilter = parseResourceFilter(searchParams);
  const sort = parseResourceSort(searchParams.get("sort"));
  const [railOpen, setRailOpen] = useState(false);
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
    setRailOpen(false);
  };

  const setCategory = (category: string) => {
    replaceParams((params) => {
      params.delete("filter");
      params.delete("view");
      params.delete("area");
      if (category === "All") params.delete("category");
      else params.set("category", category);
    });
    setRailOpen(false);
  };

  const setSort = (value: SortKey) => {
    replaceParams((params) => {
      if (value === "personalized") params.delete("sort");
      else params.set("sort", value);
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

  const isStaffOrAdmin =
    meData?.role === Role.STAFF || meData?.role === Role.ADMIN;

  const { data: contactUsers, loading: contactsLoading } = useFetch<ContactUsersResponse>({
    url: "/api/users?limit=200&sort=name",
    refetchOnFocus: true,
    transform: (json) => json as unknown as ContactUsersResponse,
  });

  const showContactsDirectory =
    activeFilter === "contacts" || activeCategory === "Contacts";

  const categories = useMemo(() => {
    if (!guides) return [];
    const seen = new Set<string>();
    for (const guide of guides) seen.add(guide.category);
    return [...seen].sort();
  }, [guides]);

  const filtered = useMemo(() => {
    if (!guides) return [];
    const query = search.trim().toLowerCase();
    const base = guides.filter((guide) => {
      const matchesSearch = !query || guideSearchText(guide).includes(query);
      const matchesCategory = activeCategory === "All" || guide.category === activeCategory;
      return matchesSearch && matchesCategory && matchesFilter(guide, activeFilter);
    });
    if (sort === "recent" || activeFilter === "recent") {
      return [...base].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
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

  const clearAll = () => {
    router.replace(pathname, { scroll: false });
    setContactRoleFilter("ALL");
    setContactAreaFilter("ALL");
    setContactHygieneFilter("ALL");
  };

  const hasAnyFilter =
    Boolean(search) || activeCategory !== "All" || activeFilter !== "all" || sort !== "personalized";

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
          onRemove: () => setCategory("All"),
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

  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Personalized";

  const railProps = {
    guides,
    contactsTotal: contactUsers?.total ?? 0,
    activeFilter,
    categories,
    activeCategory,
    onFilterSelect: setFilter,
    onCategorySelect: setCategory,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Resources"
        description="Area guides, contacts, building numbers, Media Drive, server paths, and SOPs -- one searchable directory."
      >
        {isStaffOrAdmin && (
          <Button asChild size="sm" className="h-10">
            <Link href="/resources/new">
              <PlusIcon className="size-4 mr-1.5" />
              New Resource
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-lg border bg-card p-3">
            <FilterRail {...railProps} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="resources-search"
                name="resources-search"
                placeholder="Search titles, categories, authors, text..."
                value={search}
                onChange={(event) => setSearchParam(event.target.value)}
                className="h-10 pl-9"
              />
            </div>
            <Sheet open={railOpen} onOpenChange={setRailOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 lg:hidden">
                  <FilterIcon className="size-4 mr-1.5" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 overflow-y-auto p-4">
                <SheetHeader className="mb-3 p-0">
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription className="sr-only">
                    Filter resource guides by category, Creative area, role, publication state, and sort order.
                  </SheetDescription>
                </SheetHeader>
                <FilterRail {...railProps} />
              </SheetContent>
            </Sheet>
            <Select
              value={sort}
              onValueChange={(value) => setSort(value as SortKey)}
            >
              <SelectTrigger className="h-10 w-[180px]" aria-label="Sort resources">
                <span className="truncate">{sortLabel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {hasAnyFilter && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <OperationalActiveFilterChips filters={activeFilters} />
              <Button variant="ghost" size="sm" className="h-10" onClick={clearAll}>
                Clear all
              </Button>
              <span className="ml-auto tabular-nums">
                {filtered.length} {filtered.length === 1 ? "result" : "results"}
              </span>
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-40 rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            showContactsDirectory ? null : hasAnyFilter ? (
              <EmptyState
                icon="search"
                title="No resources match your filters"
                description="Try a different keyword, category, or filter."
                actionLabel="Clear filters"
                onAction={clearAll}
              />
            ) : (
              <EmptyState
                icon="folder"
                title="No resources yet"
                description={
                  isStaffOrAdmin
                    ? "Add the first contact list, server path, SOP, or general reference note."
                    : "Check back later for Creative operations references."
                }
                actionLabel={isStaffOrAdmin ? "New Resource" : undefined}
                actionHref={isStaffOrAdmin ? "/resources/new" : undefined}
              />
            )
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((guide) => (
                <ResourceCard key={guide.id} guide={guide} />
              ))}
            </div>
          )}
        </div>
      </div>
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
          Authored Contacts resources are listed below for vendor numbers, escalation notes, and anything that does not belong on a user profile.
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
        <Button asChild variant="outline" size="sm" className="h-10 w-full justify-center">
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
    return <div className="flex min-h-6 min-w-0 items-center gap-2">{content}</div>;
  }

  return (
    <span className="flex min-w-0 items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
      <a
        href={href}
        className="flex min-h-10 min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {content}
      </a>
    </span>
  );
}
