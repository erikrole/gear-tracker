import type { Metadata } from "next";
import { ChapterBand, ExplorePages, FeatureGrid, PageIntro, StakeholderCta } from "@/components/public-showroom/showroom-blocks";
import { fieldWorkMoments, pageMockups } from "@/lib/public-showroom";

export const metadata: Metadata = {
  title: "Field Work",
  description: "How Gear Tracker supports native iOS, iPad kiosk, scanner, and game-day field workflows.",
};

export default function FieldWorkPage() {
  return (
    <main id="showroom-content">
      <PageIntro
        eyebrow="Field work"
        title="Native where the work leaves the desk."
        description="Gear Tracker keeps admin breadth on web, but uses native iOS and kiosk flows where scanner input, counter speed, and venue context matter."
        mockup={pageMockups.field}
      />
      <ChapterBand
        eyebrow="Execution model"
        title="The phone, the counter, and the control room each have a job."
        description="Students need the next action. The kiosk needs exact custody evidence. Staff need the whole operating picture without forcing desktop density into the field."
      />
      <FeatureGrid cards={fieldWorkMoments} />
      <StakeholderCta />
      <ExplorePages current="/about/field-work" />
    </main>
  );
}
