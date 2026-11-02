/**
 * Test doubles shared by the test suites.
 */
import type { TodoistApi } from "@doist/todoist-sdk";
import type { DatabaseSync } from "node:sqlite";
import type { Repo } from "../data/web.ts";
import { openDb } from "../db/index.ts";
import { writeRecipeCache } from "../db/recipe-cache.ts";
import { RecipeBook } from "../recipes/book.ts";
import { Services } from "../services/index.ts";
import { Runner } from "../services/runner.ts";

export const TEST_RECIPES_URL = "https://recipes.test/repo.json";

const recipe = (
  title: string,
  ingredients: Array<[string, string]>,
): Repo["recipes"][number] => ({
  identifier: title.toLowerCase().replace(/\W+/g, "-"),
  title,
  slug: title.toLowerCase().replace(/\W+/g, "-"),
  section: "Mains",
  ingredients: [
    {
      ingredients: ingredients.map(([ingredient, quantity]) => ({
        ingredient,
        quantity,
      })),
    },
  ],
});

export const testRepo: Repo = {
  ingredients: [
    {
      name: "Onion",
      synonyms: ["Onions"],
      measure: "count",
      include_in_shopping: true,
    },
    {
      name: "Salt",
      synonyms: [],
      measure: "pinch",
      include_in_shopping: false,
    },
    {
      name: "Pepper",
      synonyms: [],
      measure: "pinch",
      include_in_shopping: false,
    },
    {
      name: "Butter Beans",
      synonyms: ["Lima Beans"],
      measure: "g",
      include_in_shopping: true,
    },
    { name: "Rice", synonyms: [], measure: "g", include_in_shopping: true },
    {
      name: "Bread",
      synonyms: [],
      measure: "count",
      include_in_shopping: true,
    },
  ],
  recipes: [
    recipe("Bean Stew", [
      ["Onions", "2"],
      ["Lima Beans", "400g"],
      ["Salt / Pepper", "pinch"],
    ]),
    recipe("Rice Bowl", [
      ["Rice", "200g"],
      ["Onion", "1"],
    ]),
    recipe("Soup", [
      ["Onion", "1"],
      ["Mystery Root", "1"],
    ]),
  ],
};

/**
 * An in-memory database with a fresh recipe book.
 */
export function testDb(repo: Repo = testRepo): {
  db: DatabaseSync;
  recipeBook: RecipeBook;
} {
  const db = openDb(":memory:");
  const now = new Date().toISOString();
  writeRecipeCache(db, {
    url: TEST_RECIPES_URL,
    data: JSON.stringify(repo),
    etag: null,
    lastModified: null,
    fetchedAt: now,
    checkedAt: now,
  });
  return { db, recipeBook: new RecipeBook(db, TEST_RECIPES_URL) };
}

interface FakeTask {
  id: string;
  content: string;
  description: string;
  projectId: string;
  labels: string[];
  due: { date: string } | null;
  closed: boolean;
}

/**
 * Just enough of the Todoist API for the services. Queries are matched only
 * on their project; the services filter dates themselves too.
 */
export class FakeTodoist {
  tasks: FakeTask[] = [];
  projects = [
    { id: "p-cooking", name: "Cooking" },
    { id: "p-groceries", name: "Groceries" },
  ];
  labels = [{ name: "Automat" }];
  calls: string[] = [];
  /**
   * Throw from `addTask` when this returns true.
   */
  failAddTask: (args: { projectId?: string; content: string }) => boolean =
    () => false;
  #nextId = 1;

  addExisting(
    project: "Cooking" | "Groceries",
    content: string,
    date?: string,
  ) {
    this.tasks.push({
      id: `t${this.#nextId++}`,
      content,
      description: "",
      projectId: project === "Cooking" ? "p-cooking" : "p-groceries",
      labels: ["Automat"],
      due: date ? { date } : null,
      closed: false,
    });
  }

  open(project: "Cooking" | "Groceries") {
    const id = project === "Cooking" ? "p-cooking" : "p-groceries";
    return this.tasks.filter((t) => t.projectId === id && !t.closed);
  }

  get api(): TodoistApi {
    return {
      getTasksByFilter: async ({ query }: { query: string }) => {
        this.calls.push(`getTasksByFilter ${query}`);
        const project = query.includes("##Cooking") ? "Cooking" : "Groceries";
        return { results: this.open(project), nextCursor: null };
      },
      closeTask: async (id: string) => {
        this.calls.push(`closeTask ${id}`);
        this.tasks.find((t) => t.id === id)!.closed = true;
        return true;
      },
      updateTask: async (
        id: string,
        args: { content: string; description: string },
      ) => {
        this.calls.push(`updateTask ${id}`);
        Object.assign(
          this.tasks.find((t) => t.id === id)!,
          args,
        );
        return {};
      },
      addTask: async (args: {
        content: string;
        projectId: string;
        labels: string[];
        dueDate?: string;
        description?: string;
      }) => {
        if (this.failAddTask(args))
          throw new Error("HTTP 500: Todoist is down");
        const task: FakeTask = {
          id: `t${this.#nextId++}`,
          content: args.content,
          description: args.description ?? "",
          projectId: args.projectId,
          labels: args.labels,
          due: args.dueDate ? { date: args.dueDate } : null,
          closed: false,
        };
        this.calls.push(
          `addTask ${args.projectId === "p-cooking" ? "Cooking" : "Groceries"}`,
        );
        this.tasks.push(task);
        return task;
      },
      getLabels: async () => ({ results: this.labels, nextCursor: null }),
      addLabel: async ({ name }: { name: string }) => ({ name }),
      getProjects: async () => ({ results: this.projects, nextCursor: null }),
      addProject: async ({ name }: { name: string }) => ({ id: `p-${name}` }),
    } as unknown as TodoistApi;
  }
}

/**
 * Services wired to fakes, with a fixed "today".
 */
export function testServices(
  options: { today?: string; repo?: Repo; timeoutMs?: number } = {},
) {
  const { db, recipeBook } = testDb(options.repo);
  const todoist = new FakeTodoist();
  const runner = new Runner(db, { timeoutMs: options.timeoutMs });
  const today = options.today ?? "2026-11-02";
  const services = new Services(
    { db, recipeBook, todoist: () => todoist.api, today: () => today },
    runner,
  );
  return { db, recipeBook, todoist, runner, services, today };
}
