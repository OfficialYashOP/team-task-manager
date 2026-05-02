# ⚡ TaskFlow — Team Task Manager

A full-stack web application for team project management with role-based access control, task tracking, and real-time dashboards.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Express](https://img.shields.io/badge/Express-4.x-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

## 🚀 Features

- **Authentication** — Secure signup/login with JWT tokens and bcrypt password hashing
- **Project Management** — Create, edit, and delete projects with color coding
- **Team Collaboration** — Add/remove team members with role-based access (Admin/Member)
- **Task Board** — Kanban-style task tracking with 4 status columns (Todo, In Progress, Review, Done)
- **Task Assignment** — Assign tasks to team members with priority levels (Low, Medium, High, Critical)
- **Dashboard** — Overview with task stats, overdue tasks, and recent activity feed
- **Role-Based Access Control** — Admins can manage members and delete tasks; Members can create/update tasks
- **Activity Logging** — Track all project and task changes
- **Responsive Design** — Works on desktop, tablet, and mobile

## 🛠️ Tech Stack

| Layer | Technology |
|:------|:-----------|
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| Frontend | Vanilla HTML/CSS/JS |
| Security | Helmet + Rate Limiting |
| Deployment | Railway |

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/team-task-manager.git
cd team-task-manager

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your database credentials and JWT secret

# Start the server
npm start
```

### Environment Variables

| Variable | Description | Example |
|:---------|:------------|:--------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/taskmanager` |
| `JWT_SECRET` | Secret key for JWT signing | `your-secret-key-here` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` or `production` |

## 🌐 API Documentation

### Auth
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| POST | `/api/auth/signup` | Register a new user |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/api/auth/me` | Get current user profile |

### Projects
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| POST | `/api/projects` | Create project |
| GET | `/api/projects` | List user's projects |
| GET | `/api/projects/:id` | Get project details |
| PUT | `/api/projects/:id` | Update project (Admin) |
| DELETE | `/api/projects/:id` | Delete project (Admin) |
| GET | `/api/projects/:id/members` | List members |
| POST | `/api/projects/:id/members` | Add member (Admin) |
| DELETE | `/api/projects/:id/members/:userId` | Remove member (Admin) |

### Tasks
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| POST | `/api/projects/:id/tasks` | Create task |
| GET | `/api/projects/:id/tasks` | List tasks (filterable) |
| GET | `/api/projects/:id/tasks/:taskId` | Get task |
| PUT | `/api/projects/:id/tasks/:taskId` | Update task |
| DELETE | `/api/projects/:id/tasks/:taskId` | Delete task (Admin) |

### Dashboard
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| GET | `/api/dashboard/stats` | Task statistics |
| GET | `/api/dashboard/overdue` | Overdue tasks |
| GET | `/api/dashboard/recent-activity` | Activity feed |
| GET | `/api/dashboard/my-tasks` | User's assigned tasks |

## 🚀 Deployment (Railway)

1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add PostgreSQL: Click "+" → Database → PostgreSQL
4. Set environment variables: `JWT_SECRET`
5. Generate a public domain under Settings → Networking

## 📄 License

MIT
