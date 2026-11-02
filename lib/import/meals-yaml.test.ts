import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { openDb } from "../db/index.ts";
import { deleteMeal, listMeals } from "../db/meals.ts";
import { getInternal } from "../db/settings.ts";
import { importMealsOnce } from "./meals-yaml.ts";

function mealsDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "automat-import-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

const stew = `name: Bean Stew
feeds: 4
recipes:
  - Bean and Vegetable Stew
otherIngredients: []
`;

const burgers = `name: Bean Burgers
feeds: 2
recipes:
  - Bean Burgers
  - Wedges
otherIngredients:
  - quantity: "4"
    ingredient: Bread Roll
`;

describe("importMealsOnce", () => {
  test("imports every meal, enabled and freezable", async () => {
    const db = openDb(":memory:");
    const result = await importMealsOnce(
      db,
      mealsDir({ "a.yaml": stew, "b.yaml": burgers }),
    );

    assert.deepEqual(result, { status: "imported", count: 2 });
    const meals = listMeals(db);
    assert.deepEqual(
      meals.map((m) => [m.name, m.feeds, m.enabled, m.freezable, m.recipes]),
      [
        ["Bean Burgers", 2, true, true, ["Bean Burgers", "Wedges"]],
        ["Bean Stew", 4, true, true, ["Bean and Vegetable Stew"]],
      ],
    );
    assert.deepEqual(meals[0]!.otherIngredients, [
      { ingredient: "Bread Roll", quantity: "4" },
    ]);
    assert.ok(getInternal(db, "mealsImportedAt"));
  });

  test("only ever imports once, even after every meal is deleted", async () => {
    const db = openDb(":memory:");
    const dir = mealsDir({ "a.yaml": stew });
    await importMealsOnce(db, dir);
    for (const meal of listMeals(db)) deleteMeal(db, meal.id);

    assert.deepEqual(await importMealsOnce(db, dir), {
      status: "already_imported",
    });
    assert.equal(listMeals(db).length, 0);
  });

  test("a parse error imports nothing and can be retried", async () => {
    const db = openDb(":memory:");
    const dir = mealsDir({
      "a.yaml": stew,
      "b.yaml": "name: Broken\nfeeds: 0\n",
    });

    await assert.rejects(importMealsOnce(db, dir), /b\.yaml/);
    assert.equal(listMeals(db).length, 0);
    assert.equal(getInternal(db, "mealsImportedAt"), undefined);
  });

  test("a missing directory is skipped", async () => {
    const db = openDb(":memory:");
    assert.deepEqual(await importMealsOnce(db, "/nonexistent/meals"), {
      status: "no_directory",
    });
  });
});
