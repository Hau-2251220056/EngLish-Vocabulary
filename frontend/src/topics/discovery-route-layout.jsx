import { AuthenticatedShell } from "../auth/ui/authenticated-shell.jsx";
import { AuthenticationLoadingState } from "../auth/ui/authentication-loading-state.jsx";
import { useAuthentication } from "../auth/use-authentication.js";
import { PublicTopicLayout } from "./public-topic-layout.jsx";

export function DiscoveryRouteLayout() {
  const { isAuthenticated, isLoading } = useAuthentication();

  if (isLoading) return <AuthenticationLoadingState />;

  return isAuthenticated ? <AuthenticatedShell /> : <PublicTopicLayout />;
}
