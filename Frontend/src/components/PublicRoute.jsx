/**
 * Route guard for GUEST-ONLY pages (login/register/verify).
 * Already-authenticated users are redirected so they never see auth forms
 * again until they log out — admins land in the admin console, everyone
 * else in the todo app.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import Spinner from "./Spinner";

export default function PublicRoute({ children }) {
  const { user, role, booting } = useAuth();

  if (booting) return <Spinner label="Checking your session..." />;

  if (user) return <Navigate to={role === "admin" ? "/admin" : "/"} replace />;

  return children;
}
