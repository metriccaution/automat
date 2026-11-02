import type { Hono } from "hono";
import { compare, formatDate } from "../../dates.ts";
import { mealStats } from "../../db/history.ts";
import {
  createMeal,
  deleteMeal,
  findMealByName,
  getMeal,
  listMeals,
  setMealEnabled,
  updateMeal,
  type Meal,
  type MealFilter,
  type MealInput,
} from "../../db/meals.ts";
import { pickDates } from "../../recipe-choice/index.ts";
import { daysWithFreezing } from "../../recipe-choice/util.ts";
import { loadFullMeals } from "../../recipes/mod.ts";
import { resolveShoppingList } from "../../recipes/shopping.ts";
import { canFreeze, pushDayCount, pushDays } from "../../services/push-meal.ts";
import {
  chrome,
  isHtmx,
  setFlash,
  type AppContext,
  type AppDeps,
  type AppEnv,
} from "../context.ts";
import {
  dateParts,
  formValue,
  formValues,
  pageNumber,
  parseDateParts,
  partsFromDate,
  withQuery,
  type FormBody,
} from "../forms.ts";
import type { FieldErrors } from "../views/components/core.ts";
import type { DateParts } from "../views/components/forms.ts";
import { plural } from "../views/format.ts";
import { mealFormPage, type MealFormValues } from "../views/pages/meal-form.ts";
import {
  deleteMealPage,
  mealsListPage,
  mealViewPage,
} from "../views/pages/meals.ts";
import { pushPage, type PushDaysInfo } from "../views/pages/push.ts";

const PAGE_SIZE = 50;

function formFromMeal(meal: Meal): MealFormValues {
  return {
    name: meal.name,
    feeds: String(meal.feeds),
    enabled: meal.enabled,
    freezable: meal.freezable,
    recipes: [...meal.recipes],
    others: meal.otherIngredients.map((o) => ({ ...o })),
  };
}

const emptyForm = (): MealFormValues => ({
  name: "",
  feeds: "",
  enabled: true,
  freezable: true,
  recipes: [""],
  others: [],
});

function formFromBody(body: FormBody): MealFormValues {
  const options = formValues(body, "options");
  const ingredients = formValues(body, "ingredient");
  const quantities = formValues(body, "quantity");
  return {
    name: formValue(body, "name"),
    feeds: formValue(body, "feeds"),
    enabled: options.includes("enabled"),
    freezable: options.includes("freezable"),
    recipes: formValues(body, "recipes").map((r) => r.trim()),
    others: ingredients.map((ingredient, i) => ({
      ingredient: ingredient.trim(),
      quantity: (quantities[i] ?? "").trim(),
    })),
  };
}

/**
 * Apply an "add / remove / move" row button. Returns false for "save".
 */
function applyRowAction(values: MealFormValues, action: string): boolean {
  const swap = <T>(list: T[], a: number, b: number) => {
    if (a < 0 || b < 0 || a >= list.length || b >= list.length) return;
    [list[a], list[b]] = [list[b]!, list[a]!];
  };
  const match = /^(add|remove|up|down)-(recipe|ingredient)(?:-(\d+))?$/.exec(
    action,
  );
  if (!match) return false;
  const [, verb, kind, index] = match;
  const i = Number(index);
  const list: unknown[] = kind === "recipe" ? values.recipes : values.others;

  if (verb === "add") {
    if (kind === "recipe") values.recipes.push("");
    else values.others.push({ ingredient: "", quantity: "" });
  } else if (verb === "remove") {
    list.splice(i, 1);
  } else if (verb === "up") {
    swap(list, i, i - 1);
  } else if (verb === "down") {
    swap(list, i, i + 1);
  }
  return true;
}

function validate(
  values: MealFormValues,
  deps: AppDeps,
  mealId: number | undefined,
): { input: MealInput } | { errors: FieldErrors } {
  const errors: FieldErrors = new Map();

  if (!values.name) {
    errors.set("name", "Enter a name for the meal");
  } else if (values.name.length > 200) {
    errors.set("name", "Name must be 200 characters or fewer");
  } else {
    const existing = findMealByName(deps.db, values.name);
    if (existing && existing.id !== mealId) {
      errors.set(
        "name",
        `There’s already a meal called ${existing.name}. Enter a different name`,
      );
    }
  }

  const feeds = Number(values.feeds);
  if (!values.feeds) {
    errors.set("feeds", "Enter how many days the meal feeds");
  } else if (!/^\d+$/.test(values.feeds)) {
    errors.set(
      "feeds",
      "How many days the meal feeds must be a whole number, like 2",
    );
  } else if (feeds < 1) {
    errors.set("feeds", "How many days the meal feeds must be 1 or more");
  } else if (feeds > 28) {
    errors.set("feeds", "How many days the meal feeds must be 28 or fewer");
  }

  const recipes = values.recipes.filter(Boolean);
  if (recipes.length === 0) {
    errors.set("recipe-0", "Choose at least one recipe");
  }

  values.others.forEach((row, i) => {
    if (!row.ingredient && row.quantity) {
      errors.set(`ingredient-${i}`, `Enter ingredient ${i + 1}`);
    }
    if (row.ingredient && !row.quantity) {
      errors.set(
        `quantity-${i}`,
        `Enter how much ${row.ingredient} to buy, like 2 or 100g`,
      );
    }
  });

  if (errors.size) return { errors };
  return {
    input: {
      name: values.name,
      feeds,
      enabled: values.enabled,
      freezable: values.freezable,
      recipes,
      otherIngredients: values.others.filter((o) => o.ingredient && o.quantity),
    },
  };
}

export function mealsRoutes(app: Hono<AppEnv>, deps: AppDeps) {
  const { db, recipeBook, services } = deps;

  const recipeTitles = () =>
    recipeBook.data
      ? recipeBook.data.recipes
          .map((r) => r.title)
          .sort((a, b) => a.localeCompare(b))
      : null;

  const findMeal = (c: AppContext) => {
    const id = Number(c.req.param("id"));
    return Number.isInteger(id) ? getMeal(db, id) : undefined;
  };

  /*
   * List
   */
  app.get("/meals", (c) => {
    const status = c.req.query("status");
    const filter: Required<MealFilter> = {
      search: (c.req.query("q") ?? "").trim(),
      status: status === "enabled" || status === "disabled" ? status : "all",
    };
    const meals = listMeals(db, filter);
    const pages = Math.max(1, Math.ceil(meals.length / PAGE_SIZE));
    const page = Math.min(pageNumber(c.req.query("page")), pages);
    const stats = mealStats(db, deps.services.deps.today());
    const recipes = recipeBook.data?.recipes;
    const titles = recipes ? new Set(recipes.map((r) => r.title)) : null;

    return c.html(
      mealsListPage({
        chrome: chrome(c, deps),
        filter,
        page,
        pages,
        totalMeals: (
          db.prepare("SELECT COUNT(*) AS n FROM meals").get() as { n: number }
        ).n,
        href: (p) =>
          withQuery("/meals", {
            q: filter.search,
            status: filter.status === "all" ? undefined : filter.status,
            page: p === 1 ? undefined : p,
          }),
        rows: meals
          .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
          .map((meal) => ({
            meal,
            stats: stats.get(meal.name),
            missing: titles ? meal.recipes.filter((t) => !titles.has(t)) : [],
          })),
      }),
    );
  });

  /*
   * Create
   */
  app.get("/meals/new", (c) =>
    c.html(
      mealFormPage({
        chrome: chrome(c, deps),
        values: emptyForm(),
        errors: new Map(),
        recipeTitles: recipeTitles(),
      }),
    ),
  );

  app.post("/meals/new", async (c) => {
    const body = await c.req.parseBody({ all: true });
    const values = formFromBody(body);
    const action = formValue(body, "action");
    if (applyRowAction(values, action)) {
      return c.html(
        mealFormPage({
          chrome: chrome(c, deps),
          values,
          errors: new Map(),
          recipeTitles: recipeTitles(),
        }),
      );
    }

    const result = validate(values, deps, undefined);
    if ("errors" in result) {
      return c.html(
        mealFormPage({
          chrome: chrome(c, deps),
          values,
          errors: result.errors,
          recipeTitles: recipeTitles(),
        }),
        isHtmx(c) ? 200 : 422,
      );
    }
    const id = createMeal(db, result.input);
    setFlash(c, { kind: "success", text: `${result.input.name} added` });
    return c.redirect(`/meals/${id}`, 303);
  });

  /*
   * View
   */
  app.get("/meals/:id", (c) => {
    const meal = findMeal(c);
    if (!meal) return c.notFound();

    const data = recipeBook.data;
    let shopping = null;
    if (data) {
      const full = loadFullMeals([meal], data.recipes);
      // Show what the recipes that do exist would add
      const usable = full.meals[0] ?? {
        ...meal,
        recipes: data.recipes.filter((r) => meal.recipes.includes(r.title)),
      };
      shopping = resolveShoppingList(usable, recipeBook.aliases);
    }

    return c.html(
      mealViewPage({
        chrome: chrome(c, deps),
        meal,
        stats: mealStats(db, services.deps.today()).get(meal.name),
        recipes: data ? new Map(data.recipes.map((r) => [r.title, r])) : null,
        shopping,
      }),
    );
  });

  /*
   * Edit
   */
  app.get("/meals/:id/edit", (c) => {
    const meal = findMeal(c);
    if (!meal) return c.notFound();
    return c.html(
      mealFormPage({
        chrome: chrome(c, deps),
        mealId: meal.id,
        originalName: meal.name,
        values: formFromMeal(meal),
        errors: new Map(),
        recipeTitles: recipeTitles(),
      }),
    );
  });

  app.post("/meals/:id/edit", async (c) => {
    const meal = findMeal(c);
    if (!meal) return c.notFound();

    const body = await c.req.parseBody({ all: true });
    const values = formFromBody(body);
    const action = formValue(body, "action");
    if (applyRowAction(values, action)) {
      return c.html(
        mealFormPage({
          chrome: chrome(c, deps),
          mealId: meal.id,
          originalName: meal.name,
          values,
          errors: new Map(),
          recipeTitles: recipeTitles(),
        }),
      );
    }

    const result = validate(values, deps, meal.id);
    if ("errors" in result) {
      return c.html(
        mealFormPage({
          chrome: chrome(c, deps),
          mealId: meal.id,
          originalName: meal.name,
          values,
          errors: result.errors,
          recipeTitles: recipeTitles(),
        }),
        isHtmx(c) ? 200 : 422,
      );
    }
    updateMeal(db, meal.id, result.input);
    setFlash(c, { kind: "success", text: `${result.input.name} saved` });
    return c.redirect(`/meals/${meal.id}`, 303);
  });

  /*
   * Delete
   */
  app.get("/meals/:id/delete", (c) => {
    const meal = findMeal(c);
    if (!meal) return c.notFound();
    return c.html(deleteMealPage({ chrome: chrome(c, deps), meal }));
  });

  app.post("/meals/:id/delete", (c) => {
    const meal = findMeal(c);
    if (!meal) return c.notFound();
    deleteMeal(db, meal.id);
    setFlash(c, { kind: "success", text: `${meal.name} deleted` });
    return c.redirect("/meals", 303);
  });

  app.post("/meals/:id/disable", (c) => {
    const meal = findMeal(c);
    if (!meal) return c.notFound();
    setMealEnabled(db, meal.id, false);
    setFlash(c, {
      kind: "success",
      text: `${meal.name} disabled. It won’t be planned automatically`,
    });
    return c.redirect(`/meals/${meal.id}`, 303);
  });

  /*
   * Push to Todoist
   */
  /**
   * The push page. With no date entered yet, it starts at the next day with
   * no cooking planned.
   */
  const renderPush = async (
    c: AppContext,
    meal: Meal,
    input: { parts: DateParts | null; freeze: boolean },
    errors: FieldErrors = new Map(),
    problem?: string,
  ) => {
    const today = services.deps.today();
    let used: string[] | Error;
    try {
      used = (await services.upcomingCooking()).map((u) => u.date);
    } catch (e) {
      used = e as Error;
    }

    const parts =
      input.parts ??
      partsFromDate(
        used instanceof Error ? today : pickDates(today, used, 1)[0]!,
      );
    const parsed = parseDateParts(parts, "start date");

    let info: PushDaysInfo;
    if (used instanceof Error) {
      info = {
        kind: "todoist_unavailable",
        error: used.message,
        count: pushDayCount(meal, input.freeze),
      };
    } else if ("error" in parsed) {
      info = { kind: "invalid" };
    } else {
      const from = compare(parsed.date, today) < 0 ? today : parsed.date;
      info = { kind: "days", days: pushDays(meal, from, used, input.freeze) };
    }

    return c.html(
      pushPage({
        chrome: chrome(c, deps),
        meal,
        date: parts,
        freeze: input.freeze,
        canFreeze: canFreeze(meal),
        dayCounts: { plain: meal.feeds, frozen: daysWithFreezing(meal.feeds) },
        info,
        errors,
        problem,
      }),
      errors.size || problem ? 422 : 200,
    );
  };

  app.get("/meals/:id/push", async (c) => {
    const meal = findMeal(c);
    if (!meal) return c.notFound();
    const hasDate = c.req.query("date-day") !== undefined;
    return renderPush(c, meal, {
      parts: hasDate ? dateParts((k) => c.req.query(k), "date") : null,
      freeze: c.req.query("freeze") === "true",
    });
  });

  app.post("/meals/:id/push", async (c) => {
    const meal = findMeal(c);
    if (!meal) return c.notFound();

    const body = await c.req.parseBody({ all: true });
    const parts = dateParts((k) => formValue(body, k), "date");
    const freeze = formValue(body, "freeze") === "true" && canFreeze(meal);
    const parsed = parseDateParts(parts, "start date");

    const errors: FieldErrors = new Map();
    if ("error" in parsed) {
      errors.set("date-day", parsed.error);
    } else if (compare(parsed.date, services.deps.today()) < 0) {
      errors.set("date-day", "Start date must be today or in the future");
    }
    if (errors.size || !("date" in parsed)) {
      return renderPush(c, meal, { parts, freeze }, errors);
    }

    const result = services.pushMeal({
      mealId: meal.id,
      date: parsed.date,
      freeze,
    });
    if (!result.ok) {
      return renderPush(c, meal, { parts, freeze }, new Map(), result.message);
    }

    const run = await result.done;
    if (run.status === "success") {
      const dates = run.summary.mealsAdded?.[0]?.dates ?? [];
      setFlash(c, {
        kind: "success",
        text: `${meal.name} added to Todoist for ${plural(dates.length, "day")}, from ${formatDate(dates[0] ?? parsed.date)}`,
      });
      return c.redirect(`/meals/${meal.id}`, 303);
    }
    setFlash(c, {
      kind: "warning",
      text: `Pushing ${meal.name} to Todoist failed. Check what was created before trying again.`,
    });
    return c.redirect(`/history/runs/${run.id}`, 303);
  });
}
