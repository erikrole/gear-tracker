"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { MoreHorizontal, ExternalLink, Copy, Wrench, Archive, Package } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { Asset } from "../columns";
import { statusBadge } from "../columns";

export function ItemCard({
  item,
  selected,
  onSelectChange,
  canEdit,
  onRowAction,
}: {
  item: Asset;
  selected: boolean;
  onSelectChange: (checked: boolean) => void;
  canEdit: boolean;
  onRowAction?: (action: string, asset: Asset) => void;
}) {
  const router = useRouter();
  const subtitle = [item.brand, item.model].filter(Boolean).join(" ");

  return (
    <div
      className="flex items-start gap-3 px-3 py-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors min-h-[56px]"
      onClick={() => router.push(`/items/${item.id}`)}
    >
      {canEdit && (
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onSelectChange(!!v)}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 shrink-0"
          aria-label={`Select ${item.assetTag}`}
        />
      )}

      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt={item.assetTag}
          width={40}
          height={40}
          className="size-10 rounded-md object-cover shrink-0"
          unoptimized={!item.imageUrl.includes(".public.blob.vercel-storage.com")}
        />
      ) : (
        <div className="size-10 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Package className="size-4 text-muted-foreground" />
        </div>
      )}

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm truncate">{item.assetTag}</span>
              {(item._count?.accessories ?? 0) > 0 && (
                <Badge variant="secondary" size="sm" className="shrink-0 rounded-sm px-1 font-normal">
                  +{item._count!.accessories}
                </Badge>
              )}
            </div>
            {subtitle && (
              <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-1">
            {statusBadge(item)}
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-3.5" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => onRowAction?.("open", item)}>
                    <ExternalLink className="mr-2 size-4" />
                    Open
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onRowAction?.("duplicate", item)}>
                    <Copy className="mr-2 size-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onRowAction?.("maintenance", item)}>
                    <Wrench className="mr-2 size-4" />
                    Maintenance
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onRowAction?.("retire", item)}
                  >
                    <Archive className="mr-2 size-4" />
                    Retire
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.category?.name && <span>{item.category.name}</span>}
          {item.category?.name && item.location?.name && <span>·</span>}
          {item.location?.name && <span>{item.location.name}</span>}
        </div>
      </div>
    </div>
  );
}
