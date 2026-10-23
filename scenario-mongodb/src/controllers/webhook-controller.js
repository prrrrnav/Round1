const { processOrderEvent } = require('../services/webhook-service');

async function createWebhookController({ event, context, db, logger }) {
  return processOrderEvent({ event, context, db, logger });
}

module.exports = { createWebhookController };
