import { readFile } from "node:fs/promises";

import type { Ingredient } from "./ingredient/mod.ts";
import type { Meal } from "./meal/mod.ts";
import type { Recipe } from "./recipe/mod.ts";

export type { Meal } from "./meal/mod.ts";
export type { Recipe, RecipeIngredient } from "./recipe/mod.ts";
export type { Ingredient } from "./ingredient/mod.ts";

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
  ingredientsDirectory: string;
  mealsDirectory: string;
  recipiesDirectory: string;
}

// TODO - Validate this

/**
 * Load all of the raw data files.
 */
export async function loadData(filePath: string): Promise<RawData> {
  const text = await readFile(filePath, "utf-8");
  return JSON.parse(text);
}
