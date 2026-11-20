import { useEffect } from "react";
import { useAuthentication } from "../auth/use-authentication.js";
import { clearQuizRunStateNamespace } from "./quiz-run-state.js";

export function QuizSessionStorageObserver() {
  const { isAuthenticated, isLoading } = useAuthentication();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      clearQuizRunStateNamespace(window.sessionStorage);
    }
  }, [isAuthenticated, isLoading]);

  return null;
}
