const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { router: scenarioRouter } = require('./routes/scenario');
const { getBootManifests } = require('./services/assessment-service');
const { requestLogger } = require('./middleware/logger');
const { errorHandler } = require('./middleware/errors');
const { getQuestion } = require('./services/question-registry');
const assessmentService = require('./services/assessment-service');

const app = express();
const port = Number(process.env.PORT) || 3000;
const bootState = { ready: false, progress: 0, message: 'Starting candidate environment', logs: ['Starting Node.js runtime…'], error: null };

app.set('trust proxy', 1);
app.use(express.json({ limit: '512kb' }));
app.use((req, res, next) => {
  const origin = req.get('origin');
  const allowedOrigins = (process.env.ASSESSMENT_ALLOWED_ORIGINS || 'https://prrrrnav.github.io').split(',').map((item) => item.trim());
  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Key, X-Webhook-Secret, X-Request-Id, X-Assessment-Question');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  if (process.env.VERCEL) {
    const questionId = req.get('x-assessment-question');
    if (questionId && getQuestion(questionId)) assessmentService.selectQuestion(questionId);
  }
  next();
});
app.use(requestLogger);
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('/assessment/status', (_req, res) => res.json(bootState));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'codebase-debugging-assessment' }));
app.use('/scenario-api', scenarioRouter);
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

if (!process.env.VERCEL) app.listen(port, () => console.log('Codebase assessment ready at http://localhost:' + port));
else app.listen(port);

async function initializeCandidateEnvironment() {
  try {
    const workspaceFiles = getBootManifests().flatMap((question) => question.files.map((file) => ({ ...file, root: question.root, questionTitle: question.title })));
    for (let index = 0; index < workspaceFiles.length; index += 1) {
      const file = workspaceFiles[index];
      await new Promise((resolve) => setTimeout(resolve, 120));
      const filePath = path.join(file.root, file.path);
      fs.accessSync(filePath, fs.constants.R_OK);
      bootState.progress = Math.round(((index + 1) / (workspaceFiles.length + 1)) * 92);
      bootState.message = 'Loading ' + file.questionTitle + ' · ' + file.path;
      bootState.logs.push('Loaded ' + file.questionTitle + ' · ' + file.path);
    }
    await new Promise((resolve) => setTimeout(resolve, 240));
    bootState.progress = 100;
    bootState.message = 'Candidate environment ready';
    bootState.logs.push('API and database simulators ready');
    bootState.logs.push('Workspace ready');
    bootState.ready = true;
  } catch (error) {
    bootState.error = error.message;
    bootState.message = 'Workspace startup failed';
    bootState.logs.push('Startup failed: ' + error.message);
  }
}
initializeCandidateEnvironment();
