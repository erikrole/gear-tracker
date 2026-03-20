"use client";

import Link from "next/link";
import {
  SearchIcon,
  CalendarIcon,
  BoxIcon,
  ClipboardCheckIcon,
  BellIcon,
  UsersIcon,
  FolderIcon,
  BarChart3Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

type EmptyStateProps = {
  icon?: "search" | "calendar" | "box" | "clipboard" | "bell" | "users" | "folder" | "chart";
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
};

const iconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  search: SearchIcon,
  calendar: CalendarIcon,
  box: BoxIcon,
  clipboard: ClipboardCheckIcon,
  bell: BellIcon,
  users: UsersIcon,
  folder: FolderIcon,
  chart: BarChart3Icon,
};

export default function EmptyState({
  icon = "box",
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  const Icon = iconMap[icon] ?? BoxIcon;
  return (
    <Empty className="border-0 py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon className="size-6 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {actionLabel && actionHref && (
        <Button size="sm" asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button size="sm" onClick={onAction}>{actionLabel}</Button>
      )}
    </Empty>
  );
}
