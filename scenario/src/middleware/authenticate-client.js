const EXPECTED_CLIENT_KEY = 'assessment-client-key';

function authenticateClient(headers = {}) {
  const suppliedKey = headers['x-client-key'] || headers['X-Client-Key'];
  if (suppliedKey !== EXPECTED_CLIENT_KEY) {
    return {
      ok: false,
      status: 401,
      error: {
        code: 'CLIENT_UNAUTHORIZED',
        message: 'A valid X-Client-Key is required.'
      }
    };
  }
  return { ok: true, clientId: 'candidate-customer' };
}
module.exports = { authenticateClient };
