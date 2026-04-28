import React from 'react';
import ReactDOM from 'react-dom/client';
import './styling/index.css';
import App from './App.tsx';
import Digits from './Digits.tsx';
import MomentumFinder from './MomentumFinder.tsx';
import Architecture from './Architecture.tsx';
import TrailFinder from './TrailFinder.tsx';
import Dashboard from './Dashboard.tsx';
import Ideas from './Ideas.tsx';
import reportWebVitals from './reportWebVitals';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig.js";

const msalInstance = new PublicClientApplication(msalConfig);

const router = createBrowserRouter([
  {
    path: "/digits",
    element: <Digits />,
  },
  {
    path: "/",
    element: <App />
  },
  {
    path: "momentum-finder",
    element: <MomentumFinder />
  },
  {
    path: "/architecture",
    element: <Architecture />
  },
  {
    path: "/trail-finder",
    element: <TrailFinder />
  },
  {
    path: "/dashboard",
    element: <Dashboard />
  },
  {
    path: "/ideas",
    element: <Ideas />
  }
]);

// MSAL v3+ requires explicit initialization before first render so the
// popup redirect response is handled correctly instead of re-rendering the app.
msalInstance.initialize().then(() => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <RouterProvider router={router} />
      </MsalProvider>
    </React.StrictMode>
  );
  reportWebVitals();
});
