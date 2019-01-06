import { splitIngredients } from "./util";

describe("Splitting ingredients out", () => {
  test("Basic ingredient splitting", () => {
    const text = `
    ABC - 1
    DEF - 3
    `;
    const actual = splitIngredients(text);
    expect(actual).toEqual([
      {
        name: "ABC",
        quantity: "1"
      },
      {
        name: "DEF",
        quantity: "3"
      }
    ]);
  });

  test("Skips empty lines", () => {
    const text = `
    ABC - 1

    DEF - 3
    `;
    const actual = splitIngredients(text);
    expect(actual).toEqual([
      {
        name: "ABC",
        quantity: "1"
      },
      {
        name: "DEF",
        quantity: "3"
      }
    ]);
  });

  test("Handles empty text", () => {
    const text = ``;
    const actual = splitIngredients(text);
    expect(actual).toEqual([]);
  });
});
