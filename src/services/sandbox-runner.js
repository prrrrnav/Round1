const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { getQuestion } = require('./question-registry');

const PORT = 4317;
const OUTPUT_LIMIT = 18_000;
let executionQueue = Promise.resolve();

function clip(value) {
  const text = String(value || '');
  return text.length > OUTPUT_LIMIT ? text.slice(0, OUTPUT_LIMIT) + '\n… output truncated …' : text;
}

function buildWorkerSource() {
  return String.raw`const http = require('node:http');
const path = require('node:path');
const { createMongoDatabase } = require(path.join(__dirname, 'src/services/mongo-simulator.js'));
const mongoDatabases = new Map();
const workspace = process.env.ASSESSMENT_WORKSPACE;
const questionId = process.env.ASSESSMENT_QUESTION;
const secret = process.env.ASSESSMENT_WORKER_KEY;
const app = require(path.join(workspace, 'src/app.js'));
function partnerTransport(request) {
  const authorization = request?.headers?.Authorization || request?.headers?.authorization || '';
  if (authorization !== 'Bearer demo-partner-token') return { status: 401, body: { code: 'PARTNER_UNAUTHORIZED', message: 'Authorization must use the Bearer scheme.' }, log: '[billing-partner] 401 Unauthorized · PARTNER_UNAUTHORIZED', request };
  const body = request?.body || {};
  if (typeof body.customer_id !== 'string' || !body.customer_id.trim()) return { status: 400, body: { code: 'INVALID_CUSTOMER_ID', message: 'customer_id is required.' }, log: '[billing-partner] 400 Bad Request · INVALID_CUSTOMER_ID', request };
  if (!Number.isInteger(body.amount_cents) || body.amount_cents <= 0) return { status: 400, body: { code: 'INVALID_AMOUNT_CENTS', message: 'amount_cents must be a positive integer.' }, log: '[billing-partner] 400 Bad Request · INVALID_AMOUNT_CENTS', request };
  return { status: 201, body: { invoiceId: 'inv_demo_1042', customer_id: body.customer_id, amount_cents: body.amount_cents, status: 'created' }, log: '[billing-partner] 201 Created · invoice inv_demo_1042', request };
}
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(200); res.end('ready'); return; }
  if (req.method !== 'POST' || req.url !== '/run' || req.headers['x-assessment-worker-key'] !== secret) { res.writeHead(404); res.end(); return; }
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 500_000) { res.writeHead(413); res.end(); return; } }
  const payload = JSON.parse(raw);
  const output = [];
  const originalLog = console.log;
  console.log = (...args) => output.push(require('node:util').format(...args));
  try {
    let result; let mongoState = null; let databaseLogs = [];
    if (questionId === 'mongo-webhook') {
      const databaseId = payload.databaseId || 'browser-db';
      if (!mongoDatabases.has(databaseId)) mongoDatabases.set(databaseId, createMongoDatabase(payload.mongoState || {}));
      const db = mongoDatabases.get(databaseId);
      if (payload.syncMongoState && payload.mongoState) db.restore(payload.mongoState);
      const offset = db.logs.length;
      result = await app.handleRequest(payload.request, { db });
      mongoState = db.snapshot(); databaseLogs = db.logs.slice(offset);
    } else result = await app.handleRequest(payload.request, partnerTransport);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ result, stdout: output.join('\n'), mongoState, databaseLogs }));
  } catch (error) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: error.stack || error.message, stdout: output.join('\n') }));
  } finally { console.log = originalLog; }
});
server.listen(Number(process.env.PORT || ${PORT}), '0.0.0.0');
`;
}

function buildSandboxFiles(payload, question) {
  const editablePaths = new Set(question.files.filter((file) => file.editable).map((file) => file.path));
  const overrides = payload.sourceFiles || {};
  for (const [filePath, content] of Object.entries(overrides)) {
    if (!editablePaths.has(filePath) || typeof content !== 'string' || content.length > 30_000) {
      throw Object.assign(new Error('The submitted workspace contains an invalid source file.'), { status: 400 });
    }
  }

  const files = [];
  const workspaceFolder = path.basename(question.root);
  for (const file of question.files) {
    if (file.path.startsWith('test/')) continue;
    const content = Object.hasOwn(overrides, file.path)
      ? overrides[file.path]
      : fs.readFileSync(path.join(question.root, file.path), 'utf8');
    files.push({ path: path.join(workspaceFolder, file.path).replaceAll('\\', '/'), content: Buffer.from(content), mode: file.editable ? 0o666 : 0o644 });
  }
  const mongoSimulator = fs.readFileSync(path.join(__dirname, 'mongo-simulator.js'));
  files.push({ path: path.join(workspaceFolder, 'src/services/mongo-simulator.js').replaceAll('\\', '/'), content: mongoSimulator, mode: 0o644 });
  files.push({ path: path.join(workspaceFolder, 'candidate-worker.js').replaceAll('\\', '/'), content: Buffer.from(buildWorkerSource()), mode: 0o644 });
  return files;
}

async function runInSandboxExclusive(payload) {
  const question = getQuestion(payload.questionId);
  if (!question) throw Object.assign(new Error('That assessment question does not exist.'), { status: 404 });

  const { Sandbox } = await import('@vercel/sandbox');
  let sandbox;
  try {
    sandbox = await Sandbox.create({
      timeout: 55_000,
      persistent: false,
      resources: { vcpus: 1 },
      networkPolicy: 'deny-all',
      ports: [PORT]
    });
    await sandbox.writeFiles(buildSandboxFiles(payload, question));
    const workerKey = randomBytes(24).toString('hex');
    const workspace = '/vercel/sandbox/' + path.basename(question.root);
    const workerCommand = await sandbox.runCommand({
      cmd: 'node', args: ['candidate-worker.js'], cwd: workspace, detached: true,
      env: { ASSESSMENT_WORKSPACE: workspace, ASSESSMENT_QUESTION: question.id, ASSESSMENT_WORKER_KEY: workerKey, PORT: String(PORT) }
    });
    const baseUrl = sandbox.domain(PORT);
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const health = await fetch(baseUrl + '/health', { signal: AbortSignal.timeout(1000) });
        if (health.ok) { ready = true; break; }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (!ready) {
      const [workerStdout, workerStderr] = await Promise.all([workerCommand.stdout(), workerCommand.stderr()]);
      const diagnostics = clip([workerStdout, workerStderr].filter(Boolean).join('\n')).trim();
      throw Object.assign(new Error('The isolated candidate runtime did not start.' + (diagnostics ? ' ' + diagnostics : '')), { status: 502 });
    }

    const invoke = async (request, dependencies) => {
      const response = await fetch(baseUrl + '/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-assessment-worker-key': workerKey },
        body: JSON.stringify({ request, databaseId: dependencies?.db?.identity || 'browser-db', mongoState: dependencies?.db?.snapshot?.() || {}, syncMongoState: Boolean(dependencies?.syncMongoState) }),
        signal: AbortSignal.timeout(5000)
      });
      const data = await response.json();
      if (data.stdout) console.log(clip(data.stdout));
      if (data.error) throw Object.assign(new Error(clip(data.error)), { status: 422 });
      if (dependencies?.db && data.mongoState) dependencies.db.restore(data.mongoState, data.databaseLogs);
      return data.result;
    };

    const assessment = require('./assessment-service');
    assessment.selectQuestion(question.id);
    if (payload.action === 'tests') {
      const result = await assessment.runCandidateTests(payload.customerUpdate || '', {
        questionId: question.id,
        sourceFiles: payload.sourceFiles || {},
        inSandbox: true,
        handleRequest: (request, dependencies) => invoke(request, dependencies)
      });
      return result;
    }
    return assessment.runCandidateRequest(payload.input, payload.headers, {
      questionId: question.id,
      sourceFiles: payload.sourceFiles || {},
      mongoState: payload.mongoState || {},
      inSandbox: true,
      handleRequest: (request, dependencies) => invoke(request, dependencies)
    });
  } finally {
    if (sandbox) await sandbox.stop().catch(() => {});
  }
}

async function runInSandbox(payload) {
  const task = executionQueue.then(() => runInSandboxExclusive(payload), () => runInSandboxExclusive(payload));
  executionQueue = task.catch(() => {});
  return task;
}

module.exports = { runInSandbox };
