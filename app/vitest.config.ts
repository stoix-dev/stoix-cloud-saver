import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Keep the pino logger quiet so test output stays pristine.
    env: { LOG_LEVEL: "silent" },
  },
});
