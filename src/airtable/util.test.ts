import { parseAirtableRow, splitIngredients } from "./util";

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

describe("Recipe parsing", () => {
  it("Parses without a timestamp present", () => {
    expect(
      parseAirtableRow(new Date("2019-04-22T13:38:13.786Z"), {
        Ingredients: "a\nb",
        Meals: 3,
        Name: "Food",
        Source: "A book"
      })
    ).toEqual({
      ingredients: [
        {
          name: "a",
          quantity: "1"
        },
        {
          name: "b",
          quantity: "1"
        }
      ],
      lastCooked: new Date("2019-04-22T13:38:13.786Z"),
      meals: 3,
      name: "Food",
      source: "A book"
    });
  });

  it("Parses with a timestamp present", () => {
    expect(
      parseAirtableRow(new Date("2019-04-22T13:38:13.786Z"), {
        Ingredients: "a\nb",
        "Last cooked": "2018-01-01",
        Meals: 3,
        Name: "Food",
        Source: "A book"
      })
    ).toEqual({
      ingredients: [
        {
          name: "a",
          quantity: "1"
        },
        {
          name: "b",
          quantity: "1"
        }
      ],
      lastCooked: new Date("2018-01-01T00:00:00.000Z"),
      meals: 3,
      name: "Food",
      source: "A book"
    });
  });

  it("Throws up with an invalid date", () => {
    expect.assertions(3);

    expect(() =>
      parseAirtableRow(new Date("2019-04-22T13:38:13.786Z"), {
        Ingredients: "a\nb",
        "Last cooked": "2018-01-01-02",
        Meals: 3,
        Name: "Food",
        Source: "A book"
      })
    ).toThrow();

    expect(() =>
      parseAirtableRow(new Date("2019-04-22T13:38:13.786Z"), {
        Ingredients: "a\nb",
        "Last cooked": "2018-01",
        Meals: 3,
        Name: "Food",
        Source: "A book"
      })
    ).toThrow();

    expect(() =>
      parseAirtableRow(new Date("2019-04-22T13:38:13.786Z"), {
        Ingredients: "a\nb",
        "Last cooked": "2018-0a-01",
        Meals: 3,
        Name: "Food",
        Source: "A book"
      })
    ).toThrow();
  });
});
