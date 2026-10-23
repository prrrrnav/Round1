const { createRequestContext } = require('../middleware/request-context');
const { authenticateClient } = require('../middleware/authenticate-client');
const { validateInvoice } = require('../middleware/validate-invoice');
const { createInvoiceController } = require('../controllers/invoice-controller');
const { createLogger } = require('../utils/logger');

function createInvoiceRouter({ partnerTransport }) {
  async function createInvoice(request = {}) {
    const context = createRequestContext(request.headers);
    const authResult = authenticateClient(request.headers);
    if (!authResult.ok) return { status: authResult.status, body: { error: authResult.error, requestId: context.requestId }, logs: [] };

    const validationResult = validateInvoice(request.body);
    if (!validationResult.ok) return { status: validationResult.status, body: { error: validationResult.error, requestId: context.requestId }, logs: [] };

    const logs = [];
    const logger = createLogger((entry) => logs.push(entry));
    const result = await createInvoiceController({
      invoice: validationResult.value,
      context,
      partnerTransport,
      logger
    });
    return { ...result, logs };
  }
  return { createInvoice };
}
module.exports = { createInvoiceRouter };
