/**
 * Ordered schema migrations. The index in this list (plus one) is the
 * `PRAGMA user_version` the database ends up at after running it.
 *
 * Never edit a migration that has shipped; add a new one instead.
 */
export const migrations: string[] = [
  // 1: adopt the existing history table, and add everything else
  `
  CREATE TABLE IF NOT EXISTS meal_history (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_name TEXT NOT NULL,
    planned   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_meal_history_planned ON meal_history(planned);
  CREATE INDEX IF NOT EXISTS idx_meal_history_name ON meal_history(meal_name);

  CREATE TABLE meals (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    feeds      INTEGER NOT NULL CHECK (feeds > 0),
    enabled    INTEGER NOT NULL DEFAULT 1,
    freezable  INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE meal_recipes (
    meal_id      INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    position     INTEGER NOT NULL,
    recipe_title TEXT NOT NULL,
    PRIMARY KEY (meal_id, position)
  );

  CREATE TABLE meal_other_ingredients (
    meal_id    INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    position   INTEGER NOT NULL,
    ingredient TEXT NOT NULL,
    quantity   TEXT NOT NULL,
    PRIMARY KEY (meal_id, position)
  );

  CREATE TABLE runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT NOT NULL,
    trigger     TEXT NOT NULL,
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    status      TEXT NOT NULL,
    params      TEXT,
    summary     TEXT,
    log         TEXT NOT NULL DEFAULT '',
    error       TEXT
  );
  CREATE INDEX idx_runs_started ON runs(started_at);

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE recipe_cache (
    url           TEXT PRIMARY KEY,
    data          TEXT,
    etag          TEXT,
    last_modified TEXT,
    fetched_at    TEXT,
    checked_at    TEXT
  );
  `,
];
