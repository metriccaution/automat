import type { MealWithRecipes } from "./types.ts";
import type { Recipe } from "../data/index.ts";
import type { MealInput } from "../db/meals.ts";

export type { MealWithRecipes } from "./types.ts";

type MealDefinition = Pick<
  MealInput,
  "name" | "feeds" | "freezable" | "recipes" | "otherIngredients"
>;

/**
 * Recipe titles a meal refers to that aren't in the recipe book.
 */
export function missingRecipes(
  meal: Pick<MealInput, "recipes">,
  recipes: Recipe[],
): string[] {
  const titles = new Set(recipes.map((r) => r.title));
  return meal.recipes.filter((title) => !titles.has(title));
}

/**
 * Swap recipe titles for the full recipes. Meals referring to a recipe that
 * isn't in the recipe book are skipped and returned separately.
 */
export function loadFullMeals(
  meals: MealDefinition[],
  recipes: Recipe[],
): {
  meals: MealWithRecipes[];
  skipped: Array<{ name: string; missing: string[] }>;
} {
  const byTitle = new Map(recipes.map((r) => [r.title, r]));
  const ret: MealWithRecipes[] = [];
  const skipped: Array<{ name: string; missing: string[] }> = [];

  for (const meal of meals) {
    const missing = meal.recipes.filter((title) => !byTitle.has(title));
    if (missing.length > 0) {
      skipped.push({ name: meal.name, missing });
      continue;
    }

    ret.push({
      name: meal.name,
      feeds: meal.feeds,
      freezable: meal.freezable,
      otherIngredients: meal.otherIngredients,
      recipes: meal.recipes.map((title) => byTitle.get(title)!),
    });
  }

  return { meals: ret, skipped };
}
