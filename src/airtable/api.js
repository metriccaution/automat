/*
 * There's no type definitions for airtable - And its quite an in-depth job to
 * write them.
 */

const Airtable = require("airtable");

module.exports = {
  getTable
};

async function getTable({ apiKey, baseId, tableName, view, fields }) {
  const airtable = new Airtable({
    apiKey: apiKey
  });

  const recipesBase = airtable.base(baseId);

  const allRecipes = await recipesBase(tableName)
    .select({ view, fields })
    .all();

  return allRecipes.map(f => f.fields);
}
