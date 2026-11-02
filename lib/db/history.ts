import type { DatabaseSync } from "node:sqlite";
import { addDays } from "../dates.ts";
import { transaction } from "./index.ts";

const FREEZE_SUFFIX = / \(Freeze (?:one|two)\)$/;

/**
 * The meal's own name, without any freezing suffix added while planning.
 */
export const baseMealName = (name: string) => name.replace(FREEZE_SUFFIX, "");

// Returns a map of meal name -> most-recent planned date (YYYY-MM-DD) for
// meals used within the last windowDays days.
export function recentMealNames(
  db: DatabaseSync,
  windowDays: number,
  today: string,
): Map<string, string> {
  const cutoff = addDays(today, -windowDays);

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
  mealNames: string[],
  date: string,
): void {
  const insert = db.prepare(
    "INSERT INTO meal_history (meal_name, planned) VALUES (?, ?)",
  );
  transaction(db, () => {
    for (const name of mealNames) {
      insert.run(baseMealName(name), date);
    }
  });
}

export interface HistoryRow {
  id: number;
  mealName: string;
  planned: string;
}

export interface HistoryFilter {
  name?: string;
  from?: string;
  to?: string;
}

export function listHistory(
  db: DatabaseSync,
  filter: HistoryFilter,
  page: { limit: number; offset: number },
): { rows: HistoryRow[]; total: number } {
  const where: string[] = [];
  const params: string[] = [];
  if (filter.name) {
    where.push("meal_name LIKE ? ESCAPE '\\'");
    params.push(`%${filter.name.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  if (filter.from) {
    where.push("planned >= ?");
    params.push(filter.from);
  }
  if (filter.to) {
    where.push("planned <= ?");
    params.push(filter.to);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM meal_history ${clause}`)
    .get(...params) as { total: number };
  const rows = db
    .prepare(
      `SELECT id, meal_name, planned FROM meal_history ${clause}
       ORDER BY planned DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, page.limit, page.offset) as Array<{
    id: number;
    meal_name: string;
    planned: string;
  }>;

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      mealName: r.meal_name,
      planned: r.planned,
    })),
  };
}

export interface MealStats {
  mealName: string;
  lastPlanned: string;
  timesPlanned: number;
  timesPlannedRecently: number;
}

/**
 * Per-meal planning counts, for every name that appears in history.
 */
export function mealStats(
  db: DatabaseSync,
  today: string,
  recentDays = 90,
): Map<string, MealStats> {
  const rows = db
    .prepare(
      `SELECT meal_name,
              MAX(planned) AS last_planned,
              COUNT(*) AS times_planned,
              SUM(planned >= ?) AS times_recent
       FROM meal_history
       GROUP BY meal_name`,
    )
    .all(addDays(today, -recentDays)) as Array<{
    meal_name: string;
    last_planned: string;
    times_planned: number;
    times_recent: number;
  }>;

  return new Map(
    rows.map((r) => [
      r.meal_name,
      {
        mealName: r.meal_name,
        lastPlanned: r.last_planned,
        timesPlanned: r.times_planned,
        timesPlannedRecently: r.times_recent,
      },
    ]),
  );
}
