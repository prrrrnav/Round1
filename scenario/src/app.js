const { createInvoiceRouter } = require('./routes/invoice-routes');

function handleRequest(request, partnerTransport) {
  const router = createInvoiceRouter({ partnerTransport });
  return router.createInvoice(request);
}
module.exports = { handleRequest };
