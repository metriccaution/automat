import { z } from "zod";
import { DEFAULT_TIME_ZONE } from "./dates.ts";

const envSchema = z.object({
  TODOIST_TOKEN: z
    .string({ error: "TODOIST_TOKEN is required" })
    .min(1, "TODOIST_TOKEN is required"),
  DB_PATH: z.string().min(1).default("./data/automat.sqlite"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  TZ: z.string().min(1).default(DEFAULT_TIME_ZONE),
  RECIPES_URL: z
    .url()
    .default("https://metriccaution.github.io/recipe-book/repo.json"),
  MEALS_SEED_DIR: z.string().min(1).default("./meals"),
  ALLOWED_HOSTS: z
    .string()
    .default("localhost,127.0.0.1")
    .transform((value) =>
      value
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate the environment. `TZ` is defaulted here rather than left to the
 * system, and must resolve to itself.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse({
    ...source,
    TZ: source.TZ || undefined,
  });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("\n"),
    );
  }
  const env = parsed.data;

  // Changing process.env.TZ makes Node switch timezone for the whole process
  process.env.TZ = env.TZ;
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (resolved !== env.TZ) {
    throw new Error(
      `TZ is "${env.TZ}" but resolves to "${resolved}". Check the timezone name`,
    );
  }

  return env;
}
