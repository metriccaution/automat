import type {
  Ingredient,
  RawData,
  Recipe,
  RecipeIngredient,
} from "../data/mod.ts";
import { normaliseUnits } from "./normalise-units.ts";

export interface NormalisedIngredient {
  ingredient: Ingredient;
  quantity: string;
}

/**
 * A recipe, but with the ingredients swapped out for normalised data.
 */
export interface RecipeWithIngredients {
  title: string;
  section: string;
  tags: string[];
  ingredients: NormalisedIngredient[];
}

export function collateRecipes({
  ingredients,
  recipes,
}: RawData): RecipeWithIngredients[] {
  const normalised: RecipeWithIngredients[] = [];
  for (const recipe of recipes) {
    try {
      normalised.push({
        title: recipe.title,
        section: recipe.section,
        tags: recipe.tags,
        ingredients: mealIngredients(recipe)
          .map((i) => normaliseIngredient(ingredients, i))
          .flat(),
      });
    } catch (error) {
      throw new Error(`Error while parsing "${recipe.title}": ${error}`);
    }
  }

  return normalised;
}

function mealIngredients(recipe: Recipe): RecipeIngredient[] {
  const ret: RecipeIngredient[] = [];
  for (const ingredientGroup of recipe.ingredients) {
    for (const ingredient of ingredientGroup.ingredients) {
      ret.push(ingredient);
    }
  }

  return ret;
}

function normaliseIngredient(
  ingredients: Ingredient[],
  item: RecipeIngredient,
): NormalisedIngredient[] {
  const normalised: NormalisedIngredient[] = [];
  const parts = item.ingredient.split(" / ").map((i) => i.trim());

  for (const part of parts) {
    const matchingIngredient = ingredients.find(
      (i) => i.name === part || i.synonyms.includes(part),
    );
    if (!matchingIngredient) {
      throw new Error(
        `Couldn't find a matching ingredient for ${item.ingredient}`,
      );
    }

    if (!item.quantity) {
      throw new Error(`No quantity for ${item.ingredient}`);
    }

    normalised.push({
      ingredient: matchingIngredient,
      quantity: normaliseUnits(matchingIngredient.measure, item.quantity),
    });
  }

  return normalised;
}
