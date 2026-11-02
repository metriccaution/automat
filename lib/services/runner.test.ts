import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { openDb } from "../db/index.ts";
import { failStaleRuns, getRun, insertRun } from "../db/runs.ts";
import { Runner } from "./runner.ts";

describe("Runner", () => {
  test("records a successful run with its summary and log", async () => {
    const runner = new Runner(openDb(":memory:"));
    const result = runner.start("cleanup", "manual", null, async (ctx) => {
      ctx.summary.cookingClosed = 2;
      ctx.log.info("Closed things");
      ctx.log.warn("Careful");
    });
    assert.ok(result.ok);
    assert.equal(runner.current?.id, result.run.id);

    const run = await result.done;
    assert.equal(run.status, "success");
    assert.equal(run.summary.cookingClosed, 2);
    assert.equal(run.log, "Closed things\nWarning: Careful");
    assert.ok(run.finishedAt);
    assert.equal(runner.current, null);
  });

  test("only one run at a time; others are rejected, not queued", async () => {
    const runner = new Runner(openDb(":memory:"));
    let release!: () => void;
    const first = runner.start(
      "plan",
      "manual",
      null,
      () => new Promise<void>((r) => (release = r)),
    );
    const second = runner.start("cleanup", "manual", null, async () => {});

    assert.equal(second.ok, false);
    assert.match(
      !second.ok ? second.message : "",
      /^A plan run is in progress, started \d\d:\d\d:\d\d$/,
    );

    release();
    assert.ok(first.ok);
    await first.done;
    assert.equal(
      runner.start("cleanup", "manual", null, async () => {}).ok,
      true,
    );
  });

  test("a failure records the error and releases the lock", async () => {
    const runner = new Runner(openDb(":memory:"));
    const result = runner.start("plan", "manual", null, async () => {
      throw new Error("Todoist is down");
    });
    assert.ok(result.ok);
    const run = await result.done;
    assert.equal(run.status, "failed");
    assert.match(run.error!, /Todoist is down/);
    assert.equal(runner.current, null);
  });

  test("created tasks are saved as they're created, not at the end", async () => {
    const db = openDb(":memory:");
    const runner = new Runner(db);
    const result = runner.start("plan", "manual", null, async (ctx) => {
      ctx.recordTask({ id: "1", project: "Cooking", content: "Stew" });
      assert.deepEqual(getRun(db, ctx.run.id)!.summary.createdTasks, [
        { id: "1", project: "Cooking", content: "Stew" },
      ]);
      throw new Error("Then it broke");
    });
    assert.ok(result.ok);
    const run = await result.done;
    assert.equal(run.summary.createdTasks?.length, 1);
  });

  test("a run that hangs times out, aborting its signal", async () => {
    const runner = new Runner(openDb(":memory:"), { timeoutMs: 50 });
    let aborted = false;
    const result = runner.start("plan", "manual", null, (ctx) => {
      ctx.signal.addEventListener("abort", () => (aborted = true));
      return new Promise(() => {});
    });
    assert.ok(result.ok);
    const run = await result.done;
    assert.equal(run.status, "failed");
    assert.equal(run.error, "Timed out after 0 minutes");
    assert.equal(aborted, true);
    assert.equal(runner.current, null);
  });

  test("startup marks interrupted runs as failed", () => {
    const db = openDb(":memory:");
    const run = insertRun(db, "plan", "schedule", null);
    assert.equal(failStaleRuns(db), 1);
    const after = getRun(db, run.id)!;
    assert.equal(after.status, "failed");
    assert.equal(after.error, "Interrupted (process restarted)");
  });
});
