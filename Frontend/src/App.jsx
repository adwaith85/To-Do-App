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
const Profile = lazy(() => import("./pages/Profile"));

const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminUserDetail = lazy(() => import("./pages/admin/UserDetail"));
const AdminSecurity = lazy(() => import("./pages/admin/Security"));
const AdminTodos = lazy(() => import("./pages/admin/Todos"));
const AdminAudit = lazy(() => import("./pages/admin/Audit"));

export default function App() {
  return (
    <BrowserRouter>
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
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Admin panel */}
          <Route path="/admin" element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetail />} />
            <Route path="security" element={<AdminSecurity />} />
            <Route path="todos" element={<AdminTodos />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
