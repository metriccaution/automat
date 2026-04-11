import { dueDate } from "./mod";
import { describe, expect, test } from "bun:test";

describe("dueDate", () => {
  test("No due date", () => {
    expect(dueDate({ due: null })).toBeUndefined();
  });

  test("Valid due date", () => {
    const now = new Date();
    expect(
      dueDate({
        due: { date: now.toISOString(), isRecurring: false, string: "now" },
      }),
    ).toEqual(now);
  });

  test("Invalid due date", () => {
    expect(
      dueDate({
        due: { date: "cheese", isRecurring: false, string: "now" },
      }),
    ).toBeUndefined();
  });
});
