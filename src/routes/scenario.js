const express = require('express');
const controller = require('../controllers/scenario-controller');
const { asyncHandler } = require('../middleware/async-handler');
const { validateWorkspaceEdit } = require('../middleware/validate-workspace-edit');

const router = express.Router();
router.get('/questions', controller.getQuestions);
router.post('/select', controller.selectQuestion);
router.get('/files', asyncHandler(controller.getFile));
router.get('/search', controller.searchFiles);
router.put('/files', validateWorkspaceEdit, controller.saveFile);
router.post('/run', asyncHandler(controller.runCode));
router.post('/tests/run', asyncHandler(controller.runTests));
router.get('/submission', controller.getSubmission);
router.post('/invoices', asyncHandler(controller.sendRequest));
router.post('/webhooks/orders', asyncHandler(controller.sendRequest));
module.exports = { router };
