import React from "react";
import '../styling/button.css'
import { Link } from "react-router-dom";

const DigitsButton = () => {

  return (
    <Link
      to="/digits"
      className="Button"
    >
        Digits
    </Link>
  );
};

export default DigitsButton;