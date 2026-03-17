import type { MealWithRecipes as Meal } from "../recipes/mod.ts";

export function arrayShuffle<T>(array: T[]): T[] {
  for (let i = array.length; i > 0; i--) {
    const toSwap = Math.floor(Math.random() * i);
    const item: T = array[toSwap]!;
    array[toSwap] = array[i - 1]!;
    array[i - 1] = item;
  }

  return array;
}

export const suitableForFreezing = (meal: Meal): boolean => meal.feeds >= 3;

export const updateForFreezing = (meal: Meal): Meal => {
  switch (meal.feeds) {
    case 0:
    case 1:
    case 2:
      return meal;
    case 3:
    case 4:
      return {
        ...meal,
        feeds: meal.feeds - 1,
        name: `${meal.name} (Freeze one)`,
      };

    default:
      return {
        ...meal,
        feeds: meal.feeds - 2,
        name: `${meal.name} (Freeze two)`,
      };
  }
};
