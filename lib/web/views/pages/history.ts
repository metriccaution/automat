import { html } from "hono/html";
import { formatDate, formatInstant } from "../../../dates.ts";
import type { HistoryRow } from "../../../db/history.ts";
import {
  runKinds,
  runStatuses,
  runTriggers,
  type Run,
  type RunFilter,
} from "../../../db/runs.ts";
import {
  button,
  details,
  pagination,
  summaryList,
  table,
  tag,
  warningText,
  type Content,
  type FieldErrors,
  type Html,
  type TableHead,
} from "../components/core.ts";
import {
  dateInput,
  selectInput,
  textInput,
  type DateParts,
} from "../components/forms.ts";
import { layout, type Chrome } from "../layout.ts";
import {
  kindLabel,
  plainContent,
  plural,
  runOutcome,
  runStatus,
  statusLabels,
  statusTag,
  todoistTaskUrl,
  triggerLabels,
} from "../format.ts";

export type HistoryTab = "meals" | "runs" | "stats";

const tabs: Array<{ id: HistoryTab; href: string; text: string }> = [
  { id: "meals", href: "/history/meals", text: "Meals planned" },
  { id: "runs", href: "/history/runs", text: "Runs" },
  { id: "stats", href: "/history/stats", text: "Meal stats" },
];

/**
 * Tabs markup, but each tab is a real link to its own URL and only the
 * selected panel is rendered. The Tabs JS isn't used.
 */
function historyLayout(
  chrome: Chrome,
  active: HistoryTab,
  panel: Html,
  hasErrors = false,
): Html {
  const current = tabs.find((t) => t.id === active)!;
  return layout({
    title: `${current.text} – History`,
    section: "history",
    chrome,
    hasErrors,
    main: html`<h1 class="govuk-heading-xl">History</h1>
      <div class="govuk-tabs automat-tabs" hx-boost="true">
        <h2 class="govuk-tabs__title">Contents</h2>
        <ul class="govuk-tabs__list">
          ${tabs.map(
            (t) =>
              html`<li
                class="govuk-tabs__list-item${
                  t.id === active ? " govuk-tabs__list-item--selected" : ""
                }"
              >
                <a
                  class="govuk-tabs__tab"
                  href="${t.href}"
                  ${t.id === active ? html`aria-current="page"` : ""}
                  >${t.text}</a
                >
              </li>`,
          )}
        </ul>
        <div class="govuk-tabs__panel">
          <h2 class="govuk-heading-l">${current.text}</h2>
          ${panel}
        </div>
      </div>`,
  });
}

export function mealsPlannedPage(o: {
  chrome: Chrome;
  name: string;
  from: DateParts;
  to: DateParts;
  errors: FieldErrors;
  rows: HistoryRow[];
  total: number;
  mealIds: Map<string, number>;
  page: number;
  pages: number;
  href: (page: number) => string;
}): Html {
  return historyLayout(
    o.chrome,
    "meals",
    html`<form method="get" action="/history/meals" class="automat-filter">
        ${textInput({
          id: "name",
          name: "name",
          label: "Meal name",
          labelSize: "s",
          value: o.name,
          width: 20,
          type: "search",
        })}
        ${dateInput({
          id: "from",
          namePrefix: "from",
          legend: "Planned from",
          legendSize: "s",
          values: o.from,
          error: o.errors.get("from-day"),
        })}
        ${dateInput({
          id: "to",
          namePrefix: "to",
          legend: "Planned up to",
          legendSize: "s",
          values: o.to,
          error: o.errors.get("to-day"),
        })}
        ${button({ text: "Filter history", kind: "secondary" })}
      </form>
      ${
        o.rows.length === 0
          ? html`<p class="govuk-body">
              No meals have been planned
              yet${
                o.name || o.from.day || o.to.day
                  ? " that match your filter"
                  : ""
              }.
            </p>`
          : html`${table({
              caption: `${plural(o.total, "meal")} planned`,
              captionClass: "govuk-table__caption--s",
              head: ["Date planned", "Meal"],
              rows: o.rows.map((r) => {
                const id = o.mealIds.get(r.mealName);
                return [
                  formatDate(r.planned),
                  id
                    ? html`<a class="govuk-link" href="/meals/${id}"
                        >${r.mealName}</a
                      >`
                    : html`${r.mealName} (deleted)`,
                ];
              }),
            })}
            ${pagination({ page: o.page, pages: o.pages, href: o.href })}`
      }`,
    o.errors.size > 0,
  );
}

export function runsPage(o: {
  chrome: Chrome;
  filter: RunFilter;
  rows: Run[];
  total: number;
  page: number;
  pages: number;
  href: (page: number) => string;
}): Html {
  const options = <T extends string>(
    values: readonly T[],
    labels: (v: T) => string,
    selected: T | undefined,
  ) => [
    { value: "", text: "Any", selected: !selected },
    ...values.map((v) => ({
      value: v,
      text: labels(v),
      selected: v === selected,
    })),
  ];

  return historyLayout(
    o.chrome,
    "runs",
    html`<form method="get" action="/history/runs" class="automat-filter">
        <div class="automat-filter__row">
          ${selectInput({
            id: "kind",
            name: "kind",
            label: "Kind",
            items: options(runKinds, kindLabel, o.filter.kind),
          })}
          ${selectInput({
            id: "trigger",
            name: "trigger",
            label: "Trigger",
            items: options(
              runTriggers,
              (t) => triggerLabels[t],
              o.filter.trigger,
            ),
          })}
          ${selectInput({
            id: "status",
            name: "status",
            label: "Status",
            items: options(
              runStatuses,
              (s) => statusLabels[s],
              o.filter.status,
            ),
          })}
        </div>
        ${button({ text: "Filter runs", kind: "secondary" })}
      </form>
      ${
        o.rows.length === 0
          ? html`<p class="govuk-body">No runs to show.</p>`
          : html`${table({
              caption: plural(o.total, "run"),
              captionClass: "govuk-table__caption--s",
              head: ["Started", "Kind", "Trigger", "Status", "Outcome"],
              rows: o.rows.map((run) => [
                html`<a class="govuk-link" href="/history/runs/${run.id}"
                  >${formatInstant(run.startedAt)}</a
                >`,
                kindLabel(run.kind),
                triggerLabels[run.trigger],
                statusTag(run.status),
                run.status === "running" ? "In progress" : runOutcome(run),
              ]),
            })}
            ${pagination({ page: o.page, pages: o.pages, href: o.href })}`
      }`,
  );
}

function duration(run: Run): string {
  if (!run.finishedAt) return "Still running";
  const seconds = Math.round(
    (Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000,
  );
  return seconds < 60
    ? plural(seconds, "second")
    : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/**
 * What a retry won't fix, for a run that failed part way through.
 */
function partialFailureWarning(run: Run): Html | null {
  if (run.status !== "failed") return null;
  const created = run.summary.createdTasks ?? [];
  if (!created.some((t) => t.project === "Cooking")) return null;
  if (run.kind === "plan") {
    return warningText(
      "The shopping for these meals was not added. Add it in Todoist.",
    );
  }
  if (run.kind === "push_meal") {
    return warningText(
      "Cooking tasks were already created. Fix this in Todoist rather than pushing the meal again.",
    );
  }
  return null;
}

export function runDetailPage(o: {
  chrome: Chrome;
  run: Run;
  meal: { id: number; name: string } | undefined;
}): Html {
  const { run } = o;
  const s = run.summary;
  const params = run.params ?? {};
  const rows: Array<{ key: string; value: Content | Html } | null> = [
    { key: "Kind", value: kindLabel(run.kind) },
    { key: "Trigger", value: triggerLabels[run.trigger] },
    { key: "Status", value: statusTag(run.status) },
    { key: "Started", value: formatInstant(run.startedAt) },
    run.finishedAt
      ? { key: "Finished", value: formatInstant(run.finishedAt) }
      : null,
    { key: "Duration", value: duration(run) },
  ];

  if (run.kind === "push_meal") {
    rows.push(
      {
        key: "Meal",
        value: o.meal
          ? html`<a class="govuk-link" href="/meals/${o.meal.id}"
              >${o.meal.name}</a
            >`
          : "(deleted)",
      },
      {
        key: "Start date",
        value: typeof params.date === "string" ? formatDate(params.date) : "–",
      },
      { key: "Freeze some portions", value: params.freeze ? "Yes" : "No" },
    );
  }
  if (s.mealsAdded) {
    rows.push({
      key: "Meals added",
      value: s.mealsAdded.length
        ? html`<ul class="govuk-list">
            ${s.mealsAdded.map(
              (m) =>
                html`<li>
                  <strong>${m.name}</strong><br />
                  ${m.dates.map(formatDate).join(", ")}
                </li>`,
            )}
          </ul>`
        : "None",
    });
  }
  if (s.groceryTasksAdded !== undefined) {
    rows.push({
      key: "Grocery tasks added",
      value: String(s.groceryTasksAdded),
    });
  }
  if (s.cookingClosed !== undefined) {
    rows.push(
      { key: "Past cooking tasks closed", value: String(s.cookingClosed) },
      { key: "Grocery tasks closed", value: String(s.groceriesClosed ?? 0) },
      { key: "Grocery tasks trimmed", value: String(s.groceriesTrimmed ?? 0) },
    );
  }
  if (s.recipes) {
    rows.push({
      key: "Recipe book",
      value: `${
        s.recipes.outcome === "updated"
          ? "Updated"
          : s.recipes.outcome === "not_modified"
            ? "No changes"
            : "Couldn’t refresh"
      }: ${plural(s.recipes.recipeCount, "recipe")}, ${plural(s.recipes.ingredientCount, "ingredient")}`,
    });
  }

  const created = s.createdTasks ?? [];
  return layout({
    title: `${kindLabel(run.kind)} run`,
    section: "history",
    chrome: o.chrome,
    beforeMain: html`<a href="/history/runs" class="govuk-back-link"
      >All runs</a
    >`,
    main: html`<span class="govuk-caption-l">Run ${run.id}</span>
      <h1 class="govuk-heading-l">${kindLabel(run.kind)} run</h1>
      ${run.status === "running" ? runStatus(run) : ""} ${summaryList(rows)}
      ${
        run.error
          ? details(
              "Show error",
              html`<pre class="automat-pre">${run.error}</pre>`,
              true,
            )
          : ""
      }
      ${
        run.log
          ? details("Show log", html`<pre class="automat-pre">${run.log}</pre>`)
          : ""
      }
      ${
        created.length
          ? html`<h2 class="govuk-heading-m">Tasks created in Todoist</h2>
              ${partialFailureWarning(run) ?? ""}
              ${table({
                caption: plural(created.length, "task"),
                captionClass: "govuk-visually-hidden",
                head: ["Project", "Task"],
                rows: created.map((t) => [
                  t.project,
                  html`<a class="govuk-link" href="${todoistTaskUrl(t.id)}"
                    >${plainContent(t.content)}</a
                  >`,
                ]),
              })}`
          : ""
      }`,
  });
}

export interface StatsRow {
  name: string;
  mealId: number | undefined;
  lastPlanned: string;
  timesPlanned: number;
  timesPlannedRecently: number;
  inWindow: boolean;
}

export type StatsSort = "name" | "last" | "times" | "recent";

export function statsPage(o: {
  chrome: Chrome;
  rows: StatsRow[];
  neverPlanned: Array<{ id: number; name: string; enabled: boolean }>;
  sort: StatsSort;
  dir: "asc" | "desc";
  windowDays: number;
}): Html {
  const header = (text: string, key: StatsSort, numeric = false): TableHead => {
    const active = o.sort === key;
    const nextDir = active && o.dir === "asc" ? "desc" : "asc";
    return {
      text,
      numeric,
      sort: {
        href: `/history/stats?sort=${key}&dir=${nextDir}`,
        direction: active
          ? o.dir === "asc"
            ? "ascending"
            : "descending"
          : undefined,
      },
    };
  };

  return historyLayout(
    o.chrome,
    "stats",
    html`${
        o.rows.length === 0
          ? html`<p class="govuk-body">No meals have been planned yet.</p>`
          : table({
              caption: "Planned meals",
              captionClass: "govuk-table__caption--m",
              head: [
                header("Meal", "name"),
                header("Last planned", "last"),
                header("Times planned", "times", true),
                header("Last 90 days", "recent", true),
                { text: `In the ${o.windowDays}-day window` },
              ],
              rows: o.rows.map((r) => [
                r.mealId
                  ? html`<a class="govuk-link" href="/meals/${r.mealId}"
                      >${r.name}</a
                    >`
                  : html`${r.name} (deleted)`,
                formatDate(r.lastPlanned),
                r.timesPlanned,
                r.timesPlannedRecently,
                r.inWindow ? tag("Recent", "blue") : "No",
              ]),
            })
      }
      <h2 class="govuk-heading-m">Never planned</h2>
      ${
        o.neverPlanned.length === 0
          ? html`<p class="govuk-body">
              Every meal has been planned at least once.
            </p>`
          : html`<ul class="govuk-list govuk-list--bullet">
              ${o.neverPlanned.map(
                (m) =>
                  html`<li>
                    <a class="govuk-link" href="/meals/${m.id}">${m.name}</a>
                    ${m.enabled ? "" : tag("Disabled", "grey")}
                  </li>`,
              )}
            </ul>`
      }`,
  );
}
