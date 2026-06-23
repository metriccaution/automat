import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEnvelope {
  fetchedAt: number;
  data: unknown;
}

export async function fetchRepo(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Couldn't fetch recipes from ${url} : ${res.status}`);
  }

  return res.json();
}

async function cachedFetchRepo(url: string): Promise<unknown> {
  const cacheDir = join(tmpdir(), "automat-recipe-cache");
  const cacheKey = createHash("sha256").update(url).digest("hex");
  const cachePath = join(cacheDir, `${cacheKey}.json`);

  try {
    const raw = await readFile(cachePath, "utf-8");
    const envelope = JSON.parse(raw) as CacheEnvelope;
    if (Date.now() - envelope.fetchedAt < CACHE_TTL_MS) {
      return envelope.data;
    }
  } catch {
    // Cache miss or unreadable — fall through to live fetch
  }

  const data = await fetchRepo(url);

  try {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(
      cachePath,
      JSON.stringify({ fetchedAt: Date.now(), data }),
      "utf-8",
    );
  } catch {
    // Cache write failure is non-fatal
  }

  return data;
}

export async function loadRepo(
  url: string = "https://metriccaution.github.io/recipe-book/repo.json",
): Promise<Repo> {
  const rawData = await cachedFetchRepo(url);
  return repoData.parse(rawData);
}
