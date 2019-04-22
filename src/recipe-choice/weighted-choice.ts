import { RecipeDefinition } from "../types";

type WeightingFcn = (r: RecipeDefinition) => number;

type WeightedEntry = { weight: number } & RecipeDefinition;

export default function chooseAtRandom(
  assignWeight: WeightingFcn = ageWeighting,
  days: number,
  recipes: RecipeDefinition[]
): RecipeDefinition[] {
  if (days === 0 || recipes.length === 0) {
    return [];
  }

  let daysPicked = 0;
  const chosen: WeightedEntry[] = [];

  while (days > daysPicked) {
    const weighted: WeightedEntry[] = recipes.map(r => ({
      ...r,
      weight: assignWeight(r)
    }));

    while (days > daysPicked && totalWeight(weighted)) {
      const chosenIndex = pickItem(weighted);
      weighted[chosenIndex].weight = 0;

      daysPicked = daysPicked + weighted[chosenIndex].meals;
      chosen.push(weighted[chosenIndex]);
    }
  }

  return chosen.map(i => {
    delete i.weight;
    return i;
  });
}

function pickItem(list: WeightedEntry[]): number {
  const maxWeight = totalWeight(list);
  const chosen = Math.random() * maxWeight;

  let sum = 0;
  let index = 0;
  for (const item of list) {
    sum = sum + item.weight;
    if (sum >= chosen) {
      return index;
    }

    index++;
  }

  throw new Error("Couldn't pick an item");
}

function totalWeight(list: WeightedEntry[]): number {
  return list.reduce((s, i) => s + i.weight, 0);
}

const ageWeighting: WeightingFcn = r => Date.now() - r.lastCooked.getTime();
