# Acme Billing Partner API Contract

## Create an invoice

Method: POST
Path: /v1/invoices

### Authentication

The token provider returns a raw access token. The partner requires the Authorization header to use the HTTP Bearer scheme.

### Payload schema

| Field | Type | Rules |
| --- | --- | --- |
| customer_id | string | Required partner customer identifier |
| amount_cents | integer | Positive amount in the smallest currency unit |

Convert decimal currency to cents without losing a cent to floating-point representation. For example, 49.99 must be sent as 4999.

### Response codes

| Status | Meaning | Diagnostic direction |
| --- | --- | --- |
| 201 | Invoice created | Confirm returned invoice ID and amount |
| 400 | Invalid request body | Compare payload field names and value types |
| 401 | Missing or invalid partner authorization | Check token source and Authorization scheme |
| 503 | Partner unavailable | Retry according to the service policy |

Partner error responses include a stable error code and a diagnostic message. Log the request ID, route, upstream status, and error code. Never write access tokens to logs.
