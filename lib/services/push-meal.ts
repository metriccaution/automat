import { recordMeals } from "../db/history.ts";
import { getMeal, type Meal } from "../db/meals.ts";
import { compare } from "../dates.ts";
import { mealDates, pickDates } from "../recipe-choice/index.ts";
import {
  daysWithFreezing,
  suitableForFreezing,
  updateForFreezing,
} from "../recipe-choice/util.ts";
import { loadFullMeals } from "../recipes/mod.ts";
import {
  addCookingTasks,
  addGroceryTasks,
  ensureTargets,
  listUpcomingCooking,
} from "../todos/index.ts";
import type { RunContext } from "./runner.ts";
import { ensureRecipes, groceriesFor, type ServiceDeps } from "./shared.ts";

export interface PushParams {
  mealId: number;
  /**
   * Start date: the meal takes the next free days on or after this.
   */
  date: string;
  /**
   * Freeze some portions, if the meal suits it.
   */
  freeze: boolean;
}

/**
 * Whether the "plan to freeze" option applies to a meal.
 */
export const canFreeze = (meal: Pick<Meal, "feeds" | "freezable">) =>
  suitableForFreezing(meal);

/**
 * How many days a push will cover.
 */
export const pushDayCount = (
  meal: Pick<Meal, "feeds" | "freezable">,
  freeze: boolean,
) => (freeze && canFreeze(meal) ? daysWithFreezing(meal.feeds) : meal.feeds);

/**
 * The days a push will take: the next days with no cooking, from the start.
 */
export function pushDays(
  meal: Pick<Meal, "feeds" | "freezable">,
  start: string,
  usedDates: string[],
  freeze: boolean,
): string[] {
  return pickDates(start, usedDates, pushDayCount(meal, freeze));
}

/**
 * Add one meal to Todoist, from a chosen date.
 */
export async function pushMeal(
  deps: ServiceDeps,
  ctx: RunContext,
  params: PushParams,
): Promise<void> {
  const { db, recipeBook } = deps;
  const { log, summary } = ctx;
  const today = deps.today();

  const meal = getMeal(db, params.mealId);
  if (!meal) throw new Error(`No meal with ID ${params.mealId}`);

  const recipes = await ensureRecipes(deps, ctx);
  const loaded = loadFullMeals([meal], recipes.recipes);
  const skipped = loaded.skipped[0];
  if (skipped) {
    throw new Error(
      `Recipe ${skipped.missing.map((t) => `"${t}"`).join(", ")} isn't in the recipe book`,
    );
  }
  const full = loaded.meals[0]!;
  const toAdd =
    params.freeze && suitableForFreezing(full) ? updateForFreezing(full) : full;

  ctx.checkpoint();
  const api = deps.todoist(ctx.signal);
  const upcoming = await listUpcomingCooking(api, today);
  const start = compare(params.date, today) < 0 ? today : params.date;
  const mealDays = mealDates(
    upcoming.map((u) => u.date),
    start,
    [toAdd],
  );
  const dates = mealDays.map((d) => d.date);
  const groceries = groceriesFor(toAdd, dates.at(-1)!, recipeBook.aliases, log);

  ctx.checkpoint();
  const targets = await ensureTargets(api);
  await addCookingTasks(api, targets, mealDays, ctx.recordTask);
  recordMeals(db, [toAdd.name], today);
  summary.mealsAdded = [{ name: toAdd.name, dates }];
  ctx.save();
  log.info(`Added ${toAdd.name}: ${dates.join(", ")}`);

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
