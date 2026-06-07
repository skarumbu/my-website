import React from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import "../styling/nav-bar.css";
import "../styling/button.css";

const NavBar: React.FC = () => {
  const isAuthenticated = useIsAuthenticated();
  return (
    <nav className="nav-bar">
      <a href="/digits" className="button">
        Digits
      </a>
      <a href="/momentum-finder" className="button">
        NBA Games
      </a>
      <a href="/trail-finder" className="button">
        Trail Finder
      </a>
      <a href="/ideas" className="button">
        Ideas
      </a>
      <a href="/learning-plan" className="button">
        Learning Plan
      </a>
      <a href="/posts" className="button">
        Writing
      </a>
      {isAuthenticated && (
        <a href="/write" className="button">
          Write
        </a>
      )}
    </nav>
  );
};

export default NavBar;
