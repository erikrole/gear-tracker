import bcrypt from "bcryptjs";
import { PrismaClient, Role, BadgeCategory } from "@prisma/client";

const prisma = new PrismaClient();
const defaultLocations = ["Camp Randall", "Kohl Center"];

async function main() {
  for (const name of defaultLocations) {
    await prisma.location.upsert({
      where: { name },
      create: { name },
      update: {}
    });
  }

  const campRandall = await prisma.location.findUniqueOrThrow({
    where: { name: "Camp Randall" }
  });

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMeNow123!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: "admin@creative.local" },
    create: {
      name: "Creative Admin",
      email: "admin@creative.local",
      passwordHash,
      role: Role.ADMIN,
      locationId: campRandall.id
    },
    update: {
      passwordHash,
      role: Role.ADMIN,
      locationId: campRandall.id
    }
  });

  console.log("Seed complete: admin@creative.local");

  // ── Badge Definitions ──────────────────────────────────
  const badges = [
    // Accountability (A-01 through A-06)
    { slug: "ironclad", name: "Ironclad", description: "Complete 20 consecutive assigned shifts with no no-shows", category: BadgeCategory.ACCOUNTABILITY, sortOrder: 1 },
    { slug: "trusted-hands", name: "Trusted Hands", description: "Maintain 100% on-time return rate over 25+ checkouts", category: BadgeCategory.ACCOUNTABILITY, sortOrder: 2 },
    { slug: "steward", name: "Steward", description: "Report 5 equipment issues during check-in", category: BadgeCategory.ACCOUNTABILITY, sortOrder: 3 },
    { slug: "unbreakable", name: "Unbreakable", description: "30 consecutive on-time returns", category: BadgeCategory.ACCOUNTABILITY, sortOrder: 4 },
    { slug: "full-accountability", name: "Full Accountability", description: "Earn Clean Slate + Ironclad + Trusted Hands", category: BadgeCategory.ACCOUNTABILITY, sortOrder: 5 },
    { slug: "the-vault", name: "The Vault", description: "Zero overdue items AND zero items lost for an entire academic year", category: BadgeCategory.ACCOUNTABILITY, sortOrder: 6 },

    // Gear & Checkout (G-01 through G-09)
    { slug: "first-checkout", name: "First Checkout", description: "Complete your first gear checkout", category: BadgeCategory.GEAR, sortOrder: 1 },
    { slug: "gear-head", name: "Gear Head", description: "Complete 50 checkouts", category: BadgeCategory.GEAR, sortOrder: 2 },
    { slug: "century-club", name: "Century Club", description: "Complete 100 checkouts", category: BadgeCategory.GEAR, sortOrder: 3 },
    { slug: "clean-slate", name: "Clean Slate", description: "10 consecutive on-time returns", category: BadgeCategory.GEAR, sortOrder: 4 },
    { slug: "speed-scan", name: "Speed Scan", description: "Complete a checkout scan session in under 60 seconds", category: BadgeCategory.GEAR, sortOrder: 5 },
    { slug: "full-send", name: "Full Send", description: "Check out 10+ items in a single booking", category: BadgeCategory.GEAR, sortOrder: 6 },
    { slug: "zero-loss", name: "Zero Loss", description: "Return 50 bulk items with no missing units", category: BadgeCategory.GEAR, sortOrder: 7 },
    { slug: "lens-hog", name: "Lens Hog", description: "Check out 5+ lenses in a single booking", category: BadgeCategory.GEAR, sortOrder: 8 },
    { slug: "battery-pack", name: "Battery Pack", description: "Check out 10+ batteries in a single booking", category: BadgeCategory.GEAR, sortOrder: 9 },

    // Shift & Scheduling (S-01 through S-08)
    { slug: "shift-starter", name: "Shift Starter", description: "Work your first shift", category: BadgeCategory.SHIFT, sortOrder: 1 },
    { slug: "iron-worker", name: "Iron Worker", description: "Work 50 shifts", category: BadgeCategory.SHIFT, sortOrder: 2 },
    { slug: "centurion", name: "Centurion", description: "Work 100 shifts", category: BadgeCategory.SHIFT, sortOrder: 3 },
    { slug: "trade-hero", name: "Trade Hero", description: "Claim and complete 5 shift trades", category: BadgeCategory.SHIFT, sortOrder: 4 },
    { slug: "four-corners", name: "Four Corners", description: "Work at least one shift in each area: VIDEO, PHOTO, GRAPHICS, COMMS", category: BadgeCategory.SHIFT, sortOrder: 5 },
    { slug: "weekend-warrior", name: "Weekend Warrior", description: "Work 10 weekend shifts", category: BadgeCategory.SHIFT, sortOrder: 6 },
    { slug: "double-header", name: "Double Header", description: "Work two shifts in the same calendar day", category: BadgeCategory.SHIFT, sortOrder: 7 },
    { slug: "swiss-army-knife", name: "Swiss Army Knife", description: "Work shifts covering 3+ different sports in one calendar month", category: BadgeCategory.SHIFT, sortOrder: 8 },

    // Event & Sports Coverage (E-01 through E-10)
    { slug: "game-day-ready", name: "Game Day Ready", description: "Cover your first event", category: BadgeCategory.EVENT, sortOrder: 1 },
    { slug: "all-sport-athlete", name: "All-Sport Athlete", description: "Cover events across 5+ different sports", category: BadgeCategory.EVENT, sortOrder: 2 },
    { slug: "road-warrior", name: "Road Warrior", description: "Cover 5 away events", category: BadgeCategory.EVENT, sortOrder: 3 },
    { slug: "rivalry-week", name: "Rivalry Week", description: "Cover a rivalry game", category: BadgeCategory.EVENT, sortOrder: 4 },
    { slug: "march-madness", name: "March Madness", description: "Cover a basketball postseason game", category: BadgeCategory.EVENT, sortOrder: 5 },
    { slug: "camp-randall-regular", name: "Camp Randall Regular", description: "Cover 10 events at Camp Randall", category: BadgeCategory.EVENT, sortOrder: 6 },
    { slug: "season-ticket", name: "Season Ticket", description: "Cover every home game for one sport in a full season", category: BadgeCategory.EVENT, sortOrder: 7 },
    { slug: "buckys-favorite", name: "Bucky's Favorite", description: "Cover 25 events total across any sport", category: BadgeCategory.EVENT, sortOrder: 8 },
    { slug: "hat-trick", name: "Hat Trick", description: "Cover 3 events in a single week", category: BadgeCategory.EVENT, sortOrder: 9 },
    { slug: "back-to-back", name: "Back-to-Back", description: "Cover events on consecutive calendar days", category: BadgeCategory.EVENT, sortOrder: 10 },

    // Secret / Easter Egg (X-01 through X-09)
    { slug: "perfectionist", name: "Perfectionist", description: "100% scan accuracy over 50+ scans", category: BadgeCategory.SECRET, isSecret: true, sortOrder: 1 },
    { slug: "ghost", name: "Ghost", description: "Zero overdue items across an entire semester", category: BadgeCategory.SECRET, isSecret: true, sortOrder: 2 },
    { slug: "the-closer", name: "The Closer", description: "Be the last person to check in gear at 20 events", category: BadgeCategory.SECRET, isSecret: true, sortOrder: 3 },
    { slug: "og", name: "OG", description: "One of the first 10 students on the platform", category: BadgeCategory.SECRET, isSecret: true, sortOrder: 4 },
    { slug: "night-owl", name: "Night Owl", description: "Complete 5 check-ins after 9 PM", category: BadgeCategory.SECRET, isSecret: true, sortOrder: 5 },
    { slug: "early-bird", name: "Early Bird", description: "Complete 5 checkouts before 7 AM", category: BadgeCategory.SECRET, isSecret: true, sortOrder: 6 },
    { slug: "snow-day", name: "Snow Day", description: "Cover an outdoor event when temperature is below 20\u00B0F", category: BadgeCategory.SECRET, isSecret: true, sortOrder: 7 },
    { slug: "jump-around", name: "Jump Around", description: "Cover a football game at Camp Randall", category: BadgeCategory.SECRET, isSecret: true, sortOrder: 8 },
    { slug: "freshman-year", name: "Freshman Year", description: "Earn 5 badges within your first 60 days on the platform", category: BadgeCategory.SECRET, isSecret: true, sortOrder: 9 },
  ];

  for (const badge of badges) {
    await prisma.badgeDefinition.upsert({
      where: { slug: badge.slug },
      create: badge,
      update: {
        name: badge.name,
        description: badge.description,
        category: badge.category,
        isSecret: badge.isSecret ?? false,
        sortOrder: badge.sortOrder,
      },
    });
  }

  console.log(`Seed complete: ${badges.length} badge definitions upserted`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
