"use client";

import { KeyIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { FadeUp } from "@/components/ui/motion";
import EmptyState from "@/components/EmptyState";

export default function LicensesPage() {
  return (
    <FadeUp>
      <PageHeader title="Licenses" />
      <EmptyState
        icon="box"
        title="License tracking coming soon"
        description="Software license management for Photo Mechanic and other tools will appear here."
      />
    </FadeUp>
  );
}
