import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, test } from "node:test";
import { listHistory, recordMeals } from "./history.ts";
import { migrate, openDb } from "./index.ts";
import {
  createMeal,
  deleteMeal,
  findMealByName,
  getMeal,
  listMeals,
  updateMeal,
  type MealInput,
} from "./meals.ts";

const input = (overrides: Partial<MealInput> = {}): MealInput => ({
  name: "Bean Stew",
  feeds: 4,
  enabled: true,
  freezable: true,
  recipes: ["Bean Stew", "Rice"],
  otherIngredients: [{ ingredient: "Bread", quantity: "1" }],
  ...overrides,
});

describe("meals", () => {
  test("round-trips a meal, keeping recipe order", () => {
    const db = openDb(":memory:");
    const id = createMeal(db, input({ recipes: ["Z", "A", "M"] }));
    const meal = getMeal(db, id)!;
    assert.deepEqual(meal.recipes, ["Z", "A", "M"]);
    assert.deepEqual(meal.otherIngredients, [
      { ingredient: "Bread", quantity: "1" },
    ]);
  });

  test("renaming rewrites history in the same transaction", () => {
    const db = openDb(":memory:");
    const id = createMeal(db, input());
    recordMeals(db, ["Bean Stew (Freeze one)", "Other"], "2026-11-01");

    updateMeal(db, id, input({ name: "Butter Bean Stew" }));

    const names = listHistory(db, {}, { limit: 10, offset: 0 }).rows.map(
      (r) => r.mealName,
    );
    assert.deepEqual(names.sort(), ["Butter Bean Stew", "Other"]);
  });

  test("needs at least one recipe", () => {
    const db = openDb(":memory:");
    assert.throws(() => createMeal(db, input({ recipes: [] })));
  });

  test("names are unique", () => {
    const db = openDb(":memory:");
    createMeal(db, input());
    assert.throws(() => createMeal(db, input()));
    assert.equal(findMealByName(db, "bean stew")?.name, "Bean Stew");
  });

  test("delete cascades to recipes and keeps history", () => {
    const db = openDb(":memory:");
    const id = createMeal(db, input());
    recordMeals(db, ["Bean Stew"], "2026-11-01");
    deleteMeal(db, id);
    assert.equal(
      (
        db.prepare("SELECT COUNT(*) AS n FROM meal_recipes").get() as {
          n: number;
        }
      ).n,
      0,
    );
    assert.equal(listHistory(db, {}, { limit: 10, offset: 0 }).total, 1);
  });

  test("filters by name and status", () => {
    const db = openDb(":memory:");
    createMeal(db, input({ name: "Bean Stew" }));
    createMeal(db, input({ name: "Curry", enabled: false }));
    assert.deepEqual(
      listMeals(db, { status: "disabled" }).map((m) => m.name),
      ["Curry"],
    );
    assert.deepEqual(
      listMeals(db, { search: "bean" }).map((m) => m.name),
      ["Bean Stew"],
    );
  });
});

describe("migrations", () => {
  test("adopt an existing history table and its rows", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE meal_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_name TEXT NOT NULL,
      planned TEXT NOT NULL
    )`);
    db.prepare(
      "INSERT INTO meal_history (meal_name, planned) VALUES (?, ?)",
    ).run("Old Meal", "2025-01-01");

    migrate(db);
    migrate(db);

    assert.equal(listHistory(db, {}, { limit: 10, offset: 0 }).total, 1);
    assert.equal(
      (db.prepare("PRAGMA user_version").get() as { user_version: number })
        .user_version,
      1,
    );
  });
});
