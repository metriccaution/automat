import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { testRepo } from "../testing/fakes.ts";
import { OTHER_INGREDIENTS, resolveShoppingList } from "./shopping.ts";

const recipe = (title: string) =>
  testRepo.recipes.find((r) => r.title === title)!;

describe("resolveShoppingList", () => {
  test("maps synonyms to the canonical name", () => {
    const items = resolveShoppingList(
      { recipes: [recipe("Bean Stew")], otherIngredients: [] },
      testRepo.ingredients,
    );
    assert.deepEqual(
      items.map((i) => [i.ingredient, i.quantity, i.source]),
      [
        ["Onion", "2", "Bean Stew"],
        ["Butter Beans", "400g", "Bean Stew"],
      ],
    );
  });

  test("drops items where every alternative is excluded from shopping", () => {
    const items = resolveShoppingList(
      { recipes: [recipe("Bean Stew")], otherIngredients: [] },
      testRepo.ingredients,
    );
    assert.equal(
      items.some((i) => i.ingredient.includes("Salt")),
      false,
    );
  });

  test("keeps alternatives if any part is shopped for", () => {
    const items = resolveShoppingList(
      {
        recipes: [],
        otherIngredients: [{ ingredient: "Salt / Lima Beans", quantity: "1" }],
      },
      testRepo.ingredients,
    );
    assert.deepEqual(
      items.map((i) => i.ingredient),
      ["Salt / Butter Beans"],
    );
  });

  test("keeps unknown ingredients under their raw name, and flags them", () => {
    const items = resolveShoppingList(
      { recipes: [recipe("Soup")], otherIngredients: [] },
      testRepo.ingredients,
    );
    const mystery = items.find((i) => i.ingredient === "Mystery Root");
    assert.deepEqual(mystery?.unknown, ["Mystery Root"]);
    assert.equal(mystery?.source, "Soup");
  });

  test("includes other ingredients, through the same rules", () => {
    const items = resolveShoppingList(
      {
        recipes: [],
        otherIngredients: [
          { ingredient: "Onions", quantity: "3" },
          { ingredient: "Pepper", quantity: "1" },
        ],
      },
      testRepo.ingredients,
    );
    assert.deepEqual(items, [
      {
        ingredient: "Onion",
        quantity: "3",
        source: OTHER_INGREDIENTS,
        unknown: [],
      },
    ]);
  });
});
