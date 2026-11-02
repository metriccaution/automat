/**
 * One-time import of the old `meals/*.yaml` files into the database.
 *
 * To be removed once production has imported its meals (spec §10).
 */
import { parse as parseYaml } from "yaml";
import { existsSync } from "node:fs";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { recipeIngredient } from "../data/web.ts";
import { nowIso, transaction } from "../db/index.ts";
import { insertMeal } from "../db/meals.ts";
import { getInternal, setInternal } from "../db/settings.ts";

export type YamlMeal = z.infer<typeof meal>;

const meal = z.object({
  name: z.string(),
  feeds: z.int().positive(),
  recipes: z.array(z.string()).min(1),
  otherIngredients: z.array(recipeIngredient),
});

export async function loadMealsDirectory(
  mealsDirectory: string,
): Promise<YamlMeal[]> {
  const meals: YamlMeal[] = [];
  for (const file of (await readdir(mealsDirectory)).sort()) {
    const stats = await lstat(join(mealsDirectory, file));
    if (!stats.isFile()) {
      continue;
    }

    try {
      meals.push(
        meal.parse(
          parseYaml(await readFile(join(mealsDirectory, file), "utf-8")),
        ),
      );
    } catch (e) {
      throw new Error(`Couldn't read ${file}: ${(e as Error).message}`);
    }
  }

  return meals;
}

export type ImportResult =
  | { status: "already_imported" }
  | { status: "no_directory" }
  | { status: "imported"; count: number };

/**
 * Import the YAML meals, once. Keyed on the `mealsImportedAt` flag rather than
 * an empty table, so deleting every meal never brings the YAML back.
 *
 * Throws (without importing anything) if any file fails to parse.
 */
export async function importMealsOnce(
  db: DatabaseSync,
  mealsDirectory: string,
): Promise<ImportResult> {
  if (getInternal(db, "mealsImportedAt")) {
    return { status: "already_imported" };
  }
  if (!existsSync(mealsDirectory)) {
    return { status: "no_directory" };
  }

  const meals = await loadMealsDirectory(mealsDirectory);

  transaction(db, () => {
    for (const m of meals) {
      insertMeal(db, { ...m, enabled: true, freezable: true });
    }
    setInternal(db, "mealsImportedAt", nowIso());
  });

  return { status: "imported", count: meals.length };
}
