/*
 * There's no type definitions for airtable - And its quite an in-depth job to
 * write them.
 */

const Airtable = require("airtable");

module.exports = {
  getTable,
  updateRecord
};

async function getTable({ apiKey, baseId, tableName, view, fields }) {
  const airtable = new Airtable({
    apiKey: apiKey
  });

  const recipesBase = airtable.base(baseId);

  const allRecipes = await recipesBase(tableName)
    .select({ view, fields })
    .all();

  return allRecipes.map(f => Object.assign({}, f.fields, { id: f.id }));
}

async function updateRecord({ apiKey, baseId, id, newRecord, tableName }) {
  const airtable = new Airtable({
    apiKey: apiKey
  });

  await airtable
    .base(baseId)(tableName)
    .update(id, newRecord);
}
