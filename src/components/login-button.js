import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import '../styling/button.css'

const LoginButton = () => {
  const { loginWithRedirect } = useAuth0();
  console.log(loginWithRedirect.sub);

  return (
    <button
      className="Button"
      onClick={() => loginWithRedirect()}
    >
      Log In
    </button>
  );
};

export default LoginButton;