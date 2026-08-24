/**
 * Reset password — step 2 of the reset flow.
 *
 * Consumes the emailed code together with the new password. On success
 * the backend has already killed every active session, so we route the
 * user to a clean /login.
 */
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import AuthLayout from "../components/AuthLayout";
import PasswordStrength from "../components/PasswordStrength";
import { useAuth } from "../context/useAuth";

export default function ResetPassword() {
  const { state } = useLocation(); // { email } from ForgotPassword
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const [form, setForm] = useState({
    email: state?.email || "",
    otp: "",
    newPassword: "",
    confirm: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setField = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    setFieldErrors({});

    // Client-side sanity checks (backend re-validates everything).
    const errs = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))
      errs.email = "Enter your account email";
    if (!/^\d{6}$/.test(form.otp)) errs.otp = "The code is 6 digits";
    if (form.newPassword.length < 8)
      errs.newPassword = "At least 8 characters";
    else if (
      !(/[A-Z]/.test(form.newPassword) &&
        /[a-z]/.test(form.newPassword) &&
        /\d/.test(form.newPassword) &&
        /[^A-Za-z0-9]/.test(form.newPassword))
    )
      errs.newPassword = "Needs uppercase, lowercase, number & symbol";
    else if (form.confirm !== form.newPassword)
      errs.confirm = "Passwords do not match";

    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({
        email: form.email.trim().toLowerCase(),
        otp: form.otp,
        newPassword: form.newPassword,
      });
      toast.success("Password updated — all devices were signed out.");
      navigate("/login", { replace: true });
    } catch (err) {
      setServerError(
        err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.message ||
          "Reset failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Paste the code we emailed you and pick something strong. Every other device will be signed out."
      footer={
        <>
          Code expired?{" "}
          <Link to="/forgot-password" className="font-semibold text-brand-400 transition hover:text-brand-300">
            Request a new one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {serverError && <div className="alert-error">⚠ {serverError}</div>}

        {/* Email */}
        <div>
          <label htmlFor="reset-email" className="label-text">Account email</label>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={setField("email")}
            className={`input-field ${fieldErrors.email ? "input-error" : form.email ? "input-valid" : ""}`}
            required
          />
          {fieldErrors.email && <p className="error-text">⚠ {fieldErrors.email}</p>}
        </div>

        {/* Code */}
        <div>
          <label htmlFor="reset-otp" className="label-text">Reset code</label>
          <input
            id="reset-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            value={form.otp}
            onChange={(e) =>
              setForm((f) => ({ ...f, otp: e.target.value.replace(/\D/g, "").slice(0, 6) }))
            }
            className={`input-field text-center text-2xl font-bold tracking-[0.5em] ${
              fieldErrors.otp ? "input-error" : form.otp.length === 6 ? "input-valid" : ""
            }`}
            required
          />
          {fieldErrors.otp && <p className="error-text">⚠ {fieldErrors.otp}</p>}
        </div>

        {/* New password */}
        <div>
          <label htmlFor="new-password" className="label-text">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="Min 8 chars with Aa1! mix"
            value={form.newPassword}
            onChange={setField("newPassword")}
            className={`input-field ${fieldErrors.newPassword ? "input-error" : form.newPassword ? "input-valid" : ""}`}
            required
          />
          {fieldErrors.newPassword && (
            <p className="error-text">⚠ {fieldErrors.newPassword}</p>
          )}
          {!fieldErrors.newPassword && (
            <PasswordStrength password={form.newPassword} />
          )}
        </div>

        {/* Confirm */}
        <div>
          <label htmlFor="confirm-password" className="label-text">Confirm password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={form.confirm}
            onChange={setField("confirm")}
            className={`input-field ${
              fieldErrors.confirm
                ? "input-error"
                : form.confirm && !fieldErrors.confirm
                  ? "input-valid"
                  : ""
            }`}
            required
          />
          {fieldErrors.confirm && <p className="error-text">⚠ {fieldErrors.confirm}</p>}
        </div>

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthLayout>
  );
}
