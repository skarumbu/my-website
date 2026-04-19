import React from 'react';
import ReactDOM from 'react-dom/client';
import './styling/index.css';
import App from './App.tsx';
import Digits from './Digits.tsx';
import MomentumFinder from './MomentumFinder.tsx';
import Architecture from './Architecture.tsx';
import TrailFinder from './TrailFinder.tsx';
import Dashboard from './Dashboard.tsx';
import reportWebVitals from './reportWebVitals';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";

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
  }
]);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <RouterProvider router={router} />
    </MsalProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
