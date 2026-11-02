import type { DatabaseSync } from "node:sqlite";
import { nowIso } from "./index.ts";

export const runKinds = [
  "plan",
  "cleanup",
  "push_meal",
  "refresh_recipes",
] as const;
export const runTriggers = ["schedule", "manual", "startup"] as const;
export const runStatuses = ["running", "success", "failed"] as const;

export type RunKind = (typeof runKinds)[number];
export type RunTrigger = (typeof runTriggers)[number];
export type RunStatus = (typeof runStatuses)[number];

export interface CreatedTask {
  id: string;
  project: "Cooking" | "Groceries";
  content: string;
}

export interface RecipeRefreshSummary {
  outcome: "updated" | "not_modified" | "failed";
  recipeCount: number;
  ingredientCount: number;
}

export interface RunSummary {
  cookingClosed?: number;
  groceriesClosed?: number;
  groceriesTrimmed?: number;
  mealsAdded?: Array<{ name: string; dates: string[] }>;
  groceryTasksAdded?: number;
  createdTasks?: CreatedTask[];
  recipes?: RecipeRefreshSummary;
}

export interface Run {
  id: number;
  kind: RunKind;
  trigger: RunTrigger;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  params: Record<string, unknown> | null;
  summary: RunSummary;
  log: string;
  error: string | null;
}

interface RunRow {
  id: number;
  kind: RunKind;
  trigger: RunTrigger;
  started_at: string;
  finished_at: string | null;
  status: RunStatus;
  params: string | null;
  summary: string | null;
  log: string;
  error: string | null;
}

const fromRow = (row: RunRow): Run => ({
  id: row.id,
  kind: row.kind,
  trigger: row.trigger,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  status: row.status,
  params: row.params ? JSON.parse(row.params) : null,
  summary: row.summary ? JSON.parse(row.summary) : {},
  log: row.log,
  error: row.error,
});

export function insertRun(
  db: DatabaseSync,
  kind: RunKind,
  trigger: RunTrigger,
  params: Record<string, unknown> | null,
): Run {
  const startedAt = nowIso();
  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO runs (kind, trigger, started_at, status, params) VALUES (?, ?, ?, 'running', ?)",
    )
    .run(kind, trigger, startedAt, params ? JSON.stringify(params) : null);
  return getRun(db, Number(lastInsertRowid))!;
}

export function updateRunProgress(
  db: DatabaseSync,
  id: number,
  summary: RunSummary,
  log: string,
) {
  db.prepare("UPDATE runs SET summary = ?, log = ? WHERE id = ?").run(
    JSON.stringify(summary),
    log,
    id,
  );
}

export function finishRun(
  db: DatabaseSync,
  id: number,
  status: "success" | "failed",
  summary: RunSummary,
  log: string,
  error: string | null,
) {
  db.prepare(
    "UPDATE runs SET status = ?, finished_at = ?, summary = ?, log = ?, error = ? WHERE id = ?",
  ).run(status, nowIso(), JSON.stringify(summary), log, error, id);
}

/**
 * Mark runs left `running` by a previous process as failed.
 */
export function failStaleRuns(db: DatabaseSync): number {
  const { changes } = db
    .prepare(
      "UPDATE runs SET status = 'failed', finished_at = ?, error = 'Interrupted (process restarted)' WHERE status = 'running'",
    )
    .run(nowIso());
  return Number(changes);
}

export function getRun(db: DatabaseSync, id: number): Run | undefined {
  const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as
    RunRow | undefined;
  return row ? fromRow(row) : undefined;
}

export function latestRun(
  db: DatabaseSync,
  filter: { kind?: RunKind; trigger?: RunTrigger } = {},
): Run | undefined {
  const where: string[] = [];
  const params: string[] = [];
  if (filter.kind) {
    where.push("kind = ?");
    params.push(filter.kind);
  }
  if (filter.trigger) {
    where.push("trigger = ?");
    params.push(filter.trigger);
  }
  const row = db
    .prepare(
      `SELECT * FROM runs ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY started_at DESC, id DESC LIMIT 1`,
    )
    .get(...params) as RunRow | undefined;
  return row ? fromRow(row) : undefined;
}

export interface RunFilter {
  kind?: RunKind;
  trigger?: RunTrigger;
  status?: RunStatus;
}

export function listRuns(
  db: DatabaseSync,
  filter: RunFilter,
  page: { limit: number; offset: number },
): { rows: Run[]; total: number } {
  const where: string[] = [];
  const params: string[] = [];
  for (const key of ["kind", "trigger", "status"] as const) {
    if (filter[key]) {
      where.push(`${key} = ?`);
      params.push(filter[key]);
    }
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM runs ${clause}`)
    .get(...params) as { total: number };
  const rows = db
    .prepare(
      `SELECT * FROM runs ${clause} ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, page.limit, page.offset) as unknown as RunRow[];
  return { total, rows: rows.map(fromRow) };
}
