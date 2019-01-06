import { Logger } from "pino";
import { RecipeDestination } from "../types";
import { createApi, TodoistApi } from "./api";
import { countDaysWithFood, saveRecipes } from "./utils";

export interface TodoistConfig {
  apiKey: string;
  projects: {
    cooking: string;
    shopping: string;
  };
  logger: Logger;
}

/**
 * Wrap up the Todoist API as something to send cooking tasks to.
 */
export default function todoistDestination(
  config: TodoistConfig
): RecipeDestination {
  const { apiKey, projects } = config;

  const baseApi = createApi({
    apiKey
  });

  const api: TodoistApi = {
    createTask: async (...args) => {
      config.logger.debug("Creating task");
      return baseApi.createTask(...args);
    },
    getTasks: async (...args) => {
      config.logger.debug("Getting tasks");
      return baseApi.getTasks(...args);
    },
    listProjects: async (...args) => {
      config.logger.debug("Listing projects");
      return baseApi.listProjects(...args);
    }
  };

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
