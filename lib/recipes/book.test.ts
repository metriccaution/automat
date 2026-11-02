import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import { openDb } from "../db/index.ts";
import { readRecipeCache } from "../db/recipe-cache.ts";
import { testRepo } from "../testing/fakes.ts";
import { RecipeBook } from "./book.ts";

/**
 * A recipe book server whose response each test controls.
 */
let respond: (req: {
  headers: Record<string, string | string[] | undefined>;
}) => { status: number; body?: string; headers?: Record<string, string> };
let server: Server;
let url: string;

before(async () => {
  server = createServer((req, res) => {
    const { status, body, headers } = respond(req);
    res.writeHead(status, headers);
    res.end(body);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/repo.json`;
});

after(() => server.close());

// Make sure the test server isn't sent through a proxy
process.env.NO_PROXY = [process.env.NO_PROXY, "127.0.0.1"]
  .filter(Boolean)
  .join(",");
process.env.no_proxy = process.env.NO_PROXY;

describe("RecipeBook", () => {
  test("a 200 that validates replaces the data and records the validators", async () => {
    const db = openDb(":memory:");
    const book = new RecipeBook(db, url);
    assert.equal(book.data, null);
    assert.equal(book.isExpired(), true);

    respond = () => ({
      status: 200,
      body: JSON.stringify(testRepo),
      headers: {
        ETag: '"v1"',
        "Last-Modified": "Mon, 02 Nov 2026 00:00:00 GMT",
      },
    });
    const result = await book.refresh();

    assert.equal(result.outcome, "updated");
    assert.equal(result.recipeCount, testRepo.recipes.length);
    assert.equal(book.isExpired(), false);
    const row = readRecipeCache(db, url)!;
    assert.equal(row.etag, '"v1"');
    assert.ok(row.fetchedAt);

    // A new instance (a restart) reads the cache without the network
    assert.equal(new RecipeBook(db, url).data?.recipes.length, 3);
  });

  test("sends validators, and a 304 only updates checked_at", async () => {
    const db = openDb(":memory:");
    const book = new RecipeBook(db, url);
    respond = () => ({
      status: 200,
      body: JSON.stringify(testRepo),
      headers: { ETag: '"v1"' },
    });
    await book.refresh();
    const fetchedAt = book.fetchedAt;

    let sent: string | undefined;
    respond = (req) => {
      sent = req.headers["if-none-match"] as string;
      return { status: 304 };
    };
    await new Promise((r) => setTimeout(r, 5));
    const result = await book.refresh();

    assert.equal(sent, '"v1"');
    assert.equal(result.outcome, "not_modified");
    assert.equal(book.fetchedAt, fetchedAt);
    assert.notEqual(book.checkedAt, fetchedAt);
  });

  test("failures never overwrite good data", async () => {
    const db = openDb(":memory:");
    const book = new RecipeBook(db, url);
    respond = () => ({ status: 200, body: JSON.stringify(testRepo) });
    await book.refresh();

    for (const bad of [
      { status: 500, body: "oops" },
      { status: 200, body: "not json" },
      { status: 200, body: JSON.stringify({ ingredients: [], recipes: [] }) },
      { status: 200, body: JSON.stringify({ nope: true }) },
    ]) {
      respond = () => bad;
      await assert.rejects(book.refresh());
      assert.equal(book.data?.recipes.length, 3);
      assert.equal(
        JSON.parse(readRecipeCache(db, url)!.data!).recipes.length,
        3,
      );
    }
  });

  test("a different URL starts with an empty cache", async () => {
    const db = openDb(":memory:");
    respond = () => ({ status: 200, body: JSON.stringify(testRepo) });
    await new RecipeBook(db, url).refresh();
    assert.equal(new RecipeBook(db, `${url}?other`).data, null);
  });
});
