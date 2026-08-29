/**
 * AdminProtectedRoute — guards every /admin/* page.
 *
 * Two layers of protection:
 *   1. authenticity — a valid session is required (reuse the same boot
 *      refresh that powers all protected routes);
 *   2. the SESSION ROLE must be "admin". The role comes from the access
 *      token, not the DB `role` field, so a DB-admin who signed in through
 *      the normal captcha path is correctly sent back to the user app.
 *
 * The backend enforces the same rule on every /api/admin/* call, so this
 * is a UX guard that stops the page from flashing, never the security line.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import Spinner from "./Spinner";

export default function AdminProtectedRoute({ children }) {
  const { user, role, booting } = useAuth();
  const location = useLocation();

  if (booting) return <Spinner label="Checking your session..." />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Regular users (or admins on a non-admin session) go back to the app.
  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}