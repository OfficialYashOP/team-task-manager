const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate } = require('../middleware/auth');
const { requireProjectMember, requireProjectAdmin } = require('../middleware/rbac');
const { createTask, listTasks, getTask, updateTask, deleteTask } = require('../controllers/taskController');

router.use(authenticate);
router.use(requireProjectMember());

router.post('/', createTask);
router.get('/', listTasks);
router.get('/:taskId', getTask);
router.put('/:taskId', updateTask);
router.delete('/:taskId', requireProjectAdmin(), deleteTask);

module.exports = router;
