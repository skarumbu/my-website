import './App.css';

import React from "react";
import NavBar from "./components/nav-bar";

function App() {
  return (
    <div className="App">
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
