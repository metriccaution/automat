import { html } from "hono/html";
import type { Html } from "../components/core.ts";
import { markOnWhite } from "../components/logo.ts";
import { layout, type Chrome } from "../layout.ts";

export function notFoundPage(chrome: Chrome): Html {
  return layout({
    title: "Page not found",
    chrome,
    main: html`<div class="automat-empty">
      ${markOnWhite(64)}
      <h1 class="govuk-heading-l">Nothing behind this door</h1>
      <p class="govuk-body">
        The page you were looking for doesn’t exist. If you typed the address,
        check it’s correct.
      </p>
      <p class="govuk-body">
        <a class="govuk-link" href="/">Go to the home page</a>
      </p>
    </div>`,
  });
}

export function errorPage(chrome: Chrome, message: string): Html {
  return layout({
    title: "Something went wrong",
    chrome,
    main: html`<div class="automat-empty">
      ${markOnWhite(64)}
      <h1 class="govuk-heading-l">The machine jammed</h1>
      <p class="govuk-body">
        Something went wrong showing this page. Nothing was changed in Todoist.
      </p>
      <p class="govuk-body">The error was: <code>${message}</code></p>
      <p class="govuk-body">
        <a class="govuk-link" href="/history/runs">See recent runs</a> or
        <a class="govuk-link" href="/">go to the home page</a>.
      </p>
    </div>`,
  });
}
