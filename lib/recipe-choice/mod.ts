import type { MealWithRecipes as Meal } from "../recipes/mod.ts";
import {
  arrayShuffle,
  suitableForFreezing,
  updateForFreezing,
} from "./util.ts";

export function chooseAtRandom(days: number, recipes: Meal[]): Meal[] {
  if (days === 0 || recipes.length === 0) {
    return [];
  }

  let daysPicked = 0;
  const chosen: Meal[] = [];

  while (days > daysPicked) {
    const pickFrom = arrayShuffle(recipes.slice());
    while (days > daysPicked && pickFrom.length) {
      const recipe = pickFrom.splice(0, 1)[0]!;
      chosen.push(recipe);
      daysPicked = daysPicked + recipe.feeds;
    }
  }
  return chosen;
}

export function randomWithFreezing(days: number, recipes: Meal[]): Meal[] {
  if (days === 0 || recipes.length === 0) {
    return [];
  }

  let daysPicked = 0;
  const chosen: Meal[] = [];

  const withFreezing = recipes.map((r) =>
    suitableForFreezing(r) ? updateForFreezing(r) : r,
  );

  while (days > daysPicked) {
    const pickFrom = arrayShuffle(withFreezing.slice());
    while (days > daysPicked && pickFrom.length) {
      const recipe = pickFrom.splice(0, 1)[0]!;
      chosen.push(recipe);
      daysPicked = daysPicked + recipe.feeds;
    }
  }
  return chosen;
}

const removeTime = (date: Date): Date =>
  new Date(date.toISOString().split("T")[0]!);

/**
 * Pick the next `n` days which aren't already in use
 */
export function pickDates(
  startAt: Date,
  alreadyUsed: Date[],
  days: number,
): Date[] {
  let currentDay = removeTime(startAt);
  const alreadyUsedDays = alreadyUsed.map((d) => removeTime(d).getTime());

  const chosenDays: Date[] = [];
  while (chosenDays.length < days) {
    if (!alreadyUsedDays.includes(currentDay.getTime())) {
      chosenDays.push(new Date(currentDay));
    }

    currentDay = new Date(currentDay.getTime() + 1000 * 60 * 60 * 24);
  }

  return chosenDays;
}

export interface RecipeForDay {
  title: string;
  date: Date;
}

export function mealDates(
  alreadyUsed: Date[],
  days: number,
  meals: Meal[],
): RecipeForDay[] {
  const mealTitles: string[] = meals.flatMap((meal) =>
    new Array(meal.feeds).fill(meal.name),
  );
  const dates: Date[] = pickDates(new Date(), alreadyUsed, days);

  if (dates.length !== mealTitles.length) {
    throw new Error(
      `Mismatched dates and meal titles: ${dates}, ${mealTitles}`,
    );
  }

  const ret: RecipeForDay[] = [];
  for (let i = 0; i < dates.length; i++) {
    ret.push({
      title: mealTitles[i]!,
      date: dates[i]!,
    });
  }

  return ret;
}
