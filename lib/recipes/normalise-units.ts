import type { Ingredient } from "../data/index.ts";

export type MeasureType = Ingredient["measure"];

const normaliseText = (text: string): string =>
  text.toLowerCase().replace(/\s+/gim, " ").trim();

const splitNumbers = (
  possiblyNumeric: string,
): [number, string] | undefined => {
  const parsed = Number.parseFloat(possiblyNumeric);

  if (Number.isNaN(parsed)) {
    return undefined;
  }

  const remainingText = possiblyNumeric.replace(/^\s*[\d\\.]+/, "");

  return [parsed, normaliseText(remainingText)];
};

const allowedSinglesUnits = [
  "",
  "handful",
  "small handful",
  "large handful",
  "clove",
  "cloves",
  "bulb",
  "bulbs",
  "stick",
  "sticks",
  "slice",
  "slices",
  "stem",
  "stems",
  // Length
  "cm",
  // Volume
  "tsp",
  "teaspoon",
  "teaspoons",
  "tbsp",
  "tablespoon",
  "tablespoons",
];

const allowedWeightUnits = [
  "", // When they're treated like singles
  "g",
  "kg",
  // TODO - Hmm?
  "tsp",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "teaspoon",
  "teaspoons",
  // TODO - Remove once I work out the weight
  "punnet",
  "sheet",
  "cup",
  "cups",
];

const allowedVolumeUnits = [
  "l",
  "litre",
  "litres",
  "ml",
  "tsp",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "teaspoon",
  "teaspoons",
];

/**
 * Initial normalisation of ingredient quantities.
 *
 * Happens before trying to combine multiple items into one.
 */
export const normaliseUnits = (
  measureType: MeasureType,
  quantityString: string,
): string => {
  quantityString = quantityString
    .replace("½", "0.5")
    .replace("1/2", "0.5")
    .replace("1/4", "0.25")
    .replace("3/4", "0.75");

  switch (measureType) {
    case "singles": {
      if (quantityString.includes("x")) {
        throw new Error(`${quantityString}`);
      }

      const numeric = splitNumbers(quantityString) ?? [
        1,
        normaliseText(quantityString),
      ];
      const units = numeric[1];

      if (!allowedSinglesUnits.includes(units)) {
        throw new Error(`Unit for ${measureType} isn't allowed: "${units}"`);
      }

      return numeric.join(" ").trim();
    }
    case "spice": {
      return "1";
    }
    case "weight": {
      const normalised = normaliseText(quantityString);
      if (["pinch"].includes(normalised)) {
        return `1 ${normalised}`;
      }

      const numeric = splitNumbers(normalised);
      if (!numeric) {
        throw new Error(`Invalid weight string: "${quantityString}"`);
      }
      const units = numeric[1];

      if (!allowedWeightUnits.includes(units)) {
        throw new Error(`Unit for ${measureType} isn't allowed: "${units}"`);
      }

      return numeric.join(" ").trim();
    }
    case "volume": {
      const normalised = normaliseText(quantityString);
      if (["pinch"].includes(normalised)) {
        return `1 ${normalised}`;
      }

      const numeric = splitNumbers(normalised);
      if (!numeric) {
        throw new Error(`Invalid volume string: "${quantityString}"`);
      }
      const units = numeric[1];

      if (!allowedVolumeUnits.includes(units)) {
        throw new Error(`Unit for ${measureType} isn't allowed: "${units}"`);
      }

      return numeric.join(" ").trim();
    }
    case "can": {
      const canMatch = quantityString.match(/(\d+g can)s?$/gim);
      if (canMatch) {
        const canString = canMatch[0].replace("cans", "can");
        const canPrefix = quantityString.slice(0, -canString.length);

        const canCount = canPrefix ? Number.parseFloat(canPrefix) : 1;
        if (Number.isNaN(canCount)) {
          throw new Error(`Invalid can count in "${quantityString}"`);
        }

        return [canCount, normaliseText(canString)].join(" ").trim();
      }

      return normaliseText(quantityString);
    }
  }
};
