import type { DatabaseSync } from "node:sqlite";
import { formatTime } from "../dates.ts";
import {
  finishRun,
  getRun,
  insertRun,
  updateRunProgress,
  type CreatedTask,
  type Run,
  type RunKind,
  type RunSummary,
  type RunTrigger,
} from "../db/runs.ts";

export const RUN_TIMEOUT_MS = 10 * 60 * 1000;

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
}

export interface RunContext {
  run: Run;
  /**
   * Fires when the run times out. Pass it to every outbound request.
   */
  signal: AbortSignal;
  log: Logger;
  /**
   * Mutate this, then call `save()` to persist progress.
   */
  summary: RunSummary;
  save(): void;
  /**
   * Record a Todoist task as soon as it's created.
   */
  recordTask(task: CreatedTask): void;
  /**
   * Throw if the run has timed out. Call between steps.
   */
  checkpoint(): void;
}

export type StartResult =
  { ok: true; run: Run; done: Promise<Run> } | { ok: false; message: string };

export const kindLabels: Record<RunKind, string> = {
  plan: "Plan",
  cleanup: "Cleanup",
  push_meal: "Push meal",
  refresh_recipes: "Recipe refresh",
};

class RunTimeout extends Error {}

/**
 * Runs services one at a time, recording each in the `runs` table.
 */
export class Runner {
  #db: DatabaseSync;
  #timeoutMs: number;
  #current: Run | null = null;
  #listeners = new Set<(run: Run) => void>();

  constructor(db: DatabaseSync, options: { timeoutMs?: number } = {}) {
    this.#db = db;
    this.#timeoutMs = options.timeoutMs ?? RUN_TIMEOUT_MS;
  }

  get current(): Run | null {
    return this.#current;
  }

  /**
   * Call `listener` whenever a run finishes.
   */
  onFinish(listener: (run: Run) => void) {
    this.#listeners.add(listener);
  }

  busyMessage(): string | null {
    const current = this.#current;
    if (!current) return null;
    return `A ${kindLabels[current.kind].toLowerCase()} run is in progress, started ${formatTime(current.startedAt)}`;
  }

  /**
   * Start a run, unless one is already in progress.
   */
  start(
    kind: RunKind,
    trigger: RunTrigger,
    params: Record<string, unknown> | null,
    fn: (ctx: RunContext) => Promise<void>,
  ): StartResult {
    const busy = this.busyMessage();
    if (busy) return { ok: false, message: busy };

    const db = this.#db;
    const run = insertRun(db, kind, trigger, params);
    this.#current = run;

    const prefix = `[run ${run.id} ${kind}]`;
    const lines: string[] = [];
    const summary: RunSummary = {};
    let finished = false;

    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        controller.abort(
          new RunTimeout(
            `Timed out after ${Math.round(this.#timeoutMs / 60_000)} minutes`,
          ),
        ),
      this.#timeoutMs,
    );
    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () =>
        reject(controller.signal.reason),
      );
    });
    aborted.catch(() => {});

    const save = () => {
      if (!finished) updateRunProgress(db, run.id, summary, lines.join("\n"));
    };
    const write = (level: "info" | "warn", message: string) => {
      lines.push(level === "warn" ? `Warning: ${message}` : message);
      (level === "warn" ? console.warn : console.log)(`${prefix} ${message}`);
      save();
    };

    const ctx: RunContext = {
      run,
      signal: controller.signal,
      log: {
        info: (m) => write("info", m),
        warn: (m) => write("warn", m),
      },
      summary,
      save,
      recordTask: (task) => {
        (summary.createdTasks ??= []).push(task);
        save();
      },
      checkpoint: () => controller.signal.throwIfAborted(),
    };

    console.log(`${prefix} started (${trigger})`);
    const done = (async () => {
      let error: string | null = null;
      try {
        await Promise.race([fn(ctx), aborted]);
      } catch (e) {
        const reason = controller.signal.aborted ? controller.signal.reason : e;
        error =
          reason instanceof RunTimeout
            ? reason.message
            : reason instanceof Error
              ? (reason.stack ?? reason.message)
              : String(reason);
        console.error(`${prefix} failed: ${error}`);
      } finally {
        clearTimeout(timer);
        finishRun(
          db,
          run.id,
          error === null ? "success" : "failed",
          summary,
          lines.join("\n"),
          error,
        );
        finished = true;
        this.#current = null;
      }
      if (error === null) console.log(`${prefix} finished`);

      const result = getRun(db, run.id)!;
      for (const listener of this.#listeners) {
        try {
          listener(result);
        } catch (e) {
          console.error(e);
        }
      }
      return result;
    })();

    return { ok: true, run, done };
  }
}
