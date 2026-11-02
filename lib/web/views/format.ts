import { html } from "hono/html";
import type { Run, RunKind, RunStatus, RunTrigger } from "../../db/runs.ts";
import { formatInstant, formatTime } from "../../dates.ts";
import { kindLabels } from "../../services/runner.ts";
import { tag, type Html } from "./components/core.ts";
import { mark } from "./components/logo.ts";

export { kindLabels };

export const triggerLabels: Record<RunTrigger, string> = {
  schedule: "Scheduled",
  manual: "Manual",
  startup: "Startup",
};

export const statusLabels: Record<RunStatus, string> = {
  running: "Running",
  success: "Success",
  failed: "Failed",
};

export function statusTag(status: RunStatus): Html {
  return tag(
    statusLabels[status],
    status === "running" ? "blue" : status === "success" ? "green" : "red",
  );
}

export const kindLabel = (kind: RunKind) => kindLabels[kind];

/**
 * Todoist task content with markdown links reduced to their text.
 */
export const plainContent = (content: string) =>
  content.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

export const todoistTaskUrl = (id: string) =>
  `https://app.todoist.com/app/task/${encodeURIComponent(id)}`;

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * One line describing what a finished run did.
 */
export function runOutcome(run: Run): string {
  const s = run.summary;
  if (run.status === "failed") {
    return run.error?.split("\n")[0] ?? "The run failed";
  }
  const parts: string[] = [];
  if (s.mealsAdded) {
    const days = s.mealsAdded.reduce((n, m) => n + m.dates.length, 0);
    parts.push(
      s.mealsAdded.length
        ? `Added ${plural(s.mealsAdded.length, "meal")} over ${plural(days, "day")}`
        : "No meals needed adding",
    );
  }
  if (s.groceryTasksAdded) {
    parts.push(`${plural(s.groceryTasksAdded, "grocery task")} added`);
  }
  if (s.cookingClosed !== undefined) {
    parts.push(
      `closed ${plural(s.cookingClosed, "past cooking task")} and ${plural(s.groceriesClosed ?? 0, "grocery task")}`,
    );
  }
  if (s.recipes && run.kind === "refresh_recipes") {
    parts.push(
      s.recipes.outcome === "updated"
        ? `Recipe book updated: ${plural(s.recipes.recipeCount, "recipe")}`
        : "Recipe book unchanged",
    );
  }
  const text = parts.join("; ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Done";
}

/**
 * A run's live status. While running it polls itself every 2 seconds, and
 * updates the header mark out-of-band.
 */
export function runStatus(run: Run, options: { oob?: boolean } = {}): Html {
  const running = run.status === "running";
  return html`<div
      id="run-status-${run.id}"
      class="automat-run-status"
      aria-live="polite"
      ${
        running
          ? html`hx-get="/history/runs/${run.id}/status" hx-trigger="every 2s"
            hx-swap="outerHTML"`
          : ""
      }
    >
      <p class="govuk-body">
        ${statusTag(run.status)} ${kindLabel(run.kind)} run
        ${
          running
            ? html`started ${formatTime(run.startedAt)}.
              ${
                run.kind === "plan" || run.kind === "push_meal"
                  ? html`<span class="automat-dispensing"
                      >Dispensing your week…</span
                    >`
                  : ""
              }`
            : html`finished ${formatInstant(run.finishedAt ?? run.startedAt)}.
              ${runOutcome(run)}.`
        }
      </p>
      <p class="govuk-body">
        <a class="govuk-link" href="/history/runs/${run.id}"
          >View run details</a
        >
      </p>
    </div>
    ${options.oob ? mark(running, true) : ""}`;
}
