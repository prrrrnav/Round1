const express = require('express');
const controller = require('../controllers/scenario-controller');
const { asyncHandler } = require('../middleware/async-handler');
const { validateWorkspaceEdit } = require('../middleware/validate-workspace-edit');
const { executionRateLimit } = require('../middleware/execution-rate-limit');

const router = express.Router();
router.get('/questions', controller.getQuestions);
router.post('/select', controller.selectQuestion);
router.get('/files', asyncHandler(controller.getFile));
router.get('/search', controller.searchFiles);
router.put('/files', validateWorkspaceEdit, controller.saveFile);
router.post('/run', executionRateLimit, asyncHandler(controller.runCode));
router.post('/tests/run', executionRateLimit, asyncHandler(controller.runTests));
router.get('/submission', controller.getSubmission);
router.post('/invoices', executionRateLimit, asyncHandler(controller.sendRequest));
router.post('/webhooks/orders', executionRateLimit, asyncHandler(controller.sendRequest));
module.exports = { router };
