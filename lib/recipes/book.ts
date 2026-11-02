import type { DatabaseSync } from "node:sqlite";
import { parseRepo, type Repo } from "../data/web.ts";
import { nowIso } from "../db/index.ts";
import {
  readRecipeCache,
  touchRecipeCache,
  writeRecipeCache,
} from "../db/recipe-cache.ts";
import type { RecipeRefreshSummary } from "../db/runs.ts";
import { timedFetch } from "../http.ts";
import { ingredientAliases } from "./shopping.ts";
import type { Ingredient } from "../data/index.ts";

/**
 * The cache expires this long after the server last confirmed it.
 */
export const RECIPE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Warn that the recipe book can't be reached after this long.
 */
export const RECIPE_STALE_WARNING_MS = 7 * 24 * 60 * 60 * 1000;

export class RecipeBookNotLoaded extends Error {
  constructor() {
    super("Recipe book not loaded yet");
  }
}

/**
 * The in-memory copy of the recipe book. Reads never touch the network; only
 * `refresh` does, and it never replaces good data with bad.
 */
export class RecipeBook {
  #db: DatabaseSync;
  #url: string;
  #data: Repo | null = null;
  #aliases: Map<string, Ingredient> | null = null;
  #fetchedAt: string | null = null;
  #checkedAt: string | null = null;

  constructor(db: DatabaseSync, url: string) {
    this.#db = db;
    this.#url = url;
    const row = readRecipeCache(db, url);
    if (row?.data) {
      try {
        this.#set(parseRepo(JSON.parse(row.data)));
        this.#fetchedAt = row.fetchedAt;
        this.#checkedAt = row.checkedAt;
      } catch {
        // A cache that no longer validates counts as empty
      }
    }
  }

  get url() {
    return this.#url;
  }

  get data(): Repo | null {
    return this.#data;
  }

  /**
   * The data, or throw if nothing has been loaded yet.
   */
  require(): Repo {
    if (!this.#data) throw new RecipeBookNotLoaded();
    return this.#data;
  }

  get aliases(): Map<string, Ingredient> {
    return this.#aliases ?? new Map();
  }

  get fetchedAt() {
    return this.#fetchedAt;
  }

  get checkedAt() {
    return this.#checkedAt;
  }

  isExpired(now = Date.now()): boolean {
    return (
      !this.#data ||
      !this.#checkedAt ||
      now - Date.parse(this.#checkedAt) >= RECIPE_CACHE_TTL_MS
    );
  }

  isStale(now = Date.now()): boolean {
    return (
      this.#checkedAt !== null &&
      now - Date.parse(this.#checkedAt) > RECIPE_STALE_WARNING_MS
    );
  }

  #set(data: Repo) {
    this.#data = data;
    this.#aliases = ingredientAliases(data.ingredients);
  }

  #counts() {
    return {
      recipeCount: this.#data?.recipes.length ?? 0,
      ingredientCount: this.#data?.ingredients.length ?? 0,
    };
  }

  /**
   * Check the recipe book for changes. Throws on any failure, leaving the
   * cached data as it was.
   */
  async refresh(
    signal?: AbortSignal,
  ): Promise<RecipeRefreshSummary & { outcome: "updated" | "not_modified" }> {
    const row = readRecipeCache(this.#db, this.#url);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.#data && row?.etag) headers["If-None-Match"] = row.etag;
    if (this.#data && row?.lastModified) {
      headers["If-Modified-Since"] = row.lastModified;
    }

    let res: Response;
    try {
      res = await timedFetch(this.#url, { headers }, signal);
    } catch (e) {
      const { message, cause } = e as Error & { cause?: { message?: string } };
      throw new Error(
        `Couldn't reach the recipe book at ${this.#url}: ${message}${cause?.message ? ` (${cause.message})` : ""}`,
      );
    }

    const now = nowIso();
    if (res.status === 304 && this.#data) {
      touchRecipeCache(this.#db, this.#url, now);
      this.#checkedAt = now;
      return { outcome: "not_modified", ...this.#counts() };
    }

    if (!res.ok) {
      throw new Error(
        `Couldn't fetch the recipe book from ${this.#url}: HTTP ${res.status}`,
      );
    }

    const body = await res.text();
    let data: Repo;
    try {
      data = parseRepo(JSON.parse(body));
    } catch (e) {
      throw new Error(
        `The recipe book at ${this.#url} isn't valid: ${(e as Error).message}`,
      );
    }

    writeRecipeCache(this.#db, {
      url: this.#url,
      data: JSON.stringify(data),
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
      fetchedAt: now,
      checkedAt: now,
    });
    this.#set(data);
    this.#fetchedAt = now;
    this.#checkedAt = now;
    return { outcome: "updated", ...this.#counts() };
  }

  /**
   * Summary for a failed refresh.
   */
  failedSummary(): RecipeRefreshSummary {
    return { outcome: "failed", ...this.#counts() };
  }
}
