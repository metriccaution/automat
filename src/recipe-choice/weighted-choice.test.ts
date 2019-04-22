import chooseAtRandom from "./weighted-choice";

describe("Weighted item choice", () => {
  const stubRecipe = (days: number) => ({
    id: `${Math.random()}`,
    ingredients: [],
    lastCooked: new Date(Math.floor(Math.random() * Date.now())),
    meals: days,
    name: `${Math.random()}`,
    source: `${Math.random()}`
  });

  it("picks items from the list", () => {
    const recipes = [stubRecipe(1), stubRecipe(1), stubRecipe(1)];

    const chosen = chooseAtRandom(() => 1, 5, recipes);
    chosen.forEach(r => expect(recipes).toContainEqual(r));
  });

  it("keeps picking when there are not enough items to choose from", () => {
    const recipes = [stubRecipe(1), stubRecipe(1), stubRecipe(1)];

    const chosen = chooseAtRandom(() => 1, 5, recipes);
    expect(chosen).toHaveLength(5);
  });

  it("doesn't fail when there are no items to pick from", () => {
    expect(chooseAtRandom(() => 1, 1, [])).toEqual([]);
  });

  it("doesn't fail when picking no items", () => {
    expect(chooseAtRandom(() => 1, 0, [stubRecipe(1)])).toEqual([]);
  });

  it("doesn't run into an infinite loop when there's nothing with length one", () => {
    const r1 = stubRecipe(4);
    expect(chooseAtRandom(() => 1, 2, [r1])).toEqual([r1]);
  });
});
