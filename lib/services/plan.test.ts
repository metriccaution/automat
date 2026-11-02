import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { listHistory, recordMeals } from "../db/history.ts";
import { createMeal, type MealInput } from "../db/meals.ts";
import { saveSettings } from "../db/settings.ts";
import { testServices } from "../testing/fakes.ts";

const meal = (overrides: Partial<MealInput>): MealInput => ({
  name: "Bean Stew",
  feeds: 2,
  enabled: true,
  freezable: true,
  recipes: ["Bean Stew"],
  otherIngredients: [],
  ...overrides,
});

const runPlan = async (s: ReturnType<typeof testServices>) => {
  const result = s.services.plan("manual");
  assert.ok(result.ok);
  return result.done;
};

describe("plan", () => {
  test("tops up to daysToPlan, counting distinct days and skipping used ones", async () => {
    const s = testServices({ today: "2026-11-02" });
    createMeal(s.db, meal({ name: "Stew", feeds: 1, freezable: false }));
    // Two meals on one day count as one; a meal three weeks out doesn't count
    s.todoist.addExisting("Cooking", "Existing A", "2026-11-02");
    s.todoist.addExisting("Cooking", "Existing B", "2026-11-02");
    s.todoist.addExisting("Cooking", "Far ahead", "2026-11-04");
    s.todoist.addExisting("Cooking", "Next month", "2026-11-23");
    saveSettings(s.db, { daysToPlan: 4 });

    const run = await runPlan(s);
    assert.equal(run.status, "success", run.error ?? "");

    const dates = run.summary.mealsAdded!.flatMap((m) => m.dates);
    assert.deepEqual(dates, ["2026-11-03", "2026-11-05"]);
  });

  test("writes cooking tasks, then history, then groceries", async () => {
    const s = testServices();
    createMeal(s.db, meal({ name: "Stew", feeds: 1, freezable: false }));
    saveSettings(s.db, { daysToPlan: 1 });

    const run = await runPlan(s);
    assert.equal(run.status, "success", run.error ?? "");

    const adds = s.todoist.calls.filter((c) => c.startsWith("addTask"));
    assert.deepEqual(adds, [
      "addTask Cooking",
      "addTask Groceries",
      "addTask Groceries",
    ]);
    assert.deepEqual(
      run.summary.createdTasks!.map((t) => t.project),
      ["Cooking", "Groceries", "Groceries"],
    );
    assert.equal(run.summary.groceryTasksAdded, 2);
    assert.deepEqual(
      listHistory(s.db, {}, { limit: 10, offset: 0 }).rows.map((r) => [
        r.mealName,
        r.planned,
      ]),
      [["Stew", "2026-11-02"]],
    );

    // Groceries are dated to the meal's last cooking day
    const grocery = s.todoist.open("Groceries")[0]!;
    assert.match(grocery.description, /date = "2026-11-02"/);
  });

  test("a grocery failure leaves cooking tasks and history recorded", async () => {
    const s = testServices();
    createMeal(s.db, meal({ name: "Stew", feeds: 1, freezable: false }));
    saveSettings(s.db, { daysToPlan: 1 });
    s.todoist.failAddTask = (args) => args.projectId === "p-groceries";

    const run = await runPlan(s);
    assert.equal(run.status, "failed");
    assert.deepEqual(
      run.summary.createdTasks!.map((t) => t.project),
      ["Cooking"],
    );
    assert.equal(listHistory(s.db, {}, { limit: 10, offset: 0 }).total, 1);

    // A retry sees the day as planned, so doesn't double-book it
    s.todoist.failAddTask = () => false;
    const retry = await runPlan(s);
    assert.equal(retry.status, "success");
    assert.deepEqual(retry.summary.mealsAdded, []);
  });

  test("planning straight after planning adds nothing", async () => {
    const s = testServices();
    createMeal(s.db, meal({ name: "Stew", feeds: 1 }));
    createMeal(s.db, meal({ name: "Curry", feeds: 2, freezable: false }));
    saveSettings(s.db, { daysToPlan: 7 });

    const first = await runPlan(s);
    assert.ok(first.summary.mealsAdded!.length > 0);
    const second = await runPlan(s);
    assert.deepEqual(second.summary.mealsAdded, []);
    assert.match(second.log, /already planned/);
  });

  test("meals with a missing recipe are skipped, with a warning", async () => {
    const s = testServices();
    createMeal(s.db, meal({ name: "Stew", feeds: 1 }));
    createMeal(s.db, meal({ name: "Ghost", recipes: ["Not A Recipe"] }));
    saveSettings(s.db, { daysToPlan: 3 });

    const run = await runPlan(s);
    assert.equal(run.status, "success", run.error ?? "");
    assert.match(run.log, /Skipped Ghost: recipe "Not A Recipe"/);
    assert.ok(run.summary.mealsAdded!.every((m) => m.name === "Stew"));
  });

  test("fails if skipping leaves nothing to plan", async () => {
    const s = testServices();
    createMeal(s.db, meal({ name: "Ghost", recipes: ["Not A Recipe"] }));
    const run = await runPlan(s);
    assert.equal(run.status, "failed");
    assert.match(run.error!, /every enabled meal refers to a missing recipe/);
  });

  test("disabled meals aren't planned", async () => {
    const s = testServices();
    createMeal(s.db, meal({ name: "Stew", feeds: 1 }));
    createMeal(s.db, meal({ name: "Off", feeds: 1, enabled: false }));
    saveSettings(s.db, { daysToPlan: 5 });
    const run = await runPlan(s);
    assert.ok(run.summary.mealsAdded!.every((m) => m.name === "Stew"));
  });

  test("freezing respects the global switch and the per-meal flag", async () => {
    const s = testServices();
    createMeal(s.db, meal({ name: "Chilli", feeds: 4, freezable: false }));
    saveSettings(s.db, { daysToPlan: 4, planToFreeze: true });
    const run = await runPlan(s);
    assert.deepEqual(
      run.summary.mealsAdded!.map((m) => [m.name, m.dates.length]),
      [["Chilli", 4]],
    );

    const s2 = testServices();
    createMeal(s2.db, meal({ name: "Chilli", feeds: 4, freezable: true }));
    saveSettings(s2.db, { daysToPlan: 3, planToFreeze: true });
    const run2 = await runPlan(s2);
    assert.deepEqual(
      run2.summary.mealsAdded!.map((m) => [m.name, m.dates.length]),
      [["Chilli (Freeze one)", 3]],
    );
    // History stores the meal's own name
    assert.equal(
      listHistory(s2.db, {}, { limit: 1, offset: 0 }).rows[0]!.mealName,
      "Chilli",
    );
  });

  test("prefers meals outside the history window", async () => {
    const s = testServices({ today: "2026-11-02" });
    createMeal(s.db, meal({ name: "Recent", feeds: 1 }));
    createMeal(s.db, meal({ name: "Fresh", feeds: 1 }));
    recordMeals(s.db, ["Recent"], "2026-10-30");
    saveSettings(s.db, { daysToPlan: 1, historyWindowDays: 30 });

    const run = await runPlan(s);
    assert.deepEqual(
      run.summary.mealsAdded!.map((m) => m.name),
      ["Fresh"],
    );
  });

  test("cleans up past cooking tasks first", async () => {
    const s = testServices({ today: "2026-11-02" });
    createMeal(s.db, meal({ name: "Stew", feeds: 1 }));
    s.todoist.addExisting("Cooking", "Yesterday", "2026-11-01");
    saveSettings(s.db, { daysToPlan: 1 });

    const run = await runPlan(s);
    assert.equal(run.summary.cookingClosed, 1);
  });

  test("fails clearly if the recipe book was never loaded", async () => {
    const s = testServices();
    s.db.exec("DELETE FROM recipe_cache");
    const { RecipeBook } = await import("../recipes/book.ts");
    const book = new RecipeBook(s.db, "http://127.0.0.1:9/repo.json");
    (s.services.deps as { recipeBook: unknown }).recipeBook = book;

    const run = await runPlan(s);
    assert.equal(run.status, "failed");
    assert.match(run.error!, /Recipe book not loaded yet/);
    assert.match(run.log, /Couldn't reach the recipe book/);
  });
});

describe("push meal", () => {
  test("books the next free days from the start date", async () => {
    const s = testServices({ today: "2026-11-02" });
    const id = createMeal(
      s.db,
      meal({ name: "Chilli", feeds: 4, freezable: true }),
    );
    s.todoist.addExisting("Cooking", "Taken", "2026-11-06");

    const result = s.services.pushMeal({
      mealId: id,
      date: "2026-11-05",
      freeze: true,
    });
    assert.ok(result.ok);
    const run = await result.done;
    assert.equal(run.status, "success", run.error ?? "");
    assert.deepEqual(run.summary.mealsAdded, [
      {
        name: "Chilli (Freeze one)",
        dates: ["2026-11-05", "2026-11-07", "2026-11-08"],
      },
    ]);
    assert.equal(listHistory(s.db, {}, { limit: 1, offset: 0 }).total, 1);
  });

  test("works for disabled meals, without freezing unless asked", async () => {
    const s = testServices();
    const id = createMeal(
      s.db,
      meal({ name: "Chilli", feeds: 3, enabled: false }),
    );
    const result = s.services.pushMeal({
      mealId: id,
      date: "2026-11-02",
      freeze: false,
    });
    assert.ok(result.ok);
    const run = await result.done;
    assert.equal(run.summary.mealsAdded![0]!.dates.length, 3);
  });
});
