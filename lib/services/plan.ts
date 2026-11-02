import { recentMealNames, recordMeals } from "../db/history.ts";
import { listMeals } from "../db/meals.ts";
import { getSettings } from "../db/settings.ts";
import {
  chooseAtRandom,
  mealDates,
  randomWithFreezing,
} from "../recipe-choice/index.ts";
import { loadFullMeals, type MealWithRecipes } from "../recipes/mod.ts";
import {
  addCookingTasks,
  addGroceryTasks,
  ensureTargets,
  listUpcomingCooking,
  plannedDaysInWindow,
  type GroceryItem,
} from "../todos/index.ts";
import { cleanupTasks } from "./cleanup.ts";
import type { Logger, RunContext } from "./runner.ts";
import { ensureRecipes, groceriesFor, type ServiceDeps } from "./shared.ts";

/**
 * Prefer meals not planned within the history window. If they can't cover
 * the days needed, re-admit the oldest recently planned meals until they do.
 */
export function filterRecentlyPlanned(
  meals: MealWithRecipes[],
  recent: Map<string, string>,
  daysNeeded: number,
  windowDays: number,
  log: Logger,
): MealWithRecipes[] {
  const preferred = meals.filter((m) => !recent.has(m.name));
  const preferredDays = preferred.reduce((s, m) => s + m.feeds, 0);

  if (preferredDays >= daysNeeded) {
    return preferred;
  }

  const reAdmit = meals
    .filter((m) => recent.has(m.name))
    .sort((a, b) => recent.get(a.name)!.localeCompare(recent.get(b.name)!));

  const pool = [...preferred];
  let available = preferredDays;
  for (const meal of reAdmit) {
    if (available >= daysNeeded) break;
    pool.push(meal);
    available += meal.feeds;
  }

  const excluded = meals.length - pool.length;
  log.warn(
    `Pool after ${windowDays}-day filter only covers ${preferredDays} day(s) ` +
      `(need ${daysNeeded}). Re-admitting oldest recently-used meals; ` +
      `${excluded} still excluded.`,
  );
  return pool;
}

/**
 * Clean up, then top the Cooking and Groceries projects up to `daysToPlan`.
 */
export async function plan(deps: ServiceDeps, ctx: RunContext): Promise<void> {
  const { db, recipeBook } = deps;
  const settings = getSettings(db);
  const today = deps.today();
  const { log, summary } = ctx;

  const recipes = await ensureRecipes(deps, ctx);
  ctx.checkpoint();

  const api = deps.todoist(ctx.signal);
  await cleanupTasks(api, today, ctx);
  ctx.checkpoint();

  /**
   * Work out how many days need filling
   */
  const upcoming = await listUpcomingCooking(api, today);
  const missingDays =
    settings.daysToPlan -
    plannedDaysInWindow(upcoming, today, settings.daysToPlan);
  summary.mealsAdded = [];
  summary.groceryTasksAdded = 0;
  ctx.save();

  if (missingDays <= 0) {
    log.info(
      `The next ${settings.daysToPlan} day(s) are already planned. Nothing to add`,
    );
    return;
  }
  log.info(`Planning ${missingDays} day(s)`);

  /**
   * Pick meals
   */
  const loaded = loadFullMeals(
    listMeals(db, { status: "enabled" }),
    recipes.recipes,
  );
  for (const { name, missing } of loaded.skipped) {
    log.warn(
      `Skipped ${name}: recipe ${missing.map((t) => `"${t}"`).join(", ")} isn't in the recipe book`,
    );
  }
  if (loaded.meals.length === 0) {
    throw new Error(
      loaded.skipped.length
        ? "No meals to plan: every enabled meal refers to a missing recipe"
        : "No meals to plan: add or enable a meal first",
    );
  }

  const recent = recentMealNames(db, settings.historyWindowDays, today);
  const pool = filterRecentlyPlanned(
    loaded.meals,
    recent,
    missingDays,
    settings.historyWindowDays,
    log,
  );

  const toAdd = settings.planToFreeze
    ? randomWithFreezing(missingDays, pool)
    : chooseAtRandom(missingDays, pool);

  const mealDays = mealDates(
    upcoming.map((u) => u.date),
    today,
    toAdd,
  );

  // Associate each ingredient with the last cooking day of its meal — that way
  // missing one day in a multi-day run still leaves time to shop before the
  // item becomes stale.
  let dayOffset = 0;
  const groceries: GroceryItem[] = [];
  const mealsAdded: Array<{ name: string; dates: string[] }> = [];
  const warned = new Set<string>();
  for (const meal of toAdd) {
    const dates = mealDays
      .slice(dayOffset, dayOffset + meal.feeds)
      .map((d) => d.date);
    mealsAdded.push({ name: meal.name, dates });
    groceries.push(
      ...groceriesFor(meal, dates.at(-1)!, recipeBook.aliases, log, warned),
    );
    dayOffset += meal.feeds;
  }

  /**
   * Write to Todoist: cooking first, so a retry won't plan the same days again
   */
  ctx.checkpoint();
  const targets = await ensureTargets(api);
  await addCookingTasks(api, targets, mealDays, ctx.recordTask);
  recordMeals(
    db,
    toAdd.map((m) => m.name),
    today,
  );
  summary.mealsAdded = mealsAdded;
  ctx.save();
  for (const { name, dates } of mealsAdded) {
    log.info(`Added ${name}: ${dates.join(", ")}`);
  }

  ctx.checkpoint();
  summary.groceryTasksAdded = await addGroceryTasks(
    api,
    targets,
    groceries,
    ctx.recordTask,
  );
  ctx.save();
  log.info(`Added ${summary.groceryTasksAdded} grocery task(s)`);
}
