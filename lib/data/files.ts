import { YAML } from "bun";
import { readdir } from "node:fs/promises";
import { z } from "zod";
import { recipeIngredient } from "./web";
import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

export type Meal = z.infer<typeof meal>;

const meal = z.object({
  name: z.string(),
  feeds: z.int().positive(),
  recipes: z.array(z.string()).min(1),
  otherIngredients: z.array(recipeIngredient),
});

export async function loadMealsDirectory(
  mealsDirectory: string,
): Promise<Meal[]> {
  const meals: Meal[] = [];
  for (const file of await readdir(mealsDirectory)) {
    const stats = await lstat(join(mealsDirectory, file));
    if (!stats.isFile()) {
      continue;
    }

    meals.push(
      meal.parse(
        YAML.parse(await readFile(join(mealsDirectory, file), "utf-8")),
      ),
    );
  }

  return meals;
}
