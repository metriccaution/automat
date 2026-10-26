import { dueDate } from "./index.ts";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

describe("dueDate", () => {
  test("No due date", () => {
    assert.equal(dueDate({ due: null }), undefined);
  });

  test("Valid due date", () => {
    const now = new Date();
    assert.deepEqual(
      dueDate({
        due: { date: now.toISOString(), isRecurring: false, string: "now" },
      }),
      now,
    );
  });

  test("Invalid due date", () => {
    assert.equal(
      dueDate({
        due: { date: "cheese", isRecurring: false, string: "now" },
      }),
      undefined,
    );
  });
});
