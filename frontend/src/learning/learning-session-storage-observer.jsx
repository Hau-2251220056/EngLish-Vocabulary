import { useEffect } from "react";
import { useAuthentication } from "../auth/use-authentication.js";
import { clearLearningRunStateNamespace } from "./learning-run-state.js";

export function LearningSessionStorageObserver() {
  const { isAuthenticated, isLoading } = useAuthentication();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      clearLearningRunStateNamespace(window.sessionStorage);
    }
  }, [isAuthenticated, isLoading]);

  return null;
}
