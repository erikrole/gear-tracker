import "dotenv/config";
import { defineConfig } from "prisma/config";
import {
  PRISMA_SCHEMA_PLACEHOLDER_URL,
  resolvePrismaConfigUrl,
} from "./scripts/lib/prisma-direct-url.mjs";

process.env.PRISMA_SCHEMA_URL ??= PRISMA_SCHEMA_PLACEHOLDER_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  engine: "classic",
  datasource: {
    // Schema-only commands do not need a live database. Migration wrappers
    // perform the strict direct/unpooled connection preflight before any DDL.
    url: resolvePrismaConfigUrl(),
  },
});
