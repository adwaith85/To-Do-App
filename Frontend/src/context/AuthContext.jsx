/**
 * AuthProvider — the single source of truth for session state.
 *
 * Holds `user` + boot status. The access token itself lives inside the
 * axios client module; this component orchestrates the auth endpoints and
 * shares helpers through context (see useAuth.js).
 *
 * Session restore:
 *  1. Try refresh token (httpOnly cookie) → standard silent refresh
 *  2. If no refresh session, try auto-login (remember-me cookie)
 *  3. If neither works → stay logged out
 */
import { useEffect, useState, useCallback } from "react";
import client, { setAccessToken, refreshSession, hasRefreshSession } from "../api/client";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true); // true until first refresh check
  const [role, setRole] = useState(null);

  /** Apply a session payload ({ user, accessToken, role? }) from any endpoint. */
  const applySession = useCallback((data) => {
    setAccessToken(data.accessToken || null);
    setUser(data.user || null);
    if (data.role) setRole(data.role);
  }, []);

  /* ---- Restore session on first load ---- */
  useEffect(() => {
    (async () => {
      try {
        // Step 1: Try refresh token (standard session restore)
        if (hasRefreshSession()) {
          const { data } = await refreshSession();
          applySession(data.data);
          return;
        }

        // Step 2: No refresh session → try auto-login from remember-me cookie
        const { data } = await client.post("/api/auth/auto-login");
        if (data.data) {
          applySession(data.data);
          return;
        }
        // No remember-me either → stay logged out
      } catch {
        /* no valid session → stay logged out */
      } finally {
        setBooting(false);
      }
    })();
  }, [applySession]);

  /* ---- Global "session died" event from the axios interceptor ---- */
  useEffect(() => {
    const onExpired = () => {
      setAccessToken(null);
      setUser(null);
      setRole(null);
    };
    window.addEventListener("auth:session-expired", onExpired);
    return () => window.removeEventListener("auth:session-expired", onExpired);
  }, []);

  /* ---- Actions ---- */

  const login = async (payload) => {
    const { data } = await client.post("/api/auth/login", payload);
    if (data.data?.twoFactorRequired) return data;
    applySession(data.data);
    return data;
  };

  const verifyLoginOtp = async (payload) => {
    const { data } = await client.post("/api/auth/verify-login-otp", payload);
    applySession(data.data);
    return data;
  };

  const register = async (payload) => {
    const { data } = await client.post("/api/auth/register", payload);
    return data;
  };

  const setPassword = async (payload) => {
    const { data } = await client.post("/api/auth/set-password", payload);
    return data;
  };

  const verifyOtp = async (payload) => {
    const { data } = await client.post("/api/auth/verify-otp", payload);
    if (data.data?.accessToken) applySession(data.data);
    return data;
  };

  const resendOtp = async (payload) => {
    const { data } = await client.post("/api/auth/resend-otp", payload);
    return data;
  };

  const forgotPassword = async (payload) => {
    const { data } = await client.post("/api/auth/forgot-password", payload);
    return data;
  };

  const resetPassword = async (payload) => {
    const { data } = await client.post("/api/auth/reset-password", payload);
    return data;
  };

  const toggleTwoFactor = async (enabled) => {
    const { data } = await client.patch("/api/auth/2fa", { enabled });
    if (data.data?.user) setUser(data.data.user);
    return data;
  };

  /** Logout: clear local state. Remember-me cookie is preserved server-side. */
  const logout = async () => {
    try {
      await client.post("/api/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
      setRole(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user, booting, role,
        login, verifyLoginOtp,
        register, setPassword, verifyOtp, resendOtp,
        forgotPassword, resetPassword,
        toggleTwoFactor,
        logout, setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
