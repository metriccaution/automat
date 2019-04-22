import { RecipeDefinition } from "../types";
import choose from "./weighted-choice";

type WeightingFcn = (r: RecipeDefinition) => number;

export default function chooseAtRandom(
  days: number,
  recipes: RecipeDefinition[],
  now: Date = new Date()
): RecipeDefinition[] {
  if (days === 0 || recipes.length === 0) {
    return [];
  }

  const assignWeight = ageWeighting(now);
  return choose(assignWeight, days, recipes);
}

const ageWeighting: (now: Date) => WeightingFcn = now => r =>
  now.getTime() - r.lastCooked.getTime();
