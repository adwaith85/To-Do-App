/**
 * Axios instance with JWT wiring.
 *
 * Token strategy:
 *  - Access token lives ONLY in memory (this module) — never localStorage,
 *    so an XSS breach can't steal a long-lived credential.
 *  - The refresh token rides in an httpOnly cookie managed by the backend.
 *
 * Interceptors:
 *  - request : attach `Authorization: Bearer <accessToken>` when present
 *  - response: on 401 from a protected endpoint, run ONE shared refresh
 *              call (single-flight), then replay the original request.
 *              Concurrent 401s queue behind the same refresh promise.
 */
import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5050";

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send/receive the httpOnly refresh cookie
});

/* ---- In-memory access token ---- */
let accessToken = null;

/** Store/clear the access token after login, refresh and logout. */
export const setAccessToken = (token) => {
  accessToken = token;
};

/* ---- Request interceptor: attach bearer token ---- */
client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/* ---- Response interceptor: silent refresh + retry ---- */

// Endpoints where a 401 should NOT trigger a refresh attempt (they are the
// auth flow itself; retrying would loop).
const NO_REFRESH_PATHS = [
  "/api/auth/refresh-token",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
];

let refreshPromise = null; // single-flight guard

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const path = original?.url || "";

    const shouldTryRefresh =
      status === 401 &&
      original &&                       // retryable request
      !original._retry &&               // only once per request
      !NO_REFRESH_PATHS.some((p) => path.includes(p));

    if (!shouldTryRefresh) return Promise.reject(error);

    original._retry = true;

    try {
      // Share one refresh call across all concurrent 401 handlers.
      refreshPromise ||= axios.post(
        `${API_BASE_URL}/api/auth/refresh-token`,
        {},
        { withCredentials: true }
      );

      const { data } = await refreshPromise;
      setAccessToken(data.data?.accessToken || null);
      return client(original); // replay the failed request with new token
    } catch (refreshError) {
      // Refresh failed → session truly over. Let AuthContext react.
      setAccessToken(null);
      window.dispatchEvent(new Event("auth:session-expired"));
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  }
);

export default client;
