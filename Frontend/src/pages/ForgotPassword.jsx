/**
 * Forgot password — step 1 of the reset flow.
 *
 * Asks for the account email and triggers a single-use, 10-minute code.
 * The backend ALWAYS answers generically (no user enumeration), so we
 * show the same success state either way and move on to /reset-password.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/useAuth";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      await forgotPassword({ email: email.trim().toLowerCase() });
      toast.success("If that email exists, a reset code is on its way.");
      navigate("/reset-password", { state: { email: email.trim().toLowerCase() } });
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Tell us your account email and we'll send a one-time code. It expires in 10 minutes."
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="font-semibold text-brand-400 transition hover:text-brand-300">
            Back to login
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && <div className="alert-error">⚠ {error}</div>}

        <div>
          <label htmlFor="forgot-email" className="label-text">Account email</label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`input-field ${error ? "input-error" : ""}`}
            required
          />
          {error && <p className="error-text">⚠ {error}</p>}
        </div>

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {submitting ? "Sending code…" : "Send reset code"}
        </button>
      </form>
    </AuthLayout>
  );
}
