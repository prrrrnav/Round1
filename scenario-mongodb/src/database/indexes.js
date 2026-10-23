const initializedDatabases = new WeakMap();

async function ensureWebhookIndexes(db) {
  if (!initializedDatabases.has(db)) {
    const initialization = db.collection('webhook_events').createIndex(
      { eventId: 1 },
      { unique: true, name: 'eventId_unique' }
    );
    initializedDatabases.set(db, initialization);
  }
  return initializedDatabases.get(db);
}

module.exports = { ensureWebhookIndexes };
