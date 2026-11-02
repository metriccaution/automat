import { dueDate, plannedDaysInWindow } from "./index.ts";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

describe("dueDate", () => {
  test("No due date", () => {
    assert.equal(dueDate({ due: null }), undefined);
  });

  test("Date only", () => {
    assert.equal(
      dueDate({
        due: { date: "2026-11-02", isRecurring: false, string: "2 Nov" },
      }),
      "2026-11-02",
    );
  });

  test("Due time is ignored", () => {
    assert.equal(
      dueDate({
        due: {
          date: "2026-11-02T23:30:00Z",
          isRecurring: false,
          string: "2 Nov 23:30",
        },
      }),
      "2026-11-02",
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

describe("plannedDaysInWindow", () => {
  const today = "2026-11-02";

  test("two meals on one day count as one day", () => {
    assert.equal(
      plannedDaysInWindow(
        [
          { date: "2026-11-02" },
          { date: "2026-11-02" },
          { date: "2026-11-03" },
        ],
        today,
        7,
      ),
      2,
    );
  });

  test("days beyond the window don't count", () => {
    assert.equal(
      plannedDaysInWindow(
        [
          { date: "2026-11-08" },
          { date: "2026-11-09" },
          { date: "2026-11-23" },
        ],
        today,
        7,
      ),
      1,
    );
  });

  test("past days don't count", () => {
    assert.equal(plannedDaysInWindow([{ date: "2026-11-01" }], today, 7), 0);
  });
});
