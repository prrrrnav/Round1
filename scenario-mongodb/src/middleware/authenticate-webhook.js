const EXPECTED_WEBHOOK_SECRET = 'whsec_assessment';

function authenticateWebhook(headers = {}) {
  const secret = headers['x-webhook-secret'] || headers['X-Webhook-Secret'];
  if (secret !== EXPECTED_WEBHOOK_SECRET) {
    return {
      ok: false,
      status: 401,
      error: { code: 'INVALID_WEBHOOK_SECRET', message: 'The webhook secret is missing or invalid.' }
    };
  }
  return { ok: true };
}

module.exports = { authenticateWebhook };
