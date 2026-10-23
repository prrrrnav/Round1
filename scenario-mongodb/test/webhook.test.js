const assert = require('node:assert/strict');

const sampleEvent = {
  eventId: 'evt_public_001',
  type: 'order.created',
  data: { orderId: 'ord_001', customerId: 'cus_001', amount: 12.5, currency: 'USD' }
};

async function runPublicChecks(handleRequest, createDependencies, check) {
  const headers = { 'x-webhook-secret': 'whsec_assessment', 'x-request-id': 'req-visible-1' };

  await check('accepts and persists a valid order.created event', async () => {
    const dependencies = createDependencies();
    const result = await handleRequest({ headers, body: sampleEvent }, dependencies);
    assert.equal(result.status, 202);
    assert.equal(result.body.accepted, true);
    assert.equal(dependencies.db.snapshot().webhook_events.length, 1);
    assert.equal(dependencies.db.snapshot().webhook_events[0].amountCents, 1250);
  });

  await check('acknowledges a repeated event without inserting a second document', async () => {
    const dependencies = createDependencies();
    await handleRequest({ headers, body: sampleEvent }, dependencies);
    const retry = await handleRequest({ headers: { ...headers, 'x-request-id': 'req-visible-retry' }, body: sampleEvent }, dependencies);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.duplicate, true);
    assert.equal(dependencies.db.snapshot().webhook_events.length, 1);
  });

  await check('rejects invalid event payloads before writing to MongoDB', async () => {
    const dependencies = createDependencies();
    const result = await handleRequest({ headers, body: { ...sampleEvent, data: { ...sampleEvent.data, amount: -4 } } }, dependencies);
    assert.equal(result.status, 400);
    assert.equal(dependencies.db.snapshot().webhook_events?.length || 0, 0);
  });

  await check('rejects an invalid webhook secret without touching MongoDB', async () => {
    const dependencies = createDependencies();
    const result = await handleRequest({ headers: { ...headers, 'x-webhook-secret': 'wrong-secret' }, body: sampleEvent }, dependencies);
    assert.equal(result.status, 401);
    assert.equal(dependencies.db.snapshot().webhook_events?.length || 0, 0);
  });
}

module.exports = { runPublicChecks };
