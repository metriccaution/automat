import type { MealWithRecipes as Meal } from "../recipes/mod.ts";
import type { RecipeIngredient } from "../data/index.ts";
import { addDays } from "../dates.ts";
import {
  arrayShuffle,
  suitableForFreezing,
  updateForFreezing,
} from "./util.ts";

export function chooseAtRandom(days: number, recipes: Meal[]): Meal[] {
  if (days <= 0 || recipes.length === 0) {
    return [];
  }

  let daysPicked = 0;
  const chosen: Meal[] = [];

  while (days > daysPicked) {
    const pickFrom = arrayShuffle(recipes.slice());
    while (days > daysPicked && pickFrom.length) {
      const recipe = pickFrom.shift()!;
      chosen.push(recipe);
      daysPicked = daysPicked + recipe.feeds;
    }
  }
  return chosen;
}

/**
 * Apply the freezing rule to every meal it suits, then pick at random.
 */
export function randomWithFreezing(days: number, recipes: Meal[]): Meal[] {
  const withFreezing = recipes.map((r) =>
    suitableForFreezing(r) ? updateForFreezing(r) : r,
  );
  return chooseAtRandom(days, withFreezing);
}

/**
 * Pick the next `days` calendar dates, on or after `startAt`, which aren't
 * already in use.
 */
export function pickDates(
  startAt: string,
  alreadyUsed: Iterable<string>,
  days: number,
): string[] {
  const used = new Set(alreadyUsed);
  const chosenDays: string[] = [];
  let currentDay = startAt;
  while (chosenDays.length < days) {
    if (!used.has(currentDay)) {
      chosenDays.push(currentDay);
    }
    currentDay = addDays(currentDay, 1);
  }

  return chosenDays;
}

export interface RecipeForDay {
  title: string;
  date: string;
  recipes: Array<{ title: string; slug: string }>;
  otherIngredients: RecipeIngredient[];
}

/**
 * Lay meals out over the next free days, each meal taking `feeds` days.
 */
export function mealDates(
  alreadyUsed: Iterable<string>,
  startAt: string,
  meals: Meal[],
): RecipeForDay[] {
  const mealEntries = meals.flatMap((meal) =>
    new Array<Omit<RecipeForDay, "date">>(meal.feeds).fill({
      title: meal.name,
      recipes: meal.recipes.map((r) => ({ title: r.title, slug: r.slug })),
      otherIngredients: meal.otherIngredients,
    }),
  );
  const dates = pickDates(startAt, alreadyUsed, mealEntries.length);

  return mealEntries.map((entry, i) => ({ ...entry, date: dates[i]! }));
}
