/**
 * AuthContext definition (kept component-free so fast refresh works).
 *
 * Value shape:
 *   user      - current user doc or null
 *   booting   - true until the initial silent refresh check completes
 *   actions   - login, register, verifyOtp, resendOtp, logout
 */
import { createContext } from "react";

export const AuthContext = createContext(null);
