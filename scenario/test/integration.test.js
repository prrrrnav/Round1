const assert = require('node:assert/strict');

async function runPublicChecks(handleRequest, partnerTransport, check) {
  const request = {
    headers: { 'x-client-key': 'assessment-client-key', 'x-request-id': 'test-request-1' },
    body: { customerId: 'cus_1042', amount: 49.99 }
  };

  await check('accepts a valid customer request and reaches the partner', async () => {
    const result = await handleRequest(request, partnerTransport);
    assert.equal(result.upstream.request.path, '/v1/invoices');
    assert.notEqual(result.status, 401);
  });
  await check('sends partner authorization with the Bearer scheme', async () => {
    const result = await handleRequest(request, partnerTransport);
    assert.equal(result.upstream.request.headers.Authorization, 'Bearer demo-partner-token');
  });
  await check('maps invoice fields and returns the created invoice', async () => {
    const result = await handleRequest(request, partnerTransport);
    assert.equal(result.status, 201, result.body.error?.message);
    assert.equal(result.body.invoice.customer_id, 'cus_1042');
    assert.equal(result.body.invoice.amount_cents, 4999);
  });
}
module.exports = { runPublicChecks };
