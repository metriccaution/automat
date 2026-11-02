import { html } from "hono/html";
import {
  button,
  errorSummary,
  summaryList,
  type FieldErrors,
  type Html,
} from "../components/core.ts";
import { checkboxes, textInput } from "../components/forms.ts";
import { layout, type Chrome } from "../layout.ts";
import { recipeCacheRows } from "./home.ts";

export interface SettingsFormValues {
  schedulerEnabled: boolean;
  scheduleTime: string;
  daysToPlan: string;
  planToFreeze: boolean;
  historyWindowDays: string;
}

export function settingsPage(o: {
  chrome: Chrome;
  values: SettingsFormValues;
  errors: FieldErrors;
  environment: {
    dbPath: string;
    recipesUrl: string;
    timeZone: string;
    allowedHosts: string[];
    tokenSet: boolean;
  };
  recipeBook: {
    data: { recipes: unknown[]; ingredients: unknown[] } | null;
    fetchedAt: string | null;
    checkedAt: string | null;
  };
}): Html {
  const { values, errors, environment: env, recipeBook } = o;
  return layout({
    title: "Settings",
    section: "settings",
    chrome: o.chrome,
    hasErrors: errors.size > 0,
    main: html`<div class="govuk-grid-row">
      <div class="govuk-grid-column-two-thirds">
        ${errorSummary(errors)}
        <h1 class="govuk-heading-xl">Settings</h1>

        <form method="post" action="/settings" novalidate>
          ${checkboxes({
            id: "schedulerEnabled",
            name: "schedulerEnabled",
            legend: "Scheduler",
            legendSize: "m",
            items: [
              {
                value: "true",
                text: "Plan meals automatically every day",
                hint: "Turn this off while you’re on holiday. You can still run actions by hand.",
                checked: values.schedulerEnabled,
              },
            ],
          })}
          ${textInput({
            id: "scheduleTime",
            name: "scheduleTime",
            label: "Time to plan meals",
            labelSize: "s",
            hint: html`Use the 24-hour clock, in ${env.timeZone} time. For
            example, 03:00`,
            value: values.scheduleTime,
            error: errors.get("scheduleTime"),
            width: 5,
          })}
          ${textInput({
            id: "daysToPlan",
            name: "daysToPlan",
            label: "Days to plan",
            labelSize: "s",
            hint: "How many days ahead to keep planned, from 1 to 28",
            value: values.daysToPlan,
            error: errors.get("daysToPlan"),
            width: 2,
            inputmode: "numeric",
          })}
          ${checkboxes({
            id: "planToFreeze",
            name: "planToFreeze",
            legend: "Freezing",
            legendSize: "s",
            items: [
              {
                value: "true",
                text: "Plan to freeze some portions",
                hint: "Meals that can be frozen and make 3 or more days cover fewer days, and the rest is frozen.",
                checked: values.planToFreeze,
              },
            ],
          })}
          ${textInput({
            id: "historyWindowDays",
            name: "historyWindowDays",
            label: "Avoid meals planned in the last",
            labelSize: "s",
            hint: "Number of days, from 0 to 365. Recently planned meals are only used if there aren’t enough others",
            value: values.historyWindowDays,
            error: errors.get("historyWindowDays"),
            width: 3,
            inputmode: "numeric",
          })}
          ${button({ text: "Save settings" })}
        </form>

        <h2 class="govuk-heading-m">Recipe cache</h2>
        ${summaryList([
          ...recipeCacheRows(recipeBook),
          {
            key: "Recipes",
            value: String(recipeBook.data?.recipes.length ?? 0),
          },
          {
            key: "Ingredients",
            value: String(recipeBook.data?.ingredients.length ?? 0),
          },
        ])}
        <form method="post" action="/actions/refresh-recipes">
          ${button({ text: "Refresh recipe cache", kind: "secondary" })}
        </form>

        <h2 class="govuk-heading-m">Environment</h2>
        <p class="govuk-body">
          These are set with environment variables when Automat starts.
        </p>
        ${summaryList([
          { key: "Database", value: html`<code>${env.dbPath}</code>` },
          { key: "Recipe book", value: html`<code>${env.recipesUrl}</code>` },
          { key: "Timezone", value: env.timeZone },
          { key: "Allowed hosts", value: env.allowedHosts.join(", ") },
          { key: "Todoist token", value: env.tokenSet ? "Set" : "Not set" },
        ])}
      </div>
    </div>`,
  });
}
