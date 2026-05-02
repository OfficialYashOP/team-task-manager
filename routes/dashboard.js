const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getStats, getOverdueTasks, getRecentActivity, getMyTasks } = require('../controllers/dashboardController');

router.use(authenticate);

router.get('/stats', getStats);
router.get('/overdue', getOverdueTasks);
router.get('/recent-activity', getRecentActivity);
router.get('/my-tasks', getMyTasks);

module.exports = router;
