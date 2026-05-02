const pool = require('../config/db');

async function getStats(req, res) {
  try {
    const userId = req.user.id;

    const stats = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE t.status = 'todo') as todo_count,
        COUNT(*) FILTER (WHERE t.status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE t.status = 'review') as review_count,
        COUNT(*) FILTER (WHERE t.status = 'done') as done_count,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status != 'done') as overdue_count
       FROM tasks t
       JOIN project_members pm ON t.project_id = pm.project_id
       WHERE pm.user_id = $1`,
      [userId]
    );

    const projectCount = await pool.query(
      'SELECT COUNT(*) as count FROM project_members WHERE user_id = $1',
      [userId]
    );

    res.json({
      stats: {
        ...stats.rows[0],
        project_count: projectCount.rows[0].count,
      },
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
}

async function getOverdueTasks(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT t.*, p.name as project_name, p.color as project_color,
              u.name as assigned_name
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       JOIN project_members pm ON t.project_id = pm.project_id AND pm.user_id = $1
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.due_date < CURRENT_DATE AND t.status != 'done'
       ORDER BY t.due_date ASC
       LIMIT 20`,
      [userId]
    );

    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('Overdue error:', err);
    res.status(500).json({ error: 'Failed to fetch overdue tasks.' });
  }
}

async function getRecentActivity(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT al.*, u.name as user_name, u.avatar_color, p.name as project_name
       FROM activity_log al
       JOIN users u ON al.user_id = u.id
       JOIN projects p ON al.project_id = p.id
       JOIN project_members pm ON al.project_id = pm.project_id AND pm.user_id = $1
       ORDER BY al.created_at DESC
       LIMIT 25`,
      [userId]
    );

    res.json({ activities: result.rows });
  } catch (err) {
    console.error('Activity error:', err);
    res.status(500).json({ error: 'Failed to fetch activity.' });
  }
}

async function getMyTasks(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT t.*, p.name as project_name, p.color as project_color
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.assigned_to = $1 AND t.status != 'done'
       ORDER BY
         CASE WHEN t.due_date < CURRENT_DATE THEN 0 ELSE 1 END,
         t.due_date ASC NULLS LAST,
         t.priority = 'critical' DESC,
         t.priority = 'high' DESC
       LIMIT 30`,
      [userId]
    );

    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('My tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
}

module.exports = { getStats, getOverdueTasks, getRecentActivity, getMyTasks };
