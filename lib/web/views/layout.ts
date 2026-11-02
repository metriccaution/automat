import { html } from "hono/html";
import {
  notificationBanner,
  warningText,
  type Html,
} from "./components/core.ts";
import { mark } from "./components/logo.ts";

export type Section = "home" | "meals" | "history" | "settings";

export interface Flash {
  kind: "success" | "warning";
  text: string;
  /**
   * Optional link shown after the text.
   */
  link?: { href: string; text: string };
}

/**
 * The parts of every page that depend on app state.
 */
export interface Chrome {
  /**
   * The single important notification banner, if any.
   */
  banner: Html | null;
  flash: Flash | null;
  running: boolean;
}

const navItems: Array<{ section: Section; href: string; text: string }> = [
  { section: "home", href: "/", text: "Home" },
  { section: "meals", href: "/meals", text: "Meals" },
  { section: "history", href: "/history/meals", text: "History" },
  { section: "settings", href: "/settings", text: "Settings" },
];

function serviceNavigation(active: Section | undefined, running: boolean) {
  return html`<section
    aria-label="Service information"
    class="govuk-service-navigation govuk-service-navigation--inverse automat-header"
    data-module="govuk-service-navigation"
  >
    <div class="govuk-width-container">
      <div class="govuk-service-navigation__container">
        <span class="govuk-service-navigation__service-name">
          <a href="/" class="govuk-service-navigation__link automat-wordmark">
            ${mark(running)}<span class="automat-wordmark__text">Automat</span>
          </a>
        </span>
        <nav aria-label="Menu" class="govuk-service-navigation__wrapper">
          <button
            type="button"
            class="govuk-service-navigation__toggle govuk-js-service-navigation-toggle"
            aria-controls="navigation"
            hidden
            aria-hidden="true"
          >
            Menu
          </button>
          <ul class="govuk-service-navigation__list" id="navigation">
            ${navItems.map((item) =>
              item.section === active
                ? html`<li
                    class="govuk-service-navigation__item govuk-service-navigation__item--active"
                  >
                    <a
                      class="govuk-service-navigation__link"
                      href="${item.href}"
                      aria-current="page"
                    >
                      <strong class="govuk-service-navigation__active-fallback"
                        >${item.text}</strong
                      >
                    </a>
                  </li>`
                : html`<li class="govuk-service-navigation__item">
                    <a
                      class="govuk-service-navigation__link"
                      href="${item.href}"
                      >${item.text}</a
                    >
                  </li>`,
            )}
          </ul>
        </nav>
      </div>
    </div>
  </section>`;
}

export function flashMessage(flash: Flash | null): Html {
  if (!flash) return html``;
  const link = flash.link
    ? html` <a class="govuk-notification-banner__link" href="${flash.link.href}"
        >${flash.link.text}</a
      >`
    : "";
  if (flash.kind === "success") {
    return notificationBanner({
      type: "success",
      id: "flash-title",
      content: html`<p class="govuk-notification-banner__heading">
        ${flash.text}${link}
      </p>`,
    });
  }
  return warningText(
    html`${flash.text}${
      flash.link
        ? html` <a class="govuk-link" href="${flash.link.href}"
            >${flash.link.text}</a
          >`
        : ""
    }`,
  );
}

export function layout(o: {
  title: string;
  section?: Section;
  chrome: Chrome;
  main: Html;
  /**
   * The page has validation errors: prefix the title with "Error: ".
   */
  hasErrors?: boolean;
  /**
   * Shown above the main content, e.g. a back link.
   */
  beforeMain?: Html;
}): Html {
  const title = `${o.hasErrors ? "Error: " : ""}${o.title} – Automat`;
  return html`<!doctype html>
    <html lang="en" class="govuk-template">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#4c2c92" />
        <link rel="icon" sizes="48x48" href="/favicon.ico" />
        <link
          rel="icon"
          sizes="any"
          href="/public/assets/favicon.svg"
          type="image/svg+xml"
        />
        <link
          rel="apple-touch-icon"
          href="/public/assets/apple-touch-icon.png"
        />
        <link rel="manifest" href="/public/assets/manifest.json" />
        <link rel="stylesheet" href="/public/css/automat.css" />
        <link rel="stylesheet" href="/vendor/accessible-autocomplete.min.css" />
        <script src="/vendor/htmx.min.js" defer></script>
        <script src="/vendor/accessible-autocomplete.min.js" defer></script>
        <script type="module" src="/public/app.js"></script>
      </head>
      <body class="govuk-template__body">
        <script src="/public/supported.js"></script>
        <a
          href="#main-content"
          class="govuk-skip-link"
          data-module="govuk-skip-link"
          >Skip to main content</a
        >
        <header class="govuk-template__header">
          ${serviceNavigation(o.section, o.chrome.running)}
        </header>
        <div class="govuk-width-container">
          ${o.beforeMain ?? ""}
          <main class="govuk-main-wrapper" id="main-content">
            ${o.chrome.banner ?? ""} ${flashMessage(o.chrome.flash)} ${o.main}
          </main>
        </div>
        <footer class="govuk-footer">
          <div class="govuk-width-container">
            <div class="govuk-footer__meta">
              <div
                class="govuk-footer__meta-item govuk-footer__meta-item--grow"
              >
                <p class="govuk-body-s govuk-!-margin-bottom-0">
                  Automat · meals, dispensed
                </p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>`;
}
