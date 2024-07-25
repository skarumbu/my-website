import React from "react";

import LoginButton from "./login-button";
import MyAuth0Provider from "./auth0-provider";
import LogoutButton from "./logout-button";
import {
  BrowserRouter as Router,
} from "react-router-dom";

const NavBar = () => {
  return (
      <div className="nav-container mb-3">
        <nav className="navbar" style = {{backgroundColor: "#282c34"}}>
        <a
          href="/digits"
          className="Button"
        >
            Digits
        </a>
          <MyAuth0Provider>
            <LoginButton />
            <LogoutButton />
          </MyAuth0Provider>
        </nav>
      </div>
  );
};

export default NavBar;