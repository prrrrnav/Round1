const path = require('node:path');

const questions = [
  {
    id: 'customer-integration',
    title: 'Customer API Integration Debugging',
    level: 'Intermediate',
    category: 'API integration · Node.js',
    summary: 'Invoices are failing between a customer service and its billing partner.',
    reportTitle: 'Invoices are not reaching the billing partner',
    report: [
      'A customer says invoice sync started failing after their integration was updated. Their dashboard shows failed requests, but no invoices were created.',
      'Reproduce the request in the browser. Inspect the HTTP status and partner logs, then trace the adapter across routes, middleware, controllers, and services.',
      'After the fix, verify a successful response and write a short customer update that explains the cause and resolution in plain language.'
    ],
    tip: 'A 401 points to authentication. Once that is fixed, check whether a 400 response names a field the partner could not validate.',
    browserHint: 'Try: 401 authentication → 400 payload → 201 created',
    workspaceName: 'partner-billing',
    root: path.join(__dirname, '..', '..', 'scenario'),
    browser: {
      path: '/invoices',
      headers: [{ name: 'X-Client-Key', value: 'assessment-client-key', editable: true }, { name: 'X-Request-Id', value: 'req-browser-001' }, { name: 'Content-Type', value: 'application/json' }],
      body: { customerId: 'cus_1042', amount: 49.99 }
    },
    files: [
      ['README.md', false], ['docs/partner-api.md', false], ['src/app.js', true],
      ['src/controllers/invoice-controller.js', true], ['src/middleware/authenticate-client.js', true],
      ['src/middleware/request-context.js', true], ['src/middleware/validate-invoice.js', true],
      ['src/routes/invoice-routes.js', true], ['src/services/invoice-service.js', true],
      ['src/services/partner-client.js', true], ['src/services/token-provider.js', true],
      ['src/utils/logger.js', true], ['test/integration.test.js', false]
    ]
  },
  {
    id: 'mongo-webhook',
    title: 'MongoDB Webhook Reliability',
    level: 'Advanced',
    category: 'Webhooks · MongoDB · Node.js',
    summary: 'An order webhook returns HTTP 500 when the delivery provider retries an event.',
    reportTitle: 'Order updates fail when webhook deliveries are retried',
    report: [
      'A customer reports that their order system retries webhook deliveries after a timeout. The first delivery appears to process, but retries return HTTP 500 and support cannot confirm whether the order was stored once or multiple times.',
      'Reproduce a delivery and retry with the same event ID. Follow the request through authentication, validation, the service, and the MongoDB repository. Inspect database operation logs and the documented event schema.',
      'Fix the persistence behavior without weakening the unique index. Verify retries are idempotent, invalid events do not write data, and explain the change clearly to the customer.'
    ],
    tip: 'A duplicate-key error (MongoDB code 11000) often means the unique index is doing its job. Compare the query filter and stored document fields before changing the index.',
    browserHint: 'Send the same event ID twice; each delivery should be acknowledged safely.',
    workspaceName: 'order-webhook',
    root: path.join(__dirname, '..', '..', 'scenario-mongodb'),
    browser: {
      path: '/webhooks/orders',
      headers: [{ name: 'X-Webhook-Secret', value: 'whsec_assessment', editable: true }, { name: 'X-Request-Id', value: 'req-webhook-001' }, { name: 'Content-Type', value: 'application/json' }],
      body: { eventId: 'evt_8f31', type: 'order.created', data: { orderId: 'ord_2048', customerId: 'cus_1042', amount: 84.5, currency: 'USD' } }
    },
    files: [
      ['README.md', false], ['docs/webhook-contract.md', false], ['docs/mongodb-runbook.md', false],
      ['src/app.js', true], ['src/controllers/webhook-controller.js', true],
      ['src/middleware/authenticate-webhook.js', true], ['src/middleware/request-context.js', true],
      ['src/middleware/validate-event.js', true], ['src/routes/webhook-routes.js', true],
      ['src/services/webhook-service.js', true], ['src/repositories/event-repository.js', true],
      ['src/database/indexes.js', true], ['src/database/connection.js', true],
      ['src/utils/logger.js', true], ['test/webhook.test.js', false]
    ]
  }
].map((question) => ({
  ...question,
  files: question.files.map(([filePath, editable]) => ({ path: filePath, editable }))
}));

function getQuestions() {
  return questions.map(({ id, title, level, category, summary }) => ({ id, title, level, category, summary }));
}
function getQuestion(id) {
  return questions.find((question) => question.id === id) || null;
}

module.exports = { getQuestions, getQuestion };
