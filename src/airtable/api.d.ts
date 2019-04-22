/*
 * External type definitions - Airtable doesn't have type definitions, and it
 * has quite a wide ranging API compared to what I need.
 */

/**
 * A request to fetch an Airtable table
 */
export interface TableFetchConfig<T> {
  apiKey: string;
  baseId: string;
  tableName: string;
  view: string;
  fields: Array<keyof T>;
}

/**
 * Get the contents of the recipes table
 */
declare function getTable<T>(config: TableFetchConfig<T>): Promise<T[]>;

export interface RecordUpdateConfig<T> {
  apiKey: string;
  baseId: string;
  id: string;
  newRecord: T;
  tableName: string;
}

declare function updateRecord<T>(config: RecordUpdateConfig<T>): Promise<void>;
