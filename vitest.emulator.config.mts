import { defineConfig } from "vitest/config";
import unitConfig from "./vitest.config.mts";

export default defineConfig({
  resolve: unitConfig.resolve,
  test: {
    include: ["tests/integration/**/*.emulator.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 30_000,
  },
});
