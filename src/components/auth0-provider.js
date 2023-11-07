import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const MyAuth0Provider = ({ children }) => {
  const client = new SecretsManagerClient({ region: "us-east-1" });

  const domain  =client.send(new GetSecretValueCommand({"SecretId": "domain"}))["SecretString"];
  const clientId = client.send(new GetSecretValueCommand({"SecretId": "clientId"}))["SecretString"];



  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      redirectUri={window.location.origin}
    >
      {children}
    </Auth0Provider>
  );
};

export default MyAuth0Provider;