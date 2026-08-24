import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* AuthProvider boots the session (silent refresh) before routing. */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
