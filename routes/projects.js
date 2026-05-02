const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireProjectMember, requireProjectAdmin } = require('../middleware/rbac');
const {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  listMembers,
  addMember,
  removeMember,
} = require('../controllers/projectController');

router.use(authenticate);

router.post('/', createProject);
router.get('/', listProjects);
router.get('/:id', requireProjectMember(), getProject);
router.put('/:id', requireProjectAdmin(), updateProject);
router.delete('/:id', requireProjectAdmin(), deleteProject);

router.get('/:id/members', requireProjectMember(), listMembers);
router.post('/:id/members', requireProjectAdmin(), addMember);
router.delete('/:id/members/:userId', requireProjectAdmin(), removeMember);

module.exports = router;
