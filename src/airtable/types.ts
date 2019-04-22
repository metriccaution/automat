import { Logger } from "pino";

/**
 * The details needed to make a request to the Airtable API to fetch recipes
 */
export interface AirtableConfig {
  apiKey: string;
  baseId: string;
  tableName: string;
  logger: Logger;
}

/**
 * The data that Airtable throws back to us.
 */
export interface AirtableRow {
  id: string;
  Name: string;
  Meals: number;
  Ingredients: string;
  Source: string;
  "Last cooked"?: string;
}
