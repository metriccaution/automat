import { RecipeDefinition } from "../types";
import { getTable } from "./api";
import { AirtableConfig, AirtableRow } from "./types";
import { parseAirtableRow } from "./util";

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
    fields: ["Name", "Meals", "Source", "Ingredients", "Last cooked"],
    view: "Grid view"
  });

  config.logger.debug(
    {
      recipeCount: rows.length
    },
    "Got recipes"
  );

  const recipes = rows.map(parseAirtableRow.bind(null, new Date()));

  config.logger.debug("Parsed recipes");

  return recipes;
}
