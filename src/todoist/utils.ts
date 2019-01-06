import { flatten, times, uniq, zip } from "lodash";
import pMap from "p-map";
import * as pRetry from "p-retry";
import { pickDays } from "../date-utils";
import { RecipeDefinition } from "../types";
import { TodoistApi } from "./api";
import {
  formatDate,
  getDueDate,
  namedProject,
  taskHasDate,
  TodoistNewTask
} from "./api";

export interface ChooseRecipesArgs {
  projects: {
    shopping: string;
    cooking: string;
  };
  api: TodoistApi;
  start: Date;
  recipes: RecipeDefinition[];
}

/**
 * Save the choice of recipes to Todoist - This consists of shopping tasks added
 * to a shopping list (project in Todoist terms), and cooking tasks added on
 * each they're going to be eaten on.
 */
export async function saveRecipes({
  api,
  start,
  recipes,
  projects
}: ChooseRecipesArgs): Promise<void> {
  const shoppingProject = await namedProject(api, projects.shopping);
  const cookingProject = await namedProject(api, projects.cooking);

  // Create shopping tasks
  const shoppingTasks = flatten(recipes.map(r => r.ingredients))
    .sort((i1, i2) => i1.name.localeCompare(i2.name))
    .map(({ name, quantity }, index) => ({
      content: `${name} - ${quantity}`,
      order: index,
      project_id: shoppingProject.id
    }));

  // Create cooking tasks
  const days = recipes.reduce((total, recipe) => total + recipe.meals, 0);
  const alreadyChosen = (await api.getTasks(cookingProject.id))
    .filter(taskHasDate)
    .map(getDueDate);

  const dates = pickDays(days, alreadyChosen, start).map(formatDate);

  const cookingTaskNames = flatten(
    recipes.map(recipe =>
      times(recipe.meals, () => `${recipe.name} (${recipe.source})`)
    )
  );

  const cookingTasks = zip(cookingTaskNames, dates)
    .filter(([recipe, date]) => recipe && date)
    .map(
      ([name, date]): TodoistNewTask => ({
        content: name || "",
        due_date: date || "",
        project_id: cookingProject.id
      })
    );

  // Push the tasks to Todoist
  const tasks = [...shoppingTasks, ...cookingTasks].map(task => ({
    content: task,
    retryId: "automat_" + Math.floor(Math.random() * 1000000)
  }));

  await pMap(
    tasks,
    async task => {
      await pRetry(async () => api.createTask(task));
    },
    {
      concurrency: 1
    }
  );
}

export interface CountDaysWithFoodArgs {
  projects: {
    cooking: string;
  };
  api: TodoistApi;
  start: Date;
  end: Date;
}

/**
 * Count the number of days in a range that already have food set for them
 */
export async function countDaysWithFood({
  start,
  end,
  api,
  projects
}: CountDaysWithFoodArgs): Promise<number> {
  const project = await namedProject(api, projects.cooking);
  const tasks = await api.getTasks(project.id);

  return uniq(
    tasks
      .filter(taskHasDate)
      .map(getDueDate)
      .filter(date => date >= start && date <= end)
      .map(d => d.getTime())
  ).length;
}
