#!/usr/bin/env node
// Fails if two prisma migration directories share the same numeric prefix
// (e.g. 0049_foo and 0049_bar). Run via `npm run db:migrate:check` and from
// pre-commit / CI to catch the dual-claude-agent migration collision.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');

// Historical collisions already applied in prod -- new collisions still fail.
const ALLOWED_COLLISIONS = new Set(['0009']);

const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const byPrefix = new Map();
for (const name of dirs) {
  const prefix = name.split('_')[0];
  if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
  byPrefix.get(prefix).push(name);
}

const collisions = [...byPrefix.entries()]
  .filter(([prefix, names]) => names.length > 1 && !ALLOWED_COLLISIONS.has(prefix));

if (collisions.length === 0) {
  console.log(`OK: ${dirs.length} migrations, no prefix collisions`);
  process.exit(0);
}

console.error('Migration prefix collision detected:');
for (const [prefix, names] of collisions) {
  console.error(`  ${prefix}: ${names.join(', ')}`);
}
console.error('\nRename the duplicate(s) to the next available prefix, then run');
console.error('`npx prisma migrate resolve --applied <name>` if already applied to the DB.');
process.exit(1);
