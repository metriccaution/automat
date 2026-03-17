import { describe, expect, test } from "bun:test";
import { normaliseUnits } from "./normalise-units.ts";

// import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";

test("normaliseUnits should return just the number back when there's a numbered single item", () => {
  expect(normaliseUnits("singles", "1")).toBe("1");
  expect(normaliseUnits("singles", " 1  ")).toBe("1");
  expect(normaliseUnits("singles", "1.3")).toBe("1.3");
  expect(normaliseUnits("singles", "0.5")).toBe("0.5");
  expect(normaliseUnits("singles", ".5")).toBe("0.5");
  expect(normaliseUnits("singles", "5000")).toBe("5000");
  expect(normaliseUnits("singles", "½")).toBe("0.5");
  expect(normaliseUnits("singles", "1/2")).toBe("0.5");
});

test("normaliseUnits should keep the units attached to singles", () => {
  expect(normaliseUnits("singles", "1 clove")).toBe("1 clove");
  expect(normaliseUnits("singles", "½ Handful")).toBe("0.5 handful");
  expect(normaliseUnits("singles", "1/4 Handful")).toBe("0.25 handful");
  expect(normaliseUnits("singles", "3/4 Handful")).toBe("0.75 handful");
  expect(normaliseUnits("singles", "2cm")).toBe("2 cm");
  expect(normaliseUnits("singles", ".33cm")).toBe("0.33 cm");
});

test("normaliseUnits should handle items without a number", () => {
  expect(normaliseUnits("singles", "clove")).toBe("1 clove");
  expect(normaliseUnits("singles", "Handful")).toBe("1 handful");
});

test("normaliseUnits should handle weights", () => {
  expect(normaliseUnits("weight", "5")).toBe("5");
  expect(normaliseUnits("weight", "5g")).toBe("5 g");
  expect(normaliseUnits("weight", "5kg")).toBe("5 kg");
  expect(normaliseUnits("weight", "5 kg")).toBe("5 kg");
  expect(normaliseUnits("weight", "123.45g")).toBe("123.45 g");
  expect(normaliseUnits("weight", "5tsp")).toBe("5 tsp");
});

test("normaliseUnits should handle volumes", () => {
  expect(normaliseUnits("volume", "5ml")).toBe("5 ml");
  expect(normaliseUnits("volume", "5l")).toBe("5 l");
  expect(normaliseUnits("volume", "5tsp")).toBe("5 tsp");
});

test("normaliseUnits should handle cans", () => {
  expect(normaliseUnits("can", "400g can")).toBe("1 400g can");
  expect(normaliseUnits("can", "2 400g cans")).toBe("2 400g can");
});
