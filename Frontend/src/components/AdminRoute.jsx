/**
 * AdminRoute — guards /admin/* pages.
 *
 * Reuses authenticated+boot logic, then additionally requires the SESSION
 * role to be "admin". A normal user is bounced back to the app home; an
 * unauthenticated visitor goes to /login. The backend also enforces this
 * on every /api/admin/* call, so this is a UX guard, not the security line.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import Spinner from "./Spinner";

export default function AdminRoute({ children }) {
  const { user, role, booting } = useAuth();
  const location = useLocation();

  if (booting) return <Spinner label="Checking your session..." />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}
