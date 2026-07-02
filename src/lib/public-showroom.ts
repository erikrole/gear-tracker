export type ShowroomNavItem = {
  href: string;
  label: string;
  description: string;
};

export type ShowroomMetric = {
  label: string;
  value: string;
  tone: "red" | "blue" | "green" | "orange" | "purple" | "gray";
};

export type ShowroomMockupRow = {
  title: string;
  eyebrow: string;
  detail: string;
  status: string;
  tone: "red" | "blue" | "green" | "orange" | "purple" | "gray";
};

export type ShowroomMockup = {
  eyebrow: string;
  title: string;
  description: string;
  metrics: ShowroomMetric[];
  rows: ShowroomMockupRow[];
};

export type IconKey =
  | "archive"
  | "badge"
  | "calendar"
  | "check"
  | "database"
  | "fingerprint"
  | "lock"
  | "map"
  | "phone"
  | "scan"
  | "server"
  | "shield"
  | "sparkles"
  | "users"
  | "workflow";

export type ShowroomCard = {
  title: string;
  description: string;
  icon: IconKey;
  tone: "red" | "blue" | "green" | "orange" | "purple" | "gray";
};

export type StackGroup = {
  title: string;
  description: string;
  items: string[];
  icon: IconKey;
};

export const publicShowroomNav: ShowroomNavItem[] = [
  {
    href: "/about",
    label: "Overview",
    description: "A fast tour of the Wisconsin Creative operating system.",
  },
  {
    href: "/about/features",
    label: "Features",
    description: "The workflows that make gear, schedules, and handoffs move.",
  },
  {
    href: "/about/tech-stack",
    label: "Tech Stack",
    description: "The platform choices behind the product.",
  },
  {
    href: "/about/security",
    label: "Security",
    description: "Public-safe trust, access, and audit posture.",
  },
  {
    href: "/about/field-work",
    label: "Field Work",
    description: "Native iOS, kiosk, scanner, and game-day execution.",
  },
];

export const heroMockup: ShowroomMockup = {
  eyebrow: "Live operations",
  title: "Game-day gear, schedule, and custody in one command surface.",
  description:
    "Fictional stakeholder data shown here. The public showroom never reads live inventory, users, bookings, or audit logs.",
  metrics: [
    { label: "Reserved", value: "18", tone: "purple" },
    { label: "Out today", value: "42", tone: "blue" },
    { label: "Due soon", value: "7", tone: "orange" },
  ],
  rows: [
    {
      title: "MBB vs Iowa production kit",
      eyebrow: "Reservation",
      detail: "Camera bodies, wireless audio, and numbered batteries staged for pickup.",
      status: "Ready for kiosk pickup",
      tone: "purple",
    },
    {
      title: "Kohl Center handoff",
      eyebrow: "Checkout",
      detail: "Exact serialized gear and battery units bound at the staffed counter.",
      status: "Checked out",
      tone: "blue",
    },
    {
      title: "Photo desk return queue",
      eyebrow: "Recovery",
      detail: "Operators can see overdue work, missing units, and accountable next steps.",
      status: "Needs attention",
      tone: "orange",
    },
  ],
};

export const overviewPillars: ShowroomCard[] = [
  {
    title: "Reservation-first outside the counter",
    description:
      "Web and iOS help people plan the work. Physical custody starts only when the gear is actually handed off.",
    icon: "workflow",
    tone: "purple",
  },
  {
    title: "Native kiosk as the custody boundary",
    description:
      "The iPad kiosk owns checkout, pickup, return, scan evidence, and active checkout corrections.",
    icon: "scan",
    tone: "blue",
  },
  {
    title: "Web as the control room",
    description:
      "Staff and admins get the breadth they need for inventory, users, settings, imports, reports, and repair work.",
    icon: "server",
    tone: "gray",
  },
  {
    title: "Schedule tied to gear readiness",
    description:
      "Events, shifts, call times, crews, and pickup context stay connected to gear preparation.",
    icon: "calendar",
    tone: "red",
  },
];

export const featurePillars: ShowroomCard[] = [
  {
    title: "Event-aware reservations",
    description:
      "Requests can carry game, crew, location, and pickup context so gear prep starts from the real work.",
    icon: "calendar",
    tone: "purple",
  },
  {
    title: "Kiosk pickup and return",
    description:
      "A staffed counter flow binds exact assets and numbered battery units with scan evidence.",
    icon: "scan",
    tone: "blue",
  },
  {
    title: "Item-family operations",
    description:
      "Batteries and other unit-tracked families get labels, stock context, missing-unit review, and custody history.",
    icon: "archive",
    tone: "orange",
  },
  {
    title: "Schedule source of truth",
    description:
      "Coverage, open work, trade requests, call times, and gear readiness live in one planning surface.",
    icon: "users",
    tone: "green",
  },
  {
    title: "Operational reports",
    description:
      "Reports focus on current risk, utilization, overdue gear, scan history, missing units, and audit trails.",
    icon: "database",
    tone: "gray",
  },
  {
    title: "Notification paths",
    description:
      "In-app and email notifications help recover due gear, license expirations, and schedule work.",
    icon: "badge",
    tone: "red",
  },
];

export const stackGroups: StackGroup[] = [
  {
    title: "Application",
    description: "A modern Next.js app with typed React surfaces and shadcn/Radix primitives.",
    icon: "sparkles",
    items: ["Next.js", "React", "TypeScript", "Tailwind CSS", "shadcn/ui", "Radix UI", "lucide-react"],
  },
  {
    title: "Data and storage",
    description: "Postgres-backed product state with Prisma and public-object storage for media.",
    icon: "database",
    items: ["Prisma", "Neon Postgres", "@prisma/adapter-neon", "Vercel Blob", "Zod"],
  },
  {
    title: "Operations",
    description: "Deployment, observability, delivery, and rate-limiting pieces that support production use.",
    icon: "server",
    items: ["Vercel", "Sentry", "Resend", "Upstash Redis", "Vercel Cron", "React Query"],
  },
  {
    title: "Native field surface",
    description: "The iOS app and kiosk target own scanner-heavy and counter-heavy workflows.",
    icon: "phone",
    items: ["SwiftUI", "iPad kiosk", "HID scanner capture", "camera scan fallback", "Keychain-backed kiosk sessions"],
  },
];

export const securityControls: ShowroomCard[] = [
  {
    title: "Public pages read no operational data",
    description:
      "The showroom is static content. It does not call authenticated APIs or expose inventory, user, booking, or audit records.",
    icon: "lock",
    tone: "green",
  },
  {
    title: "Kiosk-only custody",
    description:
      "Standard checkout, pickup, and return custody stays behind kiosk authentication and physical-location context.",
    icon: "shield",
    tone: "blue",
  },
  {
    title: "Role-aware access",
    description:
      "Student, staff, and admin surfaces separate attention from authority while server checks remain the enforcement layer.",
    icon: "fingerprint",
    tone: "purple",
  },
  {
    title: "Auditable mutations",
    description:
      "Custody and accountability changes are designed to write audit evidence instead of relying on side-channel notes.",
    icon: "archive",
    tone: "orange",
  },
  {
    title: "Browser and API hardening",
    description:
      "The app uses CSP, HSTS, frame protections, CSRF checks, rate limits, safe parsing, and bounded exports where relevant.",
    icon: "server",
    tone: "gray",
  },
  {
    title: "Serializable integrity strategy",
    description:
      "High-risk booking and custody paths are designed around transaction safety and overlap prevention.",
    icon: "database",
    tone: "red",
  },
];

export const fieldWorkMoments: ShowroomCard[] = [
  {
    title: "Students get their next action",
    description:
      "The native app centers due gear, reservations, shifts, and search instead of exposing every admin lever.",
    icon: "phone",
    tone: "blue",
  },
  {
    title: "The counter gets one trusted flow",
    description:
      "The kiosk handles Wiscard identity, scanner input, camera fallback, exact item binding, and return confirmation.",
    icon: "scan",
    tone: "red",
  },
  {
    title: "Staff keep the control room",
    description:
      "The web app stays the place for configuration, repairs, imports, reporting, and broad operational review.",
    icon: "server",
    tone: "gray",
  },
  {
    title: "Venues and handoffs stay connected",
    description:
      "Events, locations, call times, and pickup context stay visible where they affect gear readiness.",
    icon: "map",
    tone: "green",
  },
];

export const pageMockups: Record<"features" | "tech" | "security" | "field", ShowroomMockup> = {
  features: {
    eyebrow: "Feature system",
    title: "Every surface points back to the handoff.",
    description: "The product model separates planning from custody while keeping the context visible.",
    metrics: [
      { label: "Events linked", value: "12", tone: "red" },
      { label: "Units staged", value: "64", tone: "orange" },
      { label: "Repair cues", value: "5", tone: "blue" },
    ],
    rows: [
      {
        title: "Reservation RV-2048",
        eyebrow: "Planning",
        detail: "Event, pickup location, and equipment intent are ready before the counter handoff.",
        status: "Reserved",
        tone: "purple",
      },
      {
        title: "Battery family",
        eyebrow: "Item family",
        detail: "Unit numbers, labels, and missing-unit state stay attached to the operational row.",
        status: "Low stock",
        tone: "orange",
      },
      {
        title: "Schedule readiness",
        eyebrow: "Crew",
        detail: "Open work and gear gaps appear before the event starts.",
        status: "Review",
        tone: "blue",
      },
    ],
  },
  tech: {
    eyebrow: "Platform",
    title: "A web control room backed by typed services.",
    description: "The stack favors deployable, observable, typed pieces over generic inventory sprawl.",
    metrics: [
      { label: "Runtime", value: "Node", tone: "gray" },
      { label: "Database", value: "Neon", tone: "green" },
      { label: "UI", value: "React", tone: "blue" },
    ],
    rows: [
      {
        title: "Next.js application routes",
        eyebrow: "Web",
        detail: "Public pages, authenticated app routes, and API handlers live in one typed project.",
        status: "App Router",
        tone: "blue",
      },
      {
        title: "Prisma and Neon",
        eyebrow: "Data",
        detail: "Postgres is the source of truth for bookings, items, events, users, and audit records.",
        status: "Typed data",
        tone: "green",
      },
      {
        title: "Sentry and Vercel",
        eyebrow: "Ops",
        detail: "Deployment and diagnostics are wired for production review without exposing internals.",
        status: "Observable",
        tone: "gray",
      },
    ],
  },
  security: {
    eyebrow: "Trust model",
    title: "Public story, private operations.",
    description: "The showroom names the posture without revealing sensitive thresholds or live data.",
    metrics: [
      { label: "Data reads", value: "0", tone: "green" },
      { label: "Live users", value: "0", tone: "green" },
      { label: "APIs called", value: "0", tone: "green" },
    ],
    rows: [
      {
        title: "Static public content",
        eyebrow: "Boundary",
        detail: "All pages render from typed static content and sanitized fictional mockups.",
        status: "No live reads",
        tone: "green",
      },
      {
        title: "Kiosk custody gate",
        eyebrow: "Policy",
        detail: "Standard custody actions belong to kiosk-authenticated routes, not public pages.",
        status: "Separated",
        tone: "blue",
      },
      {
        title: "Audit-led recovery",
        eyebrow: "Accountability",
        detail: "The product story emphasizes evidence and recovery, not hidden manual fixes.",
        status: "Auditable",
        tone: "orange",
      },
    ],
  },
  field: {
    eyebrow: "Field execution",
    title: "Built for the counter, the venue, and the phone.",
    description: "Gear Tracker stays native where scanning and physical handoffs demand it.",
    metrics: [
      { label: "Student taps", value: "2", tone: "blue" },
      { label: "Counter mode", value: "iPad", tone: "red" },
      { label: "Fallbacks", value: "3", tone: "green" },
    ],
    rows: [
      {
        title: "Search with scan action",
        eyebrow: "iOS",
        detail: "Students can find items and work without carrying desktop admin density.",
        status: "Native",
        tone: "blue",
      },
      {
        title: "Kiosk hand scanner",
        eyebrow: "Counter",
        detail: "HID scanner, camera scan, and typed recovery feed the same custody contract.",
        status: "Ready",
        tone: "green",
      },
      {
        title: "Staff control room",
        eyebrow: "Web",
        detail: "Operators keep broad repair, reporting, and configuration workflows on desktop.",
        status: "Controlled",
        tone: "gray",
      },
    ],
  },
};

export const forbiddenPublicMockupTerms = [
  "Ryan Dean",
  "Chris Hall",
  "Erik Role",
  "CO-0053",
  "gear.erikrole.com",
];
