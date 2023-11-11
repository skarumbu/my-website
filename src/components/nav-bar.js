import React from "react";

import LoginButton from "./login-button";
import MyAuth0Provider from "./auth0-provider";
import LogoutButton from "./logout-button";

const NavBar = () => {
  return (
    <div className="nav-container mb-3">
      <nav className="navbar" style = {{backgroundColor: "#282c34"}}>
          <MyAuth0Provider>
            <LoginButton />
            <LogoutButton />
          </MyAuth0Provider>
      </nav>
    </div>
  );
};

export default NavBar;