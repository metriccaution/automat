import { parse as parseTOML, stringify as stringifyTOML } from "smol-toml";
import { TodoistApi, type Task } from "@doist/todoist-sdk";
import { z } from "zod";
import { recipeUrl } from "../data/web.ts";
import { addDays, compare, isCalendarDate } from "../dates.ts";
import { todoistFetch } from "../http.ts";
import { filters, toFilter } from "./filters.ts";
import type { RecipeForDay } from "../recipe-choice/index.ts";

const shoppingEntry = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.string(),
  recipe: z.string(),
});

const shoppingMetadata = z.object({
  ingredient: z.string(),
  items: z.array(shoppingEntry).min(1),
});

type ShoppingMetadata = z.infer<typeof shoppingMetadata>;

function shoppingContent(
  ingredient: string,
  items: Array<{ quantity: string }>,
): string {
  return `${items.map((i) => i.quantity).join(" + ")} ${ingredient}`;
}

function parseShoppingDescription(
  task: Pick<Task, "description">,
): ShoppingMetadata | undefined {
  if (!task.description) return undefined;
  try {
    const parsed = shoppingMetadata.safeParse(parseTOML(task.description));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

const { and, dueBefore, dueAfter, project, withLabel } = filters;

export const mealsProject = "Cooking";
export const groceriesProject = "Groceries";
const automatLabel = "Automat";

/**
 * A Todoist client whose requests time out, and stop when `signal` fires.
 */
export function createTodoistApi(
  token: string,
  signal?: AbortSignal,
): TodoistApi {
  return new TodoistApi(token, { customFetch: todoistFetch(signal) });
}

async function* tasksForQuery(
  api: TodoistApi,
  query: string,
): AsyncGenerator<Task> {
  let cursor = null;
  do {
    const hits = await api.getTasksByFilter({ cursor, query });
    cursor = hits.nextCursor;

    for (const task of hits.results) {
      yield task;
    }
  } while (cursor !== null);
}

/**
 * Clear up any cooking tasks in the past. Returns how many were closed.
 */
export async function cleanupCooking(
  api: TodoistApi,
  today: string,
): Promise<number> {
  let closed = 0;
  const query = toFilter(
    and(project(mealsProject), dueBefore(today), withLabel(automatLabel)),
  );
  for await (const task of tasksForQuery(api, query)) {
    const due = dueDate(task);
    if (due && compare(due, today) < 0) {
      await api.closeTask(task.id);
      closed++;
    }
  }
  return closed;
}

/**
 * Clear up any grocery tasks whose cooking date has passed.
 */
export async function cleanupShopping(
  api: TodoistApi,
  today: string,
): Promise<{ closed: number; trimmed: number }> {
  let closed = 0;
  let trimmed = 0;

  const query = toFilter(
    and(project(groceriesProject), withLabel(automatLabel)),
  );
  for await (const task of tasksForQuery(api, query)) {
    const data = parseShoppingDescription(task);
    if (!data) continue;

    const remaining = data.items.filter(
      (item) => compare(item.date, today) >= 0,
    );

    if (remaining.length === 0) {
      await api.closeTask(task.id);
      closed++;
    } else if (remaining.length < data.items.length) {
      await api.updateTask(task.id, {
        content: shoppingContent(data.ingredient, remaining),
        description: stringifyTOML({
          ingredient: data.ingredient,
          items: remaining,
        }),
      });
      trimmed++;
    }
  }

  return { closed, trimmed };
}

/**
 * A task's due date as a calendar date. For a task with a due time, only the
 * date part is used.
 */
export function dueDate(task: Pick<Task, "due">): string | undefined {
  const date = task.due?.date?.slice(0, 10);
  return date && isCalendarDate(date) ? date : undefined;
}

export interface UpcomingCooking {
  id: string;
  date: string;
  content: string;
}

/**
 * Every Cooking task due today or later, whether or not Automat added it.
 */
export async function listUpcomingCooking(
  api: TodoistApi,
  today: string,
): Promise<UpcomingCooking[]> {
  const upcoming: UpcomingCooking[] = [];
  const query = toFilter(
    and(project(mealsProject), dueAfter(addDays(today, -1))),
  );

  for await (const task of tasksForQuery(api, query)) {
    const date = dueDate(task);
    if (date && compare(date, today) >= 0) {
      upcoming.push({ id: task.id, date, content: task.content });
    }
  }

  return upcoming.sort((a, b) => compare(a.date, b.date));
}

/**
 * How many distinct days in `[today, today + days)` already have cooking.
 */
export function plannedDaysInWindow(
  upcoming: Array<{ date: string }>,
  today: string,
  days: number,
): number {
  const end = addDays(today, days);
  return new Set(
    upcoming
      .map((u) => u.date)
      .filter((d) => compare(d, today) >= 0 && compare(d, end) < 0),
  ).size;
}

function mealContent(meal: {
  title: string;
  recipes: Array<{ title: string; slug: string }>;
}): string {
  if (meal.recipes.length === 1) {
    return `[${meal.title}](${recipeUrl(meal.recipes[0]!.slug)})`;
  }
  const links = meal.recipes
    .map((r) => `[${r.title}](${recipeUrl(r.slug)})`)
    .join(", ");
  return `${meal.title} (${links})`;
}

export interface TodoistTargets {
  label: string;
  groceriesProjectId: string;
  mealsProjectId: string;
}

/**
 * Find (or create) the label and projects that tasks are written to.
 */
export async function ensureTargets(api: TodoistApi): Promise<TodoistTargets> {
  const [label, groceriesProjectId, mealsProjectId] = await Promise.all([
    ensureLabel(api, automatLabel),
    ensureProject(api, groceriesProject),
    ensureProject(api, mealsProject),
  ]);
  return { label, groceriesProjectId, mealsProjectId };
}

type OnCreated = (task: {
  id: string;
  project: "Cooking" | "Groceries";
  content: string;
}) => void;

/**
 * Add one cooking task per meal day.
 */
export async function addCookingTasks(
  api: TodoistApi,
  targets: TodoistTargets,
  meals: RecipeForDay[],
  onCreated: OnCreated,
): Promise<void> {
  for (const meal of meals) {
    const description =
      meal.otherIngredients
        .map((i) => `${i.ingredient} - ${i.quantity}`)
        .join("\n") || undefined;

    const task = await api.addTask({
      content: mealContent(meal),
      labels: [targets.label],
      projectId: targets.mealsProjectId,
      dueDate: meal.date,
      description,
    });
    onCreated({ id: task.id, project: "Cooking", content: task.content });
  }
}

export interface GroceryItem {
  ingredient: string;
  quantity: string;
  cookingDate: string;
  recipe: string;
}

/**
 * Add one grocery task per ingredient. Returns how many were added.
 */
export async function addGroceryTasks(
  api: TodoistApi,
  targets: TodoistTargets,
  ingredients: GroceryItem[],
  onCreated: OnCreated,
): Promise<number> {
  const grouped = new Map<
    string,
    Array<{ date: string; quantity: string; recipe: string }>
  >();
  for (const { ingredient, quantity, cookingDate, recipe } of ingredients) {
    const entries = grouped.get(ingredient) ?? [];
    entries.push({ date: cookingDate, quantity, recipe });
    grouped.set(ingredient, entries);
  }

  const names = [...grouped.keys()].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
  for (const name of names) {
    const items = grouped.get(name)!;
    const task = await api.addTask({
      content: shoppingContent(name, items),
      labels: [targets.label],
      projectId: targets.groceriesProjectId,
      description: stringifyTOML({ ingredient: name, items }),
    });
    onCreated({ id: task.id, project: "Groceries", content: task.content });
  }
  return names.length;
}

/**
 * Make sure there's a label present with a particular name, and get its ID.
 */
async function ensureLabel(client: TodoistApi, label: string): Promise<string> {
  const labels = (await client.getLabels()).results;
  const match = labels.find((l) => l.name === label);
  if (match) {
    return match.name;
  }

  const newLabel = await client.addLabel({
    name: label,
  });

  return newLabel.name;
}

/**
 * Make sure there's a project present with a particular name, and get its ID.
 */
async function ensureProject(
  client: TodoistApi,
  project: string,
): Promise<string> {
  const projects = (await client.getProjects()).results;
  const matches = projects.filter((l) => l.name === project);

  if (matches.length > 1) {
    throw new Error(`Multiple projects exist with the name: ${project}`);
  }

  if (matches.length === 1) {
    return matches[0]!.id;
  }

  const newProject = await client.addProject({
    name: project,
  });

  return newProject.id;
}
