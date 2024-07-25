import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";

const MyAuth0Provider = ({ children }) => {
  const domain = process.env.REACT_APP_DOMAIN
  const clientId = process.env.REACT_APP_CLIENT_ID
  if (domain == undefined || clientId == undefined) {
    console.log("Environment variables undefined")
  }

  console.log("Redirect URI: " + window.location.origin)

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin
      }}
    >
      {children}
    </Auth0Provider>
  );
};

export default MyAuth0Provider;