/*
 * Utilities for building a Todoist query string
 */

interface BaseFilter<T extends string> {
  filterType: T;
}

export interface NotFilter extends BaseFilter<"not"> {
  filter: FilterComponent;
}

export interface AndFilter extends BaseFilter<"and"> {
  filters: FilterComponent[];
}

export interface OrFilter extends BaseFilter<"or"> {
  filters: FilterComponent[];
}

export interface ValueFilter extends BaseFilter<"value"> {
  text: string;
}

export type FilterComponent = NotFilter | AndFilter | OrFilter | ValueFilter;

const valueFilter = (text: string): ValueFilter => ({
  filterType: "value",
  text,
});

/**
 * Utilities for building various query strings
 */
export const filters = {
  /*
   * Combinations
   */
  not: (filter: FilterComponent): NotFilter => ({
    filterType: "not",
    filter,
  }),
  and: (...filters: FilterComponent[]): AndFilter => ({
    filterType: "and",
    filters,
  }),
  or: (...filters: FilterComponent[]): OrFilter => ({
    filterType: "or",
    filters,
  }),
  /*
   * Text search
   */
  search: (term: string) => valueFilter(`search: ${term}`),
  /*
   * Due date
   */
  dueOn: (dueDate: string) => valueFilter(dueDate),
  dueBefore: (dueDate: string) => valueFilter(`due before: ${dueDate}`),
  dueAfter: (dueDate: string) => valueFilter(`due after: ${dueDate}`),
  noDate: () => valueFilter(`no date`),
  overdue: () => valueFilter(`overdue`),
  /*
   * Created date
   */
  createdOn: (createdDate: string) => valueFilter(`created ${createdDate}`),
  createdBefore: (createdDate: string) =>
    valueFilter(`created before: ${createdDate}`),
  createdAfter: (createdDate: string) =>
    valueFilter(`created after: ${createdDate}`),
  /*
   * Priorities
   */
  priorityOne: () => valueFilter(`p1`),
  priorityTwo: () => valueFilter(`p1`),
  priorityThree: () => valueFilter(`p1`),
  noPriority: () => valueFilter(`No priority`),
  /**
   * Labelling
   */
  withLabel: (label: string) => valueFilter(`@${label}`),
  noLabel: () => valueFilter("no labels"),
  /*
   * Projects
   */
  project: (project: string) => valueFilter(`##${project}`),
  projectWithoutSubs: (project: string) => valueFilter(`#${project}`),
  inSection: (section: string) => valueFilter(`/${section}`),
  /*
   * Collaboration
   */
  assignedTo: (name: string) => valueFilter(`assigned to: ${name}`),
  assignedBy: (name: string) => valueFilter(`assigned by: ${name}`),
  assigned: () => valueFilter("assigned"),
  shared: () => valueFilter("shared"),
};

/**
 * Turn a filter object into the filter strings that todoist can consume
 */
export const toFilter = (filter: FilterComponent): string => {
  switch (filter.filterType) {
    case "not":
      return `!(${toFilter(filter.filter)})`;
    case "and":
      return `(${filter.filters.map((f) => toFilter(f)).join(" & ")})`;
    case "or":
      return `(${filter.filters.map((f) => toFilter(f)).join(" | ")})`;
    case "value":
      return filter.text;
  }
};
