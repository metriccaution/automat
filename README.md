# Automat

My food planning toolkit - Takes a recipe / meals file (currently not included), and transforms it into [Todoist](https://todoist.com) tasks for both daily cooking tasks, and a shopping list.

## Using it

To use Automat, you'll first need to run set up the external services, and then, the code.

### Set up Todoist

This should be pretty simple:

- Grab the [API token](https://app.todoist.com/app/settings/integrations/developer)

### Building the Code

```bash
bun install
```

### Configuration File

Currently, there's just one option:

```json
{
  "todoistToken": "abc123"
}
```

### Actually Running

```bash
bun run plan
```
