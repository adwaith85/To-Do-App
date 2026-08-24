/** Hook giving pages access to the auth session + actions. */
import { useContext } from "react";
import { AuthContext } from "./authContext";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
