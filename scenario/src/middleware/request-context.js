function createRequestContext(headers = {}) {
  const suppliedId = headers['x-request-id'] || headers['X-Request-Id'];
  return {
    requestId: suppliedId || 'req-assessment-001',
    startedAt: Date.now(),
    receivedAt: new Date().toISOString()
  };
}
module.exports = { createRequestContext };
