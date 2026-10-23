function validateInvoice(body = {}) {
  const customerId = body.customerId;
  const amount = body.amount;

  if (typeof customerId !== 'string' || customerId.trim().length === 0) {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_CUSTOMER_ID', message: 'customerId must be a non-empty string.' }
    };
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_AMOUNT', message: 'amount must be a positive number.' }
    };
  }
  return { ok: true, value: { customerId: customerId.trim(), amount } };
}
module.exports = { validateInvoice };
