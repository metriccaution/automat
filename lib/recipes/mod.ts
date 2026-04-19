import type { MealWithRecipes } from "./types.ts";
import type { RawData, RecipeIngredient } from "../data/index.ts";

export { collateRecipes } from "./collate.ts";
export type { MealWithRecipes } from "./types.ts";

export function loadFullMeals({ recipes, meals }: RawData): MealWithRecipes[] {
  const ret: MealWithRecipes[] = [];
  for (const meal of meals) {
    const mealRecipes = meal.recipes.map((recipe) => {
      const match = recipes.find((r) => r.title === recipe);
      if (!match) {
        throw new Error(
          `Couldn't merge meal ${meal.name}, no recipe match for ${recipe}`,
        );
      }

      return match;
    });

    ret.push({
      ...meal,
      recipes: mealRecipes,
    });
  }

  return ret;
}

export function mealIngredients(meal: MealWithRecipes): RecipeIngredient[] {
  const ret: RecipeIngredient[] = [];
  for (const recipe of meal.recipes) {
    for (const ingredientGroup of recipe.ingredients) {
      for (const ingredient of ingredientGroup.ingredients) {
        ret.push(ingredient);
      }
    }
  }

  for (const other of meal.otherIngredients) {
    ret.push(other);
  }

  return ret;
}
