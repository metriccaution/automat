import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

export const settingsSchema = z.object({
  schedulerEnabled: z.boolean().default(true),
  scheduleTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("03:00"),
  daysToPlan: z.int().min(1).max(28).default(7),
  planToFreeze: z.boolean().default(true),
  historyWindowDays: z.int().min(0).max(365).default(30),
});

export type Settings = z.infer<typeof settingsSchema>;

/**
 * Internal keys, never shown on the settings form.
 */
export type InternalKey = "mealsImportedAt";

export function getSettings(db: DatabaseSync): Settings {
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string;
  }>;
  const stored: Record<string, unknown> = {};
  for (const { key, value } of rows) {
    if (key in settingsSchema.shape) stored[key] = JSON.parse(value);
  }

  // Fall back to defaults key by key, so one bad value doesn't reset the rest
  const defaults = settingsSchema.parse({});
  const settings: Record<string, unknown> = { ...defaults };
  for (const [key, field] of Object.entries(settingsSchema.shape)) {
    const parsed = (field as z.ZodType).safeParse(stored[key]);
    if (parsed.success) settings[key] = parsed.data;
  }
  return settings as Settings;
}

export function saveSettings(db: DatabaseSync, values: Partial<Settings>) {
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) upsert.run(key, JSON.stringify(value));
  }
}

export function getInternal(
  db: DatabaseSync,
  key: InternalKey,
): string | undefined {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as string) : undefined;
}

export function setInternal(db: DatabaseSync, key: InternalKey, value: string) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, JSON.stringify(value));
}
