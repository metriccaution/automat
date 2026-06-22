import { readFile } from "node:fs/promises";
import { loadRepo, type Ingredient, type Recipe } from "./web";
import { loadMealsDirectory, type Meal } from "./files";
export type { RecipeIngredient, Recipe, Ingredient } from "./web";
export type { Meal } from "./files";

/**
 * The whole recipe list
 */
export interface RawData {
  ingredients: Ingredient[];
  recipes: Recipe[];
  meals: Meal[];
}

/**
 * Required arguments for loading all of the data
 */
export interface DataSourceProps {
  mealsDirectory: string;
  recipesUrl?: string;
}

/**
 * Load all of the raw data files.
 */
export async function loadData(config: DataSourceProps): Promise<RawData> {
  const [{ ingredients, recipes }, meals] = await Promise.all([
    loadRepo(config.recipesUrl),
    loadMealsDirectory(config.mealsDirectory),
  ]);

  if (ingredients.length === 0) {
    throw new Error("No ingredients found");
  }

  if (recipes.length === 0) {
    throw new Error("No recipes found");
  }

  if (meals.length === 0) {
    throw new Error("No meals found");
  }

  return {
    ingredients,
    meals,
    recipes,
  };
}
