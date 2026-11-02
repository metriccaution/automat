import type { DatabaseSync } from "node:sqlite";
import { addDays, toCalendarDate, zonedInstant } from "../dates.ts";
import { latestRun } from "../db/runs.ts";
import { getSettings } from "../db/settings.ts";

/**
 * The most recent scheduled time at or before `now`: today's, or yesterday's
 * if today's hasn't happened yet.
 */
export function lastSlot(now: Date, scheduleTime: string): Date {
  const today = toCalendarDate(now);
  const todays = zonedInstant(today, scheduleTime);
  return todays.getTime() <= now.getTime()
    ? todays
    : zonedInstant(addDays(today, -1), scheduleTime);
}

/**
 * The next scheduled time after `now`.
 */
export function nextSlot(now: Date, scheduleTime: string): Date {
  const today = toCalendarDate(now);
  const todays = zonedInstant(today, scheduleTime);
  return todays.getTime() > now.getTime()
    ? todays
    : zonedInstant(addDays(today, 1), scheduleTime);
}

/**
 * Whether a scheduled slot has passed since the last scheduled plan run.
 */
export function isDue(
  now: Date,
  scheduleTime: string,
  lastScheduledStart: string | undefined,
): boolean {
  if (!lastScheduledStart) return true;
  return lastSlot(now, scheduleTime).getTime() > Date.parse(lastScheduledStart);
}

/**
 * Checks once a minute whether a scheduled plan run is due. Missed slots
 * (downtime, holiday mode) are caught up once, never more than once per slot.
 */
export class Scheduler {
  #db: DatabaseSync;
  #startPlan: () => { ok: boolean };
  #intervalMs: number;
  #timer: NodeJS.Timeout | undefined;

  constructor(
    db: DatabaseSync,
    startPlan: () => { ok: boolean },
    options: { intervalMs?: number } = {},
  ) {
    this.#db = db;
    this.#startPlan = startPlan;
    this.#intervalMs = options.intervalMs ?? 60_000;
  }

  start() {
    this.tick();
    this.#timer = setInterval(() => this.tick(), this.#intervalMs);
    this.#timer.unref();
  }

  stop() {
    clearInterval(this.#timer);
  }

  /**
   * Start a scheduled run if one is due. If the lock is held, the next tick
   * tries again.
   */
  tick(now = new Date()): boolean {
    try {
      const settings = getSettings(this.#db);
      if (!settings.schedulerEnabled) return false;

      const last = latestRun(this.#db, { kind: "plan", trigger: "schedule" });
      if (!isDue(now, settings.scheduleTime, last?.startedAt)) return false;

      return this.#startPlan().ok;
    } catch (e) {
      console.error("[scheduler]", e);
      return false;
    }
  }
}
