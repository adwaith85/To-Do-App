import axios from "axios";

export const API_BASE_URL = "http://localhost:5050";

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20_000,
});

/* ---- In-memory access token ---- */
let accessToken = null;

/** Store/clear the access token after login, refresh and logout. */
export const setAccessToken = (token) => {
  accessToken = token;
};


const SESSION_MARKER = "appSession";

function readCookie(name) {
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(document.cookie || "");
  return match ? decodeURIComponent(match[1]) : null;
}

function csrfTokenFromCookie() {
  return readCookie("csrfToken");
}

/** Whether the backend currently holds a refresh session for this browser. */
export function hasRefreshSession() {
  return readCookie(SESSION_MARKER) !== null;
}

/* ---- Request interceptor: bearer token + CSRF echo ---- */
client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  const method = (config.method || "get").toLowerCase();
  if (method !== "get" && method !== "head") {
    const csrf = csrfTokenFromCookie();
    if (csrf) config.headers["x-csrf-token"] = csrf;
  }
  return config;
});

/* ---- Response interceptor: silent refresh + retry ---- */

// Endpoints where a 401 should NOT trigger a refresh attempt (they are the
// auth flow itself; retrying would loop).
const NO_REFRESH_PATHS = [
  "/api/auth/refresh-token",
  "/api/auth/login",
  "/api/auth/verify-login-otp",
  "/api/auth/register",
  "/api/auth/verify-otp",
  "/api/auth/resend-otp",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/logout",
];

let refreshPromise = null; // single-flight guard

/** ONE shared refresh call, queueing the boot restore and every concurrent
 *  401 handler behind the same promise. Resolves to the axios response so
 *  callers can apply the session payload. */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_BASE_URL}/api/auth/refresh-token`,
        {},
        {
          withCredentials: true,
          headers: { "x-csrf-token": csrfTokenFromCookie() || "" },
        }
      )
      .then((res) => {
        setAccessToken(res.data?.data?.accessToken || null);
        return res;
      })
      .catch((err) => {
        setAccessToken(null);
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

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
      !NO_REFRESH_PATHS.some((p) => path.includes(p)) &&
      hasRefreshSession();              // only when a session actually exists

    if (!shouldTryRefresh) return Promise.reject(error);

    original._retry = true;

    try {
      await refreshSession();
      return client(original); // replay the failed request with new token
    } catch (refreshError) {
      // Refresh failed → session truly over. Let AuthContext react.
      window.dispatchEvent(new Event("auth:session-expired"));
      return Promise.reject(refreshError);
    }
  }
);

export default client;
