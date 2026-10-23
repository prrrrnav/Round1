function createEventRepository(db) {
  const collection = db.collection('webhook_events');

  async function findByEventId(eventId) {
    // Provider event IDs are the stable idempotency key across retry attempts.
    return collection.findOne({ event_id: eventId });
  }

  async function insertEvent(event) {
    return collection.insertOne(event);
  }

  return { findByEventId, insertEvent };
}

module.exports = { createEventRepository };
