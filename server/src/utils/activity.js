const { Activity, Notification } = require('../models');

async function createActivity({ workspace, actor, entityType, entityId, action, meta = {} }) {
  return Activity.create({
    workspace,
    actor,
    entityType,
    entityId,
    action,
    meta,
  });
}

async function createNotifications({ recipients, workspace, title, message, kind = 'INFO', referenceType, referenceId }) {
  const deduped = [...new Set(recipients.map(String))];

  if (deduped.length === 0) {
    return [];
  }

  const docs = deduped.map((userId) => ({
    user: userId,
    workspace,
    title,
    message,
    kind,
    referenceType,
    referenceId,
  }));

  return Notification.insertMany(docs);
}

module.exports = {
  createActivity,
  createNotifications,
};
