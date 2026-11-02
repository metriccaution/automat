import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  addDays,
  compare,
  daysBetween,
  isCalendarDate,
  toCalendarDate,
  today,
  zonedInstant,
} from "./dates.ts";

const LONDON = "Europe/London";

describe("toCalendarDate", () => {
  test("just before midnight in winter (GMT)", () => {
    assert.equal(toCalendarDate("2026-01-15T23:59:59Z", LONDON), "2026-01-15");
  });

  test("just after midnight in winter (GMT)", () => {
    assert.equal(toCalendarDate("2026-01-16T00:00:01Z", LONDON), "2026-01-16");
  });

  test("just after midnight in summer (BST) is still the previous UTC day", () => {
    // 00:30 BST on 16 July is 23:30 UTC on 15 July
    assert.equal(toCalendarDate("2026-07-15T23:30:00Z", LONDON), "2026-07-16");
  });

  test("just before midnight in summer (BST)", () => {
    assert.equal(toCalendarDate("2026-07-15T22:59:00Z", LONDON), "2026-07-15");
  });

  test("today uses the timezone, not UTC", () => {
    assert.equal(today(new Date("2026-07-15T23:30:00Z"), LONDON), "2026-07-16");
    assert.equal(
      today(new Date("2026-07-15T23:30:00Z"), "America/New_York"),
      "2026-07-15",
    );
  });
});

describe("addDays", () => {
  test("crosses month and year ends", () => {
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  });

  test("isn't affected by DST changes", () => {
    // Clocks go forward on 29 March 2026 and back on 25 October 2026
    assert.equal(addDays("2026-03-28", 1), "2026-03-29");
    assert.equal(addDays("2026-03-29", 1), "2026-03-30");
    assert.equal(addDays("2026-10-24", 2), "2026-10-26");
  });

  test("rejects anything but a calendar date", () => {
    assert.throws(() => addDays("2026-11-02T00:00:00Z", 1));
  });
});

describe("compare and daysBetween", () => {
  test("orders dates", () => {
    assert.equal(compare("2026-01-01", "2026-01-02"), -1);
    assert.equal(compare("2026-01-02", "2026-01-02"), 0);
    assert.equal(compare("2026-01-03", "2026-01-02"), 1);
  });

  test("counts days across a DST change", () => {
    assert.equal(daysBetween("2026-03-28", "2026-03-30"), 2);
  });
});

describe("isCalendarDate", () => {
  test("accepts real dates only", () => {
    assert.equal(isCalendarDate("2026-02-28"), true);
    assert.equal(isCalendarDate("2026-02-29"), false);
    assert.equal(isCalendarDate("2026-13-01"), false);
    assert.equal(isCalendarDate("26-01-01"), false);
  });
});

describe("zonedInstant", () => {
  test("winter time is UTC", () => {
    assert.equal(
      zonedInstant("2026-01-15", "03:00", LONDON).toISOString(),
      "2026-01-15T03:00:00.000Z",
    );
  });

  test("summer time is an hour ahead", () => {
    assert.equal(
      zonedInstant("2026-07-15", "03:00", LONDON).toISOString(),
      "2026-07-15T02:00:00.000Z",
    );
  });

  test("on the day clocks go forward", () => {
    assert.equal(
      zonedInstant("2026-03-29", "03:00", LONDON).toISOString(),
      "2026-03-29T02:00:00.000Z",
    );
    // 01:30 doesn't exist that day: use the instant an hour later
    assert.equal(
      zonedInstant("2026-03-29", "01:30", LONDON).toISOString(),
      "2026-03-29T01:30:00.000Z",
    );
  });

  test("on the day clocks go back, a repeated time is its first occurrence", () => {
    assert.equal(
      zonedInstant("2026-10-25", "01:30", LONDON).toISOString(),
      "2026-10-25T00:30:00.000Z",
    );
    assert.equal(
      zonedInstant("2026-10-25", "03:00", LONDON).toISOString(),
      "2026-10-25T03:00:00.000Z",
    );
  });
});
