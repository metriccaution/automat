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
