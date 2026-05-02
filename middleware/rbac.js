const pool = require('../config/db');

/**
 * Middleware: Require user to be a member of the project
 * Checks project_members table for membership
 * Attaches project role to req.projectRole
 */
function requireProjectMember() {
  return async (req, res, next) => {
    try {
      const projectId = req.params.id || req.params.projectId;
      const userId = req.user.id;

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required.' });
      }

      const result = await pool.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this project.' });
      }

      req.projectRole = result.rows[0].role;
      next();
    } catch (err) {
      console.error('RBAC Error:', err);
      return res.status(500).json({ error: 'Authorization check failed.' });
    }
  };
}

/**
 * Middleware: Require user to be an admin of the project
 * Must be used after requireProjectMember or authenticate
 */
function requireProjectAdmin() {
  return async (req, res, next) => {
    try {
      const projectId = req.params.id || req.params.projectId;
      const userId = req.user.id;

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required.' });
      }

      const result = await pool.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this project.' });
      }

      if (result.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required for this action.' });
      }

      req.projectRole = 'admin';
      next();
    } catch (err) {
      console.error('RBAC Error:', err);
      return res.status(500).json({ error: 'Authorization check failed.' });
    }
  };
}

module.exports = { requireProjectMember, requireProjectAdmin };
