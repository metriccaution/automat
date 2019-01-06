/**
 * The core recipe type
 */
export interface RecipeDefinition {
  name: string;
  meals: number;
  source: string;
  ingredients: IngredientDefinition[];
}

/**
 * The core ingredient type
 */
export interface IngredientDefinition {
  name: string;
  quantity: string;
}

/**
 * Choose a selection of recipes to have food for a set number of days.
 */
export type RecipeChooser = (
  days: number,
  recipes: RecipeDefinition[]
) => RecipeDefinition[];

/**
 * Somewhere to push the choice of recipes to (e.g. Todoist)
 */
export interface RecipeDestination {
  countDaysWithFood: (start: Date, end: Date) => Promise<number>;
  saveRecipes: (start: Date, recipes: RecipeDefinition[]) => Promise<void>;
}
