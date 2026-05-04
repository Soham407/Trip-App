import path from "node:path";
import { defineConfig } from "vitest/config";

const rootAlias = path.resolve(process.cwd());

export default defineConfig({
  resolve: {
    alias: {
      "@": rootAlias
    }
  },
  test: {
    include: ["tests/**/*.test.ts"]
  }
});
