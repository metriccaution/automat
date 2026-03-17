/**
 * Data types for recipe planning
 */

import type { Meal, Recipe } from "../data/mod.ts";

/**
 * A meal with all the recipes replaced with their full contents.
 */
export type MealWithRecipes = Omit<Meal, "recipes"> & {
  recipes: Recipe[];
};
