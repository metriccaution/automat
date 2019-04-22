import * as pino from "pino";
import { getRecipes, updateRecipe } from "./airtable";
import { config } from "./config";
import pickFood from "./recipe-choice/random-recipes";
import todoistApi from "./todoist";

(async () => {
  const appConfig = config.get();

  const logger = pino({
    level: appConfig.logger.level
  });
  logger.info(config.toString());

  const daysToPick = appConfig.recipeChoice.days;

  const today = new Date();
  const end = new Date(today.getTime() + daysToPick * 1000 * 60 * 60 * 24);

  const todoist = todoistApi({
    ...appConfig.todoist,
    logger: logger.child({
      api: "todoist"
    })
  });

  const alreadyChosen = await todoist.countDaysWithFood(today, end);
  const howManyDays = daysToPick - alreadyChosen;

  logger.info("Pulling in recipes");
  const recipes = await getRecipes({
    ...appConfig.airtable,
    logger: logger.child({
      api: "airtable"
    })
  });

  logger.info(
    `Picking food for ${howManyDays} days (${alreadyChosen} had meals planned already)`
  );
  const chosenRecipes = pickFood(howManyDays, recipes);

  logger.info(
    `Picked ${chosenRecipes.map(r => r.name).join(", ") || "nothing"}`
  );

  logger.info("Setting up tasks");
  await todoist.saveRecipes(today, chosenRecipes);

  logger.info("Updating chosen recipes");
  for (const recipe of chosenRecipes) {
    await updateRecipe(
      {
        ...appConfig.airtable,
        logger: logger.child({
          api: "airtable"
        })
      },
      {
        ...recipe,
        lastCooked: new Date()
      }
    );
  }

  logger.info("Done");
})().catch((e: Error) => console.log("Failed to run", e));
