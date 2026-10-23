const { getAccessToken } = require('./token-provider');

function createPartnerRequest({ customerId, amount, requestId }) {
  const accessToken = getAccessToken();
  console.log('Building Acme invoice request', { requestId, customerId });

  return {
    method: 'POST',
    path: '/v1/invoices',
    headers: {
      Authorization: accessToken,
      'Content-Type': 'application/json',
      'X-Request-Id': requestId
    },
    body: {
      customerId,
      amount_cents: Math.floor(amount * 100)
    }
  };
}
module.exports = { createPartnerRequest };
