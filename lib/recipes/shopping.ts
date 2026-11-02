import type { Ingredient } from "../data/index.ts";
import type { MealWithRecipes } from "./types.ts";

export interface ShoppingItem {
  /**
   * Canonical ingredient name (alternatives joined with " / ").
   */
  ingredient: string;
  quantity: string;
  /**
   * Where the item came from: a recipe title, or "Other ingredients".
   */
  source: string;
  /**
   * Parts of the name that aren't in the ingredient database.
   */
  unknown: string[];
}

export const OTHER_INGREDIENTS = "Other ingredients";

/**
 * Build a lookup from every ingredient name and synonym to the ingredient.
 */
export function ingredientAliases(
  ingredients: Ingredient[],
): Map<string, Ingredient> {
  const aliases = new Map<string, Ingredient>();
  for (const ingredient of ingredients) {
    for (const alias of ingredient.synonyms) {
      aliases.set(alias, ingredient);
    }
  }
  // Canonical names win over another ingredient's synonym
  for (const ingredient of ingredients) {
    aliases.set(ingredient.name, ingredient);
  }
  return aliases;
}

/**
 * The shopping list for a meal: what planning, push meal and the ingredient
 * preview all put in Groceries.
 *
 * - Names are split on " / " (alternatives), and each part mapped through
 *   names and synonyms to its canonical name.
 * - Items where every part is marked `include_in_shopping: false` are dropped.
 * - Parts that aren't in the ingredient database are kept under their raw
 *   name, and listed in `unknown`.
 */
export function resolveShoppingList(
  meal: Pick<MealWithRecipes, "recipes" | "otherIngredients">,
  ingredients: Ingredient[] | Map<string, Ingredient>,
): ShoppingItem[] {
  const aliases =
    ingredients instanceof Map ? ingredients : ingredientAliases(ingredients);

  const raw = [
    ...meal.recipes.flatMap((recipe) =>
      recipe.ingredients.flatMap((group) =>
        group.ingredients.map((i) => ({ ...i, source: recipe.title })),
      ),
    ),
    ...meal.otherIngredients.map((i) => ({
      ...i,
      source: OTHER_INGREDIENTS,
    })),
  ];

  const items: ShoppingItem[] = [];
  for (const { ingredient, quantity, source } of raw) {
    const parts = ingredient
      .split(" / ")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => ({ raw: part, match: aliases.get(part) }));

    if (parts.length === 0) continue;
    if (parts.every((p) => p.match?.include_in_shopping === false)) continue;

    items.push({
      ingredient: parts.map((p) => p.match?.name ?? p.raw).join(" / "),
      quantity,
      source,
      unknown: parts.filter((p) => !p.match).map((p) => p.raw),
    });
  }

  return items;
}
