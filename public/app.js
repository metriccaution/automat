// Automat's browser code: GOV.UK Frontend components, htmx config and the
// recipe picker. Every page works without it; this only enhances them.
import {
  Button,
  Checkboxes,
  createAll,
  ErrorSummary,
  NotificationBanner,
  Radios,
  ServiceNavigation,
  SkipLink,
} from "/vendor/govuk-frontend.min.js";

const htmx = window.htmx;

if (htmx) {
  // The CSP forbids inline styles; the indicator CSS is in automat.css
  htmx.config.includeIndicatorStyles = false;
  htmx.config.allowEval = false;
  htmx.config.allowScriptTags = false;
}

/**
 * GOV.UK components used in Automat. Tabs are deliberately left out: each
 * history tab is a real link.
 */
const components = [
  Button,
  Checkboxes,
  ErrorSummary,
  NotificationBanner,
  Radios,
  ServiceNavigation,
  SkipLink,
];

function initComponents(scope) {
  for (const Component of components) {
    createAll(Component, undefined, {
      scope,
      onError: (e) => console.debug(e),
    });
  }
}

/**
 * Turn each recipe `<select>` into an accessible autocomplete.
 */
function initRecipePickers(scope) {
  const autocomplete = window.accessibleAutocomplete;
  if (!autocomplete) return;
  const enhance =
    autocomplete.enhanceSelectElement ??
    autocomplete.default?.enhanceSelectElement;

  const selects = scope.matches?.("select[data-recipe-picker]")
    ? [scope]
    : scope.querySelectorAll("select[data-recipe-picker]");
  for (const select of selects) {
    if (select.dataset.enhanced) continue;
    select.dataset.enhanced = "true";
    enhance({
      selectElement: select,
      defaultValue: "",
      showAllValues: true,
      minLength: 0,
      displayMenu: "overlay",
    });
  }
}

function init(scope) {
  initComponents(scope);
  initRecipePickers(scope);
}

if (htmx) {
  // Runs for the whole page on load, and for any content htmx swaps in
  htmx.onLoad((element) => init(element));
} else {
  init(document);
}
