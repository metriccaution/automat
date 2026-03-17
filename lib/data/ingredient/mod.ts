/**
 * Metadata about an ingredient
 */
export interface Ingredient {
  name: string;
  include?: boolean;
  synonyms: string[];
  measure: "volume" | "can" | "weight" | "singles" | "spice";
}
