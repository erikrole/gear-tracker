// Enables `node --import ./scripts/lib/register-ts.mjs scripts/<name>.ts`,
// so a maintenance script can import the app's real TypeScript helpers instead
// of re-implementing them. See ts-resolve-hook.mjs for why the hook is needed.
import { register } from "node:module";
register("./ts-resolve-hook.mjs", import.meta.url);
