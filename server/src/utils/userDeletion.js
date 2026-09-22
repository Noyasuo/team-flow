const { Activity, Comment, Notification, Project, Task, Team, User, Workspace } = require('../models');

function uniqueIds(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value)))];
}

async function deleteCommentsByIds(commentIds) {
  const ids = uniqueIds(commentIds);
  if (!ids.length) {
    return;
  }

  await Promise.all([
    Comment.deleteMany({ _id: { $in: ids } }),
    Activity.deleteMany({ entityType: 'COMMENT', entityId: { $in: ids } }),
    Notification.deleteMany({ referenceType: 'COMMENT', referenceId: { $in: ids } }),
  ]);
}

async function deleteTasksByIds(taskIds) {
  const ids = uniqueIds(taskIds);
  if (!ids.length) {
    return;
  }

  const commentIds = await Comment.distinct('_id', { task: { $in: ids } });

  await Promise.all([
    deleteCommentsByIds(commentIds),
    Activity.deleteMany({ entityType: 'TASK', entityId: { $in: ids } }),
    Notification.deleteMany({ referenceType: 'TASK', referenceId: { $in: ids } }),
    Task.deleteMany({ _id: { $in: ids } }),
  ]);
}

async function deleteProjectsByIds(projectIds) {
  const ids = uniqueIds(projectIds);
  if (!ids.length) {
    return;
  }

  const taskIds = await Task.distinct('_id', { project: { $in: ids } });

  await Promise.all([
    deleteTasksByIds(taskIds),
    Activity.deleteMany({ entityType: 'PROJECT', entityId: { $in: ids } }),
    Notification.deleteMany({ referenceType: 'PROJECT', referenceId: { $in: ids } }),
    Project.deleteMany({ _id: { $in: ids } }),
  ]);
}

async function deleteWorkspacesByIds(workspaceIds) {
  const ids = uniqueIds(workspaceIds);
  if (!ids.length) {
    return;
  }

  const projectIds = await Project.distinct('_id', { workspace: { $in: ids } });

  await Promise.all([
    deleteProjectsByIds(projectIds),
    Activity.deleteMany({ workspace: { $in: ids } }),
    Notification.deleteMany({ workspace: { $in: ids } }),
    Workspace.deleteMany({ _id: { $in: ids } }),
  ]);
}

async function deleteUserAndDependencies(userId) {
  const [ownedWorkspaceIds, ownedTeamIds, createdProjectIds, createdTaskIds, authoredCommentIds] = await Promise.all([
    Workspace.distinct('_id', { owner: userId }),
    Team.distinct('_id', { owner: userId }),
    Project.distinct('_id', { createdBy: userId }),
    Task.distinct('_id', { createdBy: userId }),
    Comment.distinct('_id', { author: userId }),
  ]);

  await Promise.all([
    Workspace.updateMany({ 'members.user': userId }, { $pull: { members: { user: userId } } }),
    Team.updateMany({ 'members.user': userId }, { $pull: { members: { user: userId } } }),
    Task.updateMany({ assignee: userId }, { $set: { assignee: null } }),
    deleteWorkspacesByIds(ownedWorkspaceIds),
    Team.deleteMany({ _id: { $in: uniqueIds(ownedTeamIds) } }),
    deleteProjectsByIds(createdProjectIds),
    deleteTasksByIds(createdTaskIds),
    deleteCommentsByIds(authoredCommentIds),
    Activity.deleteMany({ actor: userId }),
    Notification.deleteMany({ user: userId }),
  ]);

  await User.findByIdAndDelete(userId);
}

module.exports = {
  deleteUserAndDependencies,
  deleteWorkspacesByIds,
  deleteProjectsByIds,
  deleteTasksByIds,
  deleteCommentsByIds,
};
