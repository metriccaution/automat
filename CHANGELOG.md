# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Basic functionality
- Web app: run planning, cleanup and recipe refreshes on demand, pause the
  scheduler, edit meals, push a meal to Todoist, and see history and stats
- Meals, history, runs, settings and the recipe cache stored in one SQLite
  database
- Per-meal "enabled" and "freezable" flags

### Changed

- Migrated to Bun, then back to Node
- Planning runs in-process on a schedule (03:00 by default) instead of cron,
  catching up once after downtime
- Meals with a missing recipe are skipped instead of failing the whole run
- Planning counts distinct days, so two meals on one day count once
- Cooking tasks are written before shopping, so a retry never double-books
- One shopping list function for planning, pushes and the preview, which maps
  ingredient synonyms
- Configuration is through environment variables

### Deprecated

### Removed

- The `npm run plan` CLI, `config.json` and the `add-singles` command
- The `meals/` YAML files, now that they've been imported into the database
- Migrated from Airtable to a local file (not currently included)
- Custom Todiost client

### Fixed

- Dates are worked out in `TZ`, so runs near midnight are no longer a day out

### Security
