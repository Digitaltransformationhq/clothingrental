import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Honours the `@/*` alias from tsconfig.json natively.
    tsconfigPaths: true,
    alias: {
      // See tests/stubs/server-only.ts for why.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/unit/**/*.test.ts"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
    globals: false,
    // The database-backed suites share one in-process PostgreSQL, which permits
    // a single writer, so files run sequentially rather than in parallel forks.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/server/services/**", "src/lib/**"],
      thresholds: { lines: 80, functions: 80, branches: 75 },
    },
  },
});
