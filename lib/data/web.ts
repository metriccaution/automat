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
  include: z.boolean().optional().default(true),
  synonyms: z.array(z.string()),
  measure: z.string(),
});

export const repoData = z.object({
  ingredients: z.array(ingredient),
  recipes: z.array(recipe),
});

export async function fetchRepo(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Couldn't fetch recipes from ${url} : ${res.status}`);
  }

  return res.json();
}

export async function loadRepo(
  url: string = "https://metriccaution.github.io/recipe-book/repo.json",
): Promise<Repo> {
  const rawData = await fetchRepo(url);
  return repoData.parse(rawData);
}

// TODO - Add a cached version of the fetch
