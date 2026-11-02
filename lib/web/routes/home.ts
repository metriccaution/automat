import type { Hono } from "hono";
import { html } from "hono/html";
import { latestRun, getRun } from "../../db/runs.ts";
import { getSettings, saveSettings } from "../../db/settings.ts";
import { isDue, nextSlot } from "../../scheduler/index.ts";
import type { StartResult } from "../../services/runner.ts";
import {
  chrome,
  isHtmx,
  setFlash,
  type AppContext,
  type AppDeps,
  type AppEnv,
} from "../context.ts";
import { warningText } from "../views/components/core.ts";
import { runStatus } from "../views/format.ts";
import { homePage, upcomingPage, upcomingTable } from "../views/pages/home.ts";

/**
 * Answer an action: a status fragment for htmx, otherwise redirect to the run.
 */
export function respondToStart(c: AppContext, result: StartResult) {
  if (isHtmx(c)) {
    return c.html(
      result.ok
        ? runStatus(result.run, { oob: true })
        : warningText(result.message),
    );
  }
  if (!result.ok) {
    setFlash(c, { kind: "warning", text: result.message });
    return c.redirect("/", 303);
  }
  return c.redirect(`/history/runs/${result.run.id}`, 303);
}

export function homeRoutes(app: Hono<AppEnv>, deps: AppDeps) {
  const { db, services, recipeBook } = deps;

  app.get("/", (c) => {
    const settings = getSettings(db);
    return c.html(
      homePage({
        chrome: chrome(c, deps),
        settings,
        nextRun: settings.schedulerEnabled
          ? nextSlot(new Date(), settings.scheduleTime)
          : null,
        lastRun: latestRun(db),
        current: services.runner.current,
        recipeBook,
      }),
    );
  });

  app.get("/upcoming", async (c) => {
    let content;
    try {
      content = upcomingTable(await services.upcomingCooking());
    } catch (e) {
      content = upcomingTable({ error: (e as Error).message });
    }
    return isHtmx(c)
      ? c.html(content)
      : c.html(upcomingPage(chrome(c, deps), content));
  });

  app.post("/actions/plan", (c) => respondToStart(c, services.plan("manual")));
  app.post("/actions/cleanup", (c) =>
    respondToStart(c, services.cleanup("manual")),
  );
  app.post("/actions/refresh-recipes", (c) =>
    respondToStart(c, services.refreshRecipes("manual")),
  );

  app.post("/actions/scheduler", async (c) => {
    const body = await c.req.parseBody();
    const enabled = body.enabled === "true";
    saveSettings(db, { schedulerEnabled: enabled });

    const { scheduleTime } = getSettings(db);
    if (enabled) {
      const last = latestRun(db, { kind: "plan", trigger: "schedule" });
      setFlash(c, {
        kind: "success",
        text: isDue(new Date(), scheduleTime, last?.startedAt)
          ? `Scheduler resumed. Planning will run now, then daily at ${scheduleTime}`
          : `Scheduler resumed. Planning will run daily at ${scheduleTime}`,
      });
    } else {
      setFlash(c, {
        kind: "success",
        text: "Scheduler paused. Meals won’t be planned automatically, but you can still run actions by hand",
      });
    }
    return c.redirect("/", 303);
  });

  app.get("/history/runs/:id/status", (c) => {
    const run = getRun(db, Number(c.req.param("id")));
    if (!run) return c.html(html``, 404);
    return c.html(runStatus(run, { oob: true }));
  });
}
