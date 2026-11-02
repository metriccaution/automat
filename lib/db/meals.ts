import type { DatabaseSync } from "node:sqlite";
import type { RecipeIngredient } from "../data/web.ts";
import { nowIso, transaction } from "./index.ts";

export interface MealInput {
  name: string;
  feeds: number;
  enabled: boolean;
  freezable: boolean;
  /**
   * Recipe titles, in order. At least one.
   */
  recipes: string[];
  otherIngredients: RecipeIngredient[];
}

export interface Meal extends MealInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}

interface MealRow {
  id: number;
  name: string;
  feeds: number;
  enabled: number;
  freezable: number;
  created_at: string;
  updated_at: string;
}

export interface MealFilter {
  search?: string;
  status?: "enabled" | "disabled" | "all";
}

export function listMeals(db: DatabaseSync, filter: MealFilter = {}): Meal[] {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (filter.search) {
    where.push("name LIKE ? ESCAPE '\\'");
    params.push(`%${filter.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  if (filter.status === "enabled") where.push("enabled = 1");
  if (filter.status === "disabled") where.push("enabled = 0");

  const rows = db
    .prepare(
      `SELECT * FROM meals ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY name COLLATE NOCASE`,
    )
    .all(...params) as unknown as MealRow[];
  return withChildren(db, rows);
}

export function getMeal(db: DatabaseSync, id: number): Meal | undefined {
  const row = db.prepare("SELECT * FROM meals WHERE id = ?").get(id) as
    MealRow | undefined;
  return row ? withChildren(db, [row])[0] : undefined;
}

export function findMealByName(
  db: DatabaseSync,
  name: string,
): Meal | undefined {
  const row = db
    .prepare("SELECT * FROM meals WHERE name = ? COLLATE NOCASE")
    .get(name) as MealRow | undefined;
  return row ? withChildren(db, [row])[0] : undefined;
}

function withChildren(db: DatabaseSync, rows: MealRow[]): Meal[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(", ");

  const recipes = db
    .prepare(
      `SELECT meal_id, recipe_title FROM meal_recipes WHERE meal_id IN (${placeholders}) ORDER BY meal_id, position`,
    )
    .all(...ids) as Array<{ meal_id: number; recipe_title: string }>;
  const others = db
    .prepare(
      `SELECT meal_id, ingredient, quantity FROM meal_other_ingredients WHERE meal_id IN (${placeholders}) ORDER BY meal_id, position`,
    )
    .all(...ids) as Array<{
    meal_id: number;
    ingredient: string;
    quantity: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    feeds: row.feeds,
    enabled: row.enabled === 1,
    freezable: row.freezable === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    recipes: recipes
      .filter((r) => r.meal_id === row.id)
      .map((r) => r.recipe_title),
    otherIngredients: others
      .filter((o) => o.meal_id === row.id)
      .map(({ ingredient, quantity }) => ({ ingredient, quantity })),
  }));
}

function assertValid(input: MealInput) {
  if (input.recipes.length === 0) {
    throw new Error(`Meal ${input.name} needs at least one recipe`);
  }
  if (!Number.isInteger(input.feeds) || input.feeds < 1) {
    throw new Error(`Meal ${input.name} must feed at least one day`);
  }
}

function writeChildren(db: DatabaseSync, id: number, input: MealInput) {
  db.prepare("DELETE FROM meal_recipes WHERE meal_id = ?").run(id);
  db.prepare("DELETE FROM meal_other_ingredients WHERE meal_id = ?").run(id);
  const addRecipe = db.prepare(
    "INSERT INTO meal_recipes (meal_id, position, recipe_title) VALUES (?, ?, ?)",
  );
  input.recipes.forEach((title, i) => addRecipe.run(id, i, title));
  const addOther = db.prepare(
    "INSERT INTO meal_other_ingredients (meal_id, position, ingredient, quantity) VALUES (?, ?, ?, ?)",
  );
  input.otherIngredients.forEach((o, i) =>
    addOther.run(id, i, o.ingredient, o.quantity),
  );
}

/**
 * Insert a meal. Call inside a transaction when inserting several.
 */
export function insertMeal(db: DatabaseSync, input: MealInput): number {
  assertValid(input);
  const now = nowIso();
  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO meals (name, feeds, enabled, freezable, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      input.name,
      input.feeds,
      input.enabled ? 1 : 0,
      input.freezable ? 1 : 0,
      now,
      now,
    );
  const id = Number(lastInsertRowid);
  writeChildren(db, id, input);
  return id;
}

export function createMeal(db: DatabaseSync, input: MealInput): number {
  return transaction(db, () => insertMeal(db, input));
}

/**
 * Update a meal. Renaming also rewrites its history, which is keyed by name.
 */
export function updateMeal(db: DatabaseSync, id: number, input: MealInput) {
  assertValid(input);
  transaction(db, () => {
    const existing = db
      .prepare("SELECT name FROM meals WHERE id = ?")
      .get(id) as { name: string } | undefined;
    if (!existing) throw new Error(`No meal with ID ${id}`);

    db.prepare(
      "UPDATE meals SET name = ?, feeds = ?, enabled = ?, freezable = ?, updated_at = ? WHERE id = ?",
    ).run(
      input.name,
      input.feeds,
      input.enabled ? 1 : 0,
      input.freezable ? 1 : 0,
      nowIso(),
      id,
    );
    if (existing.name !== input.name) {
      db.prepare(
        "UPDATE meal_history SET meal_name = ? WHERE meal_name = ?",
      ).run(input.name, existing.name);
    }
    writeChildren(db, id, input);
  });
}

export function setMealEnabled(db: DatabaseSync, id: number, enabled: boolean) {
  db.prepare("UPDATE meals SET enabled = ?, updated_at = ? WHERE id = ?").run(
    enabled ? 1 : 0,
    nowIso(),
    id,
  );
}

/**
 * Hard delete. History rows are kept, as they're keyed by name.
 */
export function deleteMeal(db: DatabaseSync, id: number) {
  db.prepare("DELETE FROM meals WHERE id = ?").run(id);
}
