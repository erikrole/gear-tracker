import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/_setup.ts"],
    coverage: {
      include: [
        "src/lib/services/**",
        "src/lib/rbac.ts",
        "src/lib/permissions.ts",
        "src/lib/api.ts"
      ]
    }
  }
});
