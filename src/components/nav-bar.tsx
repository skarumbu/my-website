import React from "react";
import "../styling/nav-bar.css";
import "../styling/button.css";

const NavBar: React.FC = () => {
  return (
    <nav className="nav-bar">
      <a href="/digits" className="button">
        Digits
      </a>
      <a href="/momentum-finder" className="button">
        NBA Games
      </a>
    </nav>
  );
};

export default NavBar;
