import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { recordMeals } from "../db/history.ts";
import { createMeal, findMealByName, getMeal } from "../db/meals.ts";
import { finishRun, insertRun } from "../db/runs.ts";
import { getSettings } from "../db/settings.ts";
import { testServices, TEST_RECIPES_URL } from "../testing/fakes.ts";
import { createApp } from "./app.ts";
import { CONTENT_SECURITY_POLICY } from "./security.ts";

process.env.TZ = "Europe/London";

function setup() {
  const s = testServices();
  const app = createApp({
    db: s.db,
    env: {
      DB_PATH: ":memory:",
      RECIPES_URL: TEST_RECIPES_URL,
      TZ: "Europe/London",
      ALLOWED_HOSTS: ["localhost", "automat.lan"],
      TODOIST_TOKEN: "secret-token-value",
    },
    services: s.services,
    recipeBook: s.recipeBook,
  });
  const mealId = createMeal(s.db, {
    name: "Bean Stew",
    feeds: 4,
    enabled: true,
    freezable: true,
    recipes: ["Bean Stew"],
    otherIngredients: [{ ingredient: "Bread", quantity: "1" }],
  });
  recordMeals(s.db, ["Bean Stew", "Deleted Meal"], "2026-10-20");
  const run = insertRun(s.db, "plan", "manual", null);
  finishRun(
    s.db,
    run.id,
    "failed",
    { createdTasks: [{ id: "123", project: "Cooking", content: "[Stew](x)" }] },
    "Warning: something",
    "Error: boom",
  );

  const request = (path: string, init: RequestInit = {}) =>
    app.request(`http://localhost${path}`, {
      ...init,
      headers: { Host: "localhost", ...(init.headers ?? {}) },
    });
  const post = (path: string, form: Record<string, string | string[]>) => {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(form)) {
      for (const v of Array.isArray(value) ? value : [value])
        body.append(key, v);
    }
    return request(path, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "http://localhost:3000",
      },
    });
  };
  return { ...s, app, request, post, mealId, runId: run.id };
}

const pages = (mealId: number, runId: number) => [
  "/",
  "/upcoming",
  "/meals",
  "/meals?q=bean&status=enabled",
  "/meals/new",
  `/meals/${mealId}`,
  `/meals/${mealId}/edit`,
  `/meals/${mealId}/push`,
  `/meals/${mealId}/delete`,
  "/history/meals",
  "/history/runs",
  `/history/runs/${runId}`,
  "/history/stats",
  "/settings",
];

describe("pages", () => {
  test("every page renders", async () => {
    const t = setup();
    for (const path of pages(t.mealId, t.runId)) {
      const res = await t.request(path);
      assert.equal(res.status, 200, path);
      assert.match(await res.text(), /<title>.+ – Automat<\/title>/, path);
    }
  });

  test("nothing is loaded from another origin", async () => {
    const t = setup();
    for (const path of [...pages(t.mealId, t.runId), "/nope"]) {
      const body = await (await t.request(path)).text();
      // Every src/href attribute, except on links the user follows
      const tags = body.match(/<(?!a[\s>])[a-z]+\b[^>]*>/gi) ?? [];
      for (const tag of tags) {
        for (const [, url] of tag.matchAll(/\s(?:src|href)="([^"]*)"/g)) {
          assert.ok(
            url!.startsWith("/") && !url!.startsWith("//"),
            `${path}: ${tag.slice(0, 80)} loads ${url}`,
          );
        }
      }
      assert.doesNotMatch(body, /<script(?![^>]*\bsrc=)[^>]*>/, path);
      assert.doesNotMatch(body, /\sstyle="/, path);
    }
  });

  test("every response carries the CSP", async () => {
    const t = setup();
    for (const path of ["/", "/nope", "/public/app.js", "/healthz"]) {
      const res = await t.request(path);
      assert.equal(
        res.headers.get("Content-Security-Policy"),
        CONTENT_SECURITY_POLICY,
      );
    }
  });

  test("the Todoist token is never shown", async () => {
    const t = setup();
    const body = await (await t.request("/settings")).text();
    assert.doesNotMatch(body, /secret-token-value/);
    assert.match(body, /Todoist token/);
  });

  test("unknown pages get the 404 page", async () => {
    const t = setup();
    const res = await t.request("/meals/9999");
    assert.equal(res.status, 404);
    assert.match(await res.text(), /Nothing behind this door/);
  });

  test("deleted meals show as deleted in history", async () => {
    const t = setup();
    const body = await (await t.request("/history/stats")).text();
    assert.match(body, /Deleted Meal \(deleted\)/);
  });

  test("a failed plan run warns that shopping wasn't added", async () => {
    const t = setup();
    const body = await (await t.request(`/history/runs/${t.runId}`)).text();
    assert.match(body, /The shopping for these meals was not added/);
    assert.match(body, /app\.todoist\.com\/app\/task\/123/);
  });
});

describe("host checks", () => {
  test("requests to other hosts get a 421", async () => {
    const t = setup();
    const res = await t.app.request("http://evil.example/", {
      headers: { Host: "evil.example:3000" },
    });
    assert.equal(res.status, 421);
    assert.match(
      await res.text(),
      /Host `evil.example` is not in ALLOWED_HOSTS/,
    );
  });

  test("allowed hosts work with a port", async () => {
    const t = setup();
    const res = await t.app.request("http://automat.lan:3000/", {
      headers: { Host: "automat.lan:3000" },
    });
    assert.equal(res.status, 200);
  });

  test("posts from another origin get a 403", async () => {
    const t = setup();
    const res = await t.request("/actions/cleanup", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
    });
    assert.equal(res.status, 403);
    assert.equal(t.runner.current, null);
  });
});

describe("meal forms", () => {
  test("adding a meal redirects with a success banner", async () => {
    const t = setup();
    const res = await t.post("/meals/new", {
      action: "save",
      name: "Rice Bowl",
      feeds: "2",
      options: ["enabled"],
      recipes: ["Rice Bowl"],
      ingredient: ["Bread"],
      quantity: ["2"],
    });
    assert.equal(res.status, 303);
    const meal = findMealByName(t.db, "Rice Bowl")!;
    assert.equal(res.headers.get("Location"), `/meals/${meal.id}`);
    assert.equal(meal.freezable, false);
    assert.deepEqual(meal.otherIngredients, [
      { ingredient: "Bread", quantity: "2" },
    ]);

    const cookie = res.headers.get("Set-Cookie")!.split(";")[0]!;
    const page = await (
      await t.request(`/meals/${meal.id}`, { headers: { Cookie: cookie } })
    ).text();
    assert.match(page, /govuk-notification-banner--success/);
    assert.match(page, /Rice Bowl added/);
  });

  test("validation errors use the error summary", async () => {
    const t = setup();
    const res = await t.post("/meals/new", {
      action: "save",
      name: "Bean Stew",
      feeds: "0",
      recipes: [""],
    });
    assert.equal(res.status, 422);
    const body = await res.text();
    assert.match(body, /<title>Error: Add a meal/);
    assert.match(body, /href="#name">There’s already a meal called Bean Stew/);
    assert.match(
      body,
      /href="#feeds">How many days the meal feeds must be 1 or more/,
    );
    assert.match(body, /href="#recipe-0">Choose at least one recipe/);
  });

  test("row buttons add, move and remove rows without saving", async () => {
    const t = setup();
    const res = await t.post(`/meals/${t.mealId}/edit`, {
      action: "down-recipe-0",
      name: "Bean Stew",
      feeds: "4",
      options: ["enabled", "freezable"],
      recipes: ["Bean Stew", "Rice Bowl"],
    });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(
      body.indexOf('id="recipe-0"') <
        body.indexOf('value="Rice Bowl" selected'),
    );
    assert.ok(
      body.indexOf('value="Rice Bowl" selected') <
        body.indexOf('id="recipe-1"'),
    );
    assert.deepEqual(getMeal(t.db, t.mealId)!.recipes, ["Bean Stew"]);
  });

  test("delete removes the meal", async () => {
    const t = setup();
    const res = await t.post(`/meals/${t.mealId}/delete`, {});
    assert.equal(res.status, 303);
    assert.equal(getMeal(t.db, t.mealId), undefined);
  });

  test("push validates the start date", async () => {
    const t = setup();
    const res = await t.post(`/meals/${t.mealId}/push`, {
      "date-day": "31",
      "date-month": "2",
      "date-year": "2027",
    });
    assert.equal(res.status, 422);
    assert.match(await res.text(), /Start date must be a real date/);
  });

  test("push runs and redirects to the meal", async () => {
    const t = setup();
    const res = await t.post(`/meals/${t.mealId}/push`, {
      "date-day": "4",
      "date-month": "11",
      "date-year": "2026",
    });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("Location"), `/meals/${t.mealId}`);
    // Feeds 4, and freezing wasn't asked for
    assert.equal(t.todoist.open("Cooking").length, 4);
  });
});

describe("settings and actions", () => {
  test("settings save, normalising the time", async () => {
    const t = setup();
    const res = await t.post("/settings", {
      schedulerEnabled: "true",
      scheduleTime: "4:30",
      daysToPlan: "5",
      historyWindowDays: "14",
    });
    assert.equal(res.status, 303);
    assert.deepEqual(getSettings(t.db), {
      schedulerEnabled: true,
      scheduleTime: "04:30",
      daysToPlan: 5,
      planToFreeze: false,
      historyWindowDays: 14,
    });
  });

  test("invalid settings aren't saved", async () => {
    const t = setup();
    const res = await t.post("/settings", {
      scheduleTime: "25:00",
      daysToPlan: "0",
      historyWindowDays: "x",
    });
    assert.equal(res.status, 422);
    assert.equal(getSettings(t.db).scheduleTime, "03:00");
  });

  test("an action redirects to its run without JS", async () => {
    const t = setup();
    const res = await t.post("/actions/cleanup", {});
    assert.equal(res.status, 303);
    assert.match(res.headers.get("Location")!, /^\/history\/runs\/\d+$/);
  });

  test("with htmx, an action returns a polling status fragment", async () => {
    const t = setup();
    let release!: () => void;
    t.runner.start(
      "plan",
      "manual",
      null,
      () => new Promise((r) => (release = r)),
    );

    const busy = await t.request("/actions/cleanup", {
      method: "POST",
      headers: { "HX-Request": "true" },
    });
    assert.match(await busy.text(), /A plan run is in progress/);

    release();
    await new Promise((r) => setTimeout(r, 0));
    const res = await t.request("/actions/cleanup", {
      method: "POST",
      headers: { "HX-Request": "true" },
    });
    const body = await res.text();
    assert.match(body, /hx-trigger="every 2s"/);
    assert.match(body, /hx-swap-oob="true"/);
  });

  test("pausing shows the holiday banner on every page", async () => {
    const t = setup();
    await t.post("/actions/scheduler", { enabled: "false" });
    const body = await (await t.request("/meals")).text();
    assert.match(body, /Scheduler paused/);
    assert.match(body, /Resume scheduler/);
  });
});
