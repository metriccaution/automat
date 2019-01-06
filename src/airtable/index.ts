import { RecipeDefinition } from "../types";
import { getTable } from "./api";
import { AirtableConfig } from "./types";
import { splitIngredients } from "./util";

interface AirtableRow {
  Name: string;
  Meals: number;
  Ingredients: string;
  Source: string;
  "Last cooked"?: string;
}

export { AirtableConfig } from "./types";

/**
 * Fetch a list of recipes from Airtable.
 */
export async function getRecipes(
  config: AirtableConfig
): Promise<RecipeDefinition[]> {
  config.logger.debug("Requesting recipes");
  const rows: AirtableRow[] = await getTable({
    ...config,
    fields: ["Name", "Meals", "Source", "Ingredients"],
    view: "Grid view"
  });
  config.logger.debug(
    {
      recipeCount: rows.length
    },
    "Got recipes"
  );

  return rows.map(
    (r): RecipeDefinition => {
      return {
        ingredients: splitIngredients(r.Ingredients),
        meals: r.Meals,
        name: r.Name,
        source: r.Source
      };
    }
  );
}
