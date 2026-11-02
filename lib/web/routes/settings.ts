import type { Hono } from "hono";
import {
  getSettings,
  saveSettings,
  settingsSchema,
  type Settings,
} from "../../db/settings.ts";
import {
  chrome,
  setFlash,
  type AppContext,
  type AppDeps,
  type AppEnv,
} from "../context.ts";
import { formValue } from "../forms.ts";
import type { FieldErrors } from "../views/components/core.ts";
import {
  settingsPage,
  type SettingsFormValues,
} from "../views/pages/settings.ts";

const toForm = (s: Settings): SettingsFormValues => ({
  schedulerEnabled: s.schedulerEnabled,
  scheduleTime: s.scheduleTime,
  daysToPlan: String(s.daysToPlan),
  planToFreeze: s.planToFreeze,
  historyWindowDays: String(s.historyWindowDays),
});

function validate(
  values: SettingsFormValues,
): { settings: Settings } | { errors: FieldErrors } {
  const errors: FieldErrors = new Map();

  const time = /^(\d{1,2})[:.](\d{2})$/.exec(values.scheduleTime);
  let scheduleTime = "";
  if (!values.scheduleTime) {
    errors.set("scheduleTime", "Enter the time to plan meals");
  } else if (!time || Number(time[1]) > 23 || Number(time[2]) > 59) {
    errors.set(
      "scheduleTime",
      "Time to plan meals must be a 24-hour time, like 03:00",
    );
  } else {
    scheduleTime = `${time[1]!.padStart(2, "0")}:${time[2]}`;
  }

  const whole = (
    key: "daysToPlan" | "historyWindowDays",
    label: string,
    min: number,
    max: number,
  ) => {
    const raw = values[key];
    if (!raw) {
      errors.set(key, `Enter ${label}`);
    } else if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
      errors.set(
        key,
        `${label.charAt(0).toUpperCase()}${label.slice(1)} must be a whole number from ${min} to ${max}`,
      );
    }
    return Number(raw);
  };
  const daysToPlan = whole("daysToPlan", "how many days to plan", 1, 28);
  const historyWindowDays = whole(
    "historyWindowDays",
    "how many days to avoid recent meals for",
    0,
    365,
  );

  if (errors.size) return { errors };
  return {
    settings: settingsSchema.parse({
      schedulerEnabled: values.schedulerEnabled,
      scheduleTime,
      daysToPlan,
      planToFreeze: values.planToFreeze,
      historyWindowDays,
    }),
  };
}

export function settingsRoutes(app: Hono<AppEnv>, deps: AppDeps) {
  const { db, env, recipeBook } = deps;

  const render = (
    c: AppContext,
    values: SettingsFormValues,
    errors: FieldErrors = new Map(),
  ) =>
    c.html(
      settingsPage({
        chrome: chrome(c, deps),
        values,
        errors,
        environment: {
          dbPath: env.DB_PATH,
          recipesUrl: env.RECIPES_URL,
          timeZone: env.TZ,
          allowedHosts: env.ALLOWED_HOSTS,
          tokenSet: Boolean(env.TODOIST_TOKEN),
        },
        recipeBook,
      }),
      errors.size ? 422 : 200,
    );

  app.get("/settings", (c) => render(c, toForm(getSettings(db))));

  app.post("/settings", async (c) => {
    const body = await c.req.parseBody({ all: true });
    const values: SettingsFormValues = {
      schedulerEnabled: formValue(body, "schedulerEnabled") === "true",
      scheduleTime: formValue(body, "scheduleTime"),
      daysToPlan: formValue(body, "daysToPlan"),
      planToFreeze: formValue(body, "planToFreeze") === "true",
      historyWindowDays: formValue(body, "historyWindowDays"),
    };
    const result = validate(values);
    if ("errors" in result) return render(c, values, result.errors);

    saveSettings(db, result.settings);
    setFlash(c, { kind: "success", text: "Settings saved" });
    return c.redirect("/settings", 303);
  });
}
