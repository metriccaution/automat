/**
 * A single line-item for a recipe
 */
export interface RecipeIngredient {
  quantity: string;
  ingredient: string;
  notes: string;
}

/**
 * A grouping of ingredients, either:
 *
 * - `group` _is_ present, then the ingredients are grouped into sections
 * - `group` _isn't_ present, then its a catch-all group
 */
export interface IngredientGroup {
  group?: string;
  ingredients: RecipeIngredient[];
}

/**
 * A sequence of cooking instructions
 */
export interface InstructionGroup {
  group?: string;
  description?: string;
  steps: string[];
}

/**
 * Metadata about a recipe - The parts we need for meal planning, but misses out
 * things like the actual cooking steps.
 */
export interface Metadata {
  title: string;
  section: string;
  tags: string[];
  ingredients: IngredientGroup[];
}

// TODO - Parse cooking steps

/**
 * The full recipe details.
 *
 * **Note** - This is still very much a work in progress!
 */
export interface Recipe extends Metadata {
  description?: string;
  instructions: InstructionGroup[];
  source?: { description: string };
  prepTime?: string;
  cookingTime?: string;
  // TODO - Equipment
}
