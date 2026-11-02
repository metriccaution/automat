import type { TodoistApi } from "@doist/todoist-sdk";
import { cleanupCooking, cleanupShopping } from "../todos/index.ts";
import type { RunContext } from "./runner.ts";
import type { ServiceDeps } from "./shared.ts";

/**
 * Close past cooking tasks, and expire grocery items whose cooking date has
 * passed.
 */
export async function cleanupTasks(
  api: TodoistApi,
  today: string,
  ctx: RunContext,
): Promise<void> {
  const [cookingClosed, shopping] = await Promise.all([
    cleanupCooking(api, today),
    cleanupShopping(api, today),
  ]);
  ctx.summary.cookingClosed = cookingClosed;
  ctx.summary.groceriesClosed = shopping.closed;
  ctx.summary.groceriesTrimmed = shopping.trimmed;
  ctx.log.info(
    `Cleanup: closed ${cookingClosed} past cooking task(s), closed ${shopping.closed} and trimmed ${shopping.trimmed} grocery task(s)`,
  );
  ctx.save();
}

/**
 * The "Cleanup only" action.
 */
export async function cleanup(
  deps: Pick<ServiceDeps, "todoist" | "today">,
  ctx: RunContext,
): Promise<void> {
  await cleanupTasks(deps.todoist(ctx.signal), deps.today(), ctx);
}
