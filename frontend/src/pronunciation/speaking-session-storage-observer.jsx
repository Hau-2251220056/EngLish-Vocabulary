import { useEffect } from "react";
import { useAuthentication } from "../auth/use-authentication.js";
import { clearSpeakingPracticeRunStateNamespace } from "./speaking-practice-run-state.js";

export function SpeakingSessionStorageObserver() {
  const { isAuthenticated, isLoading } = useAuthentication();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      clearSpeakingPracticeRunStateNamespace(browserSessionStorage());
    }
  }, [isAuthenticated, isLoading]);

  return null;
}

function browserSessionStorage() {
  try { return window.sessionStorage; } catch { return null; }
}
