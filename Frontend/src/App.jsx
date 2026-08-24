/**
 * App routes:
 *   /login /register /verify-otp  → guest-only (PublicRoute)
 *   /                             → protected todos (ProtectedRoute)
 *   *                             → back home
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyOtp from "./pages/VerifyOtp";
import Todos from "./pages/Todos";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Guest-only pages */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/verify-otp" element={<PublicRoute><VerifyOtp /></PublicRoute>} />

        {/* Authenticated app */}
        <Route path="/" element={<ProtectedRoute><Todos /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
