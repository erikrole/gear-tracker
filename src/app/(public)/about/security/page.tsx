import type { Metadata } from "next";
import { ChapterBand, ExplorePages, FeatureGrid, PageIntro, StakeholderCta } from "@/components/public-showroom/showroom-blocks";
import { pageMockups, securityControls } from "@/lib/public-showroom";

export const metadata: Metadata = {
  title: "Security",
  description: "Public-safe security, trust, access, auditability, and reliability overview for Gear Tracker.",
};

export default function SecurityPage() {
  return (
    <main id="showroom-content">
      <PageIntro
        eyebrow="Security"
        title="Show the posture without opening the operation."
        description="This showroom explains the trust posture while keeping authenticated data, sensitive thresholds, and internal recovery detail out of public view."
        mockup={pageMockups.security}
      />
      <ChapterBand
        eyebrow="Public-safe posture"
        title="Trust controls described at the right altitude."
        description="The security page names the principles stakeholders need to understand: static public content, role-aware access, kiosk custody, auditability, browser hardening, and transaction safety."
        dark
      />
      <FeatureGrid cards={securityControls} dark />
      <StakeholderCta />
      <ExplorePages current="/about/security" />
    </main>
  );
}
