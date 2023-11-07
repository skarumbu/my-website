import './App.css';

import React from "react";
import NavBar from "./components/nav-bar";

function App() {
  return (
    <div className="App">
      <NavBar />
      <header className="Main-text">
        <p style={{fontFamily: "Seaweed Script"}}>
          Welcome to my website
        </p>
      </header>
    </div>
  );
}

export default App;
