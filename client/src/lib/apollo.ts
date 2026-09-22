import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, from, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const apiUrl =
  import.meta.env.VITE_GRAPHQL_URL?.toString() ?? 'http://localhost:4000/graphql';
const wsUrl = apiUrl.replace(/^http/, 'ws');

const httpLink = new HttpLink({ uri: apiUrl });

const authLink = new ApolloLink((operation, forward) => {
  const token = window.localStorage.getItem('teamflow_token');

  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  }));

  return forward(operation);
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: wsUrl,
    connectionParams: () => {
      const token = window.localStorage.getItem('teamflow_token');
      return { authorization: token ? `Bearer ${token}` : '' };
    },
  })
);

const httpChain = from([authLink, httpLink]);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
  },
  wsLink,
  httpChain
);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
