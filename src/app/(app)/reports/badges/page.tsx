"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MetricCard from "../MetricCard";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FadeUp } from "@/components/ui/motion";
import { useFetch } from "@/hooks/use-fetch";
import { formatDateFull } from "@/lib/format";
import {
  downloadReportCsv,
  ReportEmptyState,
  ReportErrorState,
  ReportExportButton,
  ReportListRow,
  ReportLoadingState,
  ReportMetaLine,
  ReportMetricGrid,
  ReportMobileCardLink,
  ReportSectionCard,
  ReportTableLink,
  ReportToolbar,
} from "../report-ui";

type BadgeLeaderboardRow = {
  userId: string;
  name: string;
  email: string | null;
  count: number;
};

type BadgeDistributionRow = {
  definitionId: string;
  key: string;
  name: string;
  category: string;
  active: boolean;
  count: number;
};

type RecentBadgeAward = {
  id: string;
  awardedAt: string;
  source: "AUTO" | "MANUAL";
  note: string | null;
  user: { id: string; name: string; email: string };
  definition: {
    id: string;
    key: string;
    name: string;
    category: string;
    icon: string;
    active: boolean;
  };
  awardedBy: { id: string; name: string } | null;
};

type BadgeReportData = {
  totalAwards: number;
  manualAwards: number;
  automaticAwards: number;
  recentAwardCount: number;
  activeDefinitionCount: number;
  leaderboard: BadgeLeaderboardRow[];
  distribution: BadgeDistributionRow[];
  recentAwards: RecentBadgeAward[];
};

const CATEGORY_VARIANTS: Record<string, BadgeProps["variant"]> = {
  CHECKOUT: "blue",
  ON_TIME: "green",
  SCAN: "purple",
  SHIFT: "orange",
  TRADE: "secondary",
  STREAK: "red",
  MILESTONE: "gray",
};

function categoryVariant(category: string): BadgeProps["variant"] {
  return CATEGORY_VARIANTS[category] ?? "gray";
}

function sourceVariant(source: RecentBadgeAward["source"]): BadgeProps["variant"] {
  return source === "MANUAL" ? "orange" : "secondary";
}

function downloadCsv(data: BadgeReportData) {
  downloadReportCsv("badges-report", [
    ["Awarded At", "User", "Badge", "Category", "Source", "Awarded By", "Note"],
    ...data.recentAwards.map((award) => [
      award.awardedAt,
      award.user.name,
      award.definition.name,
      award.definition.category,
      award.source,
      award.awardedBy?.name ?? "",
      award.note ?? "",
    ]),
  ]);
}

function RecentAwardMobileCard({ award }: { award: RecentBadgeAward }) {
  return (
    <ReportMobileCardLink href={`/users/${award.user.id}?tab=badges`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">{award.user.name}</span>
        <Badge variant={sourceVariant(award.source)}>{award.source.toLowerCase()}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={categoryVariant(award.definition.category)}>
          {award.definition.name}
        </Badge>
        {!award.definition.active && <Badge variant="gray">Retired</Badge>}
      </div>
      <ReportMetaLine
        className="text-sm"
        items={[
          formatDateFull(award.awardedAt),
          award.awardedBy ? `By ${award.awardedBy.name}` : "Automatic",
        ]}
      />
    </ReportMobileCardLink>
  );
}

export default function BadgeReportPage() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data, loading, error, lastRefreshed, reload } = useFetch<BadgeReportData>({
    url: "/api/reports/badges",
  });

  if (loading && !data) return <ReportLoadingState metricCount={4} rows={7} />;

  if (error && !data) {
    return (
      <ReportErrorState
        error={error}
        onRetry={reload}
        title="Failed to load badges report"
      />
    );
  }

  if (!data) return null;

  return (
    <FadeUp>
      <div className="flex flex-col gap-4">
        <ReportToolbar
          lastRefreshed={lastRefreshed}
          loading={loading}
          now={now}
          onRefresh={reload}
          exportAction={
            data.recentAwards.length > 0 ? (
              <ReportExportButton onClick={() => downloadCsv(data)} />
            ) : null
          }
        />

        <ReportMetricGrid>
          <MetricCard
            value={data.totalAwards}
            label="Total awards"
            tooltip="All earned badge rows currently stored"
          />
          <MetricCard
            value={data.recentAwardCount}
            label="Awards in 30d"
            tooltip="Badge awards created in the past 30 days"
          />
          <MetricCard
            value={data.activeDefinitionCount}
            label="Active definitions"
            tooltip="Badge definitions available in the active catalog"
          />
          <MetricCard
            value={data.manualAwards}
            label="Manual awards"
            badge={{ text: `${data.automaticAwards} auto`, variant: "secondary" }}
            tooltip="Manual awards created by admins"
          />
        </ReportMetricGrid>

        <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <ReportSectionCard title="Leaderboard" contentClassName="p-0">
            {data.leaderboard.length === 0 ? (
              <ReportEmptyState
                compact
                icon="users"
                title="No badge leaders yet"
                description="Users appear here after badges are awarded."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Awards</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.leaderboard.map((row, index) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {index === 0 && data.leaderboard.length > 1 ? (
                            <Badge variant="green" size="sm">Top</Badge>
                          ) : null}
                          <ReportTableLink href={`/users/${row.userId}?tab=badges`}>
                            {row.name}
                          </ReportTableLink>
                        </div>
                        {row.email ? (
                          <div className="text-xs text-muted-foreground">{row.email}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="tabular-nums">
                          {row.count}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ReportSectionCard>

          <ReportSectionCard title="Distribution" contentClassName="p-0">
            {data.distribution.length === 0 ? (
              <ReportEmptyState
                compact
                icon="chart"
                title="No badge distribution yet"
                description="Award counts by badge appear after the first awards are earned."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Badge</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Awards</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.distribution.map((row) => (
                    <TableRow key={row.definitionId}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.key}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={categoryVariant(row.category)}>{row.category.toLowerCase()}</Badge>
                          {!row.active && <Badge variant="gray">Retired</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="tabular-nums">
                          {row.count}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ReportSectionCard>
        </div>

        <ReportSectionCard title="Recent awards" contentClassName="p-0">
          {data.recentAwards.length === 0 ? (
            <ReportEmptyState
              icon="check"
              title="No badge awards yet"
              description="Recent automatic and manual awards will appear here after badge events run."
            />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Badge</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Awarded</TableHead>
                      <TableHead>Awarded by</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentAwards.map((award) => (
                      <TableRow key={award.id}>
                        <TableCell>
                          <ReportTableLink href={`/users/${award.user.id}?tab=badges`}>
                            {award.user.name}
                          </ReportTableLink>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={categoryVariant(award.definition.category)}>
                              {award.definition.name}
                            </Badge>
                            {!award.definition.active && <Badge variant="gray">Retired</Badge>}
                          </div>
                          {award.note ? (
                            <div className="mt-1 max-w-[28rem] truncate text-xs text-muted-foreground">
                              {award.note}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sourceVariant(award.source)}>
                            {award.source.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDateFull(award.awardedAt)}</TableCell>
                        <TableCell>{award.awardedBy?.name ?? "Automatic"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden">
                {data.recentAwards.map((award) => (
                  <RecentAwardMobileCard key={award.id} award={award} />
                ))}
              </div>
            </>
          )}
        </ReportSectionCard>

        <ReportSectionCard title="Operational notes">
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <ReportListRow className="min-h-0 px-0 py-2">
              <span>Primary profile experience</span>
              <Link href="/users" className="font-medium text-foreground underline-offset-4 hover:underline">
                User profile badges tab
              </Link>
            </ReportListRow>
            <ReportListRow className="min-h-0 px-0 py-2">
              <span>Staff action surface</span>
              <span className="font-medium text-foreground">User Admin actions menu</span>
            </ReportListRow>
          </div>
        </ReportSectionCard>
      </div>
    </FadeUp>
  );
}
