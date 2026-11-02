import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { join } from "node:path";
import { chrome, takeFlash, type AppDeps, type AppEnv } from "./context.ts";
import { historyRoutes } from "./routes/history.ts";
import { homeRoutes } from "./routes/home.ts";
import { mealsRoutes } from "./routes/meals.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { hostChecks, securityHeaders } from "./security.ts";
import { errorPage, notFoundPage } from "./views/pages/errors.ts";

/**
 * The project root, where `public/` and `node_modules/` live.
 */
export const ROOT_DIR = join(import.meta.dirname, "..", "..");

/**
 * Front-end files served straight from npm packages. Nothing is loaded from
 * a CDN.
 */
const vendorFiles: Record<string, string> = {
  "htmx.min.js": "node_modules/htmx.org/dist/htmx.min.js",
  "govuk-frontend.min.js":
    "node_modules/govuk-frontend/dist/govuk/govuk-frontend.min.js",
  "accessible-autocomplete.min.js":
    "node_modules/accessible-autocomplete/dist/accessible-autocomplete.min.js",
  "accessible-autocomplete.min.css":
    "node_modules/accessible-autocomplete/dist/accessible-autocomplete.min.css",
};

export function createApp(deps: AppDeps, rootDir = ROOT_DIR) {
  const app = new Hono<AppEnv>();

  app.use(securityHeaders);
  app.use(hostChecks(deps.env.ALLOWED_HOSTS));

  app.get("/healthz", (c) => c.text("OK"));

  /*
   * Static files
   */
  app.use(
    "/public/*",
    serveStatic({
      root: rootDir,
      onFound: (_path, c) => {
        c.header("Cache-Control", "no-cache");
      },
    }),
  );
  for (const [name, path] of Object.entries(vendorFiles)) {
    app.get(
      `/vendor/${name}`,
      serveStatic({
        path: join(rootDir, path),
        onFound: (_path, c) => {
          c.header("Cache-Control", "public, max-age=3600");
        },
      }),
    );
  }
  app.get(
    "/favicon.ico",
    serveStatic({ path: join(rootDir, "public/assets/favicon.ico") }),
  );

  /*
   * Pages
   */
  app.use(async (c, next) => {
    c.set("flash", takeFlash(c));
    await next();
  });

  homeRoutes(app, deps);
  mealsRoutes(app, deps);
  historyRoutes(app, deps);
  settingsRoutes(app, deps);

  app.notFound((c) => {
    if (c.get("flash") === undefined) c.set("flash", null);
    return c.html(notFoundPage(chrome(c, deps)), 404);
  });

  app.onError((err, c) => {
    console.error(`[web] ${c.req.method} ${c.req.path}`, err);
    let pageChrome;
    try {
      pageChrome = chrome(c, deps);
    } catch {
      pageChrome = { banner: null, flash: null, running: false };
    }
    return c.html(errorPage(pageChrome, err.message), 500);
  });

  return app;
}
