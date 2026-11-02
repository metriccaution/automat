import type { RunTrigger } from "../db/runs.ts";
import { listUpcomingCooking, type UpcomingCooking } from "../todos/index.ts";
import { cleanup } from "./cleanup.ts";
import { plan } from "./plan.ts";
import { pushMeal, type PushParams } from "./push-meal.ts";
import { refreshRecipes } from "./refresh-recipes.ts";
import type { Runner, StartResult } from "./runner.ts";
import type { ServiceDeps } from "./shared.ts";

const UPCOMING_CACHE_MS = 60_000;

/**
 * Every action the app can take, each going through the runner's lock.
 */
export class Services {
  readonly deps: ServiceDeps;
  readonly runner: Runner;
  #upcoming: { at: number; value: Promise<UpcomingCooking[]> } | null = null;

  constructor(deps: ServiceDeps, runner: Runner) {
    this.deps = deps;
    this.runner = runner;
    runner.onFinish(() => {
      this.#upcoming = null;
    });
  }

  plan(trigger: RunTrigger): StartResult {
    return this.runner.start("plan", trigger, null, (ctx) =>
      plan(this.deps, ctx),
    );
  }

  cleanup(trigger: RunTrigger): StartResult {
    return this.runner.start("cleanup", trigger, null, (ctx) =>
      cleanup(this.deps, ctx),
    );
  }

  refreshRecipes(trigger: RunTrigger): StartResult {
    return this.runner.start("refresh_recipes", trigger, null, (ctx) =>
      refreshRecipes(this.deps, ctx),
    );
  }

  pushMeal(params: PushParams): StartResult {
    return this.runner.start("push_meal", "manual", { ...params }, (ctx) =>
      pushMeal(this.deps, ctx, params),
    );
  }

  /**
   * Cooking tasks from today on, for display. Cached briefly, and cleared
   * whenever a run finishes.
   */
  upcomingCooking(): Promise<UpcomingCooking[]> {
    const now = Date.now();
    if (!this.#upcoming || now - this.#upcoming.at > UPCOMING_CACHE_MS) {
      const value = listUpcomingCooking(
        this.deps.todoist(AbortSignal.timeout(30_000)),
        this.deps.today(),
      );
      this.#upcoming = { at: now, value };
      value.catch(() => {
        if (this.#upcoming?.value === value) this.#upcoming = null;
      });
    }
    return this.#upcoming.value;
  }
}
