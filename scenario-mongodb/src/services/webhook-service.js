const { ensureWebhookIndexes } = require('../database/indexes');
const { createEventRepository } = require('../repositories/event-repository');

async function processOrderEvent({ event, context, db, logger }) {
  const startedAt = Date.now();
  await ensureWebhookIndexes(db);
  const repository = createEventRepository(db);
  const existingEvent = await repository.findByEventId(event.eventId);

  if (existingEvent) {
    logger.info('webhook.delivery.duplicate', { requestId: context.requestId, eventId: event.eventId });
    return {
      status: 200,
      body: { accepted: true, duplicate: true, eventId: existingEvent.eventId, requestId: context.requestId },
      logs: []
    };
  }

  const result = await repository.insertEvent({
    ...event,
    requestId: context.requestId,
    receivedAt: new Date().toISOString()
  });
  logger.info('webhook.delivery.accepted', {
    requestId: context.requestId,
    eventId: event.eventId,
    documentId: result.insertedId,
    durationMs: Date.now() - startedAt
  });
  return {
    status: 202,
    body: { accepted: true, duplicate: false, eventId: event.eventId, documentId: result.insertedId, requestId: context.requestId },
    logs: []
  };
}

module.exports = { processOrderEvent };
