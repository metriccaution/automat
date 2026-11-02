import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { MealWithRecipes } from "../recipes/mod.ts";
import { mealDates, pickDates, randomWithFreezing } from "./index.ts";
import {
  daysWithFreezing,
  suitableForFreezing,
  updateForFreezing,
} from "./util.ts";

const meal = (
  name: string,
  feeds: number,
  freezable = true,
): MealWithRecipes => ({
  name,
  feeds,
  freezable,
  recipes: [],
  otherIngredients: [],
});

describe("freezing rules", () => {
  test("only freezable meals feeding 3 or more are frozen", () => {
    assert.equal(suitableForFreezing(meal("a", 2)), false);
    assert.equal(suitableForFreezing(meal("a", 3)), true);
    assert.equal(suitableForFreezing(meal("a", 6, false)), false);
  });

  test("3 or 4 portions freeze one, more freeze two", () => {
    assert.deepEqual(
      [3, 4].map((f) => updateForFreezing(meal("Stew", f))),
      [
        { ...meal("Stew (Freeze one)", 2) },
        { ...meal("Stew (Freeze one)", 3) },
      ],
    );
    assert.equal(
      updateForFreezing(meal("Chilli", 6)).name,
      "Chilli (Freeze two)",
    );
    assert.equal(updateForFreezing(meal("Chilli", 6)).feeds, 4);
  });

  test("daysWithFreezing matches updateForFreezing", () => {
    for (let feeds = 1; feeds <= 8; feeds++) {
      assert.equal(
        daysWithFreezing(feeds),
        updateForFreezing(meal("m", feeds)).feeds,
      );
    }
  });

  test("randomWithFreezing leaves unfreezable meals whole", () => {
    const chosen = randomWithFreezing(4, [meal("Curry", 4, false)]);
    assert.deepEqual(
      chosen.map((m) => [m.name, m.feeds]),
      [["Curry", 4]],
    );
  });

  test("randomWithFreezing freezes freezable meals", () => {
    const chosen = randomWithFreezing(3, [meal("Curry", 4)]);
    assert.deepEqual(
      chosen.map((m) => [m.name, m.feeds]),
      [["Curry (Freeze one)", 3]],
    );
  });
});

describe("pickDates", () => {
  test("skips days that are already used", () => {
    assert.deepEqual(pickDates("2026-11-02", ["2026-11-03", "2026-11-05"], 3), [
      "2026-11-02",
      "2026-11-04",
      "2026-11-06",
    ]);
  });

  test("works across a DST change", () => {
    assert.deepEqual(pickDates("2026-10-24", [], 3), [
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
    ]);
  });
});

describe("mealDates", () => {
  test("lays each meal over its days", () => {
    const days = mealDates(["2026-11-03"], "2026-11-02", [
      meal("A", 2),
      meal("B", 1),
    ]);
    assert.deepEqual(
      days.map((d) => [d.title, d.date]),
      [
        ["A", "2026-11-02"],
        ["A", "2026-11-04"],
        ["B", "2026-11-05"],
      ],
    );
  });
});
