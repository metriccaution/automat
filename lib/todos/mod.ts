import { TodoistApi, type Task } from "@doist/todoist-api-typescript";
import type { RecipeIngredient } from "../data/recipe/mod.ts";
import { filters, toFilter } from "./filters.ts";

const { and, dueBefore, dueOn, or, project, dueAfter, withLabel } = filters;

const mealsProject = "Cooking";
const groceriesProject = "Groceries";
const automatLabel = "Automat";

async function deleteByQuery(api: TodoistApi, query: string) {
  // TODO - Paging
  const hits = await api.getTasksByFilter({ query });
  for (const task of hits.results) {
    await api.closeTask(task.id);
  }
}

/**
 * Clear up any cooking tasks in the past
 */
export async function cleanupCooking(apiKey: string): Promise<void> {
  await deleteByQuery(
    new TodoistApi(apiKey),
    toFilter(
      and(project(mealsProject), dueBefore("Today"), withLabel(automatLabel)),
    ),
  );
}

async function mealTasks(apiKey: string): Promise<Task[]> {
  // TODO - Technically have to care about days out the right of the planning window
  const cookingTasks = await new TodoistApi(apiKey).getTasksByFilter({
    query: toFilter(
      and(project(mealsProject), or(dueOn("Today"), dueAfter("Today"))),
    ),
  });

  return cookingTasks.results;
}

/**
 * What days of cooking are already planned out.
 */
export async function listPlannedDays(apiKey: string): Promise<Date[]> {
  const cookingTasks = await mealTasks(apiKey);
  const dueStrings: string[] = cookingTasks
    .map((task) => task.due)
    .filter((due): due is NonNullable<Task["due"]> => Boolean(due))
    .map((due) => due.date);

  // // TODO - This probably wants some checking...
  return dueStrings.map((d) => new Date(d));
}

/**
 * Save new recipies into Todoist.
 */
export async function saveMealPlan(
  apiKey: string,
  ingredients: RecipeIngredient[],
  meals: Array<{ title: string; date: Date }>,
): Promise<void> {
  const client = new TodoistApi(apiKey);
  const [label, groceriesProjectId, mealsProjectId] = await Promise.all([
    ensureLabel(apiKey, automatLabel),
    ensureProject(apiKey, groceriesProject),
    ensureProject(apiKey, mealsProject),
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
async function ensureLabel(apiKey: string, label: string): Promise<string> {
  const client = new TodoistApi(apiKey);
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
async function ensureProject(apiKey: string, project: string): Promise<string> {
  const client = new TodoistApi(apiKey);
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
