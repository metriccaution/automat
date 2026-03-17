import type { RecipeIngredient } from "../data/mod.ts";

const unplanned = ["Water", "Salt", "Black Pepper"];

/**
 * Some ingredients never really need to end up on the shopping list (e.g. water),
 * this filteres those out.
 */
export const removeUnplannedIngredient = (
  ingredient: RecipeIngredient,
): boolean => !unplanned.includes(ingredient.ingredient);
