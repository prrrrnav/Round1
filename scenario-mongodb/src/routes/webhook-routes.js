const { createRequestContext } = require('../middleware/request-context');
const { authenticateWebhook } = require('../middleware/authenticate-webhook');
const { validateOrderEvent } = require('../middleware/validate-event');
const { createWebhookController } = require('../controllers/webhook-controller');

function createWebhookRoutes({ db, logger }) {
  async function receiveOrderEvent(request = {}) {
    const context = createRequestContext(request.headers);
    const auth = authenticateWebhook(request.headers);
    if (!auth.ok) {
      return { status: auth.status, body: { error: auth.error, requestId: context.requestId }, logs: [] };
    }

    const validation = validateOrderEvent(request.body);
    if (!validation.ok) {
      return { status: validation.status, body: { error: validation.error, requestId: context.requestId }, logs: [] };
    }

    try {
      return await createWebhookController({
        event: validation.value,
        context,
        db,
        logger
      });
    } catch (error) {
      logger.error('webhook.processing.failed', {
        requestId: context.requestId,
        eventId: validation.value.eventId,
        databaseCode: error.code || null,
        message: error.message
      });
      return {
        status: 500,
        body: { error: { code: 'WEBHOOK_PROCESSING_FAILED', message: 'The event could not be persisted.' }, requestId: context.requestId },
        logs: []
      };
    }
  }

  return { receiveOrderEvent };
}

module.exports = { createWebhookRoutes };
