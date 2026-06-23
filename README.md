# TeamFlow

TeamFlow is a full-stack project management SaaS starter built with GraphQL, JWT authentication, RBAC, and a modern React + Vite + Tailwind frontend.

## Stack

- Backend: Node.js, Express 5, Apollo GraphQL Server, MongoDB + Mongoose
- Frontend: React 19, Vite, TypeScript, Tailwind CSS, Apollo Client, React Router
- Auth: JWT + route protection + workspace role checks (`ADMIN`, `MANAGER`, `MEMBER`, `VIEWER`)
- Testing: Jest + Supertest (backend), Vitest + Testing Library (frontend)

## Monorepo Structure

- `server`: API, models, schema, resolvers, auth and RBAC logic
- `client`: SaaS UI, protected routing, dashboard, kanban, task details, comments

## Core Features Implemented

- Secure register/login and JWT-based sessions
- Role-aware workspace access controls in GraphQL resolvers
- Workspace/project/task/comment/activity/notification data model
- Search/filter/pagination for task feeds
- Dashboard analytics (projects/tasks/overdue/completion + status/priority buckets)
- Kanban board with status movement and task detail view
- Notifications feed and task commenting

## Quick Start

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

Create env files from examples:

- `server/.env.example` -> `server/.env`
- `client/.env.example` -> `client/.env`

Required backend variables:

```env
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/teamflow
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
```

Frontend variable:

```env
VITE_GRAPHQL_URL=http://localhost:4000/graphql
```

### 3. Run development servers

```bash
cd server && npm run dev
cd ../client && npm run dev
```

- API: `http://localhost:4000/graphql`
- Frontend: `http://localhost:5173`

## Scripts

### Server

- `npm run dev`: start API with nodemon
- `npm run start`: start API with node
- `npm run test`: run backend tests

### Client

- `npm run dev`: start Vite dev server
- `npm run build`: typecheck and build
- `npm run test`: run frontend tests

## GraphQL Highlights

### Queries

- `me`, `users`
- `workspaces`, `workspace`
- `projects`, `project`
- `tasks`, `task`
- `activityFeed`, `notifications`, `dashboard`

### Mutations

- `register`, `login`
- `createWorkspace`, `addWorkspaceMember`
- `createProject`
- `createTask`, `updateTask`
- `addComment`
- `markNotificationRead`, `markAllNotificationsRead`

## Demo Flow (for portfolio video/screenshots)

1. Register a new user from the auth screen.
2. Create a workspace from dashboard.
3. Create a project and open the board.
4. Add tasks and move status across kanban columns.
5. Open task detail and post comments.
6. Show dashboard analytics cards and distribution lists.
7. Show notifications update when task assignment/comments happen.

## Notes

- Current frontend deps may warn on older Node patch versions. Node 20.19+ (or newer 22.12+) is recommended for the smoothest Vite ecosystem compatibility.
- This repo is designed as a strong portfolio baseline: extend with file uploads, team invites, audit logs, and CI/CD next.
