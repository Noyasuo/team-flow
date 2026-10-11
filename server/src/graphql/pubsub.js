const { PubSub } = require('graphql-subscriptions');

const pubsub = new PubSub();

const EVENTS = {
  TASK_CHANGED: (projectId) => `TASK_CHANGED:${projectId}`,
  COMMENT_ADDED: (taskId) => `COMMENT_ADDED:${taskId}`,
  NOTIFICATION_ADDED: (userId) => `NOTIFICATION_ADDED:${userId}`,
  WORKSPACE_UPDATED: (workspaceId) => `WORKSPACE_UPDATED:${workspaceId}`,
  PROJECT_UPDATED: (projectId) => `PROJECT_UPDATED:${projectId}`,
};

module.exports = { pubsub, EVENTS };
