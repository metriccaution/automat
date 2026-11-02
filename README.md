# Automat

My food planning toolkit. A small, self-hosted web app that keeps the
[Todoist](https://todoist.com) _Cooking_ and _Groceries_ projects topped up
with meals and shopping, from meals built out of the
[recipe book](https://metriccaution.github.io/recipe-book/).

Every day (03:00 by default) it closes past cooking tasks, expires old
shopping, and plans enough meals to fill the next week. In the web app you can
also:

- run planning, cleanup or a recipe refresh on demand, and pause the
  scheduler while you're on holiday
- add, edit, disable and delete meals
- push a single meal to Todoist for a chosen date
- see what was planned, every run, and per-meal statistics

See [the spec](docs/web-app-spec.md) for the full design.

## Security

**Automat has no login.** It's meant to be reachable only on your LAN or VPN.
Don't expose it to the internet.

To stop other web pages in the same browser from using it, Automat only
answers requests addressed to a host in `ALLOWED_HOSTS`, and rejects form
posts from other origins.

## Running it

You'll need a Todoist [API token](https://app.todoist.com/app/settings/integrations/developer).

### With Docker

```bash
echo "TODOIST_TOKEN=abc123" > .env
docker compose up -d
```

Then open <http://localhost:3000>. To use it from other devices, add the
server's hostname or IP to `ALLOWED_HOSTS` in `docker-compose.yml`.

The database lives in `./data`. **Back this directory up**: it's the only copy
of your meals. A fresh install starts with an empty meals list.

### Locally

Needs Node 24.

```bash
npm install
npm run build:css
TODOIST_TOKEN=abc123 npm start
```

### Configuration

All configuration is through environment variables:

| Variable        | Default                                                 | Notes                                                      |
| --------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| `TODOIST_TOKEN` | **required**                                            |                                                            |
| `DB_PATH`       | `./data/automat.sqlite`                                 | Must be in a mounted directory, not a single-file mount    |
| `PORT`          | `3000`                                                  |                                                            |
| `TZ`            | `Europe/London`                                         | All calendar dates and the schedule use this               |
| `RECIPES_URL`   | `https://metriccaution.github.io/recipe-book/repo.json` |                                                            |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1`                                   | Comma-separated hostnames or IPs Automat can be reached at |

Everything else (schedule time, days to plan, freezing, the history window) is
on the Settings page.

## Developing

```bash
npm run dev          # compile the CSS, then run with --watch
npm test             # prettier, type-check and tests
npm run build:icons  # redraw the favicon and app icons after changing them
```

The UI uses [GOV.UK Frontend](https://frontend.design-system.service.gov.uk/)
for its components (not the GOV.UK brand), server-rendered with Hono and
enhanced with htmx. Every page works without JavaScript, and nothing is loaded
from a CDN.
