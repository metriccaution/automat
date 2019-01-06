import { RecipeDestination } from "../types";
import { createApi } from "./api";
import { countDaysWithFood, saveRecipes } from "./utils";

export interface TodoistConfig {
  apiKey: string;
  projects: {
    cooking: string;
    shopping: string;
  };
}

/**
 * Wrap up the Todoist API as something to send cooking tasks to.
 */
export default function todoistDestination(
  config: TodoistConfig
): RecipeDestination {
  const { apiKey, projects } = config;
  const api = createApi({
    apiKey
  });

  const dest: RecipeDestination = {
    countDaysWithFood: async (start: Date, end: Date) =>
      countDaysWithFood({
        api,
        end,
        projects,
        start
      }),
    saveRecipes: async (start, recipes) =>
      saveRecipes({
        api,
        projects,
        recipes,
        start
      })
  };

  return dest;
}
