import { readFile } from "node:fs/promises";
import { planMeals } from "./lib/commands/plan";
import { z } from "zod";
import { join } from "node:path";

const config = z
  .object({
    todoistToken: z.string(),
  })
  .parse(
    JSON.parse(
      await readFile(join(import.meta.dirname, "config.json"), "utf-8"),
    ),
  );

await planMeals({
  dataFile: "../recipies/sources/repo.json",
  daysToPlan: 7,
  planToFreeze: true,
  todoistToken: config.todoistToken,
});
