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
} = require('../utils/authorization');
const { normalizePagination, buildPageInfo } = require('../utils/pagination');
const { createActivity, createNotifications } = require('../utils/activity');

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

async function getWorkspaceWithAccess(workspaceId, userId) {
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  assertWorkspaceAccess(workspace, userId);

  return workspace;
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

  assertWorkspaceRole(workspace, user._id, ['ADMIN']);

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
      await getWorkspaceWithAccess(workspaceId, user._id);

      const { page, limit, skip } = normalizePagination(args.page, args.limit);
      const filter = { workspace: workspaceId };

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

      await getWorkspaceWithAccess(project.workspace, user._id);
      return project;
    },

    tasks: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const project = await Project.findById(parseId(args.projectId));

      if (!project) {
        throw new Error('Project not found');
      }

      await getWorkspaceWithAccess(project.workspace, user._id);

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

      await getWorkspaceWithAccess(task.workspace, user._id);
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
      await getWorkspaceWithAccess(workspaceId, user._id);

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
        Project.countDocuments({ workspace: workspaceId }),
        Task.countDocuments({ workspace: workspaceId }),
        Task.countDocuments({ workspace: workspaceId, dueDate: { $lt: now }, status: { $ne: 'DONE' } }),
        Task.aggregate([
          { $match: { workspace: workspaceId } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Task.aggregate([
          { $match: { workspace: workspaceId } },
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ]),
        Task.countDocuments({
          workspace: workspaceId,
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
      const user = assertAuthenticated(context);
      if (user.role !== 'ADMIN') {
        throw new Error('Admin access required');
      }

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
  },

  Mutation: {
    signup: async (_parent, args, context) => {
      return registerUserResolver(_parent, args, context);
    },

    register: registerUserResolver,

    login: async (_parent, args, context) => {
      const input = loginSchema.parse(args.input);
      const normalizedUsername = input.username.toLowerCase().trim();

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

      return { token, user };
    },

    createWorkspace: createWorkspaceResolver,

    addWorkspaceMember: addWorkspaceMemberResolver,

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

      assertWorkspaceRole(workspace, user._id, ['ADMIN', 'MANAGER']);

      const project = await Project.create({
        workspace: workspace._id,
        name: String(args.input.name || '').trim(),
        description: args.input.description || '',
        status: args.input.status || 'ACTIVE',
        startDate: args.input.startDate || null,
        dueDate: args.input.dueDate || null,
        createdBy: user._id,
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

      assertWorkspaceRole(workspace, user._id, ['ADMIN', 'MANAGER', 'MEMBER']);

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

      return task;
    },

    updateTask: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const { task, workspace } = await getTaskWithWorkspace(parseId(args.input.id));

      assertWorkspaceRole(workspace, user._id, ['ADMIN', 'MANAGER', 'MEMBER']);

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

      return task;
    },

    addComment: async (_parent, args, context) => {
      const user = assertAuthenticated(context);
      const { task, workspace } = await getTaskWithWorkspace(parseId(args.input.taskId));

      assertWorkspaceRole(workspace, user._id, ['ADMIN', 'MANAGER', 'MEMBER']);

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
