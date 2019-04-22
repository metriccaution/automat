import { IngredientDefinition, RecipeDefinition } from "../types";
import { AirtableRow } from "./types";

export function splitIngredients(text: string): IngredientDefinition[] {
  return text
    .split("\n")
    .map(i => i.trim())
    .filter(Boolean)
    .map(i =>
      [i.split("-")[0], i.split("-")[1] ? i.split("-")[1] : "1"].map(p =>
        p.trim()
      )
    )
    .map(([name, quantity]) => ({ name, quantity }));
}

function parseDate(dateText: string): Date {
  const parts = dateText
    .split("-")
    .map(p => parseInt(p, 10))
    .filter(Boolean);

  if (parts.length !== 3) {
    throw new Error(`Couldn't parse ${dateText} to a day`);
  }

  const ret = new Date();

  ret.setUTCFullYear(parts[0]);
  ret.setUTCMonth(parts[1] - 1);
  ret.setUTCDate(parts[2]);

  ret.setUTCHours(0);
  ret.setUTCMinutes(0);
  ret.setUTCSeconds(0);
  ret.setUTCMilliseconds(0);

  return ret;
}

export function parseAirtableRow(
  fallbackDate = new Date(),
  r: AirtableRow
): RecipeDefinition {
  const lastCooked = r["Last cooked"]
    ? parseDate(r["Last cooked"])
    : fallbackDate;

  return {
    id: r.id,
    ingredients: splitIngredients(r.Ingredients),
    lastCooked,
    meals: r.Meals,
    name: r.Name,
    source: r.Source
  };
}
