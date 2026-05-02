let projectId = null;
let userRole = 'member';
let members = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!API.getToken()) { window.location.href = '/'; return; }
  projectId = new URLSearchParams(window.location.search).get('id');
  if (!projectId) { window.location.href = '/dashboard.html'; return; }

  setupMobile();
  setupUser();
  loadProject();
});

function setupMobile() {
  const toggle = document.getElementById('mobileToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle) toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
}

function setupUser() {
  const user = API.getUser();
  if (!user) return;
  document.getElementById('sidebarUser').innerHTML = `
    <div class="avatar" style="background:${user.avatarColor || '#6366f1'}">${getInitials(user.name)}</div>
    <div class="sidebar-user-info">
      <div class="name">${escapeHtml(user.name)}</div>
      <div class="email">${escapeHtml(user.email)}</div>
    </div>
    <button class="btn-ghost" onclick="API.logout()" title="Logout" style="font-size:18px;padding:4px 8px">⏻</button>
  `;
}

async function loadProject() {
  try {
    const data = await API.getProject(projectId);
    const p = data.project;
    userRole = data.userRole;

    document.getElementById('projectTitle').textContent = p.name;
    document.getElementById('projectDesc').textContent = p.description || '';
    document.title = `${p.name} — TaskFlow`;

    if (userRole === 'admin') {
      document.getElementById('addMemberBtn').style.display = '';
      document.getElementById('deleteProjectBtn').style.display = '';
    }

    // Check if AI is available
    checkAI();

    await Promise.all([loadTasks(), loadMembers()]);
  } catch (err) {
    showToast(err.message, 'error');
    setTimeout(() => window.location.href = '/dashboard.html', 1500);
  }
}

async function loadTasks() {
  try {
    const { tasks } = await API.listTasks(projectId);
    const columns = { todo: [], in_progress: [], review: [], done: [] };
    tasks.forEach(t => { if (columns[t.status]) columns[t.status].push(t); });

    const board = document.getElementById('taskBoard');
    const columnConfig = [
      { key: 'todo', label: 'To Do', color: 'var(--status-todo)', icon: '○' },
      { key: 'in_progress', label: 'In Progress', color: 'var(--status-progress)', icon: '◐' },
      { key: 'review', label: 'Review', color: 'var(--status-review)', icon: '◑' },
      { key: 'done', label: 'Done', color: 'var(--status-done)', icon: '●' },
    ];

    board.innerHTML = columnConfig.map(col => `
      <div class="board-column">
        <div class="column-header">
          <h4><span style="color:${col.color}">${col.icon}</span> ${col.label}</h4>
          <span class="count">${columns[col.key].length}</span>
        </div>
        <div class="column-body">
          ${columns[col.key].length === 0 ? '<div style="text-align:center;padding:20px;font-size:13px;color:var(--text-muted)">No tasks</div>' : ''}
          ${columns[col.key].map(t => renderBoardCard(t)).join('')}
        </div>
      </div>
    `).join('');
  } catch (err) { console.error(err); }
}

function renderBoardCard(t) {
  const overdue = isOverdue(t.due_date) && t.status !== 'done';
  return `
    <div class="board-task-card" onclick="editTask('${t.id}')">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
        <span class="badge badge-${t.priority}" style="font-size:10px">${priorityText(t.priority)}</span>
        ${userRole === 'admin' ? `<button class="btn-ghost" onclick="event.stopPropagation();confirmDeleteTask('${t.id}')" style="font-size:12px;padding:2px 4px;color:var(--text-muted)">✕</button>` : ''}
      </div>
      <div class="task-title">${escapeHtml(t.title)}</div>
      <div class="task-footer">
        ${t.assigned_name ? `<div style="display:flex;align-items:center;gap:6px"><div class="avatar" style="width:22px;height:22px;font-size:9px;background:${t.assigned_color || '#6366f1'}">${getInitials(t.assigned_name)}</div><span style="font-size:11px;color:var(--text-muted)">${escapeHtml(t.assigned_name.split(' ')[0])}</span></div>` : '<span></span>'}
        ${t.due_date ? `<div class="due-date ${overdue ? 'overdue' : ''}">📅 ${formatDate(t.due_date)}</div>` : ''}
      </div>
    </div>
  `;
}

async function loadMembers() {
  try {
    const data = await API.listMembers(projectId);
    members = data.members;
    const nav = document.getElementById('memberNav');
    nav.innerHTML = members.map(m => `
      <div class="nav-item" style="cursor:default;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:8px;min-width:0">
          <div class="avatar" style="width:28px;height:28px;font-size:10px;background:${m.avatar_color || '#6366f1'}">${getInitials(m.name)}</div>
          <div style="min-width:0"><div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(m.name)}</div></div>
        </div>
        <span class="badge badge-${m.role === 'admin' ? 'review' : 'todo'}" style="font-size:9px">${m.role}</span>
      </div>
    `).join('');

    // Update assign dropdown
    const select = document.getElementById('taskAssign');
    select.innerHTML = '<option value="">Unassigned</option>' + members.map(m =>
      `<option value="${m.id}">${escapeHtml(m.name)}</option>`
    ).join('');
  } catch (err) { console.error(err); }
}

// Task Modal
function showTaskModal() {
  document.getElementById('taskModalTitle').textContent = 'New Task';
  document.getElementById('taskSubmitBtn').textContent = 'Create Task';
  document.getElementById('editTaskId').value = '';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskStatus').value = 'todo';
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskAssign').value = '';
  document.getElementById('taskDueDate').value = '';
  document.getElementById('taskModal').classList.add('active');
}

async function editTask(taskId) {
  try {
    const { task } = await API.getTask(projectId, taskId);
    document.getElementById('taskModalTitle').textContent = 'Edit Task';
    document.getElementById('taskSubmitBtn').textContent = 'Update Task';
    document.getElementById('editTaskId').value = taskId;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDesc').value = task.description || '';
    document.getElementById('taskStatus').value = task.status;
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskAssign').value = task.assigned_to || '';
    document.getElementById('taskDueDate').value = task.due_date ? task.due_date.split('T')[0] : '';
    document.getElementById('taskModal').classList.add('active');
  } catch (err) { showToast(err.message, 'error'); }
}

async function submitTask() {
  const taskId = document.getElementById('editTaskId').value;
  const data = {
    title: document.getElementById('taskTitle').value.trim(),
    description: document.getElementById('taskDesc').value.trim(),
    status: document.getElementById('taskStatus').value,
    priority: document.getElementById('taskPriority').value,
    assigned_to: document.getElementById('taskAssign').value || null,
    due_date: document.getElementById('taskDueDate').value || null,
  };

  if (!data.title) { showToast('Task title is required', 'error'); return; }

  try {
    if (taskId) {
      await API.updateTask(projectId, taskId, data);
      showToast('Task updated', 'success');
    } else {
      await API.createTask(projectId, data);
      showToast('Task created', 'success');
    }
    closeModal('taskModal');
    loadTasks();
  } catch (err) { showToast(err.message, 'error'); }
}

async function confirmDeleteTask(taskId) {
  if (!confirm('Delete this task?')) return;
  try {
    await API.deleteTask(projectId, taskId);
    showToast('Task deleted', 'success');
    loadTasks();
  } catch (err) { showToast(err.message, 'error'); }
}

// Member Modal
function showMemberModal() { document.getElementById('memberModal').classList.add('active'); }

async function addMember() {
  const email = document.getElementById('memberEmail').value.trim();
  const role = document.getElementById('memberRole').value;
  if (!email) { showToast('Email is required', 'error'); return; }

  try {
    await API.addMember(projectId, { email, role });
    showToast('Member added!', 'success');
    closeModal('memberModal');
    document.getElementById('memberEmail').value = '';
    loadMembers();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteProject() {
  if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
  try {
    await API.deleteProject(projectId);
    showToast('Project deleted', 'success');
    setTimeout(() => window.location.href = '/dashboard.html', 500);
  } catch (err) { showToast(err.message, 'error'); }
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active');
});

// ==================== AI FEATURES ====================

async function checkAI() {
  try {
    const { available } = await API.aiStatus();
    if (available) {
      document.querySelectorAll('.ai-btn').forEach(b => b.style.display = '');
    }
  } catch (e) { /* AI not available */ }
}

async function aiSuggestTasks() {
  document.getElementById('aiSuggestModal').classList.add('active');
  document.getElementById('aiSuggestContent').innerHTML = '<div class="spinner"></div><p style="text-align:center;color:var(--text-muted);margin-top:12px">AI is thinking...</p>';

  try {
    const { tasks } = await API.listTasks(projectId);
    const projectName = document.getElementById('projectTitle').textContent;
    const projectDesc = document.getElementById('projectDesc').textContent;

    const result = await API.aiSuggestTasks({
      projectName,
      projectDescription: projectDesc,
      existingTasks: tasks.map(t => t.title),
    });

    document.getElementById('aiSuggestContent').innerHTML = result.suggestions.map(s => `
      <div style="background:var(--bg-glass);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
          <strong style="font-size:14px">${escapeHtml(s.title)}</strong>
          <span class="badge badge-${s.priority}">${s.priority}</span>
        </div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">${escapeHtml(s.description)}</p>
        <button class="btn btn-primary btn-sm" onclick="addSuggestedTask(${JSON.stringify(s).replace(/"/g, '&quot;')})">+ Add This Task</button>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('aiSuggestContent').innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

async function addSuggestedTask(suggestion) {
  try {
    await API.createTask(projectId, {
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority,
      status: suggestion.status || 'todo',
    });
    showToast(`Task "${suggestion.title}" added!`, 'success');
    loadTasks();
  } catch (err) { showToast(err.message, 'error'); }
}

async function aiProjectSummary() {
  document.getElementById('aiSummaryModal').classList.add('active');
  document.getElementById('aiSummaryContent').innerHTML = '<div class="spinner"></div><p style="text-align:center;color:var(--text-muted);margin-top:12px">Analyzing project...</p>';

  try {
    const result = await API.aiProjectSummary({ projectId });
    const healthColors = { on_track: '#10b981', at_risk: '#f59e0b', behind: '#ef4444' };
    const healthLabels = { on_track: 'On Track', at_risk: 'At Risk', behind: 'Behind' };

    document.getElementById('aiSummaryContent').innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:700;background:${healthColors[result.health]}22;color:${healthColors[result.health]}">
          ${healthLabels[result.health] || result.health}
        </span>
      </div>
      <p style="font-size:14px;line-height:1.7;color:var(--text-secondary);margin-bottom:20px">${escapeHtml(result.summary)}</p>
      <h4 style="font-size:13px;font-weight:700;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Recommendations</h4>
      <ul style="list-style:none;display:flex;flex-direction:column;gap:8px">
        ${result.recommendations.map(r => `<li style="font-size:13px;padding:10px 14px;background:var(--bg-glass);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-secondary)">💡 ${escapeHtml(r)}</li>`).join('')}
      </ul>
    `;
  } catch (err) {
    document.getElementById('aiSummaryContent').innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

async function aiImproveDesc() {
  const title = document.getElementById('taskTitle').value.trim();
  const desc = document.getElementById('taskDesc').value.trim();
  if (!title) { showToast('Enter a task title first', 'error'); return; }

  const btn = document.getElementById('aiDescBtn');
  const orig = btn.textContent;
  btn.textContent = '⏳ Generating...';
  btn.disabled = true;

  try {
    const result = await API.aiImproveDescription({ title, description: desc });
    document.getElementById('taskDesc').value = result.description;
    showToast('Description improved!', 'success');
  } catch (err) { showToast(err.message, 'error'); }
  finally { btn.textContent = orig; btn.disabled = false; }
}

async function aiCreateFromPrompt() {
  const input = document.getElementById('aiPromptInput');
  const btn = document.getElementById('aiPromptBtn');
  const prompt = input.value.trim();
  if (!prompt) { showToast('Type what you want AI to create', 'error'); return; }

  btn.textContent = '⏳ Creating...';
  btn.disabled = true;

  try {
    const result = await API.aiCreateFromPrompt({ prompt, projectId });
    input.value = '';
    showToast(`✅ AI created ${result.count} task${result.count > 1 ? 's' : ''}!`, 'success');
    loadTasks(); // Refresh the kanban board
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.textContent = '⚡ Create';
    btn.disabled = false;
  }
}

// Enter key support for AI command bar
document.addEventListener('DOMContentLoaded', () => {
  const aiInput = document.getElementById('aiPromptInput');
  if (aiInput) {
    aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') aiCreateFromPrompt();
    });
  }
});
