import { readFile } from "node:fs/promises";
import { planMeals } from "./lib/commands/plan";
import { z } from "zod";
import { join, resolve } from "node:path";

const config = z
  .object({
    todoistToken: z.string(),
    historyDb: z.string().optional(),
  })
  .parse(
    JSON.parse(
      await readFile(join(import.meta.dirname, "config.json"), "utf-8"),
    ),
  );

await planMeals({
  mealRepo: resolve(__dirname, "meals"),
  daysToPlan: 7,
  planToFreeze: true,
  todoistToken: config.todoistToken,
  historyDb: config.historyDb,
});
