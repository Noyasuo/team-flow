const express = require('express');
const {
  Project,
  Task,
  User,
  Workspace,
} = require('../models');
const {
  deleteUserAndDependencies,
  deleteWorkspacesByIds,
  deleteProjectsByIds,
  deleteTasksByIds,
} = require('../utils/userDeletion');

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const ACCESS_ROLES = [
  { value: 'ADMIN', label: 'Admin', description: 'Full system access. Can manage all workspaces, projects, users, and settings.' },
  { value: 'MANAGER', label: 'Manager', description: 'Can create and manage projects, assign tasks, and oversee team workflows.' },
  { value: 'MEMBER', label: 'Member', description: 'Standard access. Can view projects, work on assigned tasks, and add comments.' },
  { value: 'VIEWER', label: 'Viewer', description: 'Read-only access. Can view projects and tasks but cannot make changes.' },
];

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toISOString().replace('T', ' ').slice(0, 16);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value = '') {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function toRegexSearch(query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    return null;
  }

  return new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function statusPill(label, tone = 'neutral') {
  return `<span class="pill pill-${tone}">${escapeHtml(label)}</span>`;
}

function navLink(path, label, activePath) {
  const className = path === activePath ? 'nav-link active' : 'nav-link';
  return `<a href="${path}" class="${className}">${escapeHtml(label)}</a>`;
}

function renderNotice(req) {
  const ok = String(req.query.ok || '').trim();
  const error = String(req.query.error || '').trim();

  if (error) {
    return `<div class="notice notice-error">${escapeHtml(error)}</div>`;
  }

  if (ok) {
    return `<div class="notice notice-success">${escapeHtml(ok)}</div>`;
  }

  return '';
}

function basicAuthMiddleware(env) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="TeamFlow Admin"');
      return res.status(401).send('Authentication required');
    }

    const encoded = authHeader.slice(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    const username = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : '';
    const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : '';

    if (username !== env.ADMIN_EMAIL || password !== env.ADMIN_PASSWORD) {
      res.setHeader('WWW-Authenticate', 'Basic realm="TeamFlow Admin"');
      return res.status(401).send('Invalid admin credentials');
    }

    return next();
  };
}

function layout(title, content, activePath = '/admin') {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)} · TeamFlow Admin</title>
    <style>
      :root {
        --bg: #f2f7f5;
        --ink: #1f2a37;
        --muted: #526070;
        --surface: #ffffff;
        --line: #d4e1dd;
        --brand: #0e7490;
        --brand-ink: #ecfeff;
        --danger: #b42318;
        --danger-soft: #fef3f2;
        --ok: #05603a;
        --ok-soft: #ecfdf3;
      }

      * { box-sizing: border-box; }
      body {
        font-family: "Segoe UI", "Trebuchet MS", Verdana, sans-serif;
        margin: 0;
        color: var(--ink);
        background:
          radial-gradient(1200px 500px at 100% -100px, #d9f7ff 0%, transparent 65%),
          radial-gradient(900px 380px at -200px 0, #d6f7e6 0%, transparent 55%),
          var(--bg);
      }

      header {
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        backdrop-filter: blur(6px);
        background: rgba(255, 255, 255, 0.86);
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .shell {
        max-width: 1180px;
        margin: 0 auto;
        padding: 18px 20px;
      }

      .brand-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }

      .brand {
        margin: 0;
        font-size: 22px;
        letter-spacing: 0.02em;
      }

      .brand small {
        font-size: 12px;
        color: var(--muted);
        margin-left: 8px;
      }

      nav {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 14px;
      }

      .nav-link {
        text-decoration: none;
        color: #0f172a;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 14px;
        border: 1px solid transparent;
      }

      .nav-link:hover { border-color: #bfdad4; background: #effaf8; }
      .nav-link.active { background: #0f766e; color: #effffc; }

      main { padding: 24px 20px 36px; max-width: 1180px; margin: 0 auto; }

      .notice {
        border-radius: 12px;
        padding: 10px 12px;
        margin-bottom: 14px;
        font-weight: 600;
        font-size: 14px;
        border: 1px solid transparent;
      }

      .notice-success {
        background: var(--ok-soft);
        color: var(--ok);
        border-color: #9dd8b6;
      }

      .notice-error {
        background: var(--danger-soft);
        color: var(--danger);
        border-color: #f5b4ae;
      }

      .grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        margin-bottom: 16px;
      }

      .stat {
        background: linear-gradient(160deg, #ffffff 0%, #f8fbfc 100%);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 14px;
      }

      .stat-label {
        margin: 0 0 6px;
        color: var(--muted);
        font-size: 13px;
      }

      .stat-value {
        margin: 0;
        font-size: 29px;
        font-weight: 700;
      }

      .card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 18px;
        margin-bottom: 16px;
        box-shadow: 0 8px 20px rgba(12, 35, 32, 0.04);
      }

      .card-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: baseline;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }

      h3 { margin: 0; font-size: 20px; }
      .muted { color: var(--muted); font-size: 13px; margin: 0; }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-bottom: 12px;
      }

      .toolbar form {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }

      input, select {
        border: 1px solid #bcd0ca;
        border-radius: 10px;
        padding: 8px 10px;
        min-width: 130px;
        font-size: 14px;
        color: #203040;
        background: #ffffff;
      }

      input:focus, select:focus {
        outline: 2px solid #8dd7e8;
        outline-offset: 0;
        border-color: #5cb6cc;
      }

      .btn {
        border: 1px solid #0f766e;
        background: #0f766e;
        color: #f3fdfa;
        padding: 8px 12px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .btn:hover { filter: brightness(0.96); }
      .btn.secondary { background: #ffffff; color: #115e59; }
      .btn.danger { border-color: #b42318; background: #b42318; }
      .btn.tiny { padding: 6px 9px; border-radius: 8px; font-size: 12px; }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th, td {
        border-bottom: 1px solid #e9f0ed;
        padding: 10px;
        text-align: left;
        font-size: 14px;
        vertical-align: middle;
      }

      th {
        color: #415566;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      tr:hover td { background: #fafefd; }

      .row-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .inline { display: inline-flex; gap: 8px; align-items: center; }

      .pill {
        display: inline-flex;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid transparent;
        font-size: 12px;
        font-weight: 700;
      }

      .pill-neutral { background: #eef2f7; color: #334155; border-color: #d8e0ea; }
      .pill-ok { background: #ecfdf3; color: #05603a; border-color: #b9e8ca; }
      .pill-warn { background: #fff8eb; color: #8b5c08; border-color: #f7d99b; }
      .pill-danger { background: #fef3f2; color: #b42318; border-color: #f5b4ae; }
      .pill-info { background: #ecfeff; color: #0e7490; border-color: #b7eaf4; }

      .split {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }

      .stack { display: flex; flex-direction: column; gap: 10px; }

      .empty {
        padding: 20px;
        border: 1px dashed #bdd2cc;
        border-radius: 14px;
        text-align: center;
        color: var(--muted);
      }

      @media (min-width: 960px) {
        .split { grid-template-columns: 1.05fr 1.65fr; }
      }

      @media (max-width: 680px) {
        .brand { font-size: 20px; }
        main { padding: 16px 12px 26px; }
        .card { padding: 14px; }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="shell">
        <div class="brand-row">
          <h1 class="brand">TeamFlow Admin <small>Operations Console</small></h1>
          <span class="pill pill-info">Protected Area</span>
        </div>
        <nav>
          ${navLink('/admin', 'Overview', activePath)}
          ${navLink('/admin/users', 'Users', activePath)}
          ${navLink('/admin/workspaces', 'Workspaces', activePath)}
          ${navLink('/admin/projects', 'Projects', activePath)}
          ${navLink('/admin/tasks', 'Tasks', activePath)}
        </nav>
      </div>
    </header>
    <main>${content}</main>
  </body>
</html>`;
}

function createAdminRouter(env) {
  const router = express.Router();
  router.use(express.urlencoded({ extended: false }));
  router.use(basicAuthMiddleware(env));

  router.get('/', async (req, res) => {
    const [users, workspaces, projects, tasks] = await Promise.all([
      User.countDocuments({}),
      Workspace.countDocuments({}),
      Project.countDocuments({}),
      Task.countDocuments({}),
    ]);

    const [openTasks, doneTasks, disabledUsers] = await Promise.all([
      Task.countDocuments({ status: { $in: ['TODO', 'IN_PROGRESS', 'REVIEW'] } }),
      Task.countDocuments({ status: 'DONE' }),
      User.countDocuments({ isActive: false }),
    ]);

    const completion = tasks > 0 ? Math.round((doneTasks / tasks) * 100) : 0;

    const content = `
      ${renderNotice(req)}
      <div class="grid">
        <section class="stat"><p class="stat-label">Total Users</p><p class="stat-value">${users}</p></section>
        <section class="stat"><p class="stat-label">Workspaces</p><p class="stat-value">${workspaces}</p></section>
        <section class="stat"><p class="stat-label">Projects</p><p class="stat-value">${projects}</p></section>
        <section class="stat"><p class="stat-label">Tasks</p><p class="stat-value">${tasks}</p></section>
      </div>
      <div class="card">
        <div class="card-head">
          <h3>Live Operations Snapshot</h3>
          <p class="muted">A quick pulse check for system health and delivery progress.</p>
        </div>
        <div class="grid" style="margin-bottom:0">
          <section class="stat">
            <p class="stat-label">Active Users</p>
            <p class="stat-value">${users - disabledUsers}</p>
            <p class="muted">Disabled: ${disabledUsers}</p>
          </section>
          <section class="stat">
            <p class="stat-label">Open Tasks</p>
            <p class="stat-value">${openTasks}</p>
            <p class="muted">Done: ${doneTasks}</p>
          </section>
          <section class="stat">
            <p class="stat-label">Completion</p>
            <p class="stat-value">${completion}%</p>
            <p class="muted">Across all tasks</p>
          </section>
        </div>
      </div>
    `;

    res.send(layout('Overview', content, '/admin'));
  });

  router.get('/users', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || 'all').trim().toLowerCase();
    const filter = {};

    if (status === 'active') {
      filter.isActive = true;
    }

    if (status === 'disabled') {
      filter.isActive = false;
    }

    const searchRegex = toRegexSearch(q);
    if (searchRegex) {
      filter.$or = [{ name: searchRegex }, { email: searchRegex }, { title: searchRegex }];
    }

    const [users, total, activeCount, disabledCount] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).limit(200),
      User.countDocuments(filter),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
    ]);

    const rows = users
      .map(
        (user) => {
          const roleTone = user.role === 'ADMIN' ? 'danger' : user.role === 'MANAGER' ? 'warn' : user.role === 'VIEWER' ? 'info' : 'neutral';
          return `
          <tr>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml(user.title || '-')}</td>
            <td>${statusPill(user.role || 'MEMBER', roleTone)}</td>
            <td>${user.isActive ? statusPill('Active', 'ok') : statusPill('Disabled', 'danger')}</td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
              <div class="row-actions">
                <form method="POST" action="/admin/users/${user._id}/toggle-active" class="inline">
                  <button class="btn secondary tiny" type="submit">${user.isActive ? 'Disable' : 'Enable'}</button>
                </form>
                <form method="POST" action="/admin/users/${user._id}/delete" class="inline" onsubmit="return confirm('Delete this user and remove their related records? This cannot be undone.');">
                  <button class="btn danger tiny" type="submit">Delete</button>
                </form>
              </div>
            </td>
          </tr>`;
        }
      )
      .join('');

    const content = `
      ${renderNotice(req)}
      <div class="grid">
        <section class="stat"><p class="stat-label">Visible Results</p><p class="stat-value">${total}</p></section>
        <section class="stat"><p class="stat-label">Active Users</p><p class="stat-value">${activeCount}</p></section>
        <section class="stat"><p class="stat-label">Disabled Users</p><p class="stat-value">${disabledCount}</p></section>
      </div>
      <div class="split">
        <section class="card">
          <div class="card-head">
            <h3>Create Account</h3>
            <p class="muted">Only authenticated admin panel users can create new accounts.</p>
          </div>
          <form method="POST" action="/admin/users/create" class="stack">
            <input name="name" maxlength="80" minlength="2" required placeholder="Full name" />
            <input type="email" name="email" required placeholder="Email" />
            <input name="title" maxlength="100" placeholder="Title (optional)" />
            <input type="password" name="password" minlength="8" required placeholder="Temporary password (min 8 chars)" />
            <fieldset style="border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0">
              <legend style="font-size:13px;font-weight:600;color:var(--muted);padding:0 6px">Access Level</legend>
              ${ACCESS_ROLES.map((r, i) => `
                <label style="display:flex;align-items:flex-start;gap:8px;padding:8px 4px;border-radius:8px;cursor:pointer${i < ACCESS_ROLES.length - 1 ? ';border-bottom:1px solid var(--line)' : ''}">
                  <input type="radio" name="role" value="${r.value}" ${r.value === 'MEMBER' ? 'checked' : ''} style="margin-top:3px;min-width:16px" />
                  <span>
                    <strong style="font-size:14px">${escapeHtml(r.label)}</strong>
                    <span style="display:block;font-size:12px;color:var(--muted);margin-top:2px">${escapeHtml(r.description)}</span>
                  </span>
                </label>
              `).join('')}
            </fieldset>
            <button class="btn" type="submit">Create Account</button>
          </form>
        </section>
        <section class="card">
          <div class="card-head">
            <h3>Users</h3>
            <p class="muted">Manage activation state, search filters, and irreversible account deletion.</p>
          </div>
          <div class="toolbar">
            <form method="GET" action="/admin/users">
              <input name="q" placeholder="Search name/email/title" value="${escapeAttr(q)}" />
              <select name="status">
                <option value="all" ${status === 'all' ? 'selected' : ''}>All statuses</option>
                <option value="active" ${status === 'active' ? 'selected' : ''}>Active only</option>
                <option value="disabled" ${status === 'disabled' ? 'selected' : ''}>Disabled only</option>
              </select>
              <button class="btn secondary" type="submit">Apply</button>
              <a class="btn secondary" href="/admin/users">Reset</a>
            </form>
          </div>
          ${rows ? `
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Title</th><th>Role</th><th>Status</th><th>Created</th><th>Action</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          ` : '<div class="empty">No users match the current filter.</div>'}
        </section>
      </div>
    `;

    res.send(layout('Users', content, '/admin/users'));
  });

  router.post('/users/create', async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const title = String(req.body.title || '').trim();
    const password = String(req.body.password || '');
    const role = ACCESS_ROLES.find((r) => r.value === req.body.role) ? req.body.role : 'MEMBER';

    if (name.length < 2) {
      return res.redirect('/admin/users?error=Name%20must%20be%20at%20least%202%20characters');
    }

    if (!email || !email.includes('@')) {
      return res.redirect('/admin/users?error=Please%20provide%20a%20valid%20email');
    }

    if (password.length < 8) {
      return res.redirect('/admin/users?error=Password%20must%20be%20at%20least%208%20characters');
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.redirect('/admin/users?error=Email%20is%20already%20in%20use');
    }

    await User.create({
      name,
      email,
      title,
      password,
      role,
      isActive: true,
    });

    return res.redirect('/admin/users?ok=Account%20created%20successfully');
  });

  router.post('/users/:id/toggle-active', async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
      user.isActive = !user.isActive;
      await user.save();
      return res.redirect(`/admin/users?ok=User%20${user.isActive ? 'enabled' : 'disabled'}%20successfully`);
    }
    return res.redirect('/admin/users?error=User%20not%20found');
  });

  router.post('/users/:id/delete', async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.redirect('/admin/users?error=User%20not%20found');
    }

    await deleteUserAndDependencies(user._id);
    return res.redirect('/admin/users?ok=User%20deleted%20successfully');
  });

  router.get('/workspaces', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const filter = {};

    const searchRegex = toRegexSearch(q);
    if (searchRegex) {
      filter.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    const [workspaces, total] = await Promise.all([
      Workspace.find(filter).populate('owner').sort({ createdAt: -1 }).limit(200),
      Workspace.countDocuments(filter),
    ]);

    const rows = workspaces
      .map(
        (ws) => `
          <tr>
            <td><a href="/admin/workspaces/${ws._id}" style="color:var(--brand);text-decoration:none;font-weight:600">${escapeHtml(ws.name)}</a></td>
            <td>${escapeHtml(ws.description || '-')}</td>
            <td>${ws.owner ? escapeHtml(ws.owner.name) : '<span class="muted">Unknown</span>'}</td>
            <td>${ws.members ? ws.members.length : 0}</td>
            <td>${formatDate(ws.createdAt)}</td>
            <td>
              <form method="POST" action="/admin/workspaces/${ws._id}/delete" class="inline" onsubmit="return confirm('Delete this workspace and all its projects and tasks?');">
                <button class="btn danger tiny" type="submit">Delete</button>
              </form>
            </td>
          </tr>`
      )
      .join('');

    const content = `
      <div class="card">
        <div class="card-head">
          <h3>Workspaces</h3>
          <p class="muted">${total} workspace(s) in current view.</p>
        </div>
        ${renderNotice(req)}
        <div class="toolbar">
          <form method="GET" action="/admin/workspaces">
            <input name="q" placeholder="Search workspace" value="${escapeAttr(q)}" />
            <button class="btn secondary" type="submit">Apply</button>
            <a class="btn secondary" href="/admin/workspaces">Reset</a>
          </form>
        </div>
        ${rows ? `
          <table>
            <thead>
              <tr><th>Name</th><th>Description</th><th>Owner / Creator</th><th>Members</th><th>Created</th><th>Action</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        ` : '<div class="empty">No workspaces match the current filter.</div>'}
      </div>
    `;

    res.send(layout('Workspaces', content, '/admin/workspaces'));
  });

  router.get('/workspaces/:id', async (req, res) => {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) {
      return res.redirect('/admin/workspaces?error=Workspace%20not%20found');
    }

    const memberIds = ws.members.map((m) => m.user);
    const users = await User.find({ _id: { $in: memberIds } });
    const userMap = {};
    users.forEach((u) => { userMap[String(u._id)] = u; });

    const [projectCount, taskCount] = await Promise.all([
      Project.countDocuments({ workspace: ws._id }),
      Task.countDocuments({ workspace: ws._id }),
    ]);

    const owner = await User.findById(ws.owner);

    const memberRows = ws.members
      .map((m) => {
        const u = userMap[String(m.user)];
        const roleTone = m.role === 'ADMIN' ? 'danger' : m.role === 'MANAGER' ? 'warn' : 'neutral';
        return `
          <tr>
            <td>${u ? escapeHtml(u.name) : 'Unknown'}</td>
            <td>${u ? escapeHtml(u.email) : '-'}</td>
            <td>${statusPill(m.role, roleTone)}</td>
          </tr>`;
      })
      .join('');

    const content = `
      ${renderNotice(req)}
      <div class="card">
        <div class="card-head">
          <h3>${escapeHtml(ws.name)}</h3>
          <a class="btn secondary tiny" href="/admin/workspaces">&larr; Back to list</a>
        </div>
        <div class="grid">
          <section class="stat"><p class="stat-label">Owner / Creator</p><p class="stat-value" style="font-size:16px">${owner ? `${escapeHtml(owner.name)} (${escapeHtml(owner.email)})` : 'Unknown'}</p></section>
          <section class="stat"><p class="stat-label">Members</p><p class="stat-value">${ws.members.length}</p></section>
          <section class="stat"><p class="stat-label">Projects</p><p class="stat-value">${projectCount}</p></section>
          <section class="stat"><p class="stat-label">Tasks</p><p class="stat-value">${taskCount}</p></section>
        </div>
        <p class="muted" style="margin-bottom:8px">Description: ${escapeHtml(ws.description || 'No description')}</p>
        <p class="muted">Created: ${formatDate(ws.createdAt)}</p>
      </div>
      <div class="card">
        <div class="card-head">
          <h3>Members</h3>
          <p class="muted">${ws.members.length} member(s)</p>
        </div>
        ${memberRows ? `
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th></tr>
            </thead>
            <tbody>${memberRows}</tbody>
          </table>
        ` : '<div class="empty">No members in this workspace.</div>'}
      </div>
    `;

    res.send(layout(`Workspace: ${ws.name}`, content, '/admin/workspaces'));
  });

  router.post('/workspaces/:id/delete', async (req, res) => {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) {
      return res.redirect('/admin/workspaces?error=Workspace%20not%20found');
    }

    await deleteWorkspacesByIds([ws._id]);

    return res.redirect('/admin/workspaces?ok=Workspace%20deleted%20successfully');
  });

  router.get('/projects', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || 'all').trim().toUpperCase();
    const filter = {};

    if (status !== 'ALL') {
      filter.status = status;
    }

    const searchRegex = toRegexSearch(q);
    if (searchRegex) {
      filter.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    const [projects, total] = await Promise.all([
      Project.find(filter).populate('createdBy').populate('workspace').sort({ createdAt: -1 }).limit(200),
      Project.countDocuments(filter),
    ]);

    const rows = projects
      .map(
        (project) => `
          <tr>
            <td>${escapeHtml(project.name)}</td>
            <td>${project.workspace ? escapeHtml(project.workspace.name) : '<span class="muted">-</span>'}</td>
            <td>${project.createdBy ? escapeHtml(project.createdBy.name) : '<span class="muted">Unknown</span>'}</td>
            <td>${statusPill(project.status, project.status === 'DONE' ? 'ok' : project.status === 'AT_RISK' ? 'danger' : 'info')}</td>
            <td>${project.dueDate ? formatDate(project.dueDate).slice(0, 10) : '-'}</td>
            <td>${formatDate(project.createdAt)}</td>
            <td>
              <form method="POST" action="/admin/projects/${project._id}/delete" class="inline" onsubmit="return confirm('Delete this project and its tasks?');">
                <button class="btn danger tiny" type="submit">Delete</button>
              </form>
            </td>
          </tr>`
      )
      .join('');

    const content = `
      <div class="card">
        <div class="card-head">
          <h3>Projects</h3>
          <p class="muted">${total} project(s) in current view.</p>
        </div>
        ${renderNotice(req)}
        <div class="toolbar">
          <form method="GET" action="/admin/projects">
            <input name="q" placeholder="Search project" value="${escapeAttr(q)}" />
            <select name="status">
              <option value="all" ${status === 'ALL' ? 'selected' : ''}>All statuses</option>
              <option value="PLANNING" ${status === 'PLANNING' ? 'selected' : ''}>PLANNING</option>
              <option value="ON_TRACK" ${status === 'ON_TRACK' ? 'selected' : ''}>ON_TRACK</option>
              <option value="AT_RISK" ${status === 'AT_RISK' ? 'selected' : ''}>AT_RISK</option>
              <option value="DONE" ${status === 'DONE' ? 'selected' : ''}>DONE</option>
            </select>
            <button class="btn secondary" type="submit">Apply</button>
            <a class="btn secondary" href="/admin/projects">Reset</a>
          </form>
        </div>
        ${rows ? `
          <table>
            <thead>
              <tr><th>Name</th><th>Workspace</th><th>Created By</th><th>Status</th><th>Due</th><th>Created</th><th>Action</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        ` : '<div class="empty">No projects match the current filter.</div>'}
      </div>
    `;

    res.send(layout('Projects', content, '/admin/projects'));
  });

  router.post('/projects/:id/delete', async (req, res) => {
    await deleteProjectsByIds([req.params.id]);
    res.redirect('/admin/projects?ok=Project%20deleted%20successfully');
  });

  router.get('/tasks', async (req, res) => {
    const status = String(req.query.status || 'all').trim().toUpperCase();
    const priority = String(req.query.priority || 'all').trim().toUpperCase();
    const q = String(req.query.q || '').trim();
    const filter = {};

    if (status !== 'ALL') {
      filter.status = status;
    }

    if (priority !== 'ALL') {
      filter.priority = priority;
    }

    const searchRegex = toRegexSearch(q);
    if (searchRegex) {
      filter.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    const [tasks, total] = await Promise.all([
      Task.find(filter).sort({ createdAt: -1 }).limit(300),
      Task.countDocuments(filter),
    ]);

    const rows = tasks
      .map(
        (task) => `
          <tr>
            <td>${escapeHtml(task.title)}</td>
            <td>
              <form method="POST" action="/admin/tasks/${task._id}/status" class="inline">
                <select name="status">
                  ${TASK_STATUSES.map((item) => `<option value="${item}" ${task.status === item ? 'selected' : ''}>${item}</option>`).join('')}
                </select>
                <button class="btn secondary tiny" type="submit">Save</button>
              </form>
            </td>
            <td>${statusPill(task.priority, task.priority === 'CRITICAL' ? 'danger' : task.priority === 'HIGH' ? 'warn' : 'neutral')}</td>
            <td>${task.dueDate ? formatDate(task.dueDate).slice(0, 10) : '-'}</td>
            <td>
              <form method="POST" action="/admin/tasks/${task._id}/delete" class="inline" onsubmit="return confirm('Delete task?');">
                <button class="btn danger tiny" type="submit">Delete</button>
              </form>
            </td>
          </tr>`
      )
      .join('');

    const content = `
      <div class="card">
        <div class="card-head">
          <h3>Tasks</h3>
          <p class="muted">${total} task(s) in current view.</p>
        </div>
        ${renderNotice(req)}
        <div class="toolbar">
          <form method="GET" action="/admin/tasks">
            <input name="q" placeholder="Search tasks" value="${escapeAttr(q)}" />
            <select name="status">
              <option value="all" ${status === 'ALL' ? 'selected' : ''}>All statuses</option>
              ${TASK_STATUSES.map((item) => `<option value="${item}" ${status === item ? 'selected' : ''}>${item}</option>`).join('')}
            </select>
            <select name="priority">
              <option value="all" ${priority === 'ALL' ? 'selected' : ''}>All priorities</option>
              ${TASK_PRIORITIES.map((item) => `<option value="${item}" ${priority === item ? 'selected' : ''}>${item}</option>`).join('')}
            </select>
            <button class="btn secondary" type="submit">Apply</button>
            <a class="btn secondary" href="/admin/tasks">Reset</a>
          </form>
        </div>
        ${rows ? `
          <table>
            <thead>
              <tr><th>Title</th><th>Status</th><th>Priority</th><th>Due</th><th>Action</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        ` : '<div class="empty">No tasks match the current filter.</div>'}
      </div>
    `;

    res.send(layout('Tasks', content, '/admin/tasks'));
  });

  router.post('/tasks/:id/status', async (req, res) => {
    const allowed = TASK_STATUSES;
    const status = allowed.includes(req.body.status) ? req.body.status : null;

    if (status) {
      await Task.findByIdAndUpdate(req.params.id, { status });
      return res.redirect('/admin/tasks?ok=Task%20status%20updated');
    }

    return res.redirect('/admin/tasks?error=Invalid%20status%20value');
  });

  router.post('/tasks/:id/delete', async (req, res) => {
    await deleteTasksByIds([req.params.id]);
    res.redirect('/admin/tasks?ok=Task%20deleted%20successfully');
  });

  return router;
}

module.exports = { createAdminRouter };
