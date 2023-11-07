import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {StyleSheet} from 'react-native';

const LoginButton = () => {
  const { loginWithRedirect } = useAuth0();
  return (
    <button
      className="btn btn-primary btn-block"
      style={styles.button}
      onClick={() => loginWithRedirect()}
    >
      Log In
    </button>
  );
};

const styles = StyleSheet.create({
    button: {  
      alignItems: 'right',
      backgroundColor: 'transparent',
      borderRadius: 8,
      padding: 5,
      height: 40,
      borderWidth: 1,
      marginRight: 20,
      borderColor: 'transparent',
      fontFamily: "Seaweed Script",
      color: 'white',
      cursor: 'pointer',
    },
  });
  

export default LoginButton;