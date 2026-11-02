import { z } from "zod";

export type Repo = z.infer<typeof repoData>;
export type Recipe = z.infer<typeof recipe>;
export type RecipeIngredient = z.infer<typeof recipeIngredient>;
export type Ingredient = z.infer<typeof ingredient>;

export const recipeIngredient = z.object({
  ingredient: z.string(),
  quantity: z.string(),
});

export const recipe = z.object({
  identifier: z.string(),
  title: z.string(),
  slug: z.string(),
  section: z.string(),
  ingredients: z.array(
    z.object({
      ingredients: z.array(
        z.object({
          ingredient: z.string(),
          quantity: z.string(),
        }),
      ),
    }),
  ),
});

export const ingredient = z.object({
  name: z.string(),
  include_in_shopping: z.boolean().optional().default(true),
  synonyms: z.array(z.string()),
  measure: z.string(),
});

export const repoData = z.object({
  ingredients: z.array(ingredient),
  recipes: z.array(recipe),
});

export const RECIPE_BOOK_BASE = "https://metriccaution.github.io/recipe-book/";

export const recipeUrl = (slug: string) => `${RECIPE_BOOK_BASE}${slug}/`;

/**
 * Validate a recipe book response, including the non-empty checks.
 */
export function parseRepo(raw: unknown): Repo {
  const repo = repoData.parse(raw);
  if (repo.ingredients.length === 0) {
    throw new Error("No ingredients found");
  }
  if (repo.recipes.length === 0) {
    throw new Error("No recipes found");
  }
  return repo;
}
