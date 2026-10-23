# Partner Billing Integration

A small customer billing adapter with separate routes, middleware, controllers, and services.

## Customer report

Invoice synchronization began failing after the last deployment. The customer dashboard shows failed delivery attempts, while the partner dashboard has no matching invoices.

## Candidate assignment

Diagnose and repair the integration without changing the customer's request contract. The assessment browser sends a representative customer request through the same layered flow used by Run Code:

1. The route composes request context, client authentication, validation, and controller handling.
2. The controller delegates invoice submission to the service layer.
3. The partner client constructs an outbound request using the token provider.
4. A local partner simulator returns realistic HTTP responses and diagnostic logs.

Inspect the returned status and logs. Search across the codebase, read the partner API contract, identify the right layer, make a focused fix, and run the sample request and automated checks. Submit a concise customer update describing impact, cause, and resolution.

## Investigation workflow

Treat this as a production support handoff. Preserve the public customer request shape (`customerId` and `amount`) while tracing the outbound partner request. Use the workspace search before changing code and keep each edit tied to evidence from a response, log entry, contract requirement, or failing check.

1. Reproduce the customer request in Integration browser. Record the HTTP status, response code, request ID, and relevant adapter/partner logs.
2. Trace the call path from `src/app.js` through the route, middleware, controller, service, and partner client. Use Ctrl+P or the codebase search to locate request fields, authorization, and amount conversion.
3. Read `docs/partner-api.md` and compare its request contract with the actual partner request shown by the browser.
4. Change the smallest appropriate source file or files. Save and run the request again after each meaningful change; a later response can reveal the next contract mismatch.
5. Run Code to inspect normal `console.log` output. Run tests to execute visible integration checks and additional hidden checks, including fractional-currency rounding and credential-safe logging.
6. Write a customer update in plain language. Explain the customer impact, verified cause, resolution, and what the customer should now observe. Submit after running the checks.

## Completion expectations

- The unchanged customer payload passes client authentication and request validation.
- The outbound request follows the partner's documented authentication and field contract.
- Successful submission returns the created invoice and an HTTP 201 response.
- Invalid credentials or payloads still produce actionable 4xx responses, while partner failures are logged with the request ID and status.
- Currency is represented as integer cents without rounding down fractional values, and secrets are not printed to stdout.
- The customer update is accurate, concise, and avoids exposing internal credentials or implementation details.

The file editor marks the README, partner contract, and visible tests as read-only. Files under `src/` are editable. The Activity view records searches, file navigation, saves, request attempts, code runs, test runs, and submission so the investigation can be reviewed as a sequence of actions.

## Project layout

- src/app.js: scenario application entry point.
- src/routes/invoice-routes.js: endpoint and middleware composition.
- src/middleware/: request context, client authentication, and input validation.
- src/controllers/invoice-controller.js: request orchestration.
- src/services/invoice-service.js: partner call and response handling.
- src/services/partner-client.js: outbound request construction.
- src/services/token-provider.js: partner credential source.
- src/utils/logger.js: structured integration logging.
- docs/partner-api.md: upstream contract and response codes.
- test/integration.test.js: visible integration checks.

Use Search to find where authorization and invoice fields are set. Source files under src/ can be edited. Documentation and tests are read-only.
