import assert from "node:assert/strict";
import { test } from "node:test";
import { normaliseUnits } from "./normalise-units.ts";

test("normaliseUnits should return just the number back when there's a numbered single item", () => {
  assert.equal(normaliseUnits("singles", "1"), "1");
  assert.equal(normaliseUnits("singles", " 1  "), "1");
  assert.equal(normaliseUnits("singles", "1.3"), "1.3");
  assert.equal(normaliseUnits("singles", "0.5"), "0.5");
  assert.equal(normaliseUnits("singles", ".5"), "0.5");
  assert.equal(normaliseUnits("singles", "5000"), "5000");
  assert.equal(normaliseUnits("singles", "½"), "0.5");
  assert.equal(normaliseUnits("singles", "1/2"), "0.5");
});

test("normaliseUnits should keep the units attached to singles", () => {
  assert.equal(normaliseUnits("singles", "1 clove"), "1 clove");
  assert.equal(normaliseUnits("singles", "½ Handful"), "0.5 handful");
  assert.equal(normaliseUnits("singles", "1/4 Handful"), "0.25 handful");
  assert.equal(normaliseUnits("singles", "3/4 Handful"), "0.75 handful");
  assert.equal(normaliseUnits("singles", "2cm"), "2 cm");
  assert.equal(normaliseUnits("singles", ".33cm"), "0.33 cm");
});

test("normaliseUnits should handle items without a number", () => {
  assert.equal(normaliseUnits("singles", "clove"), "1 clove");
  assert.equal(normaliseUnits("singles", "Handful"), "1 handful");
});

test("normaliseUnits should handle weights", () => {
  assert.equal(normaliseUnits("weight", "5"), "5");
  assert.equal(normaliseUnits("weight", "5g"), "5 g");
  assert.equal(normaliseUnits("weight", "5kg"), "5 kg");
  assert.equal(normaliseUnits("weight", "5 kg"), "5 kg");
  assert.equal(normaliseUnits("weight", "123.45g"), "123.45 g");
  assert.equal(normaliseUnits("weight", "5tsp"), "5 tsp");
});

test("normaliseUnits should handle volumes", () => {
  assert.equal(normaliseUnits("volume", "5ml"), "5 ml");
  assert.equal(normaliseUnits("volume", "5l"), "5 l");
  assert.equal(normaliseUnits("volume", "5tsp"), "5 tsp");
});

test("normaliseUnits should handle cans", () => {
  assert.equal(normaliseUnits("can", "400g can"), "1 400g can");
  assert.equal(normaliseUnits("can", "2 400g cans"), "2 400g can");
});
