/**
 * App routes:
 *   /login /register /verify-otp /forgot-password /reset-password → guest-only
 *   /                          → protected todos dashboard
 *   *                          → back home
 *
 * <Toaster> renders react-hot-toast notifications globally.
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyOtp from "./pages/VerifyOtp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Todos from "./pages/Todos";

export default function App() {
  return (
    <BrowserRouter>
      {/* Global toast notifications — compact, frosted-glass style */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2200,
          style: {
            background: "rgba(16, 23, 44, 0.88)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            color: "#e2e8f0",
            border: "1px solid rgba(255,255,255,0.14)",
            fontFamily: "Outfit, sans-serif",
            fontSize: "12px",
            lineHeight: "18px",
            fontWeight: 500,
            padding: "7px 10px",
            minWidth: "auto",
            maxWidth: "300px",
            borderRadius: "10px",
            boxShadow: "0 8px 24px -6px rgba(0,0,0,0.65)",
          },
          success: { iconTheme: { primary: "#34d399", secondary: "#10172c" } },
          error: { iconTheme: { primary: "#fb7185", secondary: "#10172c" } },
        }}
      />

      <Routes>
        {/* Guest-only pages */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/verify-otp" element={<PublicRoute><VerifyOtp /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />

        {/* Authenticated app */}
        <Route path="/" element={<ProtectedRoute><Todos /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
