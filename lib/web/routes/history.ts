import type { Hono } from "hono";
import { addDays, compare } from "../../dates.ts";
import { listHistory, mealStats } from "../../db/history.ts";
import { getMeal, listMeals } from "../../db/meals.ts";
import {
  getRun,
  listRuns,
  runKinds,
  runStatuses,
  runTriggers,
  type RunFilter,
} from "../../db/runs.ts";
import { getSettings } from "../../db/settings.ts";
import { chrome, type AppDeps, type AppEnv } from "../context.ts";
import { dateParts, pageNumber, parseDateParts, withQuery } from "../forms.ts";
import type { FieldErrors } from "../views/components/core.ts";
import {
  mealsPlannedPage,
  runDetailPage,
  runsPage,
  statsPage,
  type StatsRow,
  type StatsSort,
} from "../views/pages/history.ts";

const PAGE_SIZE = 50;

const oneOf = <T extends string>(
  values: readonly T[],
  value: string | undefined,
): T | undefined =>
  (values as readonly string[]).includes(value ?? "")
    ? (value as T)
    : undefined;

export function historyRoutes(app: Hono<AppEnv>, deps: AppDeps) {
  const { db, services } = deps;

  app.get("/history", (c) => c.redirect("/history/meals"));

  app.get("/history/meals", (c) => {
    const name = (c.req.query("name") ?? "").trim();
    const from = dateParts((k) => c.req.query(k), "from");
    const to = dateParts((k) => c.req.query(k), "to");
    const errors: FieldErrors = new Map();

    const range: { from?: string; to?: string } = {};
    for (const [key, parts, label] of [
      ["from", from, "planned from date"],
      ["to", to, "planned up to date"],
    ] as const) {
      if (!parts.day && !parts.month && !parts.year) continue;
      const parsed = parseDateParts(parts, label);
      if ("error" in parsed) errors.set(`${key}-day`, parsed.error);
      else range[key] = parsed.date;
    }

    const totalPages = (total: number) =>
      Math.max(1, Math.ceil(total / PAGE_SIZE));
    let page = pageNumber(c.req.query("page"));
    const filter = { name, ...range };
    let result = listHistory(db, filter, {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    if (page > totalPages(result.total)) {
      page = totalPages(result.total);
      result = listHistory(db, filter, {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
    }

    const query = {
      name,
      "from-day": from.day,
      "from-month": from.month,
      "from-year": from.year,
      "to-day": to.day,
      "to-month": to.month,
      "to-year": to.year,
    };
    return c.html(
      mealsPlannedPage({
        chrome: chrome(c, deps),
        name,
        from,
        to,
        errors,
        rows: result.rows,
        total: result.total,
        mealIds: new Map(listMeals(db).map((m) => [m.name, m.id])),
        page,
        pages: totalPages(result.total),
        href: (p) =>
          withQuery("/history/meals", {
            ...query,
            page: p === 1 ? undefined : p,
          }),
      }),
      errors.size ? 422 : 200,
    );
  });

  app.get("/history/runs", (c) => {
    const filter: RunFilter = {
      kind: oneOf(runKinds, c.req.query("kind")),
      trigger: oneOf(runTriggers, c.req.query("trigger")),
      status: oneOf(runStatuses, c.req.query("status")),
    };
    const page = pageNumber(c.req.query("page"));
    const result = listRuns(db, filter, {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    return c.html(
      runsPage({
        chrome: chrome(c, deps),
        filter,
        rows: result.rows,
        total: result.total,
        page,
        pages: Math.max(1, Math.ceil(result.total / PAGE_SIZE)),
        href: (p) =>
          withQuery("/history/runs", {
            ...filter,
            page: p === 1 ? undefined : p,
          }),
      }),
    );
  });

  app.get("/history/runs/:id", (c) => {
    const run = getRun(db, Number(c.req.param("id")));
    if (!run) return c.notFound();
    const mealId = run.params?.mealId;
    const meal = typeof mealId === "number" ? getMeal(db, mealId) : undefined;
    return c.html(
      runDetailPage({
        chrome: chrome(c, deps),
        run,
        meal: meal && { id: meal.id, name: meal.name },
      }),
    );
  });

  app.get("/history/stats", (c) => {
    const sort =
      oneOf(
        ["name", "last", "times", "recent"] as const,
        c.req.query("sort"),
      ) ?? "last";
    const dir =
      c.req.query("dir") === "asc" || c.req.query("dir") === "desc"
        ? (c.req.query("dir") as "asc" | "desc")
        : sort === "name"
          ? "asc"
          : "desc";

    const today = services.deps.today();
    const { historyWindowDays } = getSettings(db);
    const windowStart = addDays(today, -historyWindowDays);
    const meals = listMeals(db);
    const ids = new Map(meals.map((m) => [m.name, m.id]));
    const stats = mealStats(db, today);

    const rows: StatsRow[] = [...stats.values()].map((s) => ({
      name: s.mealName,
      mealId: ids.get(s.mealName),
      lastPlanned: s.lastPlanned,
      timesPlanned: s.timesPlanned,
      timesPlannedRecently: s.timesPlannedRecently,
      inWindow: compare(s.lastPlanned, windowStart) >= 0,
    }));
    const compareBy: Record<StatsSort, (a: StatsRow, b: StatsRow) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      last: (a, b) => compare(a.lastPlanned, b.lastPlanned),
      times: (a, b) => a.timesPlanned - b.timesPlanned,
      recent: (a, b) => a.timesPlannedRecently - b.timesPlannedRecently,
    };
    rows.sort((a, b) => {
      const primary = compareBy[sort](a, b) * (dir === "asc" ? 1 : -1);
      return primary || a.name.localeCompare(b.name);
    });

    return c.html(
      statsPage({
        chrome: chrome(c, deps),
        rows,
        neverPlanned: meals
          .filter((m) => !stats.has(m.name))
          .map((m) => ({ id: m.id, name: m.name, enabled: m.enabled })),
        sort,
        dir,
        windowDays: historyWindowDays,
      }),
    );
  });
}
