// Centralized API client
const API = {
  baseUrl: '/api',

  getToken() {
    return localStorage.getItem('token');
  },

  setToken(token) {
    localStorage.setItem('token', token);
  },

  setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  },

  getUser() {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers },
      });

      if (response.status === 401) {
        this.logout();
        return null;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  // Auth
  signup(data) { return this.request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }); },
  login(data) { return this.request('/auth/login', { method: 'POST', body: JSON.stringify(data) }); },
  getMe() { return this.request('/auth/me'); },

  // Projects
  createProject(data) { return this.request('/projects', { method: 'POST', body: JSON.stringify(data) }); },
  listProjects() { return this.request('/projects'); },
  getProject(id) { return this.request(`/projects/${id}`); },
  updateProject(id, data) { return this.request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  deleteProject(id) { return this.request(`/projects/${id}`, { method: 'DELETE' }); },

  // Members
  listMembers(projectId) { return this.request(`/projects/${projectId}/members`); },
  addMember(projectId, data) { return this.request(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify(data) }); },
  removeMember(projectId, userId) { return this.request(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }); },

  // Tasks
  createTask(projectId, data) { return this.request(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }); },
  listTasks(projectId, query = '') { return this.request(`/projects/${projectId}/tasks${query ? '?' + query : ''}`); },
  getTask(projectId, taskId) { return this.request(`/projects/${projectId}/tasks/${taskId}`); },
  updateTask(projectId, taskId, data) { return this.request(`/projects/${projectId}/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }); },
  deleteTask(projectId, taskId) { return this.request(`/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }); },

  // Dashboard
  getStats() { return this.request('/dashboard/stats'); },
  getOverdueTasks() { return this.request('/dashboard/overdue'); },
  getRecentActivity() { return this.request('/dashboard/recent-activity'); },
  getMyTasks() { return this.request('/dashboard/my-tasks'); },

  // AI
  aiStatus() { return this.request('/ai/status'); },
  aiSuggestTasks(data) { return this.request('/ai/suggest-tasks', { method: 'POST', body: JSON.stringify(data) }); },
  aiImproveDescription(data) { return this.request('/ai/improve-description', { method: 'POST', body: JSON.stringify(data) }); },
  aiProjectSummary(data) { return this.request('/ai/project-summary', { method: 'POST', body: JSON.stringify(data) }); },
  aiCreateFromPrompt(data) { return this.request('/ai/create-from-prompt', { method: 'POST', body: JSON.stringify(data) }); },
};
