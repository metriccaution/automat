import { RecipeDefinition } from "../types";

export default function chooseAtRandom(
  days: number,
  recipes: RecipeDefinition[]
): RecipeDefinition[] {
  if (days === 0 || recipes.length === 0) {
    return [];
  }

  let daysPicked = 0;
  const chosen: RecipeDefinition[] = [];

  while (chosen.length < days) {
    const pickFrom = arrayShuffle(recipes.slice());
    while (days > daysPicked && pickFrom.length) {
      const recipe = pickFrom.splice(0, 1)[0];
      chosen.push(recipe);
      daysPicked = daysPicked + recipe.meals;
    }
  }
  return chosen;
}

export function arrayShuffle<T>(array: T[]): T[] {
  for (let i = array.length; i > 0; i--) {
    const toSwap = Math.floor(Math.random() * i);
    const item: T = array[toSwap];
    array[toSwap] = array[i - 1];
    array[i - 1] = item;
  }

  return array;
}
