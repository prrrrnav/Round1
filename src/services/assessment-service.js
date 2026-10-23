const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');
const assert = require('node:assert/strict');

const { getQuestions, getQuestion } = require('./question-registry');
const { createMongoDatabase } = require('./mongo-simulator');
let activeQuestionId = 'customer-integration';
let latestSubmission = null;
let mongoDatabase = createMongoDatabase();

function currentQuestion() { return getQuestion(activeQuestionId); }
function currentFiles() { return currentQuestion().files; }
function getQuestionDetails(question = currentQuestion()) {
  const { root, files, ...details } = question;
  return { ...details };
}
function selectQuestion(questionId) {
  const question = getQuestion(questionId);
  if (!question) return null;
  activeQuestionId = question.id;
  latestSubmission = null;
  mongoDatabase = createMongoDatabase();
  clearCandidateModuleCache();
  return getQuestionDetails(question);
}

function resolveWorkspaceFile(relativePath) {
  if (!currentFiles().some((file) => file.path === relativePath)) throw new Error('File is not part of this assessment workspace.');
  return path.join(currentQuestion().root, relativePath);
}
function readWorkspaceFile(relativePath) {
  return fs.readFileSync(resolveWorkspaceFile(relativePath), 'utf8');
}
function listWorkspaceFiles() {
  return currentFiles().map((file) => ({ ...file, content: readWorkspaceFile(file.path) }));
}
function searchWorkspace(queryValue) {
  const query = String(queryValue || '').trim().toLowerCase();
  if (!query) return { query, matches: [] };
  const matches = [];
  for (const file of currentFiles()) {
    readWorkspaceFile(file.path).split(/\r?\n/).forEach((line, index) => {
      if (file.path.toLowerCase().includes(query) || line.toLowerCase().includes(query)) {
        matches.push({ path: file.path, line: index + 1, text: line.trim().slice(0, 180) });
      }
    });
  }
  return { query, matches: matches.slice(0, 100) };
}
function saveWorkspaceFile(relativePath, content) {
  const file = currentFiles().find((item) => item.path === relativePath);
  if (!file || !file.editable) throw Object.assign(new Error('Only source files under src/ can be edited.'), { status: 403 });
  if (typeof content !== 'string' || content.length > 30000) throw Object.assign(new Error('File content must be a string under 30 KB.'), { status: 400 });
  try { new (require('node:vm').Script)(content); }
  catch (error) { throw Object.assign(new Error('JavaScript syntax error: ' + error.message), { status: 400 }); }
  fs.writeFileSync(resolveWorkspaceFile(relativePath), content, 'utf8');
  return { saved: true, path: relativePath };
}
function clearCandidateModuleCache() {
  for (const file of currentFiles()) {
    if (!file.path.startsWith('src/') || !file.path.endsWith('.js')) continue;
    const absolute = resolveWorkspaceFile(file.path);
    try { delete require.cache[require.resolve(absolute)]; } catch {}
  }
}
function loadCandidateApp() {
  clearCandidateModuleCache();
  return require(resolveWorkspaceFile('src/app.js'));
}
function captureConsole(fn) {
  const lines = [];
  const originalLog = console.log;
  console.log = (...args) => lines.push(util.format(...args));
  return Promise.resolve()
    .then(fn)
    .then((value) => ({ value, stdout: lines.join('\n') }))
    .finally(() => { console.log = originalLog; });
}
async function partnerTransport(request) {
  const authorization = request?.headers?.Authorization || request?.headers?.authorization || '';
  if (authorization !== 'Bearer demo-partner-token') {
    return {
      status: 401,
      body: { code: 'PARTNER_UNAUTHORIZED', message: 'Authorization must use the Bearer scheme.' },
      log: '[billing-partner] 401 Unauthorized · PARTNER_UNAUTHORIZED',
      request
    };
  }
  const body = request?.body || {};
  if (typeof body.customer_id !== 'string' || !body.customer_id.trim()) {
    return {
      status: 400,
      body: { code: 'INVALID_CUSTOMER_ID', message: 'customer_id is required.' },
      log: '[billing-partner] 400 Bad Request · INVALID_CUSTOMER_ID',
      request
    };
  }
  if (!Number.isInteger(body.amount_cents) || body.amount_cents <= 0) {
    return {
      status: 400,
      body: { code: 'INVALID_AMOUNT_CENTS', message: 'amount_cents must be a positive integer.' },
      log: '[billing-partner] 400 Bad Request · INVALID_AMOUNT_CENTS',
      request
    };
  }
  return {
    status: 201,
    body: { invoiceId: 'inv_demo_1042', customer_id: body.customer_id, amount_cents: body.amount_cents, status: 'created' },
    log: '[billing-partner] 201 Created · invoice inv_demo_1042',
    request
  };
}
async function runCandidateRequest(input, requestHeaders = {}, options = {}) {
  if (process.env.VERCEL && !options.inSandbox) {
    const { runInSandbox } = require('./sandbox-runner');
    return runInSandbox({ action: 'request', questionId: options.questionId || activeQuestionId, input, headers: requestHeaders, sourceFiles: options.sourceFiles || {}, mongoState: options.mongoState || {} });
  }
  const questionId = options.questionId || activeQuestionId;
  const question = getQuestion(questionId);
  if (!question) throw Object.assign(new Error('That assessment question does not exist.'), { status: 404 });
  const isMongoQuestion = questionId === 'mongo-webhook';
  if (options.mongoState && isMongoQuestion) mongoDatabase = createMongoDatabase(options.mongoState);
  const captured = await captureConsole(async () => {
    const handleRequest = options.handleRequest || loadCandidateApp().handleRequest;
    const headers = { 'x-client-key': 'assessment-client-key', 'x-request-id': 'req-assessment-001' };
    for (const [name, value] of Object.entries(requestHeaders || {})) headers[name.toLowerCase()] = value;
    const request = {
      headers,
      body: input
    };
    if (isMongoQuestion) {
      const logOffset = mongoDatabase.logs.length;
      const result = await handleRequest(request, { db: mongoDatabase });
      return {
        ...result,
        request: { method: 'POST', path: question.browser.path, ...request },
        databaseLogs: mongoDatabase.logs.slice(logOffset)
      };
    }
    return handleRequest(request, partnerTransport);
  });
  const result = captured.value;
  return {
    status: result.status,
    body: result.body,
    request: result.upstream?.request || result.request || null,
    response: result.upstream?.body || result.body,
    logs: [...(result.logs || []).map((entry) => typeof entry === 'string' ? entry : JSON.stringify(entry)), ...(result.databaseLogs || [])],
    stdout: captured.stdout,
    mongoState: isMongoQuestion ? mongoDatabase.snapshot() : undefined
  };
}
async function runCandidateTests(customerUpdate, options = {}) {
  if (process.env.VERCEL && !options.inSandbox) {
    const { runInSandbox } = require('./sandbox-runner');
    return runInSandbox({ action: 'tests', questionId: options.questionId || activeQuestionId, customerUpdate, sourceFiles: options.sourceFiles || {} });
  }
  const questionId = options.questionId || activeQuestionId;
  const question = getQuestion(questionId);
  if (!question) throw Object.assign(new Error('That assessment question does not exist.'), { status: 404 });
  const results = [];
  const stdout = [];
  const check = async (name, fn, hidden = false) => {
    try {
      const captured = await captureConsole(fn);
      if (captured.stdout) stdout.push(captured.stdout);
      results.push({ name, passed: true, hidden });
    } catch (error) {
      results.push({ name, passed: false, hidden, error: error.message });
    }
  };
  try {
    const handleRequest = options.handleRequest || loadCandidateApp().handleRequest;
    const { runPublicChecks } = require(path.join(question.root, questionId === 'mongo-webhook' ? 'test/webhook.test.js' : 'test/integration.test.js'));
    if (questionId === 'mongo-webhook') {
      const createDependencies = () => ({ db: createMongoDatabase() });
      await runPublicChecks(handleRequest, createDependencies, check);
      await check('uses the stable eventId key with case-sensitive MongoDB field matching', async () => {
        const dependencies = createDependencies();
        const request = { headers: { 'x-webhook-secret': 'whsec_assessment' }, body: {
          eventId: 'evt_hidden_1', type: 'order.created',
          data: { orderId: 'ord_hidden_1', customerId: 'cus_hidden_1', amount: 1.15, currency: 'USD' }
        } };
        await handleRequest(request, dependencies);
        const retry = await handleRequest(request, dependencies);
        assert.equal(retry.status, 200);
        assert.equal(dependencies.db.snapshot().webhook_events.length, 1);
      }, true);
      await check('acknowledges concurrent retries protected by the unique index', async () => {
        const dependencies = createDependencies();
        const request = { headers: { 'x-webhook-secret': 'whsec_assessment' }, body: {
          eventId: 'evt_concurrent', type: 'order.created',
          data: { orderId: 'ord_concurrent', customerId: 'cus_concurrent', amount: 84.5, currency: 'USD' }
        } };
        const results = await Promise.all([handleRequest(request, dependencies), handleRequest(request, dependencies)]);
        assert.equal(results.every((result) => result.status === 200 || result.status === 202), true);
        assert.equal(dependencies.db.snapshot().webhook_events.length, 1);
      }, true);
      await check('does not disclose the webhook secret in logs or standard output', async () => {
        const dependencies = createDependencies();
        const result = await handleRequest({ headers: { 'x-webhook-secret': 'whsec_assessment' }, body: {
          eventId: 'evt_secret_check', type: 'order.created',
          data: { orderId: 'ord_secret_check', customerId: 'cus_secret_check', amount: 12, currency: 'USD' }
        } }, dependencies);
        const output = JSON.stringify(result.logs) + JSON.stringify(dependencies.db.logs);
        assert.equal(output.includes('whsec_assessment'), false);
      }, true);
    } else {
      await runPublicChecks(handleRequest, partnerTransport, check);
      await check('converts fractional currency without losing a cent', async () => {
        const result = await handleRequest({
          headers: { 'x-client-key': 'assessment-client-key' },
          body: { customerId: 'cus_rounding', amount: 1.15 }
        }, partnerTransport);
        assert.equal(result.upstream.request.body.amount_cents, 115);
      }, true);
      await check('keeps partner credentials out of standard output', async () => {
        const captured = await captureConsole(() => handleRequest({
          headers: { 'x-client-key': 'assessment-client-key' },
          body: { customerId: 'cus_1042', amount: 49.99 }
        }, partnerTransport));
        assert.equal(captured.stdout.includes('demo-partner-token'), false);
      }, true);
    }
  } catch (error) {
    results.push({ name: 'Load candidate application and checks', passed: false, hidden: false, error: error.message });
  }
  const passed = results.filter((item) => item.passed).length;
  const hiddenTotal = results.filter((item) => item.hidden).length;
  const hiddenPassed = results.filter((item) => item.hidden && item.passed).length;
  if (customerUpdate) {
    latestSubmission = {
      submittedAt: new Date().toISOString(),
      passed,
      total: results.length,
      hiddenPassed,
      hiddenTotal,
      customerUpdate,
      questionId,
      source: Object.fromEntries(question.files.filter((file) => file.editable).map((file) => [file.path, options.sourceFiles?.[file.path] ?? fs.readFileSync(path.join(question.root, file.path), 'utf8')]))
    };
  }
  return {
    passed,
    total: results.length,
    results: results.filter((item) => !item.hidden).map(({ hidden, ...item }) => item),
    hiddenTotal,
    hiddenPassed,
    stdout: stdout.join('\n'),
    customerUpdate: customerUpdate || null,
    submitted: Boolean(customerUpdate)
  };
}
function getLatestSubmission() { return latestSubmission; }
function getBootFiles() { return currentFiles(); }
function getBootManifests() {
  return getQuestions().map(({ id }) => {
    const question = getQuestion(id);
    return { id, title: question.title, root: question.root, files: question.files };
  });
}
module.exports = {
  get workspaceRoot() { return currentQuestion().root; },
  getQuestions,
  getQuestionDetails,
  selectQuestion,
  getActiveQuestionId: () => activeQuestionId,
  getBootFiles,
  getBootManifests,
  listWorkspaceFiles,
  readWorkspaceFile,
  saveWorkspaceFile,
  searchWorkspace,
  runCandidateRequest,
  runCandidateTests,
  getLatestSubmission
};
