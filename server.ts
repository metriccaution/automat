import { serve } from "@hono/node-server";
import { resolve } from "node:path";
import { today } from "./lib/dates.ts";
import { openDb } from "./lib/db/index.ts";
import { failStaleRuns } from "./lib/db/runs.ts";
import { loadEnv } from "./lib/env.ts";
import { RecipeBook } from "./lib/recipes/book.ts";
import { Scheduler } from "./lib/scheduler/index.ts";
import { Services } from "./lib/services/index.ts";
import { Runner } from "./lib/services/runner.ts";
import { createTodoistApi } from "./lib/todos/index.ts";
import { createApp } from "./lib/web/app.ts";

/*
 * 1. Environment
 */
let env;
try {
  env = loadEnv();
} catch (e) {
  console.error(`[startup] ${(e as Error).message}`);
  process.exit(1);
}
const dbPath = resolve(env.DB_PATH);
console.log(`[startup] Timezone ${env.TZ}`);
console.log(`[startup] Database ${dbPath}`);
console.log(`[startup] Allowed hosts ${env.ALLOWED_HOSTS.join(", ")}`);

/*
 * 2–3. Database, migrations, and runs interrupted by a restart
 */
const db = openDb(dbPath);
const stale = failStaleRuns(db);
if (stale)
  console.log(`[startup] Marked ${stale} interrupted run(s) as failed`);

/*
 * 4. Recipe cache, refreshed in the background if it's empty or expired
 */
const recipeBook = new RecipeBook(db, env.RECIPES_URL);
const runner = new Runner(db);
const token = env.TODOIST_TOKEN;
const services = new Services(
  {
    db,
    recipeBook,
    todoist: (signal) => createTodoistApi(token, signal),
    today: () => today(),
  },
  runner,
);
if (recipeBook.isExpired()) {
  services.refreshRecipes("startup");
}

/*
 * 5. Scheduler. If the startup refresh holds the lock, a catch-up run waits
 * for the next tick.
 */
const scheduler = new Scheduler(db, () => services.plan("schedule"));
scheduler.start();

/*
 * 6. HTTP
 */
const app = createApp({ db, env, services, recipeBook });
const server = serve({ fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" });
console.log(`[startup] Listening on http://0.0.0.0:${env.PORT}`);

const shutdown = (signal: string) => {
  console.log(`[shutdown] ${signal}`);
  scheduler.stop();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
