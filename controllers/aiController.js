const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');

let genAI = null;
let model = null;

function getModel() {
  if (!model) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }
  return model;
}

/**
 * POST /api/ai/suggest-tasks
 * AI generates task suggestions for a project
 */
async function suggestTasks(req, res) {
  try {
    const { projectName, projectDescription, existingTasks } = req.body;
    if (!projectName) return res.status(400).json({ error: 'Project name is required' });

    const prompt = `You are a project management AI assistant. Given a project, suggest 5 actionable tasks.

Project: "${projectName}"
Description: "${projectDescription || 'No description'}"
${existingTasks?.length ? `Existing tasks: ${existingTasks.join(', ')}` : ''}

Return ONLY a JSON array of objects with this format (no markdown, no explanation):
[{"title":"task name","description":"brief description","priority":"low|medium|high|critical","status":"todo"}]`;

    const result = await getModel().generateContent(prompt);
    const text = result.response.text().trim();

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI returned invalid format' });

    const tasks = JSON.parse(jsonMatch[0]);
    res.json({ suggestions: tasks });
  } catch (err) {
    console.error('AI suggest-tasks error:', err.message);
    if (err.message.includes('GEMINI_API_KEY')) {
      return res.status(503).json({ error: 'AI features not configured. Add GEMINI_API_KEY in Railway.' });
    }
    res.status(500).json({ error: 'AI generation failed.' });
  }
}

/**
 * POST /api/ai/improve-description
 * AI improves a task description
 */
async function improveDescription(req, res) {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Task title is required' });

    const prompt = `You are a project management assistant. Improve this task description to be clear, actionable, and professional.

Task title: "${title}"
Current description: "${description || 'No description yet'}"

Return ONLY the improved description text (2-3 sentences, no markdown, no quotes).`;

    const result = await getModel().generateContent(prompt);
    const text = result.response.text().trim();
    res.json({ description: text });
  } catch (err) {
    console.error('AI improve-description error:', err.message);
    if (err.message.includes('GEMINI_API_KEY')) {
      return res.status(503).json({ error: 'AI features not configured. Add GEMINI_API_KEY in Railway.' });
    }
    res.status(500).json({ error: 'AI generation failed.' });
  }
}

/**
 * POST /api/ai/project-summary
 * AI generates a project status summary
 */
async function projectSummary(req, res) {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'Project ID required' });

    // Fetch project data
    const projectResult = await pool.query('SELECT name, description FROM projects WHERE id = $1', [projectId]);
    if (projectResult.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const project = projectResult.rows[0];

    const tasksResult = await pool.query(
      `SELECT title, status, priority, due_date FROM tasks WHERE project_id = $1`,
      [projectId]
    );
    const tasks = tasksResult.rows;

    const todoCount = tasks.filter(t => t.status === 'todo').length;
    const progressCount = tasks.filter(t => t.status === 'in_progress').length;
    const reviewCount = tasks.filter(t => t.status === 'review').length;
    const doneCount = tasks.filter(t => t.status === 'done').length;
    const overdueCount = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length;

    const prompt = `You are a project manager AI. Give a brief status summary and 2-3 actionable recommendations.

Project: "${project.name}"
Description: "${project.description || 'N/A'}"
Tasks breakdown: ${tasks.length} total — ${todoCount} to-do, ${progressCount} in progress, ${reviewCount} in review, ${doneCount} done, ${overdueCount} overdue
Task list: ${tasks.map(t => `"${t.title}" (${t.status}, ${t.priority})`).join('; ')}

Return a JSON object (no markdown): {"summary":"2-3 sentence summary","health":"on_track|at_risk|behind","recommendations":["rec1","rec2","rec3"]}`;

    const result = await getModel().generateContent(prompt);
    const text = result.response.text().trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI returned invalid format' });

    const summary = JSON.parse(jsonMatch[0]);
    res.json(summary);
  } catch (err) {
    console.error('AI project-summary error:', err.message);
    if (err.message.includes('GEMINI_API_KEY')) {
      return res.status(503).json({ error: 'AI features not configured. Add GEMINI_API_KEY in Railway.' });
    }
    res.status(500).json({ error: 'AI generation failed.' });
  }
}

/**
 * GET /api/ai/status
 * Check if AI features are available
 */
async function aiStatus(req, res) {
  res.json({ available: !!process.env.GEMINI_API_KEY });
}

/**
 * POST /api/ai/create-from-prompt
 * AI parses a natural language prompt and creates tasks with assignments
 */
async function createFromPrompt(req, res) {
  try {
    const { prompt, projectId } = req.body;
    if (!prompt || !projectId) return res.status(400).json({ error: 'Prompt and projectId are required' });

    // Get project members for assignment
    const membersResult = await pool.query(
      `SELECT u.id, u.name, u.email FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1`,
      [projectId]
    );
    const members = membersResult.rows;
    const memberNames = members.map(m => `${m.name} (${m.email})`).join(', ');

    const aiPrompt = `You are a project management AI. Parse the user's request and create tasks from it.

User request: "${prompt}"

Available team members to assign: ${memberNames || 'No members yet'}

Return ONLY a JSON array of task objects (no markdown, no explanation):
[{"title":"task name","description":"brief description","priority":"low|medium|high|critical","status":"todo","assign_to_name":"member name or null"}]

Rules:
- Create 1-5 tasks based on the request
- Set realistic priorities
- If the user mentions someone's name, assign that task to them using their exact name from the member list
- If no name mentioned, set assign_to_name to null
- Keep titles short and actionable
- Keep descriptions to 1-2 sentences`;

    const result = await getModel().generateContent(aiPrompt);
    const text = result.response.text().trim();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI returned invalid format' });

    const aiTasks = JSON.parse(jsonMatch[0]);
    const createdTasks = [];

    for (const task of aiTasks) {
      // Resolve member name to ID
      let assignedTo = null;
      if (task.assign_to_name && members.length > 0) {
        const match = members.find(m =>
          m.name.toLowerCase().includes(task.assign_to_name.toLowerCase()) ||
          task.assign_to_name.toLowerCase().includes(m.name.toLowerCase())
        );
        if (match) assignedTo = match.id;
      }

      const insertResult = await pool.query(
        `INSERT INTO tasks (title, description, status, priority, assigned_to, project_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [task.title, task.description, task.status || 'todo', task.priority || 'medium', assignedTo, projectId, req.user.id]
      );

      const created = insertResult.rows[0];
      const assignedMember = assignedTo ? members.find(m => m.id === assignedTo) : null;
      createdTasks.push({
        ...created,
        assigned_name: assignedMember ? assignedMember.name : null,
      });
    }

    res.json({ tasks: createdTasks, count: createdTasks.length });
  } catch (err) {
    console.error('AI create-from-prompt error:', err.message);
    if (err.message.includes('GEMINI_API_KEY')) {
      return res.status(503).json({ error: 'AI features not configured. Add GEMINI_API_KEY in Railway.' });
    }
    res.status(500).json({ error: 'AI generation failed.' });
  }
}

module.exports = { suggestTasks, improveDescription, projectSummary, aiStatus, createFromPrompt };

