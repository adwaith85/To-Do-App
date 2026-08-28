/**
 * Verify OTP page — finishes any account that still needs email proof.
 *
 * Reachable two ways:
 *  · Legacy accounts (never verified, but they ALREADY have a password):
 *    the login attempt is refused with EMAIL_NOT_VERIFIED, Login routes here,
 *    and verifying the code ISSUES THE SESSION directly → straight to the todos.
 *  · Interrupted signups (new wizard reached the email step but never chose a
 *    password): verifyOtp returns a short-lived signupToken and we collect the
 *    password right here instead of dead-ending the user.
 * Includes a resend button with a cooldown timer and dev-mode fallback codes.
 */
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import AuthLayout from "../components/AuthLayout";
import PasswordStrength from "../components/PasswordStrength";
import { useAuth } from "../context/useAuth";

const RESEND_SECONDS = 60;

/* Password rules mirror the backend Zod schema. */
const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Needs an uppercase letter")
      .regex(/[a-z]/, "Needs a lowercase letter")
      .regex(/\d/, "Needs a number")
      .regex(/[^A-Za-z0-9]/, "Needs a special character"),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword !== data.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

function PasswordToggle({ visible, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={visible ? "Hide password" : "Show password"}
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1 text-xs font-semibold tracking-wide text-slate-400 transition hover:text-brand-300"
    >
      {visible ? "HIDE" : "SHOW"}
    </button>
  );
}

export default function VerifyOtp() {
  const { state } = useLocation(); // { email, devOtp? } from Login/Register
  const navigate = useNavigate();
  const { verifyOtp, resendOtp, setPassword } = useAuth();

  const [email, setEmail] = useState(state?.email || "");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [devOtp, setDevOtp] = useState(state?.devOtp || null);
  const [signupToken, setSignupToken] = useState(null); // finish-password hand-off
  const [finishing, setFinishing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const inputRef = useRef(null);

  const finish = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email you registered with.");
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyOtp({ email: email.trim().toLowerCase(), otp });

      if (result.data?.alreadyVerified) {
        toast.success("Email already verified — please log in.");
        navigate("/login");
        return;
      }

      // Legacy account → backend issues the session; straight to the app.
      if (result.data?.accessToken) {
        toast.success("Email verified. Welcome aboard!");
        navigate("/", { replace: true });
        return;
      }

      // Interrupted signup (no password yet) → collect it on this page.
      if (result.data?.signupToken) {
        setSignupToken(result.data.signupToken);
        setOtp("");
        setDevOtp(null);
        toast.success("Email verified! Now create your password to finish.");
        return;
      }

      throw new Error("Verification response was invalid — please try again.");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Verification failed. Please try again.");
      setOtp("");
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    setError("");
    setInfo("");
    try {
      const res = await resendOtp({ email: email.trim().toLowerCase() });
      if (res?.devOtp) {
        setDevOtp(res.devOtp);
        toast(`Dev verification code: ${res.devOtp}`, { icon: "🔑" });
      }
      setInfo(`A new code was sent to ${email}.`);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      const msg = err.response?.data?.message || "Could not resend the code.";
      setError(msg);
      if (err.response?.status === 429) setCooldown(RESEND_SECONDS);
    }
  };

  const onFinish = async (vals) => {
    setError("");
    setFinishing(true);
    try {
      await setPassword({ signupToken, password: vals.password });
      toast.success("Registered successfully! Log in with your email and password.");
      navigate("/login");
    } catch (err) {
      const data = err.response?.data || {};
      const msg = data.message || err.message || "Could not save your password.";
      if (data.code === "SIGNUP_TOKEN_EXPIRED") {
        setSignupToken(null);
        setCooldown(RESEND_SECONDS);
        toast.error("That signup code expired — use Forgot password to set one instead.");
        navigate("/forgot-password", { state: { email } });
        return;
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setFinishing(false);
    }
  };

  return (
    <AuthLayout
      title={signupToken ? "Create your password" : "Check your inbox"}
      subtitle={
        signupToken
          ? "Almost done — pick a strong password and you're ready to log in."
          : `Enter the 6-digit code we sent to${email ? ` ${email}` : " your email"}.`
      }
      footer={
        <>
          Wrong account?{" "}
          <Link to="/register" className="font-semibold text-brand-400 transition hover:text-brand-300">
            Register again
          </Link>
        </>
      }
    >
      {signupToken ? (
        /* ---- Finish interrupted signup: create the password ---- */
        <form onSubmit={finish.handleSubmit(onFinish)} className="space-y-5" noValidate>
          {error && <div className="alert-error">⚠ {error}</div>}

          <div>
            <label htmlFor="finish-password" className="label-text">Password</label>
            <div className="relative">
              <input
                id="finish-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min 8 chars with Aa1! mix"
                className={`input-field pr-16 ${finish.formState.errors.password ? "input-error" : ""}`}
                {...finish.register("password")}
              />
              <PasswordToggle visible={showPassword} onClick={() => setShowPassword(!showPassword)} />
            </div>
            {finish.formState.errors.password && (
              <p className="error-text">⚠ {finish.formState.errors.password.message}</p>
            )}
            <PasswordStrength password={finish.watch("password") || ""} />
          </div>

          <div>
            <label htmlFor="finish-confirm" className="label-text">Confirm password</label>
            <div className="relative">
              <input
                id="finish-confirm"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat your password"
                className={`input-field pr-16 ${finish.formState.errors.confirmPassword ? "input-error" : ""}`}
                {...finish.register("confirmPassword")}
              />
              <PasswordToggle visible={showConfirm} onClick={() => setShowConfirm(!showConfirm)} />
            </div>
            {finish.formState.errors.confirmPassword && (
              <p className="error-text">⚠ {finish.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <button type="submit" disabled={finishing} className="btn-primary">
            {finishing && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {finishing ? "Finishing…" : "Finish & log in"}
          </button>
        </form>
      ) : (
        /* ---- Verify the emailed code ---- */
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          {error && <div className="alert-error">⚠ {error}</div>}
          {info && !error && <div className="alert-success">✓ {info}</div>}

          {devOtp && !error && (
            <div className="alert-info">
              Dev mode (no SMTP configured): your verification code is{" "}
              <span className="font-bold tracking-widest">{devOtp}</span>
            </div>
          )}

          <div>
            <label htmlFor="verify-email" className="label-text">Email</label>
            <input
              id="verify-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-field"
              required
            />
          </div>

          <div>
            <label htmlFor="otp" className="label-text">Verification code</label>
            <input
              id="otp"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              className="otp-box tracking-[0.5em]"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            disabled={verifying || otp.length !== 6 || !email.trim()}
            className="btn-primary"
          >
            {verifying && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {verifying ? "Verifying…" : "Verify & continue"}
          </button>

          <button
            type="button"
            onClick={onResend}
            disabled={cooldown > 0}
            className="w-full text-center text-sm text-slate-400 transition hover:text-brand-300 disabled:cursor-not-allowed disabled:hover:text-slate-400"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get it? Resend code"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}