import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import AdminLayout from "./components/AdminLayout";
import UserLayout from "./components/UserLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyOtp from "./pages/VerifyOtp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Spinner from "./components/Spinner";

const Todos = lazy(() => import("./pages/Todos"));
const Reminders = lazy(() => import("./pages/Reminders"));
const Archives = lazy(() => import("./pages/Archives"));
const Completed = lazy(() => import("./pages/Completed"));
const Profile = lazy(() => import("./pages/Profile"));

const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminUserDetail = lazy(() => import("./pages/admin/UserDetail"));
const AdminSecurity = lazy(() => import("./pages/admin/Security"));
const AdminTodos = lazy(() => import("./pages/admin/Todos"));
const AdminMessages = lazy(() => import("./pages/admin/Messages"));
const AdminAudit = lazy(() => import("./pages/admin/Audit"));

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2400,
          style: {
            background: "rgba(16, 23, 44, 0.92)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            color: "#e2e8f0",
            border: "1px solid rgba(255,255,255,0.14)",
            fontFamily: "Outfit, sans-serif",
            fontSize: "12px",
            lineHeight: "18px",
            fontWeight: 500,
            padding: "8px 12px",
            minWidth: "auto",
            maxWidth: "300px",
            borderRadius: "12px",
            boxShadow: "0 10px 32px -8px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)",
          },
          success: {
            iconTheme: { primary: "#34d399", secondary: "#10172c" },
            style: { border: "1px solid rgba(52,211,153,0.25)" },
          },
          error: {
            iconTheme: { primary: "#fb7185", secondary: "#10172c" },
            style: { border: "1px solid rgba(251,113,133,0.25)" },
          },
        }}
      />

      <Suspense fallback={<Spinner label="Loading console..." />}>
        <Routes>
          {/* Guest-only pages */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/verify-otp" element={<PublicRoute><VerifyOtp /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />

          {/* Authenticated app */}
          <Route path="/" element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
            <Route index element={<Todos />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="archives" element={<Archives />} />
            <Route path="completed" element={<Completed />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Admin panel */}
          <Route path="/admin" element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetail />} />
            <Route path="security" element={<AdminSecurity />} />
            <Route path="todos" element={<AdminTodos />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
