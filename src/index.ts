import { getRecipes } from "./airtable";
import { config } from "./config";
import pickFood from "./recipe-choice/random-recipes";
import todoistApi from "./todoist";

(async () => {
  log(config.toString());
  const appConfig = config.get();

  const daysToPick = appConfig.recipeChoice.days;

  const today = new Date();
  const end = new Date(today.getTime() + daysToPick * 1000 * 60 * 60 * 24);

  const todoist = todoistApi(appConfig.todoist);

  const alreadyChosen = await todoist.countDaysWithFood(today, end);
  const howManyDays = daysToPick - alreadyChosen;

  log(
    `Picking food for ${howManyDays} days (${alreadyChosen} had meals planned already)`
  );

  const recipes = await getRecipes(appConfig.airtable);
  const chosenRecipes = pickFood(howManyDays, recipes);

  log(`Picked ${chosenRecipes.map(r => r.name).join(", ") || "nothing"}`);

  await todoist.saveRecipes(today, chosenRecipes);
  log("Done");
})().catch((e: Error) => console.log("Failed to run", e));

function log(...data: any[]) {
  console.log(new Date().toISOString(), ...data);
}
