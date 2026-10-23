const { submitInvoice } = require('../services/invoice-service');

async function createInvoiceController({ invoice, context, partnerTransport, logger }) {
  return submitInvoice({ invoice, context, partnerTransport, logger });
}
module.exports = { createInvoiceController };
