"use client";

import { AlertTriangleIcon } from "lucide-react";
import { formatOverdueElapsed } from "@/lib/format";
import { UserAvatar, GearAvatarStack } from "./dashboard-avatars";
import type { OverdueItem } from "../dashboard-types";

type Props = {
  overdueCount: number;
  overdueItems: OverdueItem[];
  now: Date;
  onSelectBooking: (id: string) => void;
};

export function OverdueBanner({ overdueCount, overdueItems, now, onSelectBooking }: Props) {
  if (overdueCount === 0) return null;

  return (
    <div className="overdue-banner">
      <div className="overdue-banner-header">
        <div className="overdue-banner-title">
          <AlertTriangleIcon className="overdue-banner-icon size-[18px]" />
          <span className="pulse-dot" />
          <strong>{overdueCount} overdue checkout{overdueCount !== 1 ? "s" : ""}</strong>
        </div>
        <a href="/checkouts?filter=overdue" className="overdue-banner-viewall">Resolve all overdue &rarr;</a>
      </div>
      <div className="overdue-banner-list">
        {overdueItems.map((item) => (
          <button
            key={item.bookingId}
            className="overdue-banner-item"
            onClick={() => onSelectBooking(item.bookingId)}
          >
            <div className="overdue-banner-item-main">
              <span className="overdue-banner-item-title">{item.bookingTitle}</span>
              <span className="overdue-banner-item-meta">
                <UserAvatar initials={item.requesterInitials} />
                {item.requesterName}
                {item.items.length > 0 && <> &middot; <GearAvatarStack items={item.items} totalCount={item.assetTags.length} /></>}
                {item.items.length === 0 && item.assetTags.length > 0 && <> &middot; {item.assetTags.join(", ")}</>}
                 &middot; <span className="overdue-elapsed">{formatOverdueElapsed(item.endsAt, now)}</span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
