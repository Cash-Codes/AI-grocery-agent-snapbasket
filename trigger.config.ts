import { additionalFiles, additionalPackages } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "dummy_proj_ref",
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  dirs: ["./trigger"],
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 16000,
      randomize: false,
    },
  },
  build: {
    extensions: [
      // @libsql/client has platform-specific native bindings (@libsql/linux-x64-gnu)
      // that esbuild can't bundle because the require path is computed at runtime.
      // Mark it as a runtime install so Trigger.dev's worker container `npm install`s
      // it directly, picking up the correct Linux binding for its own platform.
      additionalPackages({ packages: ["@libsql/client"] }),
      // Ship the drizzle migration files so ensureMigrated() can find meta/_journal.json
      // on the worker. Migrations are idempotent (drizzle tracks applied ones in
      // __drizzle_migrations) so it's safe for both web tier and workers to call
      // ensureMigrated() against the shared Turso DB.
      additionalFiles({ files: ["./drizzle/**/*"] }),
    ],
  },
});
