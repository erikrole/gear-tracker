"use client";

import { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import { StarIcon, ImageIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "./status-dot";

export type ActiveBooking = {
  id: string;
  kind: string;
  title: string;
  requesterName: string;
};

export type Asset = {
  id: string;
  assetTag: string;
  name: string | null;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  computedStatus: string;
  location: { id: string; name: string };
  category: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  imageUrl: string | null;
  activeBooking: ActiveBooking | null;
  _count?: { accessories: number };
};

type ColumnMeta = {
  favoriteIds: Set<string>;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  canEdit: boolean;
};

export function getColumns(meta: ColumnMeta): ColumnDef<Asset>[] {
  const columns: ColumnDef<Asset>[] = [];

  if (meta.canEdit) {
    columns.push({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 36,
    });
  }

  columns.push(
    {
      id: "favorite",
      header: () => null,
      cell: ({ row }) => {
        const isFav = meta.favoriteIds.has(row.original.id);
        return (
          <button
            type="button"
            className="inline-flex items-center justify-center"
            onClick={(e) => meta.onToggleFavorite(e, row.original.id)}
          >
            <StarIcon
              className={`size-4 cursor-pointer shrink-0 ${
                isFav
                  ? "fill-yellow-500 text-yellow-500"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        );
      },
      enableSorting: false,
      size: 32,
    },
    {
      id: "thumbnail",
      header: () => null,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="item-thumb">
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt=""
                width={72}
                height={72}
                sizes="36px"
                loading="lazy"
                unoptimized={
                  !item.imageUrl.includes(".public.blob.vercel-storage.com")
                }
              />
            ) : (
              <ImageIcon className="size-5 text-[var(--text-tertiary)]" />
            )}
          </div>
        );
      },
      enableSorting: false,
      size: 44,
    },
    {
      accessorKey: "assetTag",
      header: "Name",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <StatusDot item={item} />
            <div>
              <span className="font-semibold text-sm">
                {item.assetTag}
              </span>
              {(item._count?.accessories ?? 0) > 0 && (
                <Badge
                  variant="gray"
                  size="sm"
                  className="ml-1.5"
                  title={`${item._count!.accessories} accessories`}
                >
                  +{item._count!.accessories}
                </Badge>
              )}
              <div className="text-xs text-muted-foreground">
                {item.name || `${item.brand} ${item.model}`}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "category",
      header: "Category",
      cell: ({ row }) =>
        row.original.category?.name || row.original.type,
    },
    {
      id: "location",
      header: "Location",
      cell: ({ row }) => row.original.location.name,
    },
    {
      id: "department",
      header: "Department",
      cell: ({ row }) => row.original.department?.name ?? "\u2014",
      meta: { className: "hidden md:table-cell" },
    },
    {
      id: "brand",
      header: "Brand",
      cell: ({ row }) => row.original.brand,
      meta: { className: "hidden md:table-cell" },
    },
    {
      id: "model",
      header: "Model",
      cell: ({ row }) => row.original.model,
      meta: { className: "hidden md:table-cell" },
    }
  );

  return columns;
}
