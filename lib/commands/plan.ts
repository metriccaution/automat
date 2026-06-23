import { loadFullMeals, mealIngredients } from "../recipes/mod.ts";
import {
  cleanupCooking,
  listPlannedDays,
  saveMealPlan,
} from "../todos/index.ts";
import {
  chooseAtRandom,
  mealDates,
  randomWithFreezing,
} from "../recipe-choice/index.ts";
import { loadData } from "../data/index.ts";
import { TodoistApi } from "@doist/todoist-api-typescript";
import { openHistory, recentMealNames, recordMeals } from "../data/history.ts";

export interface Config {
  /**
   * Where to find the recipe data.
   */
  mealRepo: string;
  /**
   * API token for Todoist.
   */
  todoistToken: string;
  /**
   * How many days to plan food for.
   */
  daysToPlan: number;
  /**
   * Any meals with enough helpings will include an assumption a portion will
   * be frozen.
   */
  planToFreeze: boolean;
  /**
   * Path to the SQLite DB file for meal history tracking.
   * If omitted, history is not recorded and no filtering is applied.
   */
  historyDb?: string;
}

/**
 * Put a number of day's food into Todoist.
 */
export async function planMeals({
  mealRepo,
  todoistToken,
  daysToPlan,
  planToFreeze,
  historyDb,
}: Config) {
  const api = new TodoistApi(todoistToken);

  /**
   * Housekeeping
   */
  await cleanupCooking(api);

  // TODO - Clean up shopping related to old cooking items

  /**
   * Load up data files
   */

  const [rawData, daysAlreadyPlanned] = await Promise.all([
    loadData({ mealsDirectory: mealRepo }),
    listPlannedDays(api),
  ]);
  const meals = loadFullMeals(rawData);
  const excludedIngredients = new Set(
    rawData.ingredients
      .filter((i) => !i.include_in_shopping)
      .map((i) => i.name),
  );

  /**
   * Pick upcoming cooking
   */

  const missingDaysFood = daysToPlan - daysAlreadyPlanned.length;

  const db = historyDb ? openHistory(historyDb) : null;

  let mealPool = meals;
  if (db !== null) {
    const recent = recentMealNames(db, 30);
    const preferred = meals.filter((m) => !recent.has(m.name));
    const preferredDays = preferred.reduce((s, m) => s + m.feeds, 0);

    if (preferredDays >= missingDaysFood) {
      mealPool = preferred;
    } else {
      const reAdmit = meals
        .filter((m) => recent.has(m.name))
        .sort((a, b) => recent.get(a.name)!.localeCompare(recent.get(b.name)!));

      mealPool = [...preferred];
      let available = preferredDays;
      for (const meal of reAdmit) {
        if (available >= missingDaysFood) break;
        mealPool.push(meal);
        available += meal.feeds;
      }

      const excluded = meals.length - mealPool.length;
      console.warn(
        `[history] Pool after 30-day filter only covers ${preferredDays} day(s) ` +
          `(need ${missingDaysFood}). Re-admitting oldest recently-used meals; ` +
          `${excluded} still excluded.`,
      );
    }
  }

  const toAdd = planToFreeze
    ? randomWithFreezing(missingDaysFood, mealPool)
    : chooseAtRandom(missingDaysFood, mealPool);

  const ingredients = toAdd
    .flatMap((m) => mealIngredients(m))
    .filter(
      (i) =>
        !i.ingredient
          .split(" / ")
          .map((part) => part.trim())
          .every((part) => excludedIngredients.has(part)),
    );
  const mealDays = mealDates(
    daysAlreadyPlanned,
    toAdd.map((meal) => meal.feeds).reduce((s, i) => s + i, 0),
    toAdd,
  );

  /**
   * Add any new shopping
   */

  await saveMealPlan(api, ingredients, mealDays);

  if (db !== null) {
    const today = new Date().toISOString().split("T")[0]!;
    recordMeals(db, toAdd, today);
    db.close();
  }

  // TODO - Normalise the shopping list down
}
