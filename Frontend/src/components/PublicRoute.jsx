/**
 * Route guard for GUEST-ONLY pages (login/register/verify).
 * Already-authenticated users are redirected to the app so they never see
 * auth forms again until they log out.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import Spinner from "./Spinner";

export default function PublicRoute({ children }) {
  const { user, booting } = useAuth();

  if (booting) return <Spinner label="Checking your session..." />;

  if (user) return <Navigate to="/" replace />;

  return children;
}
