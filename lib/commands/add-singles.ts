import { saveMealPlan } from "../todos/index.ts";
import { loadData, type RecipeIngredient } from "../data/index.ts";
import { TodoistApi } from "@doist/todoist-sdk";

export interface Config {
  /**
   * Where to find the recipe data.
   */
  mealRepo: string;
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
export async function addSingles({ mealRepo, todoistToken, recipes }: Config) {
  /**
   * Load up data files
   */

  const data = await loadData({
    mealsDirectory: mealRepo,
  });
  const pickedRecipes = data.recipes.filter((r) => recipes.includes(r.title));
  if (pickedRecipes.length !== recipes.length) {
    throw new Error("Didn't find all the recipes");
  }

  const ingredientAliases = data.ingredients
    .filter((i) => !(i.include_in_shopping === false))
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

  const cookingDate = new Date().toISOString().split("T")[0]!;

  const ingredientsToPlan = pickedRecipes
    .flatMap((r) => r.ingredients)
    .flatMap((i) => i.ingredients)
    .map((ingredient) => ({
      quantity: ingredient.quantity,
      ingredient: ingredientAliases[ingredient.ingredient],
      cookingDate,
    }))
    .filter(
      (i): i is { ingredient: string; quantity: string; cookingDate: string } =>
        Boolean(i.ingredient),
    )
    .sort((a, b) => a.ingredient.localeCompare(b.ingredient));

  await saveMealPlan(new TodoistApi(todoistToken), ingredientsToPlan, []);
}
