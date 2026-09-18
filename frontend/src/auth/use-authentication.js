import { useContext } from "react";
import { AuthenticationContext } from "./authentication-context.js";

export function useAuthentication() {
  const context = useContext(AuthenticationContext);

  if (context === null) {
    throw new Error(
      "useAuthentication must be used within AuthenticationProvider.",
    );
  }

  return context;
}
