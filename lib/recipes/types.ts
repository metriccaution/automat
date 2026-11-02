/**
 * Data types for recipe planning
 */

import type { Recipe, RecipeIngredient } from "../data/index.ts";

/**
 * A meal with all the recipes replaced with their full contents.
 */
export interface MealWithRecipes {
  name: string;
  feeds: number;
  freezable: boolean;
  recipes: Recipe[];
  otherIngredients: RecipeIngredient[];
}
