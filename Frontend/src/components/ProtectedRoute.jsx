/**
 * Route guard for AUTHENTICATED pages.
 * While the boot refresh-check runs → spinner; unauthenticated users are
 * bounced to /login remembering where they wanted to go.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import Spinner from "./Spinner";

export default function ProtectedRoute({ children }) {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) return <Spinner label="Restoring your session..." />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
