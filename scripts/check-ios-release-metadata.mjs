#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const strictTestFlight = args.has("--testflight");
const projectPath = path.join(process.cwd(), "ios", "project.yml");

function fail(message) {
  console.error(`iOS release metadata check failed: ${message}`);
  process.exit(1);
}

function readSetting(source, name) {
  const match = source.match(new RegExp(`^\\s*${name}:\\s*"?([^"\\n]+)"?\\s*$`, "m"));
  return match?.[1]?.trim();
}

const project = readFileSync(projectPath, "utf8");
const marketingVersion = readSetting(project, "MARKETING_VERSION");
const buildNumber = readSetting(project, "CURRENT_PROJECT_VERSION");

if (!marketingVersion) {
  fail("MARKETING_VERSION is missing from ios/project.yml.");
}

if (!buildNumber) {
  fail("CURRENT_PROJECT_VERSION is missing from ios/project.yml.");
}

if (!/^\d+(?:\.\d+){1,2}$/.test(marketingVersion)) {
  fail(`MARKETING_VERSION "${marketingVersion}" must look like 1.0 or 1.0.1.`);
}

if (!/^[1-9]\d*$/.test(buildNumber)) {
  fail(`CURRENT_PROJECT_VERSION "${buildNumber}" must be a positive integer.`);
}

if (strictTestFlight && buildNumber === "1") {
  fail("CURRENT_PROJECT_VERSION is still 1. Bump the iOS build number before archiving a TestFlight candidate.");
}

const mode = strictTestFlight ? "TestFlight" : "development";
console.log(`iOS ${mode} metadata OK: MARKETING_VERSION=${marketingVersion}, CURRENT_PROJECT_VERSION=${buildNumber}`);
