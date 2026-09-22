import { useQuery, useSubscription } from '@apollo/client/react';
import dayjs from 'dayjs';
import { gql } from '@apollo/client';
import { NOTIFICATION_ADDED_SUBSCRIPTION } from '../../lib/graphql';

const NOTIFICATIONS = gql`
  query Notifications($unreadOnly: Boolean, $page: Int, $limit: Int) {
    notifications(unreadOnly: $unreadOnly, page: $page, limit: $limit) {
      nodes {
        id
        title
        message
        kind
        readAt
        createdAt
      }
    }
  }
`;

type NotificationsResult = {
  notifications: {
    nodes: Array<{
      id: string;
      title: string;
      message: string;
      kind: string;
      readAt?: string | null;
      createdAt: string;
    }>;
  };
};

export function NotificationsPage() {
  const { data, loading, refetch } = useQuery<NotificationsResult>(NOTIFICATIONS, {
    variables: { unreadOnly: false, page: 1, limit: 30 },
  });

  // Live updates: the list refreshes the instant a new notification arrives - no manual refresh needed.
  useSubscription(NOTIFICATION_ADDED_SUBSCRIPTION, {
    onData: () => void refetch(),
  });

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Notifications</h2>
      {loading ? (
        <p className="text-sm text-ink/70">Loading notifications...</p>
      ) : (
        <ul className="space-y-2">
          {(data?.notifications.nodes ?? []).map((notification) => (
            <li key={notification.id} className="rounded-xl border border-ink/10 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{notification.title}</p>
                <span className="text-xs text-ink/60">
                  {dayjs(notification.createdAt).format('MMM D, HH:mm')}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink/70">{notification.message}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-aqua">
                {notification.kind} {notification.readAt ? '· read' : '· unread'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
