import { html } from "hono/html";
import { recipeUrl, type Recipe } from "../../../data/web.ts";
import { formatDate } from "../../../dates.ts";
import type { MealStats } from "../../../db/history.ts";
import type { Meal, MealFilter } from "../../../db/meals.ts";
import type { ShoppingItem } from "../../../recipes/shopping.ts";
import {
  backLink,
  button,
  buttonLink,
  pagination,
  summaryList,
  table,
  tag,
  warningText,
  type Html,
} from "../components/core.ts";
import { radios, textInput } from "../components/forms.ts";
import { markOnWhite } from "../components/logo.ts";
import { layout, type Chrome } from "../layout.ts";
import { plural } from "../format.ts";

export interface MealListRow {
  meal: Meal;
  stats: MealStats | undefined;
  /**
   * Recipe titles not in the recipe book (empty if it isn't loaded).
   */
  missing: string[];
}

export function emptyState(text: string): Html {
  return html`<div class="automat-empty">
    ${markOnWhite(64)}
    <p class="govuk-body-l">${text}</p>
  </div>`;
}

export function mealsListPage(o: {
  chrome: Chrome;
  rows: MealListRow[];
  filter: Required<MealFilter>;
  page: number;
  pages: number;
  totalMeals: number;
  href: (page: number) => string;
}): Html {
  const { filter } = o;
  const results =
    o.totalMeals === 0
      ? emptyState("The machine is empty. Add a meal to get started.")
      : o.rows.length === 0
        ? html`<p class="govuk-body">No meals match your search.</p>`
        : html`${table({
            caption: `${plural(o.rows.length, "meal")}`,
            captionClass: "govuk-visually-hidden",
            head: [
              "Name",
              { text: "Feeds", numeric: true },
              "Status",
              "Freezable",
              "Last planned",
              { text: "Times planned", numeric: true },
            ],
            rows: o.rows.map(({ meal, stats, missing }) => [
              html`<a class="govuk-link" href="/meals/${meal.id}"
                >${meal.name}</a
              >`,
              meal.feeds,
              html`${
                meal.enabled ? tag("Enabled", "green") : tag("Disabled", "grey")
              }
              ${missing.length ? tag("Recipe missing", "red") : ""}`,
              meal.freezable ? "Yes" : "No",
              stats ? formatDate(stats.lastPlanned) : "Never",
              stats?.timesPlanned ?? 0,
            ]),
          })}
          ${pagination({ page: o.page, pages: o.pages, href: o.href })}`;

  return layout({
    title: "Meals",
    section: "meals",
    chrome: o.chrome,
    main: html`<div class="automat-heading-row">
        <h1 class="govuk-heading-xl">Meals</h1>
        ${buttonLink("/meals/new", "Add a meal")}
      </div>

      <form
        method="get"
        action="/meals"
        class="automat-filter"
        role="search"
        hx-get="/meals"
        hx-trigger="input changed delay:300ms from:#q, change, submit"
        hx-target="#meals-results"
        hx-select="#meals-results"
        hx-swap="outerHTML"
        hx-push-url="true"
      >
        ${textInput({
          id: "q",
          name: "q",
          label: "Search meals",
          labelSize: "s",
          value: filter.search,
          type: "search",
          width: 20,
          spellcheck: false,
          autocomplete: "off",
        })}
        ${radios({
          id: "status",
          name: "status",
          legend: "Show",
          legendSize: "s",
          inline: true,
          small: true,
          items: [
            { value: "all", text: "All", checked: filter.status === "all" },
            {
              value: "enabled",
              text: "Enabled",
              checked: filter.status === "enabled",
            },
            {
              value: "disabled",
              text: "Disabled",
              checked: filter.status === "disabled",
            },
          ],
        })}
        ${button({ text: "Filter meals", kind: "secondary" })}
      </form>

      <div id="meals-results">${results}</div>`,
  });
}

export function mealViewPage(o: {
  chrome: Chrome;
  meal: Meal;
  stats: MealStats | undefined;
  recipes: Map<string, Recipe> | null;
  shopping: ShoppingItem[] | null;
}): Html {
  const { meal, recipes } = o;
  const missing = recipes ? meal.recipes.filter((t) => !recipes.has(t)) : [];
  const change = (hidden: string, anchor: string) => [
    { href: `/meals/${meal.id}/edit#${anchor}`, text: "Change", hidden },
  ];

  return layout({
    title: meal.name,
    section: "meals",
    chrome: o.chrome,
    beforeMain: backLink("/meals", "All meals"),
    main: html`<h1 class="govuk-heading-xl">${meal.name}</h1>
      ${
        missing.length
          ? warningText(
              html`${
                missing.length === 1
                  ? html`The recipe “${missing[0]}” isn’t`
                  : html`The recipes ${missing.map((t) => `“${t}”`).join(", ")}
                    aren’t`
              }
              in the recipe book. This meal is skipped when planning until you
              change it.`,
            )
          : ""
      }

      <div class="govuk-button-group">
        ${buttonLink(`/meals/${meal.id}/push`, "Push to Todoist")}
        ${buttonLink(`/meals/${meal.id}/edit`, "Edit meal", "secondary")}
      </div>

      ${summaryList([
        { key: "Name", value: meal.name, actions: change("name", "name") },
        {
          key: "Feeds",
          value: plural(meal.feeds, "day"),
          actions: change("how many days it feeds", "feeds"),
        },
        {
          key: "Planning",
          value: meal.enabled
            ? "Included in random planning"
            : html`${tag("Disabled", "grey")} Not planned automatically, but can
              still be pushed`,
          actions: change("whether it’s planned", "options"),
        },
        {
          key: "Freezing",
          value: meal.freezable
            ? meal.feeds >= 3
              ? "Plan to freeze some portions"
              : "Can be frozen (it doesn’t make enough to freeze any)"
            : "Never frozen",
          actions: change("freezing", "options"),
        },
        {
          key: "Recipes",
          value: html`<ul class="govuk-list">
            ${meal.recipes.map((title) => {
              const recipe = recipes?.get(title);
              return html`<li>
                ${
                  recipe
                    ? html`<a
                        class="govuk-link"
                        href="${recipeUrl(recipe.slug)}"
                        >${title}</a
                      >`
                    : html`${title}
                      ${recipes ? tag("Recipe missing", "red") : ""}`
                }
              </li>`;
            })}
          </ul>`,
          actions: change("recipes", "recipes"),
        },
        {
          key: "Other ingredients",
          value: meal.otherIngredients.length
            ? html`<ul class="govuk-list">
                ${meal.otherIngredients.map(
                  (o) => html`<li>${o.quantity} ${o.ingredient}</li>`,
                )}
              </ul>`
            : "None",
          actions: change("other ingredients", "other-ingredients"),
        },
        {
          key: "Last planned",
          value: o.stats ? formatDate(o.stats.lastPlanned) : "Never",
        },
        {
          key: "Times planned",
          value: String(o.stats?.timesPlanned ?? 0),
        },
      ])}

      <h2 class="govuk-heading-m">Shopping list</h2>
      ${shoppingPreview(o.shopping)}

      <p class="govuk-body">
        <a class="govuk-link" href="/meals/${meal.id}/delete"
          >Delete meal<span class="govuk-visually-hidden">
            ${meal.name}</span
          ></a
        >
      </p>`,
  });
}

function shoppingPreview(items: ShoppingItem[] | null): Html {
  if (items === null) {
    return warningText(
      "The recipe book isn’t loaded yet, so the shopping list can’t be worked out.",
    );
  }
  if (items.length === 0) {
    return html`<p class="govuk-body">Nothing to buy for this meal.</p>`;
  }
  return html`<p class="govuk-body">
      This is what pushing or planning the meal adds to Groceries.
    </p>
    ${table({
      caption: "Shopping list",
      captionClass: "govuk-visually-hidden",
      head: ["Ingredient", "Quantity", "From"],
      rows: items.map((item) => [
        html`${item.ingredient}
        ${
          item.unknown.length
            ? html`<br />${tag("Not in ingredient database", "yellow")}`
            : ""
        }`,
        item.quantity,
        item.source,
      ]),
    })}`;
}

export function deleteMealPage(o: { chrome: Chrome; meal: Meal }): Html {
  const { meal } = o;
  return layout({
    title: `Delete ${meal.name}`,
    section: "meals",
    chrome: o.chrome,
    beforeMain: backLink(`/meals/${meal.id}`),
    main: html`<div class="govuk-grid-row">
      <div class="govuk-grid-column-two-thirds">
        <h1 class="govuk-heading-l">
          Are you sure you want to delete ${meal.name}?
        </h1>
        <p class="govuk-body">
          You can’t undo this. Its planning history is kept.
        </p>
        ${
          meal.enabled
            ? html`<p class="govuk-body">
                  If you might want it again, disable it instead. It then won’t
                  be planned automatically, but you can still push it to
                  Todoist.
                </p>
                <form method="post" action="/meals/${meal.id}/disable">
                  ${button({ text: "Disable meal instead", kind: "secondary" })}
                </form>`
            : ""
        }
        <form method="post" action="/meals/${meal.id}/delete">
          <div class="govuk-button-group">
            ${button({ text: "Delete meal", kind: "warning" })}
            <a class="govuk-link" href="/meals/${meal.id}">Cancel</a>
          </div>
        </form>
      </div>
    </div>`,
  });
}
