import React from 'react';
import ReactDOM from 'react-dom/client';
import './styling/index.css';
import App from './App.tsx';
import Digits from './Digits.tsx';
import MomentumFinder from './MomentumFinder.tsx';
import reportWebVitals from './reportWebVitals';
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

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
  }
]);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <RouterProvider router={router} /> 
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
