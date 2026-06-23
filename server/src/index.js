const env = require('./config/env');
const { connectDatabase } = require('./config/db');
const { createApp } = require('./app');

async function startServer() {
  await connectDatabase(env.MONGODB_URI);
  const app = await createApp(env);

  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`TeamFlow API running on http://localhost:${env.PORT}/graphql`);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}. Shutting down TeamFlow API...`);
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start TeamFlow API:', error);
  process.exit(1);
});
