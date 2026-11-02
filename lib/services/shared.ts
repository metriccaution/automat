import type { TodoistApi } from "@doist/todoist-sdk";
import type { DatabaseSync } from "node:sqlite";
import type { Ingredient, Repo } from "../data/index.ts";
import type { RecipeBook } from "../recipes/book.ts";
import type { MealWithRecipes } from "../recipes/mod.ts";
import { resolveShoppingList } from "../recipes/shopping.ts";
import type { GroceryItem } from "../todos/index.ts";
import type { Logger, RunContext } from "./runner.ts";

/**
 * Everything a service needs, passed in so tests can use fakes.
 */
export interface ServiceDeps {
  db: DatabaseSync;
  recipeBook: RecipeBook;
  /**
   * A Todoist client bound to the run's signal.
   */
  todoist: (signal: AbortSignal) => TodoistApi;
  /**
   * Today's calendar date.
   */
  today: () => string;
}

/**
 * Refresh the recipe book if it has expired, then return it. A failed refresh
 * is logged and the cached data used; with no cached data, the run fails.
 */
export async function ensureRecipes(
  { recipeBook }: ServiceDeps,
  ctx: RunContext,
): Promise<Repo> {
  if (recipeBook.isExpired()) {
    try {
      const result = await recipeBook.refresh(ctx.signal);
      ctx.summary.recipes = result;
      ctx.log.info(
        result.outcome === "updated"
          ? `Recipe book updated: ${result.recipeCount} recipes, ${result.ingredientCount} ingredients`
          : "Recipe book checked: no changes",
      );
    } catch (e) {
      ctx.checkpoint();
      ctx.summary.recipes = recipeBook.failedSummary();
      ctx.log.warn(
        `${(e as Error).message}. Carrying on with the cached recipe book`,
      );
    }
    ctx.save();
  }
  return recipeBook.require();
}

/**
 * The shopping for a meal, dated to its last cooking day.
 */
export function groceriesFor(
  meal: MealWithRecipes,
  cookingDate: string,
  aliases: Map<string, Ingredient>,
  log: Logger,
  warned: Set<string> = new Set(),
): GroceryItem[] {
  return resolveShoppingList(meal, aliases).map((item) => {
    for (const unknown of item.unknown) {
      const key = `${unknown}\u0000${item.source}`;
      if (!warned.has(key)) {
        warned.add(key);
        log.warn(
          `"${unknown}" (in ${item.source}) isn't in the ingredient database. Added to the shopping list as it is`,
        );
      }
    }
    return {
      ingredient: item.ingredient,
      quantity: item.quantity,
      cookingDate,
      recipe: meal.name,
    };
  });
}
