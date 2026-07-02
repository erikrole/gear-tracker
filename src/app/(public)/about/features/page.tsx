import type { Metadata } from "next";
import { ChapterBand, ExplorePages, FeatureGrid, PageIntro, StakeholderCta } from "@/components/public-showroom/showroom-blocks";
import { featurePillars, pageMockups } from "@/lib/public-showroom";

export const metadata: Metadata = {
  title: "Features",
  description: "Public overview of Gear Tracker reservations, kiosk custody, Schedule, item families, reports, and notifications.",
};

export default function FeaturesPage() {
  return (
    <main id="showroom-content">
      <PageIntro
        eyebrow="Features"
        title="The workflow is the product."
        description="Every feature is organized around a real operational handoff: who needs gear, where it moves, when it comes back, and what recovery path exists when reality changes."
        mockup={pageMockups.features}
      />
      <ChapterBand
        eyebrow="Workflow pillars"
        title="Feature breadth without losing the custody model."
        description="The public feature set highlights shipped operating modes without implying unauthenticated access or live public data."
      />
      <FeatureGrid cards={featurePillars} />
      <StakeholderCta />
      <ExplorePages current="/about/features" />
    </main>
  );
}
