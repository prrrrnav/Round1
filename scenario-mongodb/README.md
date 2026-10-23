# Order Webhook Reliability

## Customer report

Order webhook deliveries sometimes return HTTP 500 when the provider retries an event. The first delivery may have completed, so support needs to establish whether retries create duplicate records or fail after a successful write.

## Assessment

Diagnose the failure by reproducing a delivery and then retrying the same `eventId`. Follow the request through authentication, validation, route/controller orchestration, the webhook service, repository, and MongoDB collection operations. Compare the filters and stored document fields with the documented schema. Preserve the unique index and make duplicate delivery safe.

Use the Integration browser to inspect HTTP responses and MongoDB operation logs. Search the codebase and documentation, edit the appropriate source files, then run Code and tests. Write a concise customer update describing the impact, verified cause, and fix.

## What you should demonstrate

- Interpret 401, 400, 202, 200, and 500 responses in the context of a webhook delivery.
- Trace request IDs and structured logs across application and database layers.
- Validate event shape before any database write.
- Use MongoDB collection operations and understand unique-index / duplicate-key behavior.
- Make retries idempotent without weakening data integrity.
- Explain the customer-visible resolution without exposing webhook secrets.

## Project map

- `src/app.js`: candidate application entry point.
- `src/routes/webhook-routes.js`: request lifecycle and error mapping.
- `src/middleware/`: request context, webhook authentication, and event validation.
- `src/controllers/webhook-controller.js`: HTTP-level orchestration.
- `src/services/webhook-service.js`: idempotency and processing policy.
- `src/repositories/event-repository.js`: MongoDB document reads and writes.
- `src/database/`: database connection contract and index definitions.
- `src/utils/logger.js`: structured request logging.
- `docs/webhook-contract.md`: provider contract and retry behavior.
- `docs/mongodb-runbook.md`: collection shape, useful MongoDB queries, and index guidance.
- `test/webhook.test.js`: visible behavior checks.

The local assessment injects a deterministic MongoDB collection adapter that implements the native driver's `collection`, `createIndex`, `findOne`, and `insertOne` contract. It records operations and enforces declared unique indexes, so the exercise runs without installing a MongoDB server. The same repository methods are designed around MongoDB collection semantics used by a real deployment.

The README, docs, and tests are read-only. Files under `src/` can be edited. Closed editor tabs retain unsaved buffers, and Run Code / Run tests save candidate changes before execution.
