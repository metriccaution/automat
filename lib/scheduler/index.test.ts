import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { openDb } from "../db/index.ts";
import { finishRun, insertRun } from "../db/runs.ts";
import { saveSettings } from "../db/settings.ts";
import { isDue, lastSlot, nextSlot, Scheduler } from "./index.ts";

process.env.TZ = "Europe/London";

describe("slots", () => {
  test("the last slot is today's once it has passed", () => {
    assert.equal(
      lastSlot(new Date("2026-01-15T09:00:00Z"), "03:00").toISOString(),
      "2026-01-15T03:00:00.000Z",
    );
  });

  test("the last slot is yesterday's before today's has happened", () => {
    assert.equal(
      lastSlot(new Date("2026-01-15T02:00:00Z"), "03:00").toISOString(),
      "2026-01-14T03:00:00.000Z",
    );
  });

  test("slots are in local time across a DST change", () => {
    // 03:00 BST on 29 March is 02:00 UTC
    assert.equal(
      lastSlot(new Date("2026-03-29T02:30:00Z"), "03:00").toISOString(),
      "2026-03-29T02:00:00.000Z",
    );
    assert.equal(
      nextSlot(new Date("2026-03-28T12:00:00Z"), "03:00").toISOString(),
      "2026-03-29T02:00:00.000Z",
    );
  });

  test("a run is due on first start", () => {
    assert.equal(isDue(new Date(), "03:00", undefined), true);
  });

  test("a missed slot is caught up once", () => {
    const now = new Date("2026-01-15T09:00:00Z");
    assert.equal(isDue(now, "03:00", "2026-01-14T03:00:05Z"), true);
    assert.equal(isDue(now, "03:00", "2026-01-15T09:00:00Z"), false);
  });

  test("a run in the current slot isn't repeated", () => {
    const now = new Date("2026-01-15T03:05:00Z");
    assert.equal(isDue(now, "03:00", "2026-01-15T03:00:01Z"), false);
  });
});

describe("Scheduler", () => {
  test("starts a plan when due, and only once per slot", () => {
    const db = openDb(":memory:");
    const starts: number[] = [];
    const scheduler = new Scheduler(db, () => {
      const run = insertRun(db, "plan", "schedule", null);
      finishRun(db, run.id, "failed", {}, "", "boom");
      starts.push(run.id);
      return { ok: true };
    });

    assert.equal(scheduler.tick(), true);
    // A failed scheduled run isn't retried until the next slot
    assert.equal(scheduler.tick(), false);
    assert.equal(starts.length, 1);
  });

  test("does nothing in holiday mode", () => {
    const db = openDb(":memory:");
    saveSettings(db, { schedulerEnabled: false });
    let started = false;
    const scheduler = new Scheduler(db, () => {
      started = true;
      return { ok: true };
    });
    assert.equal(scheduler.tick(), false);
    assert.equal(started, false);
  });

  test("tries again on the next tick when the lock is held", () => {
    const db = openDb(":memory:");
    let attempts = 0;
    const scheduler = new Scheduler(db, () => {
      attempts++;
      return { ok: false };
    });
    scheduler.tick();
    scheduler.tick();
    assert.equal(attempts, 2);
  });
});
