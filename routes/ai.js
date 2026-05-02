const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { suggestTasks, improveDescription, projectSummary, aiStatus } = require('../controllers/aiController');

router.use(authenticate);

router.get('/status', aiStatus);
router.post('/suggest-tasks', suggestTasks);
router.post('/improve-description', improveDescription);
router.post('/project-summary', projectSummary);

module.exports = router;
