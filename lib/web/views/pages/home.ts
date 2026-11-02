import { html } from "hono/html";
import { formatDate, formatInstant } from "../../../dates.ts";
import type { Run } from "../../../db/runs.ts";
import type { Settings } from "../../../db/settings.ts";
import type { UpcomingCooking } from "../../../todos/index.ts";
import {
  button,
  summaryList,
  table,
  warningText,
  type Html,
} from "../components/core.ts";
import { layout, type Chrome } from "../layout.ts";
import {
  kindLabel,
  plainContent,
  runStatus,
  statusTag,
  triggerLabels,
} from "../format.ts";

export function recipeCacheRows(book: {
  data: unknown;
  fetchedAt: string | null;
  checkedAt: string | null;
}) {
  return [
    {
      key: "Recipes last updated",
      value: book.fetchedAt ? formatInstant(book.fetchedAt) : "Not loaded yet",
    },
    {
      key: "Last checked",
      value: book.checkedAt ? formatInstant(book.checkedAt) : "Never",
    },
  ];
}

function actionForm(
  action: string,
  text: string,
  kind: "primary" | "secondary",
): Html {
  return html`<form
    method="post"
    action="${action}"
    hx-post="${action}"
    hx-target="#action-result"
    hx-swap="innerHTML"
    class="automat-action"
  >
    ${button({ text, kind })}
  </form>`;
}

export function homePage(o: {
  chrome: Chrome;
  settings: Settings;
  nextRun: Date | null;
  lastRun: Run | undefined;
  current: Run | null;
  recipeBook: {
    data: unknown;
    fetchedAt: string | null;
    checkedAt: string | null;
  };
}): Html {
  const { settings, lastRun } = o;
  return layout({
    title: "Home",
    section: "home",
    chrome: o.chrome,
    main: html`<h1 class="govuk-heading-xl">Meal planning</h1>

      <h2 class="govuk-heading-m">Scheduler</h2>
      ${summaryList([
        {
          key: "Status",
          value: settings.schedulerEnabled
            ? html`On, daily at ${settings.scheduleTime}`
            : "Paused",
        },
        {
          key: "Next scheduled run",
          value: o.nextRun ? formatInstant(o.nextRun) : "None while paused",
        },
        {
          key: "Last run",
          value: lastRun
            ? html`<a class="govuk-link" href="/history/runs/${lastRun.id}"
                  >${kindLabel(lastRun.kind)}
                  (${triggerLabels[lastRun.trigger].toLowerCase()})</a
                >
                ${statusTag(lastRun.status)}
                <br />${formatInstant(lastRun.startedAt)}`
            : "No runs yet",
        },
        ...recipeCacheRows(o.recipeBook),
      ])}

      <h2 class="govuk-heading-m">Actions</h2>
      <div class="govuk-button-group automat-actions">
        ${actionForm("/actions/plan", "Run planning now", "primary")}
        ${actionForm("/actions/cleanup", "Cleanup only", "secondary")}
        ${actionForm(
          "/actions/refresh-recipes",
          "Refresh recipe cache",
          "secondary",
        )}
        <form method="post" action="/actions/scheduler" class="automat-action">
          <input
            type="hidden"
            name="enabled"
            value="${settings.schedulerEnabled ? "false" : "true"}"
          />
          ${button({
            text: settings.schedulerEnabled
              ? "Pause scheduler"
              : "Resume scheduler",
            kind: "secondary",
          })}
        </form>
      </div>
      <div id="action-result">${o.current ? runStatus(o.current) : ""}</div>

      <h2 class="govuk-heading-m">Upcoming</h2>
      <div
        id="upcoming"
        hx-get="/upcoming"
        hx-trigger="load"
        hx-swap="outerHTML"
      >
        <p class="govuk-body">
          <a class="govuk-link" href="/upcoming"
            >See what’s planned in Todoist</a
          >
        </p>
      </div>`,
  });
}

export function upcomingTable(
  upcoming: UpcomingCooking[] | { error: string },
): Html {
  if ("error" in upcoming) {
    return html`<div id="upcoming">
      ${warningText(`Couldn’t load the Cooking project from Todoist: ${upcoming.error}`)}
    </div>`;
  }
  if (upcoming.length === 0) {
    return html`<div id="upcoming">
      <p class="govuk-body">Nothing is planned from today onwards.</p>
    </div>`;
  }
  return html`<div id="upcoming">
    ${table({
      caption: "Cooking from today onwards",
      captionClass: "govuk-visually-hidden",
      head: ["Day", "Meal"],
      rows: upcoming.map((u) => [
        { content: formatDate(u.date), header: true },
        plainContent(u.content),
      ]),
    })}
  </div>`;
}

export function upcomingPage(chrome: Chrome, content: Html): Html {
  return layout({
    title: "Upcoming",
    section: "home",
    chrome,
    main: html`<h1 class="govuk-heading-l">Upcoming</h1>
      ${content}
      <p class="govuk-body">
        <a class="govuk-link" href="/">Back to home</a>
      </p>`,
  });
}
