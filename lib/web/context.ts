import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { html } from "hono/html";
import type { DatabaseSync } from "node:sqlite";
import { formatInstant } from "../dates.ts";
import type { Env } from "../env.ts";
import { latestRun } from "../db/runs.ts";
import { getSettings } from "../db/settings.ts";
import type { RecipeBook } from "../recipes/book.ts";
import type { Services } from "../services/index.ts";
import {
  button,
  notificationBanner,
  type Html,
} from "./views/components/core.ts";
import type { Chrome, Flash } from "./views/layout.ts";

export interface AppDeps {
  db: DatabaseSync;
  env: Pick<
    Env,
    "DB_PATH" | "RECIPES_URL" | "TZ" | "ALLOWED_HOSTS" | "TODOIST_TOKEN"
  >;
  services: Services;
  recipeBook: RecipeBook;
}

export type AppEnv = {
  Variables: {
    flash: Flash | null;
  };
};

export type AppContext = Context<AppEnv>;

const FLASH_COOKIE = "automat_flash";

/**
 * Show a message on the next page (Post/Redirect/Get).
 */
export function setFlash(c: Context, flash: Flash) {
  setCookie(c, FLASH_COOKIE, encodeURIComponent(JSON.stringify(flash)), {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 60,
  });
}

/**
 * Read and clear the flash message.
 */
export function takeFlash(c: Context): Flash | null {
  const raw = getCookie(c, FLASH_COOKIE);
  if (!raw) return null;
  deleteCookie(c, FLASH_COOKIE, { path: "/" });
  try {
    const flash = JSON.parse(decodeURIComponent(raw)) as Flash;
    return typeof flash.text === "string" &&
      (flash.kind === "success" || flash.kind === "warning")
      ? flash
      : null;
  } catch {
    return null;
  }
}

/**
 * The single important banner, in priority order.
 */
export function importantBanner(deps: AppDeps): Html | null {
  const { db, recipeBook } = deps;
  const banner = (content: Html) =>
    notificationBanner({ type: "important", content });

  const scheduled = latestRun(db, { trigger: "schedule" });
  if (scheduled?.status === "failed") {
    return banner(
      html`<p class="govuk-notification-banner__heading">
        The last scheduled planning run failed, on
        ${formatInstant(scheduled.startedAt)}.
        <a
          class="govuk-notification-banner__link"
          href="/history/runs/${scheduled.id}"
          >See what went wrong</a
        >
      </p>`,
    );
  }

  if (recipeBook.isStale()) {
    return banner(
      html`<p class="govuk-notification-banner__heading">
          The recipe book can’t be reached
        </p>
        <p class="govuk-body">
          It was last checked on ${formatInstant(recipeBook.checkedAt!)}.
          Planning is using the recipes from then.
          <a class="govuk-notification-banner__link" href="/settings"
            >Check the recipe cache</a
          >
        </p>`,
    );
  }

  if (!getSettings(db).schedulerEnabled) {
    return banner(
      html`<p class="govuk-notification-banner__heading">Scheduler paused</p>
        <p class="govuk-body">
          Meals won’t be planned automatically until you resume it.
        </p>
        <form method="post" action="/actions/scheduler">
          <input type="hidden" name="enabled" value="true" />
          ${button({ text: "Resume scheduler", classes: "govuk-!-margin-bottom-0" })}
        </form>`,
    );
  }

  return null;
}

export function chrome(c: AppContext, deps: AppDeps): Chrome {
  return {
    banner: importantBanner(deps),
    flash: c.get("flash"),
    running: deps.services.runner.current !== null,
  };
}

export const isHtmx = (c: Context) => c.req.header("HX-Request") === "true";
