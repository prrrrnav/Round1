const assessmentService = require('../services/assessment-service');

function getQuestions(_req, res) {
  res.json({ questions: assessmentService.getQuestions(), activeQuestionId: assessmentService.getActiveQuestionId() });
}
function selectQuestion(req, res) {
  const selected = assessmentService.selectQuestion(req.body?.questionId);
  if (!selected) return res.status(404).json({ error: 'That assessment question does not exist.' });
  return res.json({ question: selected });
}
async function getFile(req, res) {
  const requestedPath = req.query.path;
  if (requestedPath) {
    const metadata = assessmentService.getBootFiles().find((file) => file.path === requestedPath);
    if (!metadata) return res.status(404).json({ error: 'File not found in assessment workspace.' });
    return res.json({
      path: requestedPath,
      editable: metadata.editable,
      content: assessmentService.readWorkspaceFile(requestedPath)
    });
  }
  res.json({ files: assessmentService.listWorkspaceFiles() });
}
function searchFiles(req, res) {
  res.json(assessmentService.searchWorkspace(req.query.q));
}
function saveFile(req, res) {
  if (process.env.VERCEL) return res.status(409).json({ error: 'Saved source files are kept in this browser and sent only to an isolated candidate runtime.' });
  res.json(assessmentService.saveWorkspaceFile(req.workspaceEdit.relativePath, req.workspaceEdit.content));
}
async function runCode(req, res) {
  const result = await assessmentService.runCandidateRequest(req.body?.input, req.body?.headers, {
    questionId: req.body?.questionId || req.get('x-assessment-question'),
    sourceFiles: req.body?.sourceFiles,
    mongoState: req.body?.mongoState
  });
  res.json({
    stdout: result.stdout,
    request: result.request,
    response: result.response,
    status: result.status,
    logs: result.logs,
    mongoState: result.mongoState,
    runtimeError: result.body?.error?.message || result.body?.error || null
  });
}
async function runTests(req, res) {
  const customerUpdate = typeof req.body?.customerUpdate === 'string' ? req.body.customerUpdate.trim() : '';
  res.json(await assessmentService.runCandidateTests(customerUpdate, {
    questionId: req.body?.questionId || req.get('x-assessment-question'),
    sourceFiles: req.body?.sourceFiles
  }));
}
function getSubmission(_req, res) {
  res.json({ submission: assessmentService.getLatestSubmission() });
}
async function sendRequest(req, res) {
  const envelope = req.body?.__assessment || {};
  const input = Object.hasOwn(req.body || {}, 'payload') ? req.body.payload : req.body;
  const result = await assessmentService.runCandidateRequest(input || {}, req.headers, {
    questionId: envelope.questionId || req.get('x-assessment-question'),
    sourceFiles: envelope.sourceFiles,
    mongoState: envelope.mongoState
  });
  res.status(result.status).json({
    upstreamStatus: result.status,
    response: result.body,
    partnerRequest: result.request,
    partnerResponse: result.response,
    logs: result.logs,
    stdout: result.stdout,
    mongoState: result.mongoState
  });
}
module.exports = { getQuestions, selectQuestion, getFile, searchFiles, saveFile, runCode, runTests, getSubmission, sendRequest };
