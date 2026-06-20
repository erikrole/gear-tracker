#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { relative } from "node:path";

const result = spawnSync("npm", ["run", "lint", "--", "--format", "stylish"], {
  encoding: "utf8",
});

const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const ruleCounts = new Map();
const fileCounts = new Map();
let currentFile = "";

for (const line of output.split(/\r?\n/)) {
  if (line.startsWith(process.cwd())) {
    currentFile = relative(process.cwd(), line.trim());
    continue;
  }

  const match = line.match(/\b(warning|error)\s+(.+?)\s+([@\w/-]+)$/);
  if (!match) continue;

  const severity = match[1];
  const rule = match[3];
  const key = `${severity}:${rule}`;
  ruleCounts.set(key, (ruleCounts.get(key) ?? 0) + 1);
  if (currentFile) fileCounts.set(currentFile, (fileCounts.get(currentFile) ?? 0) + 1);
}

function printTop(title, counts, limit = 15) {
  console.log(title);
  for (const [key, count] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)) {
    console.log(`${String(count).padStart(4, " ")}  ${key}`);
  }
  if (counts.size === 0) console.log("   0  none");
  console.log("");
}

console.log(`ESLint exit code: ${result.status ?? 0}`);
printTop("Top rules", ruleCounts);
printTop("Top files", fileCounts);

process.exit(result.status ?? 0);
