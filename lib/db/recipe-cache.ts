import type { DatabaseSync } from "node:sqlite";

export interface RecipeCacheRow {
  url: string;
  data: string | null;
  etag: string | null;
  lastModified: string | null;
  fetchedAt: string | null;
  checkedAt: string | null;
}

export function readRecipeCache(
  db: DatabaseSync,
  url: string,
): RecipeCacheRow | undefined {
  const row = db
    .prepare("SELECT * FROM recipe_cache WHERE url = ?")
    .get(url) as
    | {
        url: string;
        data: string | null;
        etag: string | null;
        last_modified: string | null;
        fetched_at: string | null;
        checked_at: string | null;
      }
    | undefined;
  return row
    ? {
        url: row.url,
        data: row.data,
        etag: row.etag,
        lastModified: row.last_modified,
        fetchedAt: row.fetched_at,
        checkedAt: row.checked_at,
      }
    : undefined;
}

/**
 * Replace the cached data after a 200 that passed validation.
 */
export function writeRecipeCache(
  db: DatabaseSync,
  row: Omit<RecipeCacheRow, "data"> & { data: string },
) {
  db.prepare(
    `INSERT INTO recipe_cache (url, data, etag, last_modified, fetched_at, checked_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET
       data = excluded.data, etag = excluded.etag,
       last_modified = excluded.last_modified,
       fetched_at = excluded.fetched_at, checked_at = excluded.checked_at`,
  ).run(
    row.url,
    row.data,
    row.etag,
    row.lastModified,
    row.fetchedAt,
    row.checkedAt,
  );
}

/**
 * Record that the server confirmed the cached data (a 304).
 */
export function touchRecipeCache(db: DatabaseSync, url: string, at: string) {
  db.prepare("UPDATE recipe_cache SET checked_at = ? WHERE url = ?").run(
    at,
    url,
  );
}
