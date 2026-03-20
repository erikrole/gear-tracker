"use client";

import EmptyState from "@/components/EmptyState";
import { Card } from "@/components/ui/card";

export default function KitsPage() {
  return (
    <>
      <div className="page-header">
        <h1>Kits</h1>
      </div>
      <Card>
        <EmptyState
          icon="box"
          title="Kits coming soon"
          description="Group items together for easy checkout and tracking."
        />
      </Card>
    </>
  );
}
