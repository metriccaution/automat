import chooseAtRandom, { arrayShuffle } from "./random-recipes";

describe("Array shuffling", () => {
  it("doesn't throw up on empty arrays", () => {
    expect(() => arrayShuffle([])).not.toThrow();
  });

  it("keeps all of the items in the initial array", () => {
    const initial = new Array(50).fill(0).map(() => Math.random());
    const actual = arrayShuffle([...initial]);

    expect(actual).toHaveLength(50);
    initial.forEach(i => expect(actual).toContain(i));
  });

  it("shuffles in place", () => {
    const initial = new Array(50).fill(0).map(() => Math.random());
    const actual = arrayShuffle(initial);
    expect(actual).toBe(initial);
  });
});

describe("Random item choice", () => {
  const stubRecipe = (days: number) => ({
    ingredients: [],
    meals: days,
    name: `${Math.random()}`,
    source: `${Math.random()}`
  });

  it("picks items from the list", () => {
    const recipes = [stubRecipe(1), stubRecipe(1), stubRecipe(1)];

    const chosen = chooseAtRandom(5, recipes);
    chosen.forEach(r => expect(recipes).toContain(r));
  });

  it("keeps picking when there are not enough items to choose from", () => {
    const recipes = [stubRecipe(1), stubRecipe(1), stubRecipe(1)];

    const chosen = chooseAtRandom(5, recipes);
    expect(chosen).toHaveLength(5);
  });

  it("doesn't fail when there are no items to pick from", () => {
    expect(chooseAtRandom(1, [])).toEqual([]);
  });

  it("doesn't fail when picking no items", () => {
    expect(chooseAtRandom(0, [stubRecipe(1)])).toEqual([]);
  });

  it("doesn't run into an infinite loop when there's nothing with length one", () => {
    const r1 = stubRecipe(4);
    expect(chooseAtRandom(2, [r1])).toEqual([r1]);
  });
});
