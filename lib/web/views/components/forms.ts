import { html } from "hono/html";
import type { Content, Html } from "./core.ts";

function errorMessage(id: string, error?: string): Html {
  return error
    ? html`<p id="${id}-error" class="govuk-error-message">
        <span class="govuk-visually-hidden">Error:</span> ${error}
      </p>`
    : html``;
}

function hint(id: string, text?: Content): Html {
  return text
    ? html`<div id="${id}-hint" class="govuk-hint">${text}</div>`
    : html``;
}

function describedBy(id: string, hasHint: boolean, error?: string): Html {
  const ids = [hasHint && `${id}-hint`, error && `${id}-error`].filter(Boolean);
  return ids.length ? html`aria-describedby="${ids.join(" ")}"` : html``;
}

export interface TextInputOptions {
  id: string;
  name: string;
  label: Content;
  /**
   * Make the label the page heading, at this size.
   */
  labelSize?: "s" | "m" | "l";
  labelHidden?: boolean;
  hint?: Content;
  value?: string;
  error?: string;
  width?: 2 | 3 | 4 | 5 | 10 | 20 | 30 | "full";
  inputmode?: "numeric" | "text" | "search";
  type?: "text" | "search";
  spellcheck?: boolean;
  autocomplete?: string;
  /**
   * Extra attributes, e.g. htmx ones.
   */
  attrs?: Html;
}

export function textInput(o: TextInputOptions): Html {
  const width =
    o.width === "full"
      ? " govuk-!-width-full"
      : o.width
        ? ` govuk-input--width-${o.width}`
        : "";
  return html`<div
    class="govuk-form-group${o.error ? " govuk-form-group--error" : ""}"
  >
    <label
      class="govuk-label${o.labelSize ? ` govuk-label--${o.labelSize}` : ""}${
        o.labelHidden ? " govuk-visually-hidden" : ""
      }"
      for="${o.id}"
    >
      ${o.label}
    </label>
    ${hint(o.id, o.hint)} ${errorMessage(o.id, o.error)}
    <input
      class="govuk-input${width}${o.error ? " govuk-input--error" : ""}"
      id="${o.id}"
      name="${o.name}"
      type="${o.type ?? "text"}"
      value="${o.value ?? ""}"
      ${o.inputmode ? html`inputmode="${o.inputmode}"` : ""}
      ${o.spellcheck === false ? html`spellcheck="false"` : ""}
      ${o.autocomplete ? html`autocomplete="${o.autocomplete}"` : ""}
      ${describedBy(o.id, Boolean(o.hint), o.error)}
      ${o.attrs ?? ""}
    />
  </div>`;
}

export interface ChoiceItem {
  value: string;
  text: Content;
  hint?: Content;
  checked?: boolean;
}

function fieldset(
  o: {
    id: string;
    legend: Content;
    legendSize?: "s" | "m" | "l";
    legendHidden?: boolean;
    hint?: Content;
    error?: string;
  },
  body: Html,
): Html {
  return html`<div
    class="govuk-form-group${o.error ? " govuk-form-group--error" : ""}"
  >
    <fieldset
      class="govuk-fieldset"
      ${describedBy(o.id, Boolean(o.hint), o.error)}
    >
      <legend
        class="govuk-fieldset__legend${
          o.legendSize ? ` govuk-fieldset__legend--${o.legendSize}` : ""
        }${o.legendHidden ? " govuk-visually-hidden" : ""}"
      >
        ${o.legend}
      </legend>
      ${hint(o.id, o.hint)} ${errorMessage(o.id, o.error)} ${body}
    </fieldset>
  </div>`;
}

export function checkboxes(o: {
  id: string;
  name: string;
  legend: Content;
  legendSize?: "s" | "m" | "l";
  legendHidden?: boolean;
  hint?: Content;
  error?: string;
  items: ChoiceItem[];
  small?: boolean;
}): Html {
  return fieldset(
    o,
    html`<div
      class="govuk-checkboxes${o.small ? " govuk-checkboxes--small" : ""}"
      data-module="govuk-checkboxes"
    >
      ${o.items.map((item, i) => {
        const id = i === 0 ? o.id : `${o.id}-${i + 1}`;
        return html`<div class="govuk-checkboxes__item">
          <input
            class="govuk-checkboxes__input"
            id="${id}"
            name="${o.name}"
            type="checkbox"
            value="${item.value}"
            ${item.checked ? "checked" : ""}
            ${item.hint ? html`aria-describedby="${id}-item-hint"` : ""}
          />
          <label class="govuk-label govuk-checkboxes__label" for="${id}">
            ${item.text}
          </label>
          ${
            item.hint
              ? html`<div
                  id="${id}-item-hint"
                  class="govuk-hint govuk-checkboxes__hint"
                >
                  ${item.hint}
                </div>`
              : ""
          }
        </div>`;
      })}
    </div>`,
  );
}

export function radios(o: {
  id: string;
  name: string;
  legend: Content;
  legendSize?: "s" | "m" | "l";
  legendHidden?: boolean;
  hint?: Content;
  error?: string;
  items: ChoiceItem[];
  inline?: boolean;
  small?: boolean;
}): Html {
  return fieldset(
    o,
    html`<div
      class="govuk-radios${o.inline ? " govuk-radios--inline" : ""}${
        o.small ? " govuk-radios--small" : ""
      }"
      data-module="govuk-radios"
    >
      ${o.items.map((item, i) => {
        const id = i === 0 ? o.id : `${o.id}-${i + 1}`;
        return html`<div class="govuk-radios__item">
          <input
            class="govuk-radios__input"
            id="${id}"
            name="${o.name}"
            type="radio"
            value="${item.value}"
            ${item.checked ? "checked" : ""}
          />
          <label class="govuk-label govuk-radios__label" for="${id}">
            ${item.text}
          </label>
        </div>`;
      })}
    </div>`,
  );
}

export function selectInput(o: {
  id: string;
  name: string;
  label: Content;
  error?: string;
  items: Array<{ value: string; text: string; selected?: boolean }>;
}): Html {
  return html`<div
    class="govuk-form-group${o.error ? " govuk-form-group--error" : ""}"
  >
    <label class="govuk-label" for="${o.id}">${o.label}</label>
    ${errorMessage(o.id, o.error)}
    <select
      class="govuk-select${o.error ? " govuk-select--error" : ""}"
      id="${o.id}"
      name="${o.name}"
      ${describedBy(o.id, false, o.error)}
    >
      ${o.items.map(
        (item) =>
          html`<option value="${item.value}" ${item.selected ? "selected" : ""}>
            ${item.text}
          </option>`,
      )}
    </select>
  </div>`;
}

export interface DateParts {
  day: string;
  month: string;
  year: string;
}

export function dateInput(o: {
  id: string;
  namePrefix: string;
  legend: Content;
  legendSize?: "s" | "m" | "l";
  hint?: Content;
  error?: string;
  values: DateParts;
}): Html {
  const part = (key: keyof DateParts, label: string, width: 2 | 4) =>
    html`<div class="govuk-date-input__item">
      <div class="govuk-form-group">
        <label class="govuk-label govuk-date-input__label" for="${o.id}-${key}">
          ${label}
        </label>
        <input
          class="govuk-input govuk-date-input__input govuk-input--width-${width}${
            o.error ? " govuk-input--error" : ""
          }"
          id="${o.id}-${key}"
          name="${o.namePrefix}-${key}"
          type="text"
          inputmode="numeric"
          value="${o.values[key]}"
        />
      </div>
    </div>`;

  return html`<div
    class="govuk-form-group${o.error ? " govuk-form-group--error" : ""}"
  >
    <fieldset
      class="govuk-fieldset"
      role="group"
      ${describedBy(o.id, Boolean(o.hint), o.error)}
    >
      <legend
        class="govuk-fieldset__legend${
          o.legendSize ? ` govuk-fieldset__legend--${o.legendSize}` : ""
        }"
      >
        ${o.legend}
      </legend>
      ${hint(o.id, o.hint)} ${errorMessage(o.id, o.error)}
      <div class="govuk-date-input" id="${o.id}">
        ${part("day", "Day", 2)} ${part("month", "Month", 2)}
        ${part("year", "Year", 4)}
      </div>
    </fieldset>
  </div>`;
}
