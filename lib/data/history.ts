import { Database } from "bun:sqlite";
import type { MealWithRecipes } from "../recipes/mod.ts";

const FREEZE_SUFFIX = / \(Freeze (?:one|two)\)$/;

export function openHistory(dbPath: string): Database {
  const db = new Database(dbPath, { create: true });
  db.run(`
    CREATE TABLE IF NOT EXISTS meal_history (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_name TEXT NOT NULL,
      planned   TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_meal_history_planned
    ON meal_history(planned)
  `);
  return db;
}

// Returns a map of meal name -> most-recent planned date (YYYY-MM-DD) for
// meals used within the last windowDays days.
export function recentMealNames(
  db: Database,
  windowDays: number,
): Map<string, string> {
  const cutoff = new Date(Date.now() - windowDays * 86400_000)
    .toISOString()
    .split("T")[0]!;

  const rows = db
    .query<{ meal_name: string; most_recent: string }, [string]>(
      `SELECT meal_name, MAX(planned) AS most_recent
       FROM meal_history
       WHERE planned >= ?
       GROUP BY meal_name`,
    )
    .all(cutoff);

  return new Map(rows.map((r) => [r.meal_name, r.most_recent]));
}

export function recordMeals(
  db: Database,
  meals: MealWithRecipes[],
  date: string,
): void {
  const insert = db.prepare(
    "INSERT INTO meal_history (meal_name, planned) VALUES (?, ?)",
  );
  const insertMany = db.transaction((entries: [string, string][]) => {
    for (const [name, d] of entries) {
      insert.run(name, d);
    }
  });
  insertMany(meals.map((m) => [m.name.replace(FREEZE_SUFFIX, ""), date]));
}
