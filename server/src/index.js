const http = require('http');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/use/ws');

const env = require('./config/env');
const { connectDatabase, closeDatabase } = require('./config/db');
const { ensureAdminUser } = require('./config/admin');
const { createApp } = require('./app');
const { schema } = require('./graphql/schema');
const { User } = require('./models');
const { readBearerToken, verifyAuthToken } = require('./utils/auth');

async function buildSubscriptionContext(ctx) {
  let user = null;
  let role = null;
  const rawAuth = ctx.connectionParams?.authorization || ctx.connectionParams?.Authorization || '';
  const token = readBearerToken(String(rawAuth));

  if (token) {
    try {
      const payload = verifyAuthToken(token, env.JWT_SECRET);
      user = await User.findById(payload.sub);
      role = payload.role || null;
    } catch (_error) {
      user = null;
      role = null;
    }
  }

  return { env, user, role };
}

async function startServer() {
  await connectDatabase(env.MONGODB_URI);
  await ensureAdminUser(env);
  const app = await createApp(env);

  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
  const wsServerCleanup = useServer({ schema, context: buildSubscriptionContext }, wsServer);

  const server = httpServer.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`TeamFlow API running on http://localhost:${env.PORT}/graphql`);
    // eslint-disable-next-line no-console
    console.log(`TeamFlow subscriptions running on ws://localhost:${env.PORT}/graphql`);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}. Shutting down TeamFlow API...`);
    await wsServerCleanup.dispose();
    server.close(async () => {
      try {
        await closeDatabase();
      } finally {
        process.exit(0);
      }
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start TeamFlow API:', error);
  process.exit(1);
});
