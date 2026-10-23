const { createWebhookRoutes } = require('./routes/webhook-routes');
const { getDatabase } = require('./database/connection');
const { createLogger } = require('./utils/logger');

async function handleRequest(request, dependencies = {}) {
  const logs = [];
  const db = getDatabase(dependencies.db);
  const logger = createLogger((entry) => logs.push(entry));
  const routes = createWebhookRoutes({ db, logger });
  const result = await routes.receiveOrderEvent(request);
  return { ...result, logs: [...logs, ...(result.logs || [])] };
}

module.exports = { handleRequest };
