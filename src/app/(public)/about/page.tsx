import { ChapterBand, ExplorePages, FeatureGrid, ShowroomHero, StakeholderCta } from "@/components/public-showroom/showroom-blocks";
import { heroMockup, overviewPillars } from "@/lib/public-showroom";

export default function AboutPage() {
  return (
    <main id="showroom-content">
      <ShowroomHero mockup={heroMockup} />
      <ChapterBand
        eyebrow="Public overview"
        title="Built around physical handoffs, not generic inventory."
        description="The public story is simple: plan the work in web and iOS, bind custody at the kiosk, keep Schedule and gear readiness connected, and leave an audit trail when accountability changes."
      />
      <FeatureGrid cards={overviewPillars} />
      <ChapterBand
        eyebrow="Why stakeholders care"
        title="Operational speed, clarity, and trust in one product."
        description="Gear Tracker gives Wisconsin Creative a product narrative that matches the daily reality of students, staff, game-day venues, batteries, camera bodies, and staffed counters."
        dark
      />
      <StakeholderCta />
      <ExplorePages current="/about" />
    </main>
  );
}
