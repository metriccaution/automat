# Automat

Glue code for turning an [Airtable](https://airtable.com/) recipe book into [Todoist](https://todoist.com) tasks for both daily cooking tasks, and a shopping list.

## Using it

To use Automat, you'll first need to run set up the external services, and then, the code.

### Set up Airtable

Setup here should be fairly simple:

- Grab the API key (https://airtable.com/account)
- Grab the base ID (https://airtable.com/api)
- Grab the table name within the base that contains the recipes

The table should have the columns:

| Name        | Type   | Description                                  | Use                                                                                                    |
| ----------- | ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Name        | Text   | The name of the recipe                       | Forms part of the cooking task name                                                                    |
| Meals       | Number | The number of days food the recipe will make | Used both for choosing how many recipes to choose for a time, and for how many cooking tasks to create |
| Ingredients | Text   | A new-line delimited list of ingredients     | Populates the shopping list                                                                            |
| Source      | Text   | Where the recipe is from                     | Forms part of the cooking task name                                                                    |

### Set up Todoist

Again, this should be pretty simple:

- Grab the API token (https://todoist.com/prefs/integrations)
- Create two projects, and grab their names - Its suggested, but not required that these are only used for Automat tasks
  - One for the daily cooking tasks to be put into
  - One for the shopping list

### Building the code

- Download the repo
- Run `npm install`
- Run `npm test`

## Configuration

There are a number of ways to configure Automat (based off [Convict](https://github.com/mozilla/node-convict)):

- Environment variables
- Command line arguments (e.g. `--config=other-config.json`)
- Config file

| Property                 | Required | Default         | Environment variable | Argument           | JSON Path                   |
| ------------------------ | -------- | --------------- | -------------------- | ------------------ | --------------------------- |
| Config file path         | no       | `./config.json` | `CONFIG_FILE`        | `config`           | N/A                         |
| Airtable API key         | yes      | N\A             | `AIRTABLE_KEY`       | `airtable-key`     | `airtable.apiKey`           |
| Airtable base ID         | yes      | N\A             | `AIRTABLE_BASE`      | `airtable-base`    | `airtable.baseId`           |
| Airtable table name      | no       | Recipes         | `AIRTABLE_TABLE`     | `airtable-table`   | `airtable.tableName`        |
| Todoist API key          | yes      | N\A             | `TODOIST_KEY`        | `todoist-key`      | `todoist.apiKey`            |
| Todoist cooking project  | no       | Cooking         | `COOKING_PROJECT`    | `cooking-project`  | `todoist.projects.cooking`  |
| Todoist shopping project | no       | Groceries       | `SHOPPING_PROJECT`   | `shopping-project` | `todoist.projects.shopping` |
| Days to pick food for    | no       | 10              | `AUTOMAT_DAYS`       | `days`             | `recipeChoice.days`         |
| Logger                   | no       | info            | `LOG_LEVEL`          | `log-level`        | `logger.level`              |

### Example config JSON file

```json
{
  "airtable": {
    "apiKey": "abc123",
    "baseId": "def456",
    "tableName": "Recipes"
  },
  "todoist": {
    "apiKey": "hij789",
    "projects": {
      "cooking": "Cooking",
      "shopping": "Groceries"
    }
  },
  "recipeChoice": {
    "days": 5
  }
}
```

## Running It

Once the config has been set up, then running the code is a matter of running

```bash
`npm start`
```
