import './styling/main.css';

import React from "react";
import NavBar from "./components/nav-bar";

function App() {
  return (
    <div className="main">
      <header className="Main-text">
        <NavBar />
      </header>
      <p>
        Welcome to my website
      </p>
    </div>
  );
}

export default App;
