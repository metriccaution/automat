import { html } from "hono/html";
import { formatDate } from "../../../dates.ts";
import type { Meal } from "../../../db/meals.ts";
import {
  backLink,
  button,
  errorSummary,
  insetText,
  warningText,
  type FieldErrors,
  type Html,
} from "../components/core.ts";
import { checkboxes, dateInput, type DateParts } from "../components/forms.ts";
import { layout, type Chrome } from "../layout.ts";
import { plural } from "../format.ts";

export type PushDaysInfo =
  | { kind: "days"; days: string[] }
  | { kind: "invalid" }
  | { kind: "todoist_unavailable"; error: string; count: number };

export function pushDaysInset(meal: Meal, info: PushDaysInfo): Html {
  let content: Html;
  switch (info.kind) {
    case "days":
      content = html`<p class="govuk-body">
          ${meal.name} will go on ${plural(info.days.length, "day")}:
        </p>
        <ul class="govuk-list govuk-list--bullet">
          ${info.days.map((d) => html`<li>${formatDate(d)}</li>`)}
        </ul>
        <p class="govuk-body">
          The shopping is added for ${formatDate(info.days.at(-1)!)}.
        </p>`;
      break;
    case "invalid":
      content = html`<p class="govuk-body">
        Enter a start date to see which days the meal will go on.
      </p>`;
      break;
    case "todoist_unavailable":
      content = html`<p class="govuk-body">
        ${meal.name} will go on the next ${plural(info.count, "day")} with
        nothing planned, from the start date. Todoist couldn’t be checked just
        now (${info.error}), so the days will be worked out when you push it.
      </p>`;
      break;
  }
  return insetText(content, "push-days");
}

export function pushPage(o: {
  chrome: Chrome;
  meal: Meal;
  date: DateParts;
  freeze: boolean;
  canFreeze: boolean;
  dayCounts: { plain: number; frozen: number };
  info: PushDaysInfo;
  errors: FieldErrors;
  /**
   * A problem not tied to a field, e.g. another run in progress.
   */
  problem?: string;
}): Html {
  const { meal, errors } = o;
  const action = `/meals/${meal.id}/push`;
  return layout({
    title: `Push ${meal.name} to Todoist`,
    section: "meals",
    chrome: o.chrome,
    hasErrors: errors.size > 0,
    beforeMain: backLink(`/meals/${meal.id}`),
    main: html`<div class="govuk-grid-row">
      <div class="govuk-grid-column-two-thirds">
        ${errorSummary(errors)} ${o.problem ? warningText(o.problem) : ""}
        <span class="govuk-caption-l">${meal.name}</span>
        <h1 class="govuk-heading-l">Push to Todoist</h1>
        ${
          meal.enabled
            ? ""
            : html`<p class="govuk-body">
                This meal is disabled, so it isn’t planned automatically. You
                can still push it.
              </p>`
        }

        <form
          method="post"
          action="${action}"
          novalidate
          hx-get="${action}"
          hx-trigger="change, input changed delay:500ms"
          hx-select="#push-days"
          hx-target="#push-days"
          hx-swap="outerHTML"
          hx-push-url="false"
        >
          ${dateInput({
            id: "date",
            namePrefix: "date",
            legend: "Start date",
            legendSize: "m",
            hint: "The meal goes on the next days with nothing planned, from this date. For example, 5 11 2026",
            values: o.date,
            error: errors.get("date-day"),
          })}
          ${
            o.canFreeze
              ? checkboxes({
                  id: "freeze",
                  name: "freeze",
                  legend: "Freezing",
                  legendSize: "m",
                  items: [
                    {
                      value: "true",
                      text: "Plan to freeze some portions",
                      hint: `Covers ${plural(o.dayCounts.frozen, "day")} instead of ${o.dayCounts.plain}.`,
                      checked: o.freeze,
                    },
                  ],
                })
              : ""
          }
          ${pushDaysInset(meal, o.info)}
          <div class="govuk-button-group">
            ${button({ text: "Push to Todoist" })}
            <a class="govuk-link" href="/meals/${meal.id}">Cancel</a>
          </div>
        </form>
      </div>
    </div>`,
  });
}
