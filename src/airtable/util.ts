import { IngredientDefinition } from "../types";

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
