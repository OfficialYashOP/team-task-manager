const Joi = require('joi');
const pool = require('../config/db');

// Validation Schemas
const createProjectSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(2000).allow('').default(''),
  color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
});

const updateProjectSchema = Joi.object({
  name: Joi.string().min(1).max(200),
  description: Joi.string().max(2000).allow(''),
  color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/),
}).min(1);

const addMemberSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('admin', 'member').default('member'),
});

/**
 * POST /api/projects
 */
async function createProject(req, res) {
  try {
    const { error, value } = createProjectSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { name, description, color } = value;
    const userId = req.user.id;

    // Create the project
    const projectResult = await pool.query(
      'INSERT INTO projects (name, description, color, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, color, userId]
    );
    const project = projectResult.rows[0];

    // Add creator as admin member
    await pool.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [project.id, userId, 'admin']
    );

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (project_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
      [project.id, userId, 'project_created', `Project "${name}" was created`]
    );

    res.status(201).json({ project });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
}

/**
 * GET /api/projects
 */
async function listProjects(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT p.*, pm.role as user_role,
              (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
              (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_count,
              (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
       FROM projects p
       JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
       ORDER BY p.updated_at DESC`,
      [userId]
    );

    res.json({ projects: result.rows });
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
}

/**
 * GET /api/projects/:id
 */
async function getProject(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT p.*, u.name as creator_name
       FROM projects p
       JOIN users u ON p.created_by = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json({ project: result.rows[0], userRole: req.projectRole });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Failed to fetch project.' });
  }
}

/**
 * PUT /api/projects/:id
 */
async function updateProject(req, res) {
  try {
    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { id } = req.params;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (value.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(value.name);
    }
    if (value.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(value.description);
    }
    if (value.color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      values.push(value.color);
    }
    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({ project: result.rows[0] });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Failed to update project.' });
  }
}

/**
 * DELETE /api/projects/:id
 */
async function deleteProject(req, res) {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    res.json({ message: 'Project deleted successfully.' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
}

/**
 * GET /api/projects/:id/members
 */
async function listMembers(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar_color, pm.role, pm.joined_at
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY pm.joined_at ASC`,
      [id]
    );

    res.json({ members: result.rows });
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'Failed to fetch members.' });
  }
}

/**
 * POST /api/projects/:id/members
 */
async function addMember(req, res) {
  try {
    const { error, value } = addMemberSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { id } = req.params;
    const { email, role } = value;

    // Find user by email
    const userResult = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [email.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No user found with that email address.' });
    }

    const targetUser = userResult.rows[0];

    // Check if already a member
    const existingMember = await pool.query(
      'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
      [id, targetUser.id]
    );
    if (existingMember.rows.length > 0) {
      return res.status(409).json({ error: 'User is already a member of this project.' });
    }

    // Add member
    await pool.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [id, targetUser.id, role]
    );

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (project_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
      [id, req.user.id, 'member_added', `${targetUser.name} was added to the project as ${role}`]
    );

    res.status(201).json({
      message: `${targetUser.name} added to project as ${role}.`,
      member: { id: targetUser.id, name: targetUser.name, email: targetUser.email, role },
    });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Failed to add member.' });
  }
}

/**
 * DELETE /api/projects/:id/members/:userId
 */
async function removeMember(req, res) {
  try {
    const { id, userId } = req.params;

    // Prevent removing yourself if you're the last admin
    const admins = await pool.query(
      "SELECT user_id FROM project_members WHERE project_id = $1 AND role = 'admin'",
      [id]
    );
    if (admins.rows.length === 1 && admins.rows[0].user_id === userId) {
      return res.status(400).json({ error: 'Cannot remove the last admin from the project.' });
    }

    const result = await pool.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found in project.' });
    }

    res.json({ message: 'Member removed from project.' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove member.' });
  }
}

module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  listMembers,
  addMember,
  removeMember,
};
