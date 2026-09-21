const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express5');

const { typeDefs } = require('./graphql/typeDefs');
const { resolvers } = require('./graphql/resolvers');
const { User } = require('./models');
const { readBearerToken, verifyAuthToken } = require('./utils/auth');

async function createApp(env) {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'teamflow-api' });
  });

  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await apolloServer.start();

  app.use(
    '/graphql',
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        let user = null;
        let role = null;
        const token = readBearerToken(req.headers.authorization);

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

        return {
          env,
          user,
          role,
        };
      },
    })
  );

  return app;
}

module.exports = { createApp };
