/*
 * The raw API calls for Todoist
 */
import axios from "axios";
import { removeTime } from "../date-utils";

/*
 * Data models
 */
export interface TodoistProject {
  id: number;
  name: string;
  order: number;
  indent: number;
  comment_count: 0;
}

export interface TodoistTask {
  id: number;
  name: string;
  due?: {
    recurring: boolean;
    string: string;
    date: string;
    datetime: string;
    timezone: string;
  };
}

export interface TodoistCreate<T> {
  retryId: string;
  content: T;
}

export interface TodoistNewTask {
  content: string;
  project_id?: number;
  due_date?: string;
  order?: number;
}

/*
 * API docs
 */

export interface TodoistConfig {
  apiKey: string;
}

/**
 * The raw Todoist API - Method call === HTTP Request
 */
export interface TodoistApi {
  listProjects: () => Promise<TodoistProject[]>;
  getTasks: (projectId: number) => Promise<TodoistTask[]>;
  createTask: (task: TodoistCreate<TodoistNewTask>) => Promise<void>;
}

export function createApi(config: TodoistConfig): TodoistApi {
  const client = axios.create({
    baseURL: "https://api.todoist.com/rest/v1",
    headers: { Authorization: `Bearer ${config.apiKey}` }
  });

  const listProjects = async () =>
    client.get("/projects").then(d => d.data as TodoistProject[]);

  const getTasks = async (projectId: number) => {
    const response = await client.get(`/tasks?project_id=${projectId}`);
    return response.data as TodoistTask[];
  };

  const createTask = async (task: TodoistCreate<TodoistNewTask>) => {
    await client.post("/tasks", task.content, {
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": task.retryId
      }
    });
  };

  return {
    createTask,
    getTasks,
    listProjects
  };
}

/*
 * API Utilities
 */

/**
 * Get a named project from the API - Throws up if it can't uniquely identify
 * the project
 */
export async function namedProject(
  api: TodoistApi,
  name: string
): Promise<TodoistProject> {
  const allProjects = await api.listProjects();
  const project = allProjects.filter(p => p.name === name);

  if (project.length === 0) {
    throw new Error(`No project in Todoist with name ${name}`);
  } else if (project.length > 1) {
    throw new Error(`${project.length} projects in Todoist with name ${name}`);
  }

  return project[0];
}

/**
 * Put a date string into the Todoist format
 */
export function formatDate(date: Date): string {
  function leftPad(toPad: any, length: number) {
    const padChars = Math.max(0, length - ("" + toPad).length);
    return new Array(padChars).fill("0").join("") + toPad;
  }

  const dateParts = [
    leftPad(date.getUTCFullYear(), 4),
    leftPad(date.getUTCMonth() + 1, 2),
    leftPad(date.getUTCDate(), 2)
  ];

  return dateParts.join("-");
}

/**
 * Returns true when a task has a due date set
 */
export function taskHasDate(task: TodoistTask): boolean {
  return Boolean(task.due);
}

/**
 * Return the due date of a task - parsed into a JS date. Throws up when there
 * isn't a date
 */
export function getDueDate(task: TodoistTask): Date {
  if (!task.due || !task.due.date) {
    throw new Error(`No date on task - ${task.name}`);
  }

  const dateString = task.due.date;

  const parts = dateString
    .split("-")
    .map(p => parseInt(p, 10))
    .filter(d => !isNaN(d));

  if (parts.length !== 3) {
    throw new Error(`Couldn't parse date - ${dateString}`);
  }

  const [year, month, date] = parts;

  const parsed = new Date();
  parsed.setUTCFullYear(year);
  parsed.setUTCMonth(month - 1);
  parsed.setUTCDate(date);

  return removeTime(parsed);
}
