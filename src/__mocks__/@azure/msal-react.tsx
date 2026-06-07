// Manual mock for @azure/msal-react
// Jest auto-discovers this file for the scoped package @azure/msal-react
// Provides overridable defaults for all write component tests

import React from 'react';

export const useIsAuthenticated = jest.fn(() => false);

export const useMsal = jest.fn(() => ({
  instance: {
    acquireTokenSilent: jest.fn(),
    acquireTokenRedirect: jest.fn(),
    loginRedirect: jest.fn(),
  },
  inProgress: 'none',
  accounts: [{ username: 'test@example.com' }],
}));

export const MsalProvider: React.FC<{ children: React.ReactNode; instance: any }> = ({ children }) =>
  React.createElement(React.Fragment, null, children);

export const useAccount = jest.fn(() => null);
