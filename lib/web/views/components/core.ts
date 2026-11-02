/**
 * Typed wrappers around GOV.UK Frontend component markup.
 */
import { html } from "hono/html";

export type Html = ReturnType<typeof html>;
export type Content = Html | string | number;

/**
 * Field ID -> error message, in the order they should be listed.
 */
export type FieldErrors = Map<string, string>;

export type TagColour =
  | "grey"
  | "green"
  | "turquoise"
  | "blue"
  | "light-blue"
  | "purple"
  | "pink"
  | "red"
  | "orange"
  | "yellow";

export function tag(text: string, colour?: TagColour): Html {
  return html`<strong class="govuk-tag${colour ? ` govuk-tag--${colour}` : ""}"
    >${text}</strong
  >`;
}

export interface SummaryRow {
  key: Content;
  value: Content | Content[];
  actions?: Array<{ href: string; text: string; hidden: string }>;
}

export function summaryList(
  rows: Array<SummaryRow | null | false>,
  options: { noBorder?: boolean } = {},
): Html {
  const shown = rows.filter((r): r is SummaryRow => Boolean(r));
  const anyActions = shown.some((r) => r.actions?.length);
  return html`<dl
    class="govuk-summary-list${
      options.noBorder ? " govuk-summary-list--no-border" : ""
    }"
  >
    ${shown.map(
      (row) =>
        html`<div
          class="govuk-summary-list__row${
            anyActions && !row.actions?.length
              ? " govuk-summary-list__row--no-actions"
              : ""
          }"
        >
          <dt class="govuk-summary-list__key">${row.key}</dt>
          <dd class="govuk-summary-list__value">${row.value}</dd>
          ${
            row.actions?.length
              ? html`<dd class="govuk-summary-list__actions">
                  ${row.actions.map(
                    (a) =>
                      html`<a class="govuk-link" href="${a.href}"
                        >${a.text}<span class="govuk-visually-hidden">
                          ${a.hidden}</span
                        ></a
                      >`,
                  )}
                </dd>`
              : ""
          }
        </div>`,
    )}
  </dl>`;
}

export function notificationBanner(options: {
  type?: "important" | "success";
  content: Content;
  id?: string;
}): Html {
  const success = options.type === "success";
  const id = options.id ?? "govuk-notification-banner-title";
  return html`<div
    class="govuk-notification-banner${
      success ? " govuk-notification-banner--success" : ""
    }"
    role="${success ? "alert" : "region"}"
    aria-labelledby="${id}"
    data-module="govuk-notification-banner"
  >
    <div class="govuk-notification-banner__header">
      <h2 class="govuk-notification-banner__title" id="${id}">
        ${success ? "Success" : "Important"}
      </h2>
    </div>
    <div class="govuk-notification-banner__content">${options.content}</div>
  </div>`;
}

export function warningText(content: Content): Html {
  return html`<div class="govuk-warning-text">
    <span class="govuk-warning-text__icon" aria-hidden="true">!</span>
    <strong class="govuk-warning-text__text">
      <span class="govuk-visually-hidden">Warning</span>
      ${content}
    </strong>
  </div>`;
}

export function insetText(content: Content, id?: string): Html {
  return html`<div class="govuk-inset-text" ${id ? html`id="${id}"` : ""}>
    ${content}
  </div>`;
}

export function details(summary: string, content: Content, open = false) {
  return html`<details class="govuk-details" ${open ? "open" : ""}>
    <summary class="govuk-details__summary">
      <span class="govuk-details__summary-text">${summary}</span>
    </summary>
    <div class="govuk-details__text">${content}</div>
  </details>`;
}

export interface ButtonOptions {
  text: string;
  kind?: "primary" | "secondary" | "warning";
  name?: string;
  value?: string;
  formaction?: string;
  /**
   * Extra attributes, e.g. htmx ones.
   */
  attrs?: Html;
  classes?: string;
}

export function button(options: ButtonOptions): Html {
  const kind = options.kind ?? "primary";
  return html`<button
    type="submit"
    class="govuk-button${
      kind !== "primary" ? ` govuk-button--${kind}` : ""
    }${options.classes ? ` ${options.classes}` : ""}"
    data-module="govuk-button"
    data-prevent-double-click="true"
    ${options.name ? html`name="${options.name}"` : ""}
    ${options.value !== undefined ? html`value="${options.value}"` : ""}
    ${options.formaction ? html`formaction="${options.formaction}"` : ""}
    ${options.attrs ?? ""}
  >
    ${options.text}
  </button>`;
}

export function buttonLink(
  href: string,
  text: string,
  kind: "primary" | "secondary" = "primary",
): Html {
  return html`<a
    href="${href}"
    role="button"
    draggable="false"
    class="govuk-button${kind === "secondary" ? " govuk-button--secondary" : ""}"
    data-module="govuk-button"
    >${text}</a
  >`;
}

export function backLink(href: string, text = "Back"): Html {
  return html`<a href="${href}" class="govuk-back-link">${text}</a>`;
}

export function errorSummary(errors: FieldErrors): Html {
  if (errors.size === 0) return html``;
  return html`<div
    class="govuk-error-summary"
    data-module="govuk-error-summary"
  >
    <div role="alert">
      <h2 class="govuk-error-summary__title">There is a problem</h2>
      <div class="govuk-error-summary__body">
        <ul class="govuk-list govuk-error-summary__list">
          ${[...errors].map(
            ([field, message]) =>
              html`<li><a href="#${field}">${message}</a></li>`,
          )}
        </ul>
      </div>
    </div>
  </div>`;
}

export interface TableHead {
  text: string;
  numeric?: boolean;
  /**
   * Sortable column: where the header links to, and its current state.
   */
  sort?: { href: string; direction?: "ascending" | "descending" };
}

export interface TableCell {
  content: Content;
  numeric?: boolean;
  header?: boolean;
}

export function table(options: {
  caption?: string;
  captionClass?: string;
  head: Array<TableHead | string>;
  rows: Array<Array<TableCell | Content>>;
  id?: string;
}): Html {
  const head = options.head.map((h) =>
    typeof h === "string" ? { text: h } : h,
  );
  return html`<table
    class="govuk-table"
    ${options.id ? html`id="${options.id}"` : ""}
  >
    ${
      options.caption
        ? html`<caption
            class="govuk-table__caption ${
              options.captionClass ?? "govuk-table__caption--m"
            }"
          >
            ${options.caption}
          </caption>`
        : ""
    }
    <thead class="govuk-table__head">
      <tr class="govuk-table__row">
        ${head.map(
          (h) =>
            html`<th
              scope="col"
              class="govuk-table__header${
                h.numeric ? " govuk-table__header--numeric" : ""
              }"
              ${h.sort?.direction ? html`aria-sort="${h.sort.direction}"` : ""}
            >
              ${
                h.sort
                  ? html`<a
                      class="govuk-link automat-sort-link"
                      href="${h.sort.href}"
                      >${h.text}${
                        h.sort.direction === "ascending"
                          ? html`<span aria-hidden="true"> ▲</span>`
                          : h.sort.direction === "descending"
                            ? html`<span aria-hidden="true"> ▼</span>`
                            : ""
                      }</a
                    >`
                  : h.text
              }
            </th>`,
        )}
      </tr>
    </thead>
    <tbody class="govuk-table__body">
      ${options.rows.map(
        (row) =>
          html`<tr class="govuk-table__row">
            ${row.map((cell, i) => {
              const c =
                typeof cell === "object" && cell !== null && "content" in cell
                  ? cell
                  : { content: cell as Content };
              const numeric = c.numeric ?? head[i]?.numeric;
              return c.header
                ? html`<th scope="row" class="govuk-table__header">
                    ${c.content}
                  </th>`
                : html`<td
                    class="govuk-table__cell${
                      numeric ? " govuk-table__cell--numeric" : ""
                    }"
                  >
                    ${c.content}
                  </td>`;
            })}
          </tr>`,
      )}
    </tbody>
  </table>`;
}

const prevIcon = html`<svg
  class="govuk-pagination__icon govuk-pagination__icon--prev"
  xmlns="http://www.w3.org/2000/svg"
  height="13"
  width="15"
  aria-hidden="true"
  focusable="false"
  viewBox="0 0 15 13"
>
  <path
    d="m6.5938-0.0078125-6.7266 6.7266 6.7441 6.4062 1.377-1.449-4.1856-3.9768h12.896v-2h-12.984l4.2931-4.293-1.414-1.414z"
  ></path>
</svg>`;

const nextIcon = html`<svg
  class="govuk-pagination__icon govuk-pagination__icon--next"
  xmlns="http://www.w3.org/2000/svg"
  height="13"
  width="15"
  aria-hidden="true"
  focusable="false"
  viewBox="0 0 15 13"
>
  <path
    d="m8.107-0.0078125-1.4136 1.414 4.2926 4.293h-12.986v2h12.896l-4.1855 3.9766 1.377 1.4492 6.7441-6.4062-6.7246-6.7266z"
  ></path>
</svg>`;

/**
 * Pages to show: first, last, and those either side of the current page.
 */
function pageItems(page: number, pages: number): Array<number | "…"> {
  const items: Array<number | "…"> = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) {
      items.push(p);
    } else if (items.at(-1) !== "…") {
      items.push("…");
    }
  }
  return items;
}

export function pagination(options: {
  page: number;
  pages: number;
  href: (page: number) => string;
}): Html {
  const { page, pages, href } = options;
  if (pages <= 1) return html``;
  return html`<nav class="govuk-pagination" aria-label="Pagination">
    ${
      page > 1
        ? html`<div class="govuk-pagination__prev">
            <a
              class="govuk-link govuk-pagination__link"
              href="${href(page - 1)}"
              rel="prev"
            >
              ${prevIcon}
              <span class="govuk-pagination__link-title"
                >Previous<span class="govuk-visually-hidden"> page</span></span
              >
            </a>
          </div>`
        : ""
    }
    <ul class="govuk-pagination__list">
      ${pageItems(page, pages).map((item) =>
        item === "…"
          ? html`<li
              class="govuk-pagination__item govuk-pagination__item--ellipses"
            >
              &ctdot;
            </li>`
          : html`<li
              class="govuk-pagination__item${
                item === page ? " govuk-pagination__item--current" : ""
              }"
            >
              <a
                class="govuk-link govuk-pagination__link"
                href="${href(item)}"
                aria-label="Page ${item}"
                ${item === page ? html`aria-current="page"` : ""}
                >${item}</a
              >
            </li>`,
      )}
    </ul>
    ${
      page < pages
        ? html`<div class="govuk-pagination__next">
            <a
              class="govuk-link govuk-pagination__link"
              href="${href(page + 1)}"
              rel="next"
            >
              <span class="govuk-pagination__link-title"
                >Next<span class="govuk-visually-hidden"> page</span></span
              >
              ${nextIcon}
            </a>
          </div>`
        : ""
    }
  </nav>`;
}
