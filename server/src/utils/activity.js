const { Activity, Notification } = require('../models');
const { pubsub, EVENTS } = require('../graphql/pubsub');

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

  const notifications = await Notification.insertMany(docs);

  notifications.forEach((notification) => {
    pubsub.publish(EVENTS.NOTIFICATION_ADDED(String(notification.user)), {
      notificationAdded: notification,
    });
  });

  return notifications;
}

module.exports = {
  createActivity,
  createNotifications,
};
