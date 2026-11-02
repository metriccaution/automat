import type { RunContext } from "./runner.ts";
import type { ServiceDeps } from "./shared.ts";

/**
 * Check the recipe book now, ignoring the cache expiry.
 */
export async function refreshRecipes(
  { recipeBook }: Pick<ServiceDeps, "recipeBook">,
  ctx: RunContext,
): Promise<void> {
  try {
    const result = await recipeBook.refresh(ctx.signal);
    ctx.summary.recipes = result;
    ctx.log.info(
      result.outcome === "updated"
        ? `Recipe book updated: ${result.recipeCount} recipes, ${result.ingredientCount} ingredients`
        : "Recipe book checked: no changes",
    );
  } catch (e) {
    ctx.summary.recipes = recipeBook.failedSummary();
    throw e;
  }
}
