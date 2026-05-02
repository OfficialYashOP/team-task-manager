const Joi = require('joi');
const pool = require('../config/db');

const createTaskSchema = Joi.object({
  title: Joi.string().min(1).max(300).required(),
  description: Joi.string().max(5000).allow('').default(''),
  status: Joi.string().valid('todo', 'in_progress', 'review', 'done').default('todo'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  assigned_to: Joi.string().uuid().allow(null).default(null),
  due_date: Joi.string().allow(null, '').default(null),
});

const updateTaskSchema = Joi.object({
  title: Joi.string().min(1).max(300),
  description: Joi.string().max(5000).allow(''),
  status: Joi.string().valid('todo', 'in_progress', 'review', 'done'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  assigned_to: Joi.string().uuid().allow(null),
  due_date: Joi.string().allow(null, ''),
}).min(1);

async function createTask(req, res) {
  try {
    const { error, value } = createTaskSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { projectId } = req.params;
    const userId = req.user.id;
    const { title, description, status, priority, assigned_to, due_date } = value;

    if (assigned_to) {
      const memberCheck = await pool.query(
        'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, assigned_to]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Assigned user is not a member of this project.' });
      }
    }

    const result = await pool.query(
      `INSERT INTO tasks (title, description, status, priority, project_id, assigned_to, created_by, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, status, priority, projectId, assigned_to, userId, due_date || null]
    );

    await pool.query(
      'INSERT INTO activity_log (task_id, project_id, user_id, action, details) VALUES ($1, $2, $3, $4, $5)',
      [result.rows[0].id, projectId, userId, 'task_created', `Task "${title}" was created`]
    );

    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Failed to create task.' });
  }
}

async function listTasks(req, res) {
  try {
    const { projectId } = req.params;
    const { status, priority, assigned_to } = req.query;

    let query = `
      SELECT t.*, u.name as assigned_name, u.avatar_color as assigned_color, c.name as creator_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.project_id = $1`;
    const values = [projectId];
    let paramIndex = 2;

    if (status) {
      query += ` AND t.status = $${paramIndex++}`;
      values.push(status);
    }
    if (priority) {
      query += ` AND t.priority = $${paramIndex++}`;
      values.push(priority);
    }
    if (assigned_to) {
      query += ` AND t.assigned_to = $${paramIndex++}`;
      values.push(assigned_to);
    }

    query += ' ORDER BY t.created_at DESC';
    const result = await pool.query(query, values);
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('List tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
}

async function getTask(req, res) {
  try {
    const { taskId } = req.params;
    const result = await pool.query(
      `SELECT t.*, u.name as assigned_name, u.avatar_color as assigned_color, c.name as creator_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN users c ON t.created_by = c.id
       WHERE t.id = $1`,
      [taskId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });
    res.json({ task: result.rows[0] });
  } catch (err) {
    console.error('Get task error:', err);
    res.status(500).json({ error: 'Failed to fetch task.' });
  }
}

async function updateTask(req, res) {
  try {
    const { error, value } = updateTaskSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { projectId, taskId } = req.params;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, val] of Object.entries(value)) {
      if (key === 'due_date') {
        updates.push(`due_date = $${paramIndex++}`);
        values.push(val || null);
      } else {
        updates.push(`${key} = $${paramIndex++}`);
        values.push(val);
      }
    }
    updates.push('updated_at = NOW()');
    values.push(taskId);

    const result = await pool.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} AND project_id = $${paramIndex + 1} RETURNING *`,
      [...values, projectId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });

    const changes = Object.keys(value).join(', ');
    await pool.query(
      'INSERT INTO activity_log (task_id, project_id, user_id, action, details) VALUES ($1, $2, $3, $4, $5)',
      [taskId, projectId, req.user.id, 'task_updated', `Updated: ${changes}`]
    );

    res.json({ task: result.rows[0] });
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Failed to update task.' });
  }
}

async function deleteTask(req, res) {
  try {
    const { projectId, taskId } = req.params;
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND project_id = $2 RETURNING title',
      [taskId, projectId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });

    await pool.query(
      'INSERT INTO activity_log (project_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
      [projectId, req.user.id, 'task_deleted', `Task "${result.rows[0].title}" was deleted`]
    );

    res.json({ message: 'Task deleted successfully.' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
}

module.exports = { createTask, listTasks, getTask, updateTask, deleteTask };
