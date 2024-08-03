import React from "react";

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
        </nav>
      </div>
  );
};

export default NavBar;