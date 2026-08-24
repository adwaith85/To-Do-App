/**
 * AuthProvider — the single source of truth for session state.
 *
 * Holds `user` + boot status. The access token itself lives inside the
 * axios client module; this component orchestrates the auth endpoints and
 * shares helpers through context (see useAuth.js).
 *
 * Session restore: because the access token is memory-only, a full page
 * reload silently calls /refresh-token (cookie) to rebuild the session —
 * standard pattern for short-lived access tokens.
 */
import { useEffect, useState, useCallback } from "react";
import client, { setAccessToken } from "../api/client";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true); // true until first refresh check

  /** Apply a session payload ({ user, accessToken }) from any endpoint. */
  const applySession = useCallback((data) => {
    setAccessToken(data.accessToken || null);
    setUser(data.user || null);
  }, []);

  /* ---- Restore session on first load ---- */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await client.post("/api/auth/refresh-token");
        applySession(data.data);
      } catch {
        /* no valid refresh cookie → stay logged out */
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
    };
    window.addEventListener("auth:session-expired", onExpired);
    return () => window.removeEventListener("auth:session-expired", onExpired);
  }, []);

  /* ---- Actions ---- */

  /** POST /login → stores tokens or rethrows for the page to render errors. */
  const login = async (payload) => {
    const { data } = await client.post("/api/auth/login", payload);
    applySession(data.data);
    return data;
  };

  /** POST /register → returns response (may include devOtp in dev). */
  const register = async (payload) => {
    const { data } = await client.post("/api/auth/register", payload);
    return data;
  };

  /** POST /verify-otp → on success the backend logs the user in. */
  const verifyOtp = async (payload) => {
    const { data } = await client.post("/api/auth/verify-otp", payload);
    if (data.data?.accessToken) applySession(data.data);
    return data;
  };

  /** POST /resend-otp */
  const resendOtp = async (payload) => {
    const { data } = await client.post("/api/auth/resend-otp", payload);
    return data;
  };

  /** POST /logout → clear local state regardless of server result. */
  const logout = async () => {
    try {
      await client.post("/api/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, booting, login, register, verifyOtp, resendOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
