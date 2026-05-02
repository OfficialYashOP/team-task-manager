let selectedColor = '#6366f1';

document.addEventListener('DOMContentLoaded', () => {
  if (!API.getToken()) { window.location.href = '/'; return; }
  initDashboard();
});

async function initDashboard() {
  setupUser();
  setupColorPicker();
  setupMobileToggle();
  await Promise.all([loadStats(), loadOverdue(), loadActivity(), loadProjects(), loadMyTasks()]);
}

function setupUser() {
  const user = API.getUser();
  if (!user) return;
  document.getElementById('greeting').textContent = `Welcome, ${user.name.split(' ')[0]}`;
  document.getElementById('sidebarUser').innerHTML = `
    <div class="avatar" style="background:${user.avatarColor || '#6366f1'}">${getInitials(user.name)}</div>
    <div class="sidebar-user-info">
      <div class="name">${escapeHtml(user.name)}</div>
      <div class="email">${escapeHtml(user.email)}</div>
    </div>
    <button class="btn-ghost" onclick="API.logout()" title="Logout" style="font-size:18px;padding:4px 8px">⏻</button>
  `;
}

function setupColorPicker() {
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.color-dot').forEach(d => d.style.borderColor = 'transparent');
      dot.style.borderColor = '#fff';
      selectedColor = dot.dataset.color;
    });
  });
  const first = document.querySelector('.color-dot');
  if (first) first.style.borderColor = '#fff';
}

function setupMobileToggle() {
  const toggle = document.getElementById('mobileToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle) toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
}

// Sections
function showSection(name) {
  ['dashboard', 'projects', 'mytasks'].forEach(s => {
    document.getElementById(s + 'Section').style.display = s === name ? 'block' : 'none';
  });
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));
  event.target.closest('.nav-item')?.classList.add('active');
  document.getElementById('sidebar').classList.remove('open');
}

// Stats
async function loadStats() {
  try {
    const { stats } = await API.getStats();
    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card" style="--card-accent:linear-gradient(135deg,#3b82f6,#6366f1)">
        <div class="stat-icon">📁</div>
        <div class="stat-value">${stats.project_count}</div>
        <div class="stat-label">Projects</div>
      </div>
      <div class="stat-card" style="--card-accent:linear-gradient(135deg,#6366f1,#8b5cf6)">
        <div class="stat-icon">📋</div>
        <div class="stat-value">${stats.total_count}</div>
        <div class="stat-label">Total Tasks</div>
      </div>
      <div class="stat-card" style="--card-accent:linear-gradient(135deg,#f59e0b,#f97316)">
        <div class="stat-icon">🔄</div>
        <div class="stat-value">${stats.in_progress_count}</div>
        <div class="stat-label">In Progress</div>
      </div>
      <div class="stat-card" style="--card-accent:linear-gradient(135deg,#10b981,#059669)">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${stats.done_count}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card" style="--card-accent:linear-gradient(135deg,#f43f5e,#e11d48)">
        <div class="stat-icon">⚠️</div>
        <div class="stat-value">${stats.overdue_count}</div>
        <div class="stat-label">Overdue</div>
      </div>
    `;
  } catch (err) { console.error(err); }
}

// Overdue
async function loadOverdue() {
  try {
    const { tasks } = await API.getOverdueTasks();
    const container = document.getElementById('overdueList');
    if (tasks.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🎉</div><h3>No overdue tasks</h3><p>Great job staying on track!</p></div>';
      return;
    }
    container.innerHTML = tasks.map(t => `
      <div class="task-item" onclick="window.location.href='/project.html?id=${t.project_id}'">
        <div class="task-status-dot" style="background:var(--status-overdue)"></div>
        <div class="task-info">
          <div class="task-title">${escapeHtml(t.title)}</div>
          <div class="task-meta">
            <span style="color:var(--status-overdue)">Due ${formatDate(t.due_date)}</span>
            <span>${escapeHtml(t.project_name)}</span>
          </div>
        </div>
        <span class="badge badge-${t.priority}">${priorityText(t.priority)}</span>
      </div>
    `).join('');
  } catch (err) { console.error(err); }
}

// Activity
async function loadActivity() {
  try {
    const { activities } = await API.getRecentActivity();
    const container = document.getElementById('activityList');
    if (activities.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No recent activity</p></div>';
      return;
    }
    container.innerHTML = activities.slice(0, 10).map(a => `
      <div class="activity-item">
        <div class="avatar" style="background:${a.avatar_color || '#6366f1'}">${getInitials(a.user_name)}</div>
        <div class="activity-content">
          <div class="action"><strong>${escapeHtml(a.user_name)}</strong> ${escapeHtml(a.details)}</div>
          <div class="time">${timeAgo(a.created_at)} · ${escapeHtml(a.project_name)}</div>
        </div>
      </div>
    `).join('');
  } catch (err) { console.error(err); }
}

// Projects
async function loadProjects() {
  try {
    const { projects } = await API.listProjects();
    const grid = document.getElementById('projectsGrid');
    const nav = document.getElementById('projectNavList');

    if (projects.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">📁</div><h3>No projects yet</h3><p>Create your first project to get started</p></div>';
      nav.innerHTML = '<div style="padding:8px 12px;font-size:13px;color:var(--text-muted)">No projects</div>';
      return;
    }

    grid.innerHTML = projects.map(p => {
      const progress = p.task_count > 0 ? Math.round((p.completed_count / p.task_count) * 100) : 0;
      return `
        <div class="project-card" style="--project-color:${p.color}" onclick="window.location.href='/project.html?id=${p.id}'">
          <h4>${escapeHtml(p.name)}</h4>
          <div class="description">${escapeHtml(p.description || 'No description')}</div>
          <div style="background:var(--bg-input);border-radius:4px;height:4px;margin-bottom:12px;overflow:hidden">
            <div style="height:100%;width:${progress}%;background:${p.color};border-radius:4px;transition:width 0.5s ease"></div>
          </div>
          <div class="project-stats">
            <span>📋 ${p.task_count} tasks</span>
            <span>✅ ${p.completed_count} done</span>
            <span>👥 ${p.member_count} members</span>
          </div>
        </div>
      `;
    }).join('');

    nav.innerHTML = projects.map(p => `
      <button class="nav-item" onclick="window.location.href='/project.html?id=${p.id}'">
        <span style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0"></span>
        ${escapeHtml(p.name)}
      </button>
    `).join('');
  } catch (err) { console.error(err); }
}

// My Tasks
async function loadMyTasks() {
  try {
    const { tasks } = await API.getMyTasks();
    const container = document.getElementById('myTasksList');
    if (tasks.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🎯</div><h3>No active tasks</h3><p>Tasks assigned to you will appear here</p></div>';
      return;
    }
    container.innerHTML = tasks.map(t => {
      const overdue = isOverdue(t.due_date) && t.status !== 'done';
      return `
        <div class="task-item" onclick="window.location.href='/project.html?id=${t.project_id}'">
          <div class="task-status-dot" style="background:${overdue ? 'var(--status-overdue)' : statusColor(t.status)}"></div>
          <div class="task-info">
            <div class="task-title">${escapeHtml(t.title)}</div>
            <div class="task-meta">
              <span class="badge badge-${t.status}">${statusText(t.status)}</span>
              <span>${escapeHtml(t.project_name)}</span>
              ${t.due_date ? `<span style="${overdue ? 'color:var(--status-overdue)' : ''}">${formatDate(t.due_date)}</span>` : ''}
            </div>
          </div>
          <span class="badge badge-${t.priority}">${priorityText(t.priority)}</span>
        </div>
      `;
    }).join('');
  } catch (err) { console.error(err); }
}

// Modals
function showCreateProjectModal() { document.getElementById('createProjectModal').classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

async function createProject() {
  const name = document.getElementById('projectName').value.trim();
  if (!name) { showToast('Project name is required', 'error'); return; }

  try {
    await API.createProject({
      name,
      description: document.getElementById('projectDesc').value.trim(),
      color: selectedColor,
    });
    showToast('Project created!', 'success');
    closeModal('createProjectModal');
    document.getElementById('projectName').value = '';
    document.getElementById('projectDesc').value = '';
    await Promise.all([loadProjects(), loadStats(), loadActivity()]);
  } catch (err) { showToast(err.message, 'error'); }
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});
