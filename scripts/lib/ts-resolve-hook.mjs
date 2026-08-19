// Resolve extensionless relative imports to their .ts source.
//
// Node strips TypeScript types natively, but its ESM resolver still demands a
// file extension, while the app's TS sources import as `./sports`. Without this
// hook a script can only reach `src/` by duplicating logic in plain JS, which is
// how parsing rules drift apart. Register via `scripts/lib/register-ts.mjs`.

import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
// Mirrors the `@/*` -> `src/*` mapping in tsconfig.json.
const ALIAS_PREFIX = "@/";
const SRC_DIR = resolvePath(process.cwd(), "src");

function firstExisting(basePath) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = basePath + suffix;
    if (candidate && existsSync(candidate) && !existsSync(candidate + "/")) {
      return candidate;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  const alreadySuffixed = /\.([mc]?[jt]sx?|json)$/.test(specifier);

  if (specifier.startsWith(ALIAS_PREFIX)) {
    const hit = firstExisting(resolvePath(SRC_DIR, specifier.slice(ALIAS_PREFIX.length)));
    if (hit) return nextResolve(pathToFileURL(hit).href, context);
  }

  if (specifier.startsWith(".") && !alreadySuffixed && context.parentURL?.startsWith("file:")) {
    const hit = firstExisting(resolvePath(dirname(fileURLToPath(context.parentURL)), specifier));
    if (hit) return nextResolve(pathToFileURL(hit).href, context);
  }

  return nextResolve(specifier, context);
}
