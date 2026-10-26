import { DatabaseSync } from "node:sqlite";
import type { MealWithRecipes } from "../recipes/mod.ts";

const FREEZE_SUFFIX = / \(Freeze (?:one|two)\)$/;

export function openHistory(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS meal_history (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_name TEXT NOT NULL,
      planned   TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_meal_history_planned
    ON meal_history(planned)
  `);
  return db;
}

// Returns a map of meal name -> most-recent planned date (YYYY-MM-DD) for
// meals used within the last windowDays days.
export function recentMealNames(
  db: DatabaseSync,
  windowDays: number,
): Map<string, string> {
  const cutoff = new Date(Date.now() - windowDays * 86400_000)
    .toISOString()
    .split("T")[0]!;

  const rows = db
    .prepare(
      `SELECT meal_name, MAX(planned) AS most_recent
       FROM meal_history
       WHERE planned >= ?
       GROUP BY meal_name`,
    )
    .all(cutoff) as { meal_name: string; most_recent: string }[];

  return new Map(rows.map((r) => [r.meal_name, r.most_recent]));
}

export function recordMeals(
  db: DatabaseSync,
  meals: MealWithRecipes[],
  date: string,
): void {
  const insert = db.prepare(
    "INSERT INTO meal_history (meal_name, planned) VALUES (?, ?)",
  );
  db.exec("BEGIN");
  try {
    for (const m of meals) {
      insert.run(m.name.replace(FREEZE_SUFFIX, ""), date);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
