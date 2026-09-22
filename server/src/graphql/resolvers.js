const mongoose = require('mongoose');
const { DateTimeResolver, JSONResolver } = require('graphql-scalars');
const { z } = require('zod');
const {
  User,
  Workspace,
  Project,
  Task,
  Comment,
  Activity,
  Notification,
} = require('../models');
const { generateAuthToken } = require('../utils/auth');
const {
  assertAuthenticated,
  assertWorkspaceAccess,
  assertWorkspaceRole,
  assertProjectAccess,
  getWorkspaceRole,
  getProjectAccessLevel,
} = require('../utils/authorization');
const { normalizePagination, buildPageInfo } = require('../utils/pagination');
const { createActivity, createNotifications } = require('../utils/activity');
const { deleteUserAndDependencies } = require('../utils/userDeletion');
const { pubsub, EVENTS } = require('./pubsub');

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.email(),
  password: z.string().min(8).max(128),
  title: z.string().max(100).optional(),
});

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(1),
});

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

function parseId(id) {
  objectIdSchema.parse(id);
  return new mongoose.Types.ObjectId(id);
}

function parseOptionalId(id) {
  if (!id) {
    return null;
  }
  return parseId(id);
}

function assertAdmin(context) {
  const user = assertAuthenticated(context);
  if (user.role !== 'ADMIN') {
    throw new Error('Admin access required');
  }
  return user;
}

async function getWorkspaceWithAccess(workspaceId, userId) {
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const user = await User.findById(userId).select('role');
  assertWorkspaceAccess(workspace, userId, user?.role || null);

  return workspace;
}

function canManageWorkspace(workspace, userId, userRole = null) {
  if (userRole === 'ADMIN') {
    return true;
  }

  return ['ADMIN', 'MANAGER'].includes(getWorkspaceRole(workspace, userId, userRole));
}

function canManageProject(project, userId, userRole = null) {
  if (userRole === 'ADMIN') {
    return true;
  }

  const projectAccessLevel = getProjectAccessLevel(project, userId, userRole);
  return ['ADMIN', 'MANAGER'].includes(getWorkspaceRole(project.workspace, userId, userRole)) || projectAccessLevel === 'EDIT' || String(project.createdBy) === String(userId);
}

async function getTaskWithWorkspace(taskId) {
  const task = await Task.findById(taskId);
  if (!task) {
    throw new Error('Task not found');
  }

  const workspace = await Workspace.findById(task.workspace);
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  return { task, workspace };
}

async function registerUserResolver(_parent, args, context) {
  throw new Error('Registration is only available via the admin console.');
}

async function createWorkspaceResolver(_parent, args, context) {
  const user = assertAuthenticated(context);
  const name = String(args.input.name || '').trim();

  if (!['ADMIN', 'MANAGER'].includes(user.role || 'MEMBER')) {
    throw new Error('Only ADMIN or MANAGER accounts can create workspaces');
  }

  if (name.length < 2) {
    throw new Error('Workspace name must be at least 2 characters');
  }

  const workspace = await Workspace.create({
    name,
    description: args.input.description || '',
    owner: user._id,
    members: [{ user: user._id, role: 'ADMIN' }],
  });

  await createActivity({
    workspace: workspace._id,
    actor: user._id,
    entityType: 'WORKSPACE',
    entityId: workspace._id,
    action: 'WORKSPACE_CREATED',
  });

  return workspace;
}

async function addWorkspaceMemberResolver(_parent, args, context) {
  const user = assertAuthenticated(context);
  const workspaceId = parseId(args.input.workspaceId);
  const memberId = parseId(args.input.userId);

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  assertWorkspaceRole(workspace, user._id, ['ADMIN'], user.role);

  const targetUser = await User.findById(memberId);
  if (!targetUser) {
    throw new Error('User not found');
  }

  const existingIndex = workspace.members.findIndex((member) => String(member.user) === String(memberId));

  if (existingIndex >= 0) {
    workspace.members[existingIndex].role = args.input.role;
  } else {
    workspace.members.push({ user: memberId, role: args.input.role });
  }

  await workspace.save();

  await createActivity({
    workspace: workspace._id,
    actor: user._id,
    entityType: 'WORKSPACE',
    entityId: workspace._id,
    action: 'MEMBER_ADDED',
    meta: { userId: String(memberId), role: args.input.role },
  });

  await createNotifications({
    recipients: [memberId],
    workspace: workspace._id,
    title: 'Added to workspace',
    message: `You were added to ${workspace.name} as ${args.input.role}`,
    kind: 'INFO',
    referenceType: 'WORKSPACE',
    referenceId: workspace._id,
  });

  pubsub.publish(EVENTS.WORKSPACE_UPDATED(String(workspace._id)), { workspaceUpdated: workspace });

  return workspace;
}

async function removeWorkspaceMemberResolver(_parent, args, context) {
  const user = assertAuthenticated(context);
  const workspaceId = parseId(args.workspaceId);
  const memberId = parseId(args.userId);

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  assertWorkspaceRole(workspace, user._id, ['ADMIN'], user.role);

  if (String(workspace.owner) === String(memberId)) {
    throw new Error('Workspace owner cannot be removed');
  }

  workspace.members = workspace.members.filter((member) => String(member.user) !== String(memberId));
  await workspace.save();

  await createActivity({
    workspace: workspace._id,
    actor: user._id,
    entityType: 'WORKSPACE',
    entityId: workspace._id,
    action: 'MEMBER_REMOVED',
    meta: { userId: String(memberId) },
  });

  pubsub.publish(EVENTS.WORKSPACE_UPDATED(String(workspace._id)), { workspaceUpdated: workspace });

  return workspace;
}

const resolvers = {
  DateTime: DateTimeResolver,
  JSON: JSONResolver,
  Query: {
    me: async (_parent, _args, context) => {
      const user = assertAuthenticated(context);
      return User.findById(user._id);
    },

    users: async (_parent, args, context) => {
      assertAuthenticated(context);
      const { page, limit, skip } = normalizePagination(args.page, args.limit);
      const [nodes, totalCount] = await Promise.all([
        User.find({ isActive: true }).sort({ createdAt: -1 }).skip(skip).limit(limit),
        User.countDocuments({ isActive: true }),
      ]);

      return {
        nodes,
        pageInfo: buildPageInfo(totalCount, page, limit),
      };
    },

    workspaces: async (_parent, _args, context) => {
      const user = assertAuthenticated(context);
      return Workspace.find({
        $or: [{ owner: user._id }, { 'members.user': user._id }],
      }).sort({ createdAt: -1 });
    },

    teams: async (_parent, _args, context) => {
      const user = assertAuthenticated(context);
      return Workspace.find({
        $or: [{ owner: user._id }, { 'members.user': user._id }],
      }).sort({ createdAt: -1 });
    },

    workspace: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const workspaceId = parseId(args.id);
      return getWorkspaceWithAccess(workspaceId, user._id);
    },

    team: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const teamId = parseId(args.id);
      return getWorkspaceWithAccess(teamId, user._id);
    },

    projects: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const workspaceId = parseId(args.workspaceId);
      const workspace = await getWorkspaceWithAccess(workspaceId, user._id);

      const { page, limit, skip } = normalizePagination(args.page, args.limit);
      const workspaceRole = getWorkspaceRole(workspace, user._id, user.role);
      const filter = {
        workspace: workspaceId,
        ...(workspaceRole === 'ADMIN' || workspaceRole === 'MANAGER'
          ? {}
          : { $or: [{ members: { $elemMatch: { user: user._id } } }, { createdBy: user._id }] }),
      };

      const [nodes, totalCount] = await Promise.all([
        Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Project.countDocuments(filter),
      ]);

      return {
        nodes,
        pageInfo: buildPageInfo(totalCount, page, limit),
      };
    },

    project: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const project = await Project.findById(parseId(args.id));

      if (!project) {
        return null;
      }

      const workspace = await getWorkspaceWithAccess(project.workspace, user._id);
      const workspaceRole = getWorkspaceRole(workspace, user._id, user.role);
      if (workspaceRole !== 'ADMIN' && workspaceRole !== 'MANAGER' && String(project.createdBy) !== String(user._id)) {
        assertProjectAccess(project, user._id, 'VIEW', user.role);
      }
      return project.populate([{ path: 'members.user' }, { path: 'createdBy' }, { path: 'workspace' }]);
    },

    tasks: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const project = await Project.findById(parseId(args.projectId));

      if (!project) {
        throw new Error('Project not found');
      }

      const workspace = await getWorkspaceWithAccess(project.workspace, user._id);
      const workspaceRole = getWorkspaceRole(workspace, user._id, user.role);
      if (workspaceRole !== 'ADMIN' && workspaceRole !== 'MANAGER' && String(project.createdBy) !== String(user._id)) {
        assertProjectAccess(project, user._id, 'VIEW', user.role);
      }

      const { page, limit, skip } = normalizePagination(args.page, args.limit);
      const filter = { project: project._id };

      if (args.status) {
        filter.status = args.status;
      }

      if (args.priority) {
        filter.priority = args.priority;
      }

      if (args.assigneeId) {
        filter.assignee = parseId(args.assigneeId);
      }

      if (args.search && args.search.trim()) {
        const regex = new RegExp(args.search.trim(), 'i');
        filter.$or = [{ title: regex }, { description: regex }];
      }

      const [nodes, totalCount] = await Promise.all([
        Task.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Task.countDocuments(filter),
      ]);

      return {
        nodes,
        pageInfo: buildPageInfo(totalCount, page, limit),
      };
    },

    task: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const task = await Task.findById(parseId(args.id));

      if (!task) {
        return null;
      }

      const workspace = await getWorkspaceWithAccess(task.workspace, user._id);
      const project = await Project.findById(task.project);
      if (!project) {
        return null;
      }

      const workspaceRole = getWorkspaceRole(workspace, user._id, user.role);
      if (workspaceRole !== 'ADMIN' && workspaceRole !== 'MANAGER' && String(project.createdBy) !== String(user._id)) {
        assertProjectAccess(project, user._id, 'VIEW', user.role);
      }

      return task;
    },

    activityFeed: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const workspaceId = parseId(args.workspaceId);
      await getWorkspaceWithAccess(workspaceId, user._id);

      const { page, limit, skip } = normalizePagination(args.page, args.limit, 100);
      const filter = { workspace: workspaceId };

      const [nodes, totalCount] = await Promise.all([
        Activity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Activity.countDocuments(filter),
      ]);

      return {
        nodes,
        pageInfo: buildPageInfo(totalCount, page, limit),
      };
    },

    notifications: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const { page, limit, skip } = normalizePagination(args.page, args.limit, 100);

      const filter = { user: user._id };
      if (args.unreadOnly) {
        filter.readAt = null;
      }

      const [nodes, totalCount] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Notification.countDocuments(filter),
      ]);

      return {
        nodes,
        pageInfo: buildPageInfo(totalCount, page, limit),
      };
    },

    dashboard: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const workspaceId = parseId(args.workspaceId);
      const workspace = await getWorkspaceWithAccess(workspaceId, user._id);
      const workspaceRole = getWorkspaceRole(workspace, user._id, user.role);
      const projectFilter = {
        workspace: workspaceId,
        ...(workspaceRole === 'ADMIN' || workspaceRole === 'MANAGER'
          ? {}
          : { $or: [{ members: { $elemMatch: { user: user._id } } }, { createdBy: user._id }] }),
      };
      const visibleProjectIds = await Project.find(projectFilter).distinct('_id');
      const taskFilter = { workspace: workspaceId, project: { $in: visibleProjectIds } };

      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);

      const [
        totalProjects,
        totalTasks,
        overdueTasks,
        statusBuckets,
        priorityBuckets,
        completedTasksThisWeek,
      ] = await Promise.all([
        Project.countDocuments(projectFilter),
        Task.countDocuments(taskFilter),
        Task.countDocuments({ ...taskFilter, dueDate: { $lt: now }, status: { $ne: 'DONE' } }),
        Task.aggregate([
          { $match: taskFilter },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Task.aggregate([
          { $match: taskFilter },
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ]),
        Task.countDocuments({
          ...taskFilter,
          status: 'DONE',
          updatedAt: { $gte: sevenDaysAgo },
        }),
      ]);

      return {
        totalProjects,
        totalTasks,
        overdueTasks,
        tasksByStatus: statusBuckets.map((bucket) => ({ key: bucket._id, count: bucket.count })),
        tasksByPriority: priorityBuckets.map((bucket) => ({ key: bucket._id, count: bucket.count })),
        completedTasksThisWeek,
      };
    },

    adminStats: async (_parent, _args, context) => {
      assertAdmin(context);

      const [totalUsers, activeUsers, totalWorkspaces, totalProjects, totalTasks, openTasks, completedTasks] =
        await Promise.all([
          User.countDocuments({}),
          User.countDocuments({ isActive: true }),
          Workspace.countDocuments({}),
          Project.countDocuments({}),
          Task.countDocuments({}),
          Task.countDocuments({ status: { $in: ['TODO', 'IN_PROGRESS', 'REVIEW'] } }),
          Task.countDocuments({ status: 'DONE' }),
        ]);

      return {
        totalUsers,
        activeUsers,
        totalWorkspaces,
        totalProjects,
        totalTasks,
        openTasks,
        completedTasks,
      };
    },

    adminUsers: async (_parent, _args, context) => {
      assertAdmin(context);
      return User.find({}).sort({ createdAt: -1 }).limit(200);
    },

    adminWorkspaces: async (_parent, _args, context) => {
      assertAdmin(context);
      return Workspace.find({}).populate('owner').sort({ createdAt: -1 }).limit(200);
    },

    adminProjects: async (_parent, _args, context) => {
      assertAdmin(context);
      return Project.find({}).populate('workspace').populate('createdBy').sort({ createdAt: -1 }).limit(200);
    },

    adminTasks: async (_parent, _args, context) => {
      assertAdmin(context);
      return Task.find({})
        .populate('workspace')
        .populate('project')
        .populate('assignee')
        .populate('createdBy')
        .sort({ createdAt: -1 })
        .limit(300);
    },
  },

  Mutation: {
    signup: async (_parent, args, context) => {
      return registerUserResolver(_parent, args, context);
    },

    register: registerUserResolver,

    login: async (_parent, args, context) => {
      const input = loginSchema.parse(args.input);
      const normalizedUsername = input.username.trim();

      const user = await User.findOne({ username: normalizedUsername }).select('+password');
      if (!user) {
        throw new Error('Invalid credentials');
      }

      const validPassword = await user.comparePassword(input.password);
      if (!validPassword) {
        throw new Error('Invalid credentials');
      }

      const token = generateAuthToken(
        { ...user.toObject(), role: user.role || 'MEMBER' },
        context.env.JWT_SECRET,
        context.env.JWT_EXPIRES_IN
      );
      user.password = undefined;

      return { token, user, requiresPasswordChange: input.password === '12345678' };
    },

    changeMyPassword: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      if (args.newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      const targetUser = await User.findById(user._id).select('+password');
      if (!targetUser || !(await targetUser.comparePassword(args.currentPassword))) {
        throw new Error('Current password is incorrect');
      }

      targetUser.password = args.newPassword;
      return targetUser.save();
    },

    createAdminUser: async (_parent, args, context) => {
      assertAdmin(context);
      const input = args.input;
      const existing = await User.findOne({
        $or: [{ username: input.username.trim() }, { email: input.email.toLowerCase().trim() }],
      });
      if (existing) {
        throw new Error('Username or email is already in use');
      }

      return User.create({
        username: input.username.trim(),
        name: input.name,
        email: input.email,
        password: input.password,
        title: input.title || '',
        role: input.role || 'MEMBER',
        isActive: true,
      });
    },

    updateAdminUser: async (_parent, args, context) => {
      const currentAdmin = assertAdmin(context);
      const input = args.input;
      const targetUser = await User.findById(parseId(input.id)).select('+password');

      if (!targetUser) {
        throw new Error('User not found');
      }

      const nextUsername = input.username === undefined ? targetUser.username : input.username.trim();
      const nextEmail = input.email === undefined ? targetUser.email : input.email.trim().toLowerCase();
      const nextName = input.name === undefined ? targetUser.name : input.name.trim();
      const nextTitle = input.title === undefined ? targetUser.title : input.title.trim();

      if (nextName.length < 2 || nextName.length > 80) {
        throw new Error('Name must be between 2 and 80 characters');
      }
      if (!nextUsername || nextUsername.length < 3) {
        throw new Error('Username must be at least 3 characters');
      }
      if (!z.email().safeParse(nextEmail).success) {
        throw new Error('Please provide a valid email address');
      }
      if (nextTitle.length > 100) {
        throw new Error('Title must be 100 characters or fewer');
      }
      if (input.password !== undefined && input.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      const duplicate = await User.findOne({
        _id: { $ne: targetUser._id },
        $or: [{ username: nextUsername }, { email: nextEmail }],
      });
      if (duplicate) {
        throw new Error('Username or email is already in use');
      }

      if (String(targetUser._id) === String(currentAdmin._id) && input.isActive === false) {
        throw new Error('You cannot disable your own admin account');
      }

      targetUser.username = nextUsername;
      targetUser.name = nextName;
      targetUser.email = nextEmail;
      targetUser.title = nextTitle;
      if (input.password !== undefined && input.password.length > 0) targetUser.password = input.password;
      if (input.role !== undefined) targetUser.role = input.role;
      if (input.isActive !== undefined) targetUser.isActive = input.isActive;

      return targetUser.save();
    },

    resetAdminUserPassword: async (_parent, args, context) => {
      assertAdmin(context);
      const targetUser = await User.findById(parseId(args.userId)).select('+password');
      if (!targetUser) {
        throw new Error('User not found');
      }
      targetUser.password = '12345678';
      return targetUser.save();
    },

    changeAdminUserPassword: async (_parent, args, context) => {
      assertAdmin(context);
      if (args.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
      const targetUser = await User.findById(parseId(args.userId)).select('+password');
      if (!targetUser) {
        throw new Error('User not found');
      }
      targetUser.password = args.password;
      return targetUser.save();
    },

    setUserActive: async (_parent, args, context) => {
      assertAdmin(context);
      const targetUser = await User.findById(parseId(args.userId));
      if (!targetUser) {
        throw new Error('User not found');
      }
      targetUser.isActive = args.isActive;
      return targetUser.save();
    },

    deleteAdminUser: async (_parent, args, context) => {
      const currentAdmin = assertAdmin(context);
      const targetId = parseId(args.userId);

      if (String(targetId) === String(currentAdmin._id)) {
        throw new Error('You cannot delete your own admin account');
      }

      const targetUser = await User.findById(targetId);
      if (!targetUser) {
        throw new Error('User not found');
      }

      await deleteUserAndDependencies(targetId);
      return true;
    },

    setAdminTaskStatus: async (_parent, args, context) => {
      assertAdmin(context);
      const task = await Task.findByIdAndUpdate(parseId(args.taskId), { status: args.status }, { new: true })
        .populate('workspace')
        .populate('project')
        .populate('assignee')
        .populate('createdBy');
      if (!task) {
        throw new Error('Task not found');
      }
      pubsub.publish(EVENTS.TASK_CHANGED(String(task.project._id)), { taskChanged: task });
      return task;
    },

    createWorkspace: createWorkspaceResolver,

    updateWorkspace: async (_parent, args, context) => {
      const user = assertAdmin(context);
      const workspace = await Workspace.findById(parseId(args.input.id));
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      if (args.input.name !== undefined) {
        const name = String(args.input.name || '').trim();
        if (!name) {
          throw new Error('Workspace name is required');
        }
        workspace.name = name;
      }

      if (args.input.description !== undefined) {
        workspace.description = args.input.description || '';
      }

      await workspace.save();
      pubsub.publish(EVENTS.WORKSPACE_UPDATED(String(workspace._id)), { workspaceUpdated: workspace });
      return workspace;
    },

    deleteWorkspace: async (_parent, args, context) => {
      assertAdmin(context);
      const workspace = await Workspace.findById(parseId(args.id));
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      await Promise.all([
        Project.deleteMany({ workspace: workspace._id }),
        Task.deleteMany({ workspace: workspace._id }),
        Workspace.findByIdAndDelete(workspace._id),
      ]);

      return true;
    },

    addWorkspaceMember: addWorkspaceMemberResolver,

    removeWorkspaceMember: removeWorkspaceMemberResolver,

    addProjectMember: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const project = await Project.findById(parseId(args.input.projectId));
      if (!project) throw new Error('Project not found');
      const workspace = await Workspace.findById(project.workspace);
      assertWorkspaceAccess(workspace, user._id, user.role);
      const workspaceRole = getWorkspaceRole(workspace, user._id, user.role);
      const canManageProjectMembership = ['ADMIN', 'MANAGER'].includes(workspaceRole) || getProjectAccessLevel(project, user._id, user.role) === 'EDIT' || String(project.createdBy) === String(user._id);
      if (!canManageProjectMembership) {
        throw new Error('EDIT project access required');
      }
      if (!workspace.members.some((member) => String(member.user) === String(args.input.userId))) {
        throw new Error('Project member must belong to the workspace');
      }
      const existing = project.members.find((member) => String(member.user) === String(args.input.userId));
      if (existing) existing.accessLevel = args.input.accessLevel;
      else project.members.push({ user: parseId(args.input.userId), accessLevel: args.input.accessLevel });
      await project.save();
      const populated = await project.populate([{ path: 'members.user' }, { path: 'createdBy' }, { path: 'workspace' }]);
      pubsub.publish(EVENTS.PROJECT_UPDATED(String(populated._id)), { projectUpdated: populated });
      return populated;
    },

    updateProjectMemberAccess: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const project = await Project.findById(parseId(args.input.projectId));
      if (!project) throw new Error('Project not found');
      const workspace = await Workspace.findById(project.workspace);
      assertWorkspaceAccess(workspace, user._id, user.role);
      const workspaceRole = getWorkspaceRole(workspace, user._id, user.role);
      const canManageProjectMembership = ['ADMIN', 'MANAGER'].includes(workspaceRole) || getProjectAccessLevel(project, user._id, user.role) === 'EDIT' || String(project.createdBy) === String(user._id);
      if (!canManageProjectMembership) {
        throw new Error('EDIT project access required');
      }
      const member = project.members.find((entry) => String(entry.user) === String(args.input.userId));
      if (!member) throw new Error('Project member not found');
      member.accessLevel = args.input.accessLevel;
      await project.save();
      const populated = await project.populate([{ path: 'members.user' }, { path: 'createdBy' }, { path: 'workspace' }]);
      pubsub.publish(EVENTS.PROJECT_UPDATED(String(populated._id)), { projectUpdated: populated });
      return populated;
    },

    removeProjectMember: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const project = await Project.findById(parseId(args.projectId));
      if (!project) throw new Error('Project not found');
      const workspace = await Workspace.findById(project.workspace);
      assertWorkspaceAccess(workspace, user._id, user.role);
      const workspaceRole = getWorkspaceRole(workspace, user._id, user.role);
      const canManageProjectMembership = ['ADMIN', 'MANAGER'].includes(workspaceRole) || getProjectAccessLevel(project, user._id, user.role) === 'EDIT' || String(project.createdBy) === String(user._id);
      if (!canManageProjectMembership) {
        throw new Error('EDIT project access required');
      }
      if (String(args.userId) === String(project.createdBy)) throw new Error('Project creator cannot be removed');
      project.members = project.members.filter((entry) => String(entry.user) !== String(args.userId));
      await project.save();
      const populated = await project.populate([{ path: 'members.user' }, { path: 'createdBy' }, { path: 'workspace' }]);
      pubsub.publish(EVENTS.PROJECT_UPDATED(String(populated._id)), { projectUpdated: populated });
      return populated;
    },

    createTeam: async (_parent, args, context) => {
      return createWorkspaceResolver(_parent, { input: args.input }, context);
    },

    inviteUser: async (_parent, args, context) => {
      return addWorkspaceMemberResolver(_parent, { input: args.input }, context);
    },

    createProject: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const workspace = await Workspace.findById(parseId(args.input.workspaceId));

      if (!workspace) {
        throw new Error('Workspace not found');
      }

      assertWorkspaceRole(workspace, user._id, ['ADMIN', 'MANAGER'], user.role);

      const project = await Project.create({
        workspace: workspace._id,
        name: String(args.input.name || '').trim(),
        description: args.input.description || '',
        status: args.input.status || 'ACTIVE',
        startDate: args.input.startDate || null,
        dueDate: args.input.dueDate || null,
        createdBy: user._id,
        members: [],
      });

      await createActivity({
        workspace: workspace._id,
        actor: user._id,
        entityType: 'PROJECT',
        entityId: project._id,
        action: 'PROJECT_CREATED',
      });

      return project;
    },

    updateProject: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const project = await Project.findById(parseId(args.input.id));
      if (!project) {
        throw new Error('Project not found');
      }

      const workspace = await Workspace.findById(project.workspace);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      if (!canManageWorkspace(workspace, user._id, user.role) && String(project.createdBy) !== String(user._id)) {
        throw new Error('You do not have permission to update this project');
      }

      if (args.input.name !== undefined) {
        const name = String(args.input.name || '').trim();
        if (!name) {
          throw new Error('Project name is required');
        }
        project.name = name;
      }

      if (args.input.description !== undefined) {
        project.description = args.input.description || '';
      }

      if (args.input.status !== undefined) {
        project.status = args.input.status;
      }

      if (args.input.startDate !== undefined) {
        project.startDate = args.input.startDate || null;
      }

      if (args.input.dueDate !== undefined) {
        project.dueDate = args.input.dueDate || null;
      }

      await project.save();
      const populated = await project.populate([{ path: 'members.user' }, { path: 'createdBy' }, { path: 'workspace' }]);
      pubsub.publish(EVENTS.PROJECT_UPDATED(String(populated._id)), { projectUpdated: populated });
      return populated;
    },

    deleteProject: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const project = await Project.findById(parseId(args.id));
      if (!project) {
        throw new Error('Project not found');
      }

      const workspace = await Workspace.findById(project.workspace);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      if (!canManageWorkspace(workspace, user._id, user.role) && String(project.createdBy) !== String(user._id)) {
        throw new Error('You do not have permission to delete this project');
      }

      await Promise.all([
        Task.deleteMany({ project: project._id }),
        Project.findByIdAndDelete(project._id),
      ]);

      return true;
    },

    createTask: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const workspaceId = parseId(args.input.workspaceId);
      const projectId = parseId(args.input.projectId);
      const assigneeId = parseOptionalId(args.input.assigneeId);

      const [workspace, project] = await Promise.all([
        Workspace.findById(workspaceId),
        Project.findById(projectId),
      ]);

      if (!workspace) {
        throw new Error('Workspace not found');
      }

      if (!project || String(project.workspace) !== String(workspace._id)) {
        throw new Error('Project not found in this workspace');
      }

      assertWorkspaceRole(workspace, user._id, ['ADMIN', 'MANAGER', 'MEMBER'], user.role);
      if (project.members.length) assertProjectAccess(project, user._id, 'EDIT', user.role);

      const task = await Task.create({
        workspace: workspace._id,
        project: project._id,
        title: String(args.input.title || '').trim(),
        description: args.input.description || '',
        status: args.input.status || 'TODO',
        priority: args.input.priority || 'MEDIUM',
        dueDate: args.input.dueDate || null,
        assignee: assigneeId,
        createdBy: user._id,
      });

      await createActivity({
        workspace: workspace._id,
        actor: user._id,
        entityType: 'TASK',
        entityId: task._id,
        action: 'TASK_CREATED',
      });

      if (assigneeId && String(assigneeId) !== String(user._id)) {
        await createNotifications({
          recipients: [assigneeId],
          workspace: workspace._id,
          title: 'Task assigned',
          message: `You were assigned task: ${task.title}`,
          kind: 'ASSIGNMENT',
          referenceType: 'TASK',
          referenceId: task._id,
        });
      }

      pubsub.publish(EVENTS.TASK_CHANGED(String(project._id)), { taskChanged: task });

      return task;
    },

    updateTask: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const { task, workspace } = await getTaskWithWorkspace(parseId(args.input.id));

      assertWorkspaceRole(workspace, user._id, ['ADMIN', 'MANAGER', 'MEMBER'], user.role);
      const taskProject = await Project.findById(task.project);
      if (taskProject?.members.length) assertProjectAccess(taskProject, user._id, 'EDIT', user.role);

      const previousAssignee = task.assignee ? String(task.assignee) : null;
      const updates = {
        title: args.input.title,
        description: args.input.description,
        status: args.input.status,
        priority: args.input.priority,
        dueDate: args.input.dueDate,
      };

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          task[key] = value;
        }
      });

      if (args.input.assigneeId !== undefined) {
        task.assignee = parseOptionalId(args.input.assigneeId);
      }

      await task.save();

      await createActivity({
        workspace: workspace._id,
        actor: user._id,
        entityType: 'TASK',
        entityId: task._id,
        action: 'TASK_UPDATED',
        meta: {
          status: task.status,
          priority: task.priority,
        },
      });

      const currentAssignee = task.assignee ? String(task.assignee) : null;
      if (currentAssignee && currentAssignee !== previousAssignee && currentAssignee !== String(user._id)) {
        await createNotifications({
          recipients: [currentAssignee],
          workspace: workspace._id,
          title: 'Task assignment updated',
          message: `You are now assigned to task: ${task.title}`,
          kind: 'ASSIGNMENT',
          referenceType: 'TASK',
          referenceId: task._id,
        });
      }

      pubsub.publish(EVENTS.TASK_CHANGED(String(task.project)), { taskChanged: task });

      return task;
    },

    deleteTask: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const task = await Task.findById(parseId(args.id));
      if (!task) {
        throw new Error('Task not found');
      }

      const workspace = await Workspace.findById(task.workspace);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const project = await Project.findById(task.project);
      if (!project) {
        throw new Error('Project not found');
      }

      if (
        !(user.role === 'ADMIN' || canManageWorkspace(workspace, user._id, user.role)) &&
        !(project.members.length ? getProjectAccessLevel(project, user._id, user.role) === 'EDIT' : false) &&
        String(task.createdBy) !== String(user._id)
      ) {
        throw new Error('You do not have permission to delete this task');
      }

      await Task.findByIdAndDelete(task._id);
      pubsub.publish(EVENTS.TASK_CHANGED(String(task.project)), { taskChanged: task });
      return true;
    },

    addComment: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const { task, workspace } = await getTaskWithWorkspace(parseId(args.input.taskId));

      assertWorkspaceRole(workspace, user._id, ['ADMIN', 'MANAGER', 'MEMBER'], user.role);

      const body = String(args.input.body || '').trim();
      if (!body) {
        throw new Error('Comment body is required');
      }

      const comment = await Comment.create({
        workspace: workspace._id,
        task: task._id,
        author: user._id,
        body,
      });

      await createActivity({
        workspace: workspace._id,
        actor: user._id,
        entityType: 'COMMENT',
        entityId: comment._id,
        action: 'COMMENT_ADDED',
        meta: {
          taskId: String(task._id),
        },
      });

      const recipients = [task.assignee, task.createdBy].filter(
        (id) => id && String(id) !== String(user._id)
      );

      await createNotifications({
        recipients,
        workspace: workspace._id,
        title: 'New task comment',
        message: `${user.name} commented on task: ${task.title}`,
        kind: 'COMMENT',
        referenceType: 'COMMENT',
        referenceId: comment._id,
      });

      pubsub.publish(EVENTS.COMMENT_ADDED(String(task._id)), { commentAdded: comment });

      return comment;
    },

    markNotificationRead: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const notification = await Notification.findOne({
        _id: parseId(args.notificationId),
        user: user._id,
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      notification.readAt = notification.readAt || new Date();
      await notification.save();
      return notification;
    },

    markAllNotificationsRead: async (_parent, _args, context) => {
      const user = assertAuthenticated(context);
      await Notification.updateMany(
        { user: user._id, readAt: null },
        { $set: { readAt: new Date() } }
      );
      return true;
    },
  },

  Subscription: {
    taskChanged: {
      subscribe: async (_parent, args, context) => {
        const user = assertAuthenticated(context);
        const project = await Project.findById(parseId(args.projectId));
        if (!project) {
          throw new Error('Project not found');
        }
        const workspace = await Workspace.findById(project.workspace);
        assertWorkspaceAccess(workspace, user._id);
        return pubsub.asyncIterableIterator(EVENTS.TASK_CHANGED(String(project._id)));
      },
    },

    commentAdded: {
      subscribe: async (_parent, args, context) => {
        const user = assertAuthenticated(context);
        const task = await Task.findById(parseId(args.taskId));
        if (!task) {
          throw new Error('Task not found');
        }
        const workspace = await Workspace.findById(task.workspace);
        assertWorkspaceAccess(workspace, user._id);
        return pubsub.asyncIterableIterator(EVENTS.COMMENT_ADDED(String(task._id)));
      },
    },

    notificationAdded: {
      subscribe: (_parent, _args, context) => {
        const user = assertAuthenticated(context);
        return pubsub.asyncIterableIterator(EVENTS.NOTIFICATION_ADDED(String(user._id)));
      },
    },

    workspaceUpdated: {
      subscribe: async (_parent, args, context) => {
        const user = assertAuthenticated(context);
        const workspace = await Workspace.findById(parseId(args.workspaceId));
        if (!workspace) {
          throw new Error('Workspace not found');
        }
        assertWorkspaceAccess(workspace, user._id);
        return pubsub.asyncIterableIterator(EVENTS.WORKSPACE_UPDATED(String(workspace._id)));
      },
    },

    projectUpdated: {
      subscribe: async (_parent, args, context) => {
        const user = assertAuthenticated(context);
        const project = await Project.findById(parseId(args.projectId));
        if (!project) {
          throw new Error('Project not found');
        }
        const workspace = await Workspace.findById(project.workspace);
        assertWorkspaceAccess(workspace, user._id);
        return pubsub.asyncIterableIterator(EVENTS.PROJECT_UPDATED(String(project._id)));
      },
    },
  },

  WorkspaceMember: {
    user: async (parent) => User.findById(parent.user),
  },

  Workspace: {
    owner: async (parent) => User.findById(parent.owner),
  },

  Project: {
    workspace: async (parent) => Workspace.findById(parent.workspace),
    createdBy: async (parent) => User.findById(parent.createdBy),
  },

  Task: {
    workspace: async (parent) => Workspace.findById(parent.workspace),
    project: async (parent) => Project.findById(parent.project),
    assignee: async (parent) => (parent.assignee ? User.findById(parent.assignee) : null),
    createdBy: async (parent) => User.findById(parent.createdBy),
    comments: async (parent, args) => {
      const { page, limit, skip } = normalizePagination(args.page, args.limit);
      const filter = { task: parent._id };

      const [nodes, totalCount] = await Promise.all([
        Comment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Comment.countDocuments(filter),
      ]);

      return {
        nodes,
        pageInfo: buildPageInfo(totalCount, page, limit),
      };
    },
  },

  Comment: {
    workspace: async (parent) => Workspace.findById(parent.workspace),
    task: async (parent) => Task.findById(parent.task),
    author: async (parent) => User.findById(parent.author),
  },

  Activity: {
    workspace: async (parent) => Workspace.findById(parent.workspace),
    actor: async (parent) => User.findById(parent.actor),
  },

  Notification: {
    user: async (parent) => User.findById(parent.user),
    workspace: async (parent) => Workspace.findById(parent.workspace),
  },
};

module.exports = { resolvers };
