function createMongoDatabase() {
  const documents = new Map();
  const uniqueIndexes = new Map();
  const logs = [];

  function log(operation, collectionName, details = '') {
    logs.push('[mongodb] ' + operation + ' ' + collectionName + (details ? ' ' + details : ''));
  }
  function collection(name) {
    if (!documents.has(name)) documents.set(name, []);
    if (!uniqueIndexes.has(name)) uniqueIndexes.set(name, []);
    const rows = documents.get(name);
    const matches = (document, filter) => Object.entries(filter || {}).every(([key, value]) => document[key] === value);
    return {
      async createIndex(specification, options = {}) {
        const uniqueField = Object.keys(specification)[0];
        if (options.unique && !uniqueIndexes.get(name).includes(uniqueField)) uniqueIndexes.get(name).push(uniqueField);
        const indexName = Object.entries(specification).map(([key, direction]) => key + '_' + direction).join('_');
        log('createIndex', name, indexName + (options.unique ? ' unique' : ''));
        return indexName;
      },
      async findOne(filter) {
        const result = rows.find((row) => matches(row, filter)) || null;
        log('findOne', name, 'filter=' + JSON.stringify(filter) + ' ' + (result ? 'hit' : 'miss'));
        return result ? structuredClone(result) : null;
      },
      async insertOne(document) {
        for (const field of uniqueIndexes.get(name)) {
          if (rows.some((row) => row[field] === document[field])) {
            log('insertOne', name, 'E11000 duplicate key on ' + field);
            const error = new Error('E11000 duplicate key error collection: order_webhook.' + name + ' index: ' + field + '_1 dup key');
            error.code = 11000;
            throw error;
          }
        }
        const insertedId = document._id || 'mongo_' + String(rows.length + 1).padStart(4, '0');
        rows.push({ ...structuredClone(document), _id: insertedId });
        log('insertOne', name, 'insertedId=' + insertedId);
        return { acknowledged: true, insertedId };
      },
      async countDocuments(filter = {}) {
        return rows.filter((row) => matches(row, filter)).length;
      }
    };
  }
  return {
    collection,
    logs,
    reset() { documents.clear(); uniqueIndexes.clear(); logs.length = 0; },
    snapshot() { return Object.fromEntries(Array.from(documents, ([name, rows]) => [name, structuredClone(rows)])); }
  };
}

module.exports = { createMongoDatabase };
