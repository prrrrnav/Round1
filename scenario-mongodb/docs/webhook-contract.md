# Order event webhook contract

The provider sends `POST /webhooks/orders` with a JSON body and these headers:

| Header | Requirement |
| --- | --- |
| `X-Webhook-Secret` | Must equal the configured endpoint secret. |
| `X-Request-Id` | Identifies one HTTP delivery attempt; retries get a new request ID. |
| `Content-Type` | `application/json`. |

Example event:

```json
{
  "eventId": "evt_8f31",
  "type": "order.created",
  "data": {
    "orderId": "ord_2048",
    "customerId": "cus_1042",
    "amount": 84.5,
    "currency": "USD"
  }
}
```

`eventId` is stable across retry attempts. `X-Request-Id` is not. Store each event once using `eventId` as the idempotency key. The endpoint may return `202 Accepted` for a newly persisted event and `200 OK` when an already-persisted event is received again. Both responses tell the provider it can stop retrying.

Return `401` when the secret is missing or invalid, `400` when the event is malformed, and `500` only for unexpected persistence or processing failures. Do not acknowledge a failed write. Keep the MongoDB unique index on `eventId`; it is the final guard against concurrent duplicate deliveries. A duplicate-key error has MongoDB error code `11000`.

Log the request ID, event ID, outcome, and database error code. Never log the webhook secret or full customer payload.
