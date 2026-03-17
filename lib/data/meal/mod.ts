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
