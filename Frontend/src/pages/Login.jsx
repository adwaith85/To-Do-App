/**
 * Login page.
 *
 * Step 1 — email/phone + password + human-check captcha.
 *   Human check: reCAPTCHA-style "I am not a robot" checkbox backed by a
 *   self-hosted visual captcha (image code). The backend verifies the code
 *   BEFORE touching credentials (captcha → password → validation → policy).
 *   → When the account has 2FA enabled the backend answers with
 *     { twoFactorRequired, pendingToken } and we reveal STEP 2 inline:
 *     a 6-digit email code that completes the sign-in.
 *
 * Error choreography:
 *   CAPTCHA_FAILED (400 with code) → refresh image, clear the code input
 *   ACCOUNT_LOCKED (423)           → amber banner with minutes remaining
 *   EMAIL_NOT_VERIFIED (403)       → routed to /verify-otp with the email
 */
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import client from "../api/client";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/useAuth";
import { getRemembered, setRemembered, clearRemembered } from "../utils/rememberMe";

/* ---- Local validation mirroring the backend Zod rules ---- */
const loginSchema = z.object({
  // Accepts an email OR a phone number — the backend normalizes both.
  identifier: z.string().trim().min(3, "Enter your email or phone number"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
  notRobot: z.boolean().refine((v) => v === true, {
    message: "Confirm you are not a robot",
  }),
  // UNIFIED verification field: the visual captcha code for a normal user
  // login, OR a fixed-format admin code (ADM-XXXX-XXXX) for an admin login.
  verificationField: z.string().trim().min(1, "Enter the captcha code"),
});

const OTP_SHAPE = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

/** Where to land after a successful login, based on the session role. */
function homeFor(role) {
  return role === "admin" ? "/admin" : "/";
}

export default function Login() {
  const navigate = useNavigate();
  const { login, verifyLoginOtp } = useAuth();

  const [serverError, setServerError] = useState("");
  const [lockMinutes, setLockMinutes] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingToken, setPendingToken] = useState(null); // 2FA hand-off
  const [pendingRole, setPendingRole] = useState("user"); // role for the 2FA finish redirect
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [rememberMeChosen, setRememberMeChosen] = useState(false);
  const [verifying2fa, setVerifying2fa] = useState(false);

  /* ---- Visual captcha state ---- */
  const [captcha, setCaptcha] = useState(null);    // { svg, token }
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaError, setCaptchaError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "", password: "", rememberMe: false,
      notRobot: false, verificationField: "",
    },
  });

  const notRobot = watch("notRobot");

  /* ---- Remember-me device persistence ----
   * Pre-fill identifier + password (and keep the box ticked) on devices
   * that signed in with Remember Me, until the box is unchecked or the
   * user logs out. */
  useEffect(() => {
    const saved = getRemembered();
    if (saved) {
      setValue("identifier", saved.identifier);
      setValue("password", saved.password);
      setValue("rememberMe", true);
    }
  }, [setValue]);

  /** Unmarking Remember Me forgets the stored credentials immediately. */
  const onRememberChange = (e) => {
    if (!e.target.checked) clearRemembered();
  };

  /** After a successful credential grant, persist when Remember Me is on. */
  const persistRemembered = (vals) => {
    if (vals.rememberMe) setRemembered(vals.identifier, vals.password);
    else clearRemembered();
  };

  /** Pull a fresh captcha image + token from the API. */
  const refreshCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const { data } = await client.get("/api/auth/captcha");
      setCaptcha(data.data);
      setValue("verificationField", "");
      clearErrors("verificationField");
    } finally {
      setCaptchaLoading(false);
    }
  }, [setValue, clearErrors]);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  /* ---- Step 1 submit ---- */
  const onSubmit = async (vals) => {
    setServerError("");
    setLockMinutes(null);
    setCaptchaError("");

    try {
      const result = await login({
        email: vals.identifier,          // backend accepts email OR phone here
        password: vals.password,
        rememberMe: vals.rememberMe,
        // UNIFIED field: an admin code (ADM-XXXX-XXXX) OR the visual captcha
        // code. The backend disambiguates by format — admin code first.
        verificationField: vals.verificationField.trim(),
        // Token of the self-hosted visual captcha (used when the field held
        // a captcha response rather than an admin code).
        visualCaptchaToken: captcha?.token,
      });

      persistRemembered(vals); // Remember Me → fill fields on this device

      if (result.data?.twoFactorRequired) {
        // Hold the pending token; show the code step.
        setRememberMeChosen(vals.rememberMe);
        setPendingRole(result.data.role || "user");
        setPendingToken(result.data.pendingToken);
        toast("Code sent to your email", { icon: "📬" });
        return;
      }

      toast.success(`Welcome back${result.data?.user?.name ? `, ${result.data.user.name}` : ""}!`);
      navigate(homeFor(result.data?.role), { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data || {};
      const msg = data.message || "Could not log in. Please try again.";

      // Wrong captcha code → swap the image, clear the input, stay put.
      if (data.code === "CAPTCHA_FAILED") {
        setCaptchaError("Captcha code is incorrect. Try again.");
        refreshCaptcha();
        return;
      }

      if (status === 423 || data.code === "ACCOUNT_LOCKED") {
        const mins = Number((msg.match(/(\d+)\s*minute/i) || [])[1] || 0);
        setLockMinutes(mins);
      } else if (
        status === 403 &&
        data.code === "EMAIL_NOT_VERIFIED"
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
      navigate(homeFor(pendingRole), { replace: true });
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
                {...register("rememberMe", { onChange: onRememberChange })}
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

          {/* Human check — reCAPTCHA-style "not a robot" */}
          <div>
            <div className={`captcha-panel ${errors.notRobot ? "captcha-error" : ""}`}>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={notRobot}
                  onClick={() => setValue("notRobot", !notRobot, { shouldValidate: true })}
                  className={`robot-check ${notRobot ? "robot-check-on" : ""}`}
                >
                  {notRobot && (
                    <svg viewBox="0 0 12 10" className="h-3.5 w-3.5" fill="none">
                      <path d="M1 5.2 4.4 8.6 11 1.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className="text-xs font-semibold text-[#333]">I am not a robot</span>
                <span className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#a0a0a0]">
                  reCAPTCHA
                </span>
              </div>
              {errors.notRobot && <p className="mt-2 text-xs text-rose-600">⚠ {errors.notRobot.message}</p>}
            </div>

            {notRobot && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="captcha-image"
                    dangerouslySetInnerHTML={{ __html: captcha?.svg || "" }}
                  />
                  {captchaLoading && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-brand-400" />
                  )}
                  <button
                    type="button"
                    onClick={refreshCaptcha}
                    aria-label="New captcha"
                    title="New captcha"
                    className="btn-secondary !p-2.5 text-base"
                  >
                    ⟳
                  </button>
                </div>

                <div>
                  <label htmlFor="verificationField" className="label-text">Enter the code</label>
                  <input
                    id="verificationField"
                    type="text"
                    autoComplete="off"
                    maxLength={32}
                    placeholder="Captcha code above · or ADM-XXXX-XXXX (admin)"
                    className={`input-field ${errors.verificationField || captchaError ? "input-error" : ""}`}
                    {...register("verificationField")}
                  />
                  {errors.verificationField && <p className="error-text">⚠ {errors.verificationField.message}</p>}
                  {!errors.verificationField && captchaError && <p className="error-text">⚠ {captchaError}</p>}
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                    Type the characters from the image above to sign in as a regular
                    user. Admins can instead enter their <b>ADM-XXXX-XXXX</b> code.
                  </p>
                </div>
              </div>
            )}
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