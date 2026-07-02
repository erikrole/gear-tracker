import Image from "next/image";
import Link from "next/link";
import {
  ArchiveIcon,
  ArrowRightIcon,
  BadgeCheckIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  FingerprintIcon,
  LockIcon,
  MapPinnedIcon,
  PhoneIcon,
  QrCodeIcon,
  ServerIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersRoundIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { publicShowroomNav, type IconKey, type ShowroomCard, type ShowroomMockup, type StackGroup } from "@/lib/public-showroom";

const icons: Record<IconKey, LucideIcon> = {
  archive: ArchiveIcon,
  badge: BadgeCheckIcon,
  calendar: CalendarDaysIcon,
  check: CheckCircle2Icon,
  database: DatabaseIcon,
  fingerprint: FingerprintIcon,
  lock: LockIcon,
  map: MapPinnedIcon,
  phone: PhoneIcon,
  scan: QrCodeIcon,
  server: ServerIcon,
  shield: ShieldCheckIcon,
  sparkles: SparklesIcon,
  users: UsersRoundIcon,
  workflow: WorkflowIcon,
};

const toneClasses = {
  red: "bg-[var(--red-bg)] text-[var(--red-text)] ring-[var(--red)]/20",
  blue: "bg-[var(--blue-bg)] text-[var(--blue-text)] ring-[var(--blue)]/20",
  green: "bg-[var(--green-bg)] text-[var(--green-text)] ring-[var(--green)]/20",
  orange: "bg-[var(--orange-bg)] text-[var(--orange-text)] ring-[var(--orange)]/20",
  purple: "bg-[var(--purple-bg)] text-[var(--purple-text)] ring-[var(--purple)]/20",
  gray: "bg-muted text-muted-foreground ring-border",
};

// Neutral chips need different treatment on the dark bands; the colored
// tone tints stay readable on both.
const darkToneOverrides: Partial<Record<keyof typeof toneClasses, string>> = {
  gray: "bg-white/8 text-white/72 ring-white/10",
};

function toneClass(tone: keyof typeof toneClasses, dark: boolean) {
  return (dark && darkToneOverrides[tone]) || toneClasses[tone];
}

export function ShowroomHero({ mockup }: { mockup: ShowroomMockup }) {
  return (
    <section className="relative isolate overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(160,0,0,0.34),transparent_36%),linear-gradient(180deg,#050505_0%,#111_58%,#f4f4f4_58%,#f4f4f4_100%)]" />
      <div className="mx-auto grid min-h-[86svh] w-full max-w-7xl grid-rows-[auto_1fr] px-4 pb-8 pt-16 sm:px-6 lg:px-8 lg:pt-20">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-6 flex justify-center">
            <Image src="/Badgers.png" alt="Wisconsin Motion W" width={72} height={72} className="size-16 object-contain drop-shadow-[0_18px_35px_rgba(0,0,0,0.45)]" priority />
          </div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-white/60">Wisconsin Creative Gear Tracker</p>
          <h1 className="font-[var(--font-heading)] text-5xl font-black leading-[0.95] text-balance tracking-normal sm:text-7xl lg:text-8xl">
            The operating system for game-day gear.
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-pretty text-white/72 sm:text-xl">
            A public showroom for stakeholders: how Wisconsin Creative reserves gear, binds physical custody, connects Schedule to readiness, and keeps field work moving.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full bg-white px-6 text-black hover:bg-white/90">
              <Link href="/about/features">Explore features</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-white/20 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white">
              <Link href="/about/security">Review security posture</Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 self-end">
          <ProductMockup mockup={mockup} featured />
        </div>
      </div>
    </section>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  mockup,
}: {
  eyebrow: string;
  title: string;
  description: string;
  mockup: ShowroomMockup;
}) {
  return (
    <section className="bg-[#050505] text-white">
      <div className="mx-auto grid min-h-[74svh] w-full max-w-7xl items-end gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-20">
        <div className="pb-4">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/55">{eyebrow}</p>
          <h1 className="mt-5 font-[var(--font-heading)] text-5xl font-black leading-none text-balance tracking-normal sm:text-7xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-pretty text-white/70">{description}</p>
        </div>
        <ProductMockup mockup={mockup} compact />
      </div>
    </section>
  );
}

export function ChapterBand({
  eyebrow,
  title,
  description,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  dark?: boolean;
}) {
  return (
    <section className={cn("px-4 py-20 sm:px-6 lg:px-8", dark ? "bg-[#080808] text-white" : "bg-[#f4f4f4] text-foreground")}>
      <div className="mx-auto max-w-5xl text-center">
        <p className={cn("text-sm font-semibold uppercase tracking-[0.2em]", dark ? "text-white/55" : "text-muted-foreground")}>{eyebrow}</p>
        <h2 className="mt-5 font-[var(--font-heading)] text-4xl font-black leading-none text-balance tracking-normal sm:text-6xl">
          {title}
        </h2>
        <p className={cn("mx-auto mt-6 max-w-3xl text-lg leading-8 text-pretty", dark ? "text-white/68" : "text-muted-foreground")}>{description}</p>
      </div>
    </section>
  );
}

export function FeatureGrid({ cards, dark = false }: { cards: ShowroomCard[]; dark?: boolean }) {
  return (
    <section className={cn("px-4 pb-20 sm:px-6 lg:px-8", dark ? "bg-[#080808] text-white" : "bg-[#f4f4f4] text-foreground")}>
      <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = icons[card.icon];
          return (
            <article
              key={card.title}
              className={cn(
                "rounded-2xl p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_18px_60px_rgba(0,0,0,0.06)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                dark ? "bg-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]" : "bg-white"
              )}
            >
              <div className={cn("mb-8 flex size-11 items-center justify-center rounded-xl ring-1", toneClass(card.tone, dark))}>
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-semibold text-balance">{card.title}</h3>
              <p className={cn("mt-3 text-sm leading-6 text-pretty", dark ? "text-white/64" : "text-muted-foreground")}>{card.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function StackGrid({ groups }: { groups: StackGroup[] }) {
  return (
    <section className="bg-[#f4f4f4] px-4 pb-20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-2">
        {groups.map((group) => {
          const Icon = icons[group.icon];
          return (
            <article key={group.title} className="overflow-hidden rounded-3xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_18px_60px_rgba(0,0,0,0.06)]">
              <div className="p-7">
                <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-[#111] text-white">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h2 className="font-[var(--font-heading)] text-3xl font-black text-balance tracking-normal">{group.title}</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-pretty text-muted-foreground">{group.description}</p>
              </div>
              <div className="grid border-t border-border/70 sm:grid-cols-2">
                {group.items.map((item) => (
                  <div key={item} className="min-h-14 border-b border-border/70 px-7 py-4 text-sm font-medium last:border-b-0 sm:odd:border-r">
                    {item}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ProductMockup({ mockup, featured = false, compact = false }: { mockup: ShowroomMockup; featured?: boolean; compact?: boolean }) {
  return (
    <figure
      aria-label={`${mockup.title} mockup with fictional data`}
      className={cn(
        "mx-auto w-full overflow-hidden rounded-[2rem] bg-[#141414] p-2 shadow-[0_30px_100px_rgba(0,0,0,0.45)] ring-1 ring-white/10",
        featured ? "max-w-5xl" : "max-w-3xl",
        compact && "lg:translate-y-6"
      )}
    >
      <div className="overflow-hidden rounded-[1.5rem] bg-[#f7f7f7] text-foreground">
        <div className="flex items-center justify-between border-b border-border/80 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <Image src="/Badgers.png" alt="" width={28} height={28} className="size-7 object-contain" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{mockup.eyebrow}</p>
              <p className="text-sm font-semibold">Wisconsin Creative</p>
            </div>
          </div>
          <Badge variant="gray">Fictional data</Badge>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[0.86fr_1.14fr]">
          <div className="rounded-2xl bg-[#111] p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">{mockup.eyebrow}</p>
            <p className="mt-4 text-2xl font-semibold leading-tight text-balance">{mockup.title}</p>
            <p className="mt-3 text-sm leading-6 text-pretty text-white/60">{mockup.description}</p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {mockup.metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl bg-white/8 p-3">
                  <p className="text-2xl font-semibold tabular-nums">{metric.value}</p>
                  <p className="mt-1 text-[0.68rem] uppercase tracking-[0.12em] text-white/50">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {mockup.rows.map((row) => (
              <div key={row.title} className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_6px_18px_rgba(0,0,0,0.05)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{row.eyebrow}</p>
                    <p className="mt-1 font-semibold text-balance">{row.title}</p>
                  </div>
                  <Badge variant={row.tone}>{row.status}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-pretty text-muted-foreground">{row.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

export function ExplorePages({ current }: { current: string }) {
  const pages = publicShowroomNav.filter((item) => item.href !== current);
  return (
    <section aria-label="Keep exploring the showroom" className="bg-[#f4f4f4] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Keep exploring</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pages.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_18px_60px_rgba(0,0,0,0.06)] outline-none transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/40 motion-reduce:transform-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-lg font-semibold">{item.label}</span>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none" aria-hidden="true" />
              </span>
              <p className="mt-2 text-sm leading-6 text-pretty text-muted-foreground">{item.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StakeholderCta({
  primaryHref = "/about/tech-stack",
  primaryLabel = "View the stack",
}: {
  primaryHref?: string;
  primaryLabel?: string;
} = {}) {
  return (
    <section className="bg-[#050505] px-4 py-20 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/50">Stakeholder-ready</p>
        <h2 className="mt-5 font-[var(--font-heading)] text-4xl font-black leading-none text-balance tracking-normal sm:text-6xl">
          Share the story without opening the system.
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-pretty text-white/68">
          The showroom is public, static, and intentionally separate from authenticated Gear Tracker operations.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 rounded-full bg-white px-6 text-black hover:bg-white/90">
            <Link href={primaryHref}>{primaryLabel}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-white/20 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
