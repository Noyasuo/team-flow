import { ApolloProvider } from '@apollo/client/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { apolloClient } from './lib/apollo';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </WorkspaceProvider>
      </AuthProvider>
    </ApolloProvider>
  </StrictMode>
);
