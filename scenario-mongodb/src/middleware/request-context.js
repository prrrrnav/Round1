function createRequestContext(headers = {}) {
  const requestId = headers['x-request-id'] || headers['X-Request-Id'] || 'req-' + Date.now();
  return { requestId, startedAt: Date.now() };
}

module.exports = { createRequestContext };
