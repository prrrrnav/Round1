// The assessment injects an offline adapter here. A deployed application can
// inject client.db('order_webhook') from the official MongoClient driver; both
// objects expose the MongoDB database.collection() interface used downstream.
function getDatabase(injectedDatabase) {
  if (!injectedDatabase || typeof injectedDatabase.collection !== 'function') {
    throw new Error('A MongoDB database connection must be provided to the application.');
  }
  return injectedDatabase;
}

module.exports = { getDatabase };
