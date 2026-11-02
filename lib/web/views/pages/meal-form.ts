import { html } from "hono/html";
import {
  backLink,
  button,
  errorSummary,
  warningText,
  type FieldErrors,
  type Html,
} from "../components/core.ts";
import { checkboxes, textInput } from "../components/forms.ts";
import { layout, type Chrome } from "../layout.ts";

/**
 * The meal form as submitted: strings, possibly invalid.
 */
export interface MealFormValues {
  name: string;
  feeds: string;
  enabled: boolean;
  freezable: boolean;
  recipes: string[];
  others: Array<{ ingredient: string; quantity: string }>;
}

function rowButton(
  o: {
    action: string;
    name: string;
    value: string;
    text: string;
    hidden: string;
  },
  kind: "secondary" | "warning" = "secondary",
) {
  return html`<button
    type="submit"
    class="govuk-button govuk-button--${kind} automat-row__button"
    name="${o.name}"
    value="${o.value}"
    hx-post="${o.action}"
    hx-target="#meal-form"
    hx-select="#meal-form"
    hx-swap="outerHTML"
  >
    ${o.text}<span class="govuk-visually-hidden"> ${o.hidden}</span>
  </button>`;
}

function recipeRows(
  action: string,
  values: MealFormValues,
  recipeTitles: string[] | null,
  errors: FieldErrors,
): Html {
  if (recipeTitles === null) {
    return html`${warningText(
      "The recipe book isn’t loaded yet, so recipes can’t be chosen. Refresh the recipe cache, then come back to this page.",
    )}
    ${
      values.recipes.length
        ? html`<p class="govuk-body">
              This meal’s recipes are kept as they are:
            </p>
            <ul class="govuk-list govuk-list--bullet">
              ${values.recipes.map(
                (title) =>
                  html`<li>
                    ${title}<input
                      type="hidden"
                      name="recipes"
                      value="${title}"
                    />
                  </li>`,
              )}
            </ul>`
        : ""
    }
    ${button({
      text: "Refresh recipe cache",
      kind: "secondary",
      formaction: "/actions/refresh-recipes",
    })}`;
  }

  const known = new Set(recipeTitles);
  const rows = values.recipes.length ? values.recipes : [""];
  return html`${rows.map((title, i) => {
    const id = `recipe-${i}`;
    const error = errors.get(id);
    const missing = title !== "" && !known.has(title);
    return html`<div class="automat-row">
      <div class="govuk-form-group${error ? " govuk-form-group--error" : ""}">
        <label class="govuk-label" for="${id}">Recipe ${i + 1}</label>
        ${
          missing
            ? warningText(
                `“${title}” isn’t in the recipe book. Choose another recipe, or remove it.`,
              )
            : ""
        }
        ${
          error
            ? html`<p id="${id}-error" class="govuk-error-message">
                <span class="govuk-visually-hidden">Error:</span> ${error}
              </p>`
            : ""
        }
        <select
          class="govuk-select${error ? " govuk-select--error" : ""}"
          id="${id}"
          name="recipes"
          data-recipe-picker
          ${error ? html`aria-describedby="${id}-error"` : ""}
        >
          <option value="">Choose a recipe</option>
          ${
            missing
              ? html`<option value="${title}" selected>${title}</option>`
              : ""
          }
          ${recipeTitles.map(
            (t) =>
              html`<option value="${t}" ${t === title ? "selected" : ""}>
                ${t}
              </option>`,
          )}
        </select>
      </div>
      <div class="govuk-button-group automat-row__actions">
        ${
          i > 0
            ? rowButton({
                action,
                name: "action",
                value: `up-recipe-${i}`,
                text: "Move up",
                hidden: `recipe ${i + 1}`,
              })
            : ""
        }
        ${
          i < rows.length - 1
            ? rowButton({
                action,
                name: "action",
                value: `down-recipe-${i}`,
                text: "Move down",
                hidden: `recipe ${i + 1}`,
              })
            : ""
        }
        ${
          rows.length > 1
            ? rowButton({
                action,
                name: "action",
                value: `remove-recipe-${i}`,
                text: "Remove",
                hidden: `recipe ${i + 1}`,
              })
            : ""
        }
      </div>
    </div>`;
  })}
  ${rowButton({
    action,
    name: "action",
    value: "add-recipe",
    text: "Add another recipe",
    hidden: "",
  })}`;
}

function otherRows(
  action: string,
  values: MealFormValues,
  errors: FieldErrors,
): Html {
  return html`${values.others.map(
    (row, i) =>
      html`<div class="automat-row automat-row--pair">
        ${textInput({
          id: `ingredient-${i}`,
          name: "ingredient",
          label: `Ingredient ${i + 1}`,
          value: row.ingredient,
          error: errors.get(`ingredient-${i}`),
          width: 20,
        })}
        ${textInput({
          id: `quantity-${i}`,
          name: "quantity",
          label: `Quantity ${i + 1}`,
          hint: i === 0 ? "For example, 2 or 100g" : undefined,
          value: row.quantity,
          error: errors.get(`quantity-${i}`),
          width: 10,
        })}
        <div class="govuk-button-group automat-row__actions">
          ${rowButton({
            action,
            name: "action",
            value: `remove-ingredient-${i}`,
            text: "Remove",
            hidden: `ingredient ${i + 1}`,
          })}
        </div>
      </div>`,
  )}
  ${rowButton({
    action,
    name: "action",
    value: "add-ingredient",
    text: values.others.length ? "Add another ingredient" : "Add an ingredient",
    hidden: "",
  })}`;
}

export function mealFormPage(o: {
  chrome: Chrome;
  /**
   * Undefined for a new meal.
   */
  mealId?: number;
  originalName?: string;
  values: MealFormValues;
  errors: FieldErrors;
  recipeTitles: string[] | null;
}): Html {
  const { values, errors, mealId } = o;
  const action = mealId ? `/meals/${mealId}/edit` : "/meals/new";
  const title = mealId ? `Edit ${o.originalName}` : "Add a meal";

  return layout({
    title,
    section: "meals",
    chrome: o.chrome,
    hasErrors: errors.size > 0,
    beforeMain: backLink(mealId ? `/meals/${mealId}` : "/meals"),
    main: html`<div class="govuk-grid-row">
      <div class="govuk-grid-column-two-thirds">
        ${errorSummary(errors)}
        <h1 class="govuk-heading-l">${title}</h1>

        <form method="post" action="${action}" id="meal-form" novalidate>
          <!-- Enter in a text field saves, rather than pressing the first row button -->
          <button
            type="submit"
            name="action"
            value="save"
            class="govuk-visually-hidden"
            tabindex="-1"
            aria-hidden="true"
          >
            Save meal
          </button>

          ${textInput({
            id: "name",
            name: "name",
            label: "Name",
            labelSize: "s",
            value: values.name,
            error: errors.get("name"),
            spellcheck: false,
          })}
          ${textInput({
            id: "feeds",
            name: "feeds",
            label: "How many days does it feed?",
            labelSize: "s",
            value: values.feeds,
            error: errors.get("feeds"),
            width: 2,
            inputmode: "numeric",
          })}
          ${checkboxes({
            id: "options",
            name: "options",
            legend: "Options",
            legendSize: "s",
            items: [
              {
                value: "enabled",
                text: "Include in random planning",
                hint: "Turn this off to stop the meal being planned. You can still push it to Todoist.",
                checked: values.enabled,
              },
              {
                value: "freezable",
                text: "Can be frozen",
                hint: "When planning, a meal for 3 or more days covers fewer days and some portions are frozen.",
                checked: values.freezable,
              },
            ],
          })}

          <fieldset class="govuk-fieldset" id="recipes">
            <legend class="govuk-fieldset__legend govuk-fieldset__legend--m">
              Recipes
            </legend>
            ${recipeRows(action, values, o.recipeTitles, errors)}
          </fieldset>

          <fieldset class="govuk-fieldset" id="other-ingredients">
            <legend class="govuk-fieldset__legend govuk-fieldset__legend--m">
              Other ingredients
            </legend>
            <div class="govuk-hint">
              Things to buy that aren’t in a recipe, like bread to serve with
              it.
            </div>
            ${otherRows(action, values, errors)}
          </fieldset>

          <div class="govuk-button-group">
            ${button({ text: "Save meal", name: "action", value: "save" })}
            <a
              class="govuk-link"
              href="${mealId ? `/meals/${mealId}` : "/meals"}"
              >Cancel</a
            >
          </div>
        </form>
      </div>
    </div>`,
  });
}
