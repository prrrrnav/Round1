function validateOrderEvent(body = {}) {
  if (typeof body.eventId !== 'string' || !body.eventId.trim()) {
    return { ok: false, status: 400, error: { code: 'INVALID_EVENT_ID', message: 'eventId must be a non-empty string.' } };
  }
  if (body.type !== 'order.created') {
    return { ok: false, status: 400, error: { code: 'UNSUPPORTED_EVENT_TYPE', message: 'Only order.created events are supported.' } };
  }

  const data = body.data || {};
  if (typeof data.orderId !== 'string' || !data.orderId.trim()) {
    return { ok: false, status: 400, error: { code: 'INVALID_ORDER_ID', message: 'data.orderId must be a non-empty string.' } };
  }
  if (typeof data.customerId !== 'string' || !data.customerId.trim()) {
    return { ok: false, status: 400, error: { code: 'INVALID_CUSTOMER_ID', message: 'data.customerId must be a non-empty string.' } };
  }
  if (typeof data.amount !== 'number' || !Number.isFinite(data.amount) || data.amount <= 0) {
    return { ok: false, status: 400, error: { code: 'INVALID_AMOUNT', message: 'data.amount must be a positive number.' } };
  }
  if (data.currency !== 'USD') {
    return { ok: false, status: 400, error: { code: 'UNSUPPORTED_CURRENCY', message: 'Only USD order events are supported.' } };
  }

  return {
    ok: true,
    value: {
      eventId: body.eventId.trim(),
      type: body.type,
      orderId: data.orderId.trim(),
      customerId: data.customerId.trim(),
      amountCents: Math.round(data.amount * 100),
      currency: data.currency
    }
  };
}

module.exports = { validateOrderEvent };
