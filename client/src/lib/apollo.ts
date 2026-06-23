import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, from } from '@apollo/client';

const apiUrl =
  import.meta.env.VITE_GRAPHQL_URL?.toString() ?? 'http://localhost:4000/graphql';

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

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
});
