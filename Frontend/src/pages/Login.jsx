/**
 * Login page.
 *
 * Step 1 — email/phone + password (+ show/hide, Remember Me, captcha).
 *   → When the account has 2FA enabled the backend answers with
 *     { twoFactorRequired, pendingToken } and we reveal STEP 2 inline:
 *     a 6-digit email code that completes the sign-in.
 *
 * Error choreography:
 *   ACCOUNT_LOCKED (423)   → amber banner with minutes remaining
 *   EMAIL_NOT_VERIFIED(403)→ routed to /verify-otp with the email
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/useAuth";
import { executeCaptcha } from "../utils/captcha";

const loginSchema = z.object({
  // Accepts an email OR a phone number — the backend normalizes both.
  identifier: z.string().trim().min(3, "Enter your email or phone number"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
});

const OTP_SHAPE = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

export default function Login() {
  const navigate = useNavigate();
  const { login, verifyLoginOtp } = useAuth();

  const [serverError, setServerError] = useState("");
  const [lockMinutes, setLockMinutes] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingToken, setPendingToken] = useState(null); // 2FA hand-off
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [rememberMeChosen, setRememberMeChosen] = useState(false);
  const [verifying2fa, setVerifying2fa] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", rememberMe: false },
  });

  /* ---- Step 1 submit ---- */
  const onSubmit = async (vals) => {
    setServerError("");
    setLockMinutes(null);

    try {
      const captchaToken = await executeCaptcha("login");

      const result = await login({
        email: vals.identifier,          // backend accepts email OR phone here
        password: vals.password,
        rememberMe: vals.rememberMe,
        ...(captchaToken && { captchaToken }),
      });

      if (result.data?.twoFactorRequired) {
        // Hold the pending token; show the code step.
        setRememberMeChosen(vals.rememberMe);
        setPendingToken(result.data.pendingToken);
        toast("Code sent to your email", { icon: "📬" });
        return;
      }

      toast.success(`Welcome back${result.data?.user?.name ? `, ${result.data.user.name}` : ""}!`);
      navigate("/", { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || "Could not log in. Please try again.";

      if (status === 423 || err.response?.data?.code === "ACCOUNT_LOCKED") {
        const mins = Number((msg.match(/(\d+)\s*minute/i) || [])[1] || 0);
        setLockMinutes(mins);
      } else if (
        status === 403 &&
        err.response?.data?.code === "EMAIL_NOT_VERIFIED"
      ) {
        toast.error("Please verify your email first.");
        navigate("/verify-otp", {
          state: { email: vals.identifier.includes("@") ? vals.identifier : "" },
        });
        return;
      }
      setServerError(msg);
    }
  };

  /* ---- Step 2 submit (2FA code) ---- */
  const onVerify2fa = async (e) => {
    e.preventDefault();
    setOtpError("");

    const parsed = OTP_SHAPE.safeParse(otp.trim());
    if (!parsed.success) {
      setOtpError(parsed.error.issues[0].message);
      return;
    }

    setVerifying2fa(true);
    try {
      await verifyLoginOtp({
        pendingToken,
        otp: parsed.data,
        rememberMe: rememberMeChosen,
      });
      toast.success("Signed in successfully!");
      navigate("/", { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.message ||
        "Verification failed.";
      setOtpError(msg);
      if (err.response?.data?.code === "TWO_FACTOR_EXPIRED") {
        setPendingToken(null); // back to step 1
      }
    } finally {
      setVerifying2fa(false);
    }
  };

  /* ================================================================ */
  return (
    <AuthLayout
      title={pendingToken ? "Two-factor check" : "Welcome back"}
      subtitle={
        pendingToken
          ? "We emailed you a 6-digit code. It expires in 10 minutes."
          : "Log in to pick up where you left off."
      }
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-semibold text-brand-400 transition hover:text-brand-300">
            Create an account
          </Link>
        </>
      }
    >
      {!pendingToken ? (
        /* ---------------- STEP 1: credentials ---------------- */
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {serverError && <div className="alert-error">⚠ {serverError}</div>}

          {lockMinutes !== null && (
            <div className="alert-warn">
              🔒 Account locked after too many failed attempts.
              Try again in <b>{lockMinutes} minute{lockMinutes === 1 ? "" : "s"}</b> or reset your password below.
            </div>
          )}

          {/* Identifier */}
          <div>
            <label htmlFor="identifier" className="label-text">
              Email or phone
            </label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              placeholder="you@example.com  ·  +91 98765 43210"
              className={`input-field ${errors.identifier ? "input-error" : ""}`}
              {...register("identifier")}
            />
            {errors.identifier && <p className="error-text">⚠ {errors.identifier.message}</p>}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="label-text">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`input-field pr-16 ${errors.password ? "input-error" : ""}`}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1 text-xs font-semibold tracking-wide text-slate-400 transition hover:text-brand-300"
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
            {errors.password && <p className="error-text">⚠ {errors.password.message}</p>}
          </div>

          {/* Remember me + Forgot */}
          <div className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-400">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-white/10 accent-brand-500"
                {...register("rememberMe")}
              />
              Remember me for 30 days
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-brand-400 transition hover:text-brand-300"
            >
              Forgot password?
            </Link>
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        /* ---------------- STEP 2: 2FA code ---------------- */
        <form onSubmit={onVerify2fa} className="space-y-5" noValidate>
          {otpError && <div className="alert-error">⚠ {otpError}</div>}

          <div>
            <label htmlFor="otp" className="label-text">6-digit code</label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="otp-box tracking-[0.5em]"
            />
            {otpError && <p className="error-text">⚠ {otpError}</p>}
          </div>

          <button type="submit" disabled={verifying2fa} className="btn-primary">
            {verifying2fa && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {verifying2fa ? "Verifying…" : "Verify & sign in"}
          </button>

          <button
            type="button"
            onClick={() => {
              setPendingToken(null);
              setOtp("");
              setOtpError("");
            }}
            className="btn-secondary w-full"
          >
            ← Use a different account
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
