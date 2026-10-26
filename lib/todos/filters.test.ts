import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { filters, toFilter, type FilterComponent } from "./filters.ts";

describe("toFilter", () => {
  const tests: Array<{ filter: FilterComponent; expected: string }> = [
    {
      filter: filters.search("text"),
      expected: "search: text",
    },
    {
      filter: filters.dueOn("tomorrow"),
      expected: "tomorrow",
    },
    {
      filter: filters.project("shopping"),
      expected: "##shopping",
    },
    {
      filter: filters.and(
        filters.dueBefore("today"),
        filters.project("cooking"),
      ),
      expected: "(due before: today & ##cooking)",
    },
    {
      filter: filters.and(
        filters.dueBefore("today"),
        filters.project("cooking"),
        filters.not(
          filters.or(filters.search("not me"), filters.assignedTo("Steve")),
        ),
      ),
      expected:
        "(due before: today & ##cooking & !((search: not me | assigned to: Steve)))",
    },
  ];

  for (const { expected, filter } of tests) {
    test(`Filter from ${JSON.stringify(filter)}`, () => {
      assert.deepEqual(toFilter(filter), expected);
    });
  }
});
