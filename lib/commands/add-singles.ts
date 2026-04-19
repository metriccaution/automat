import { saveMealPlan } from "../todos/index.ts";
import { loadData, type RecipeIngredient } from "../data/index.ts";
import { TodoistApi } from "@doist/todoist-api-typescript";

export interface Config {
  /**
   * Where to find the recipe data.
   */
  dataFile: string;
  /**
   * API token for Todoist.
   */
  todoistToken: string;
  /**
   * What food to add.
   */
  recipes: string[];
  /**
   * Any other ingredients.
   */
  ingredients: RecipeIngredient[];
}

/**
 * Add the ingredients for a one-off plan.
 */
export async function addSingles({ dataFile, todoistToken, recipes }: Config) {
  /**
   * Load up data files
   */

  const data = await loadData(dataFile);
  const pickedRecipes = data.recipes.filter((r) => recipes.includes(r.title));
  if (pickedRecipes.length !== recipes.length) {
    throw new Error("Didn't find all the recipes");
  }

  const ingredientAliases = data.ingredients
    .filter((i) => !(i.include === false))
    .reduce(
      (aliases, ingredient) => {
        aliases[ingredient.name] = ingredient.name;
        for (const alias of ingredient.synonyms) {
          aliases[alias] = ingredient.name;
        }

        return aliases;
      },
      {} as Record<string, string>,
    );

  const ingredientsToPlan = pickedRecipes
    .flatMap((r) => r.ingredients)
    .flatMap((i) => i.ingredients)
    .map((ingredient) => ({
      quantity: ingredient.quantity,
      ingredient: ingredientAliases[ingredient.ingredient],
    }))
    .filter((i): i is RecipeIngredient => Boolean(i.ingredient))
    .sort((a, b) => a.ingredient.localeCompare(b.ingredient));

  await saveMealPlan(new TodoistApi(todoistToken), ingredientsToPlan, []);
}
