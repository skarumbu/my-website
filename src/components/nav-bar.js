import React from "react";
import "../styling/nav-bar.css";
import "../styling/button.css"; // Ensure you import the button styles

const NavBar = () => {
  return (
    <nav className="nav-bar">
      <a href="/digits" className="button">
        Digits
      </a>
    </nav>
  );
};

export default NavBar;
