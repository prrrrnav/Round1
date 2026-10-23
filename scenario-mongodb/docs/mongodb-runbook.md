# MongoDB operations runbook

The `webhook_events` collection stores one immutable record per provider event:

```js
{
  _id: ObjectId,
  eventId: 'evt_8f31',       // stable provider idempotency key
  type: 'order.created',
  orderId: 'ord_2048',
  customerId: 'cus_1042',
  amountCents: 8450,
  currency: 'USD',
  requestId: 'req-webhook-001', // delivery attempt that first persisted it
  receivedAt: ISODate(...)
}
```

## Required index

```js
db.webhook_events.createIndex({ eventId: 1 }, { unique: true, name: 'eventId_unique' });
```

The unique index protects against two provider retries arriving concurrently. A duplicate-key response is expected at the storage boundary in a race; application logic should resolve the existing event or treat that duplicate as an idempotent acknowledgement. Do not remove the unique constraint to hide an application bug.

## Useful investigations

```js
db.webhook_events.findOne({ eventId: 'evt_8f31' });
db.webhook_events.countDocuments({ eventId: 'evt_8f31' });
db.webhook_events.getIndexes();
```

Compare field names exactly. MongoDB field names are case-sensitive; `eventId`, `event_id`, and `EventId` are different keys. Check the query filter, inserted document, index key, and response behavior together. The local adapter emits a log line for each collection operation and simulates the declared unique index.

## Native Node.js driver connection shape

In a deployed service, `database/connection.js` would create and retain a `MongoClient`, then inject `client.db('order_webhook')` into the repository layer:

```js
const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db('order_webhook');
const events = db.collection('webhook_events');
const existing = await events.findOne({ eventId: 'evt_8f31' });
```

The assessment injects its offline adapter at this connection boundary. Repository code still uses the same `db.collection(...).findOne(...)` and `insertOne(...)` operations as the native MongoDB driver.
