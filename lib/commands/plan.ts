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
} from "../recipe-choice/mod.ts";
import { loadData } from "../data/mod.ts";
import { removeUnplannedIngredient } from "../recipes/filtered-ingredients.ts";

export interface Config {
  /**
   * Where to find the recipe data.
   */
  dataFile: string;
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
}

/**
 * Put a number of day's food into Todoist.
 */
export async function planMeals({
  dataFile,
  todoistToken,
  daysToPlan,
  planToFreeze,
}: Config) {
  /**
   * Housekeeping
   */
  await cleanupCooking(todoistToken);

  // TODO - Clean up shopping related to old cooking items

  /**
   * Load up data files
   */

  const [meals, daysAlreadyPlanned] = await Promise.all([
    loadFullMeals(await loadData(dataFile)),
    listPlannedDays(todoistToken),
  ]);

  /**
   * Pick upcoming cooking
   */

  const missingDaysFood = daysToPlan - daysAlreadyPlanned.length;
  const toAdd = planToFreeze
    ? randomWithFreezing(missingDaysFood, meals)
    : chooseAtRandom(missingDaysFood, meals);

  const ingredients = toAdd
    .flatMap((m) => mealIngredients(m))
    .filter(removeUnplannedIngredient);
  const mealDays = mealDates(
    daysAlreadyPlanned,
    toAdd.map((meal) => meal.feeds).reduce((s, i) => s + i, 0),
    toAdd,
  );

  /**
   * Add any new shopping
   */

  await saveMealPlan(todoistToken, ingredients, mealDays);

  // TODO - Normalise the shopping list down
}
