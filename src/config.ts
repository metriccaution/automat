import * as convict from "convict";
import { existsSync } from "fs";
import { resolve } from "path";

export const config = convict({
  airtable: {
    apiKey: {
      arg: "airtable-key",
      default: "",
      doc: "The API key for accessing Airtable",
      env: "AIRTABLE_KEY",
      sensitive: true
    },
    baseId: {
      arg: "airtable-base",
      default: "",
      doc: "The ID of the Airtable base to pull from",
      env: "AIRTABLE_BASE"
    },
    tableName: {
      arg: "airtable-table",
      default: "Recipes",
      doc: "The name of the table within the base to pull recipes from",
      env: "AIRTABLE_TABLE"
    }
  },
  configFile: {
    arg: "config",
    default: resolve(process.cwd(), "config.json"),
    doc: "A file on disk to specify more config",
    env: "CONFIG_FILE"
  },
  recipeChoice: {
    days: {
      arg: "days",
      default: 10,
      doc: "How many days to pick food for",
      env: "AUTOMAT_DAYS"
    }
  },
  todoist: {
    apiKey: {
      arg: "todoist-key",
      default: "",
      env: "TODOIST_KEY",
      sensitive: true
    },
    projects: {
      cooking: {
        arg: "cooking-project",
        default: "Cooking",
        doc: "The name of the project to put cooking in",
        env: "COOKING_PROJECT"
      },
      shopping: {
        arg: "shopping-project",
        default: "Groceries",
        doc: "The name of the project to put cooking in",
        env: "SHOPPING_PROJECT"
      }
    }
  }
});

config.validate();

const file = config.get().configFile;
if (file && existsSync(file)) {
  config.loadFile(file);
}

config.validate();
