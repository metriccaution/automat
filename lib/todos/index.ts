import { TodoistApi, type Task } from "@doist/todoist-api-typescript";
import type { RecipeIngredient } from "../data/index.ts";
import { filters, toFilter } from "./filters.ts";

const { and, dueBefore, dueOn, or, project, dueAfter, withLabel } = filters;

const mealsProject = "Cooking";
const groceriesProject = "Groceries";
const automatLabel = "Automat";

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

async function deleteByQuery(api: TodoistApi, query: string) {
  for await (const task of tasksForQuery(api, query)) {
    await api.closeTask(task.id);
  }
}

/**
 * Clear up any cooking tasks in the past
 */
export async function cleanupCooking(api: TodoistApi): Promise<void> {
  await deleteByQuery(
    api,
    toFilter(
      and(project(mealsProject), dueBefore("Today"), withLabel(automatLabel)),
    ),
  );
}

export function dueDate(task: Pick<Task, "due">): Date | undefined {
  const due = task.due;
  if (!due) {
    return undefined;
  }

  const parsed = new Date(due.date);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

/**
 * What days of cooking are already planned out.
 */
export async function listPlannedDays(apiClient: TodoistApi): Promise<Date[]> {
  const dates: Date[] = [];

  const query = toFilter(
    and(project(mealsProject), or(dueOn("Today"), dueAfter("Today"))),
  );

  for await (const task of tasksForQuery(apiClient, query)) {
    const taskDue = dueDate(task);
    if (taskDue) {
      dates.push(taskDue);
    }
  }

  return dates;
}

/**
 * Save new recipes into Todoist.
 */
export async function saveMealPlan(
  client: TodoistApi,
  ingredients: RecipeIngredient[],
  meals: Array<{ title: string; date: Date }>,
): Promise<void> {
  const [label, groceriesProjectId, mealsProjectId] = await Promise.all([
    ensureLabel(client, automatLabel),
    ensureProject(client, groceriesProject),
    ensureProject(client, mealsProject),
  ]);

  const sortedIngredients = ingredients
    .slice()
    .sort((a, b) =>
      a.ingredient.toLowerCase().localeCompare(b.ingredient.toLowerCase()),
    );

  for (const ingredient of sortedIngredients) {
    await client.addTask({
      content: `${ingredient.ingredient} - ${ingredient.quantity}`,
      labels: [label],
      projectId: groceriesProjectId,
    });
  }

  for (const meal of meals) {
    await client.addTask({
      content: meal.title,
      labels: [label],
      projectId: mealsProjectId,
      dueDate: meal.date.toISOString().split("T")[0]!,
    });
  }
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
