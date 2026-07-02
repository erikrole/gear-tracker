import type { Metadata } from "next";
import { ChapterBand, ExplorePages, PageIntro, StackGrid, StakeholderCta } from "@/components/public-showroom/showroom-blocks";
import { pageMockups, stackGroups } from "@/lib/public-showroom";

export const metadata: Metadata = {
  title: "Tech Stack",
  description: "Public-safe platform overview for the Wisconsin Creative Gear Tracker stack.",
};

export default function TechStackPage() {
  return (
    <main id="showroom-content">
      <PageIntro
        eyebrow="Tech stack"
        title="Modern web, typed data, native field work."
        description="The stack combines a Next.js control room, Prisma-backed Neon Postgres, Vercel deployment, public-object media storage, observability, email, and native iOS field execution."
        mockup={pageMockups.tech}
      />
      <ChapterBand
        eyebrow="Platform map"
        title="The stack is boring where reliability matters."
        description="Public copy names the major pieces without exposing sensitive configuration, endpoint internals, or operational runbook detail."
      />
      <StackGrid groups={stackGroups} />
      <StakeholderCta primaryHref="/about/security" primaryLabel="Review security posture" />
      <ExplorePages current="/about/tech-stack" />
    </main>
  );
}
