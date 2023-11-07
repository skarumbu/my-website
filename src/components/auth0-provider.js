import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";

const MyAuth0Provider = ({ children }) => {
  return (
    <Auth0Provider
      domain={process.env.domain}
      clientId={process.env.clientId}
      redirectUri={window.location.origin}
    >
      {children}
    </Auth0Provider>
  );
};

export default MyAuth0Provider;