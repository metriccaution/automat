import { countDaysWithFood, saveRecipes } from "./utils";

describe("Counting days with food", () => {
  it("Calls the expected API endpoints", async () => {
    const createTask = jest.fn();
    const listProjects = jest.fn().mockResolvedValue([
      {
        id: "correct-id",
        name: "ABC"
      },
      {
        id: "incorrect-id",
        name: "DEF"
      }
    ]);
    const getTasks = jest.fn().mockResolvedValue([]);

    await countDaysWithFood({
      api: {
        createTask,
        getTasks,
        listProjects
      },
      end: new Date(),
      projects: {
        cooking: "ABC"
      },
      start: new Date()
    });

    expect(createTask.mock.calls).toEqual([]);
    expect(listProjects.mock.calls).toEqual([[]]);
    expect(getTasks.mock.calls).toEqual([["correct-id"]]);
  });

  it("Fails when it can't find a project for food", async () => {
    const createTask = jest.fn();
    const listProjects = jest.fn().mockResolvedValue([
      {
        id: "incorrect-id",
        name: "DEF"
      }
    ]);
    const getTasks = jest.fn().mockResolvedValue([]);

    expect.assertions(1);
    try {
      await countDaysWithFood({
        api: {
          createTask,
          getTasks,
          listProjects
        },
        end: new Date(),
        projects: {
          cooking: "ABC"
        },
        start: new Date()
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("Fails when it finds multiple projects for food", async () => {
    const createTask = jest.fn();
    const listProjects = jest.fn().mockResolvedValue([
      {
        id: "correct-id",
        name: "ABC"
      },
      {
        id: "incorrect-id",
        name: "ABC"
      }
    ]);
    const getTasks = jest.fn().mockResolvedValue([]);

    expect.assertions(1);
    try {
      await countDaysWithFood({
        api: {
          createTask,
          getTasks,
          listProjects
        },
        end: new Date(),
        projects: {
          cooking: "ABC"
        },
        start: new Date()
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("Filters days down correctly", async () => {
    const createTask = jest.fn();
    const listProjects = jest.fn().mockResolvedValue([
      {
        id: "correct-id",
        name: "ABC"
      }
    ]);
    const getTasks = jest.fn().mockResolvedValue([
      {
        due: {
          date: "2019-01-01"
        }
      },
      {
        due: {
          date: "2019-01-10"
        }
      },
      {
        due: {
          date: "2019-01-05"
        }
      },
      {
        due: {
          date: "2018-01-01"
        }
      },
      {
        due: {
          date: "2019-02-01"
        }
      },
      {}
    ]);

    const count = await countDaysWithFood({
      api: {
        createTask,
        getTasks,
        listProjects
      },
      end: new Date("2019-01-10T00:00:00.000Z"),
      projects: {
        cooking: "ABC"
      },
      start: new Date("2019-01-01T00:00:00.000Z")
    });

    expect(count).toBe(3);
  });

  it("Accounts for duplicates on a single day", async () => {
    const createTask = jest.fn();
    const listProjects = jest.fn().mockResolvedValue([
      {
        id: "correct-id",
        name: "ABC"
      }
    ]);
    const getTasks = jest.fn().mockResolvedValue([
      {
        due: {
          date: "2019-01-01"
        }
      },
      {
        due: {
          date: "2019-01-01"
        }
      }
    ]);

    const count = await countDaysWithFood({
      api: {
        createTask,
        getTasks,
        listProjects
      },
      end: new Date("2019-01-10T00:00:00.000Z"),
      projects: {
        cooking: "ABC"
      },
      start: new Date("2019-01-01T00:00:00.000Z")
    });

    expect(count).toBe(1);
  });
});

describe("Creating tasks", () => {
  it("Creates no tasks when given no recipes", async () => {
    const createTask = jest.fn().mockResolvedValue(undefined);
    await saveRecipes({
      api: {
        createTask,
        getTasks: jest.fn().mockResolvedValue([]),
        listProjects: jest.fn().mockResolvedValue([
          {
            id: "cooking",
            name: "ABC"
          },
          {
            id: "shopping",
            name: "DEF"
          }
        ])
      },
      projects: {
        cooking: "ABC",
        shopping: "DEF"
      },
      recipes: [],
      start: new Date("2019-01-01T00:00:00.000Z")
    });

    expect(createTask.mock.calls).toEqual([]);
  });

  it("Creates tasks for cooking and shopping, skipping days with food already", async () => {
    const createTask = jest.fn().mockResolvedValue(undefined);
    await saveRecipes({
      api: {
        createTask,
        getTasks: jest.fn().mockResolvedValue([
          {
            due: {
              date: "2019-01-02"
            }
          }
        ]),
        listProjects: jest.fn().mockResolvedValue([
          {
            id: "cooking",
            name: "ABC"
          },
          {
            id: "shopping",
            name: "DEF"
          }
        ])
      },
      projects: {
        cooking: "ABC",
        shopping: "DEF"
      },
      recipes: [
        {
          ingredients: [
            {
              name: "c",
              quantity: "d"
            },
            {
              name: "a",
              quantity: "b"
            }
          ],
          meals: 2,
          name: "Recipe 1",
          source: "Book 1"
        },
        {
          ingredients: [
            {
              name: "e",
              quantity: "f"
            }
          ],
          meals: 3,
          name: "Recipe 2",
          source: "Book 2"
        }
      ],
      start: new Date("2019-01-01T00:00:00.000Z")
    });

    // Slightly nasty assertion as there's a random component in here
    createTask.mock.calls.forEach(args => expect(args).toHaveLength(1));
    createTask.mock.calls
      .map(args => args[0])
      .map(o => Object.keys(o))
      .forEach(k => expect(k).toEqual(["content", "retryId"]));
    expect(createTask.mock.calls.map(args => args[0].content)).toEqual([
      {
        content: "a - b",
        order: 0,
        project_id: "shopping"
      },
      {
        content: "c - d",
        order: 1,
        project_id: "shopping"
      },
      {
        content: "e - f",
        order: 2,
        project_id: "shopping"
      },
      {
        content: "Recipe 1 (Book 1)",
        due_date: "2019-01-01",
        project_id: "cooking"
      },
      {
        content: "Recipe 1 (Book 1)",
        due_date: "2019-01-03",
        project_id: "cooking"
      },
      {
        content: "Recipe 2 (Book 2)",
        due_date: "2019-01-04",
        project_id: "cooking"
      },
      {
        content: "Recipe 2 (Book 2)",
        due_date: "2019-01-05",
        project_id: "cooking"
      },
      {
        content: "Recipe 2 (Book 2)",
        due_date: "2019-01-06",
        project_id: "cooking"
      }
    ]);
  });
});
