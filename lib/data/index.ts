import { readFile } from "node:fs/promises";

/**
 * Metadata about an ingredient
 */
export interface Ingredient {
  name: string;
  include?: boolean;
  synonyms: string[];
  measure: "volume" | "can" | "weight" | "singles" | "spice";
}

/**
 * A single line-item for a recipe
 */
export interface MealIngredient {
  quantity: string;
  ingredient: string;
  notes: string;
}

/**
 * A full meal - expands upon a recipe by adding other ingredients (e.g.
 * adding rice to a curry recipe), and some metadata about how many meals it
 * will provide.
 */
export interface Meal {
  name: string;
  feeds: number;
  recipes: string[];
  otherIngredients: MealIngredient[];
}

/**
 * A single line-item for a recipe
 */
export interface RecipeIngredient {
  quantity: string;
  ingredient: string;
  notes: string;
}

/**
 * A grouping of ingredients, either:
 *
 * - `group` _is_ present, then the ingredients are grouped into sections
 * - `group` _isn't_ present, then its a catch-all group
 */
export interface IngredientGroup {
  group?: string;
  ingredients: RecipeIngredient[];
}

/**
 * A sequence of cooking instructions
 */
export interface InstructionGroup {
  group?: string;
  description?: string;
  steps: string[];
}

/**
 * Metadata about a recipe - The parts we need for meal planning, but misses out
 * things like the actual cooking steps.
 */
export interface Metadata {
  title: string;
  section: string;
  tags: string[];
  ingredients: IngredientGroup[];
}

// TODO - Parse cooking steps

/**
 * The full recipe details.
 *
 * **Note** - This is still very much a work in progress!
 */
export interface Recipe extends Metadata {
  description?: string;
  instructions: InstructionGroup[];
  source?: { description: string };
  prepTime?: string;
  cookingTime?: string;
  // TODO - Equipment
}

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
