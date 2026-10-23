const { createPartnerRequest } = require('./partner-client');

async function submitInvoice({ invoice, context, partnerTransport, logger }) {
  const partnerRequest = createPartnerRequest({
    ...invoice,
    requestId: context.requestId
  });
  logger.info('partner.request', {
    requestId: context.requestId,
    method: partnerRequest.method,
    path: partnerRequest.path
  });

  const upstream = await partnerTransport(partnerRequest);
  const durationMs = Date.now() - context.startedAt;

  if (upstream.status >= 400) {
    logger.error('partner.response.error', {
      requestId: context.requestId,
      status: upstream.status,
      code: upstream.body.code,
      durationMs
    });
    return {
      status: upstream.status,
      body: { error: upstream.body, requestId: context.requestId },
      upstream
    };
  }

  logger.info('partner.response.success', {
    requestId: context.requestId,
    status: upstream.status,
    invoiceId: upstream.body.invoiceId,
    durationMs
  });
  return {
    status: upstream.status,
    body: { invoice: upstream.body, requestId: context.requestId },
    upstream
  };
}
module.exports = { submitInvoice };
