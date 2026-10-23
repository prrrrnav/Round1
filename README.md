# Codebase Debugging Assessment

A VS Code-inspired local assessment for debugging layered Node.js systems. Candidates choose a problem, explore its multi-file codebase, search documentation and source, diagnose failures, make and save a fix, run the application, inspect logs, run visible and hidden checks, and submit a customer-facing explanation.

## Run the platform

Requires Node.js 20 or newer.

    npm install
    npm run dev

Open http://localhost:3000. The frontend is maintained separately under frontend/ (HTML, styles, and scripts). Assessment codebases live in separate scenario folders.

The candidate editor uses a VS Code-inspired workspace: open multiple files in tabs, close and restore tabs, expand or collapse folders, and switch between light and dark themes. Shortcuts include Ctrl+P to search, Ctrl+W to close the active file, Ctrl+Tab to switch tabs, and Ctrl+Shift+T to reopen the last closed file. Unsaved edits remain in the in-memory buffer when a tab is closed and are saved before Run Code or Run tests.

At startup, the platform reads and checks the assessment environment and shows progress before opening the question picker. Candidates can switch questions at any time; each selection loads its own customer report, codebase, docs, browser request, and test suite. The development command does not watch candidate source files, so editing a scenario does not restart the platform.

The available questions are Customer API Integration Debugging and MongoDB Webhook Reliability. The second scenario teaches MongoDB collection queries, document fields, unique indexes, duplicate-key errors, and idempotency under webhook retries. It uses an included deterministic adapter that implements the MongoDB collection API used by the exercise, so candidates can run it without installing a database server.

## Candidate workflow

1. Choose a problem statement, read its README, and explore its scenario-specific file tree.
2. Search the selected codebase for the relevant request fields and persistence or authentication behavior. Read the scenario's docs, then trace routes, middleware, controllers, and services/repositories.
3. Reproduce the failure with the built-in Integration browser. The scenario simulator returns HTTP status codes, response bodies, application logs, and, for MongoDB, collection-operation logs.
4. Edit one or more source files. Save writes the change to the actual scenario workspace on disk.
5. Run Code executes a sample request and displays console.log output in stdout.
6. Run tests executes the visible integration checks and hidden behavior checks against the same layered code.
7. Write a customer update and submit. A local reviewer snapshot is available at GET /scenario-api/submission.

The Activity view records searches, opened files, saves, browser requests, code runs, tests, and submissions.

## Candidate project architecture

Each question provides a different codebase with routes, middleware, controllers, services, docs, and scenario-specific tests. The invoice integration exercises partner authentication and payload mapping. The MongoDB webhook scenario exercises validation, event repositories, collection queries, unique indexes, duplicate-key handling, and retry idempotency.

The built-in simulator runs the selected candidate codebase. Edits to source files in that scenario are picked up on the next run. READMEs, documentation, and tests are read-only in the editor. The MongoDB question uses a deterministic adapter implementing the collection operations used by the exercise; it does not require a local MongoDB daemon.

## Platform architecture

The assessment server separates HTTP routes, controllers, middleware, and services under src/. The frontend is isolated under frontend/ and does not require a frontend build step.

## Local execution scope

Local practice runs candidate source in the Node.js assessment process. On Vercel, every Run Code, Run tests, and Integration browser request creates a disposable Vercel Sandbox with network access disabled. Only the selected scenario's candidate source and runtime adapter are copied into it; test suites and hidden checks stay in the assessment service. Browser edits are stored per candidate in local storage, not in shared server files.

## Hosted deployment

The static candidate interface is published from `frontend/` to GitHub Pages. Its API base is configured in `frontend/scripts/config.js` and points to the Vercel Express service. The Vercel function explicitly includes both scenario directories so it can load read-only assessment materials and test suites. The `src/server.js` function has a 60-second limit to accommodate isolated sandbox startup and execution.
