import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const QR_PREFIX = /^bg:\/\/item\/(.+)$/;

export type AssetSelect = Prisma.AssetSelect;

export async function findAssetByScanValue<S extends AssetSelect>(
  scanValue: string,
  select: S,
): Promise<Prisma.AssetGetPayload<{ select: S }> | null> {
  const trimmed = scanValue.trim();
  const qrMatch = trimmed.match(QR_PREFIX);

  if (qrMatch) {
    return db.asset.findUnique({
      where: { id: qrMatch[1] },
      select,
    }) as Promise<Prisma.AssetGetPayload<{ select: S }> | null>;
  }

  return db.asset.findFirst({
    where: { assetTag: { equals: trimmed, mode: "insensitive" } },
    select,
  }) as Promise<Prisma.AssetGetPayload<{ select: S }> | null>;
}
