/**
 * Verify OTP page — final step of registration.
 *
 * The emailed 6-digit code activates the account; the backend then logs
 * the user straight in (access token + refresh cookie) and we redirect to
 * the todos. Includes a resend button with a cooldown timer.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/useAuth";

const RESEND_SECONDS = 60;

export default function VerifyOtp() {
  const { state } = useLocation(); // { email, devOtp? } from Register
  const navigate = useNavigate();
  const { verifyOtp, resendOtp } = useAuth();

  const [email, setEmail] = useState(state?.email || "");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(state?.devOtp ? `Dev mode — your code is ${state.devOtp}` : "");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef(null);

  // Start the resend countdown on mount (a code was just sent).
  useEffect(() => {
    setCooldown(RESEND_SECONDS);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setVerifying(true);
    try {
      const result = await verifyOtp({ email: email.trim().toLowerCase(), otp });

      if (result.data?.alreadyVerified) {
        navigate("/login", { state: { info: "Email already verified — please log in." } });
        return;
      }

      navigate("/", { replace: true }); // fully logged in by verifyOtp()
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed. Please try again.");
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
      await resendOtp({ email: email.trim().toLowerCase() });
      setInfo(`A new code was sent to ${email}.`);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err.response?.data?.message || "Could not resend the code.");
      if (err.response?.status === 429) setCooldown(RESEND_SECONDS);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={state?.devOtp ? undefined : "Enter the 6-digit code we emailed you."}
      footer={
        <>
          Wrong account?{" "}
          <Link to="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
            Register again
          </Link>
        </>
      }
    >
      {state?.devOtp && (
        <div className="alert-info mb-5">
          Dev mode (no SMTP configured): your verification code is{" "}
          <span className="font-bold tracking-widest">{state.devOtp}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && <div className="alert-error">{error}</div>}
        {info && !error && <div className="alert-success">{info}</div>}

        <div>
          <label htmlFor="verify-email" className="label-text">Email</label>
          <input
            id="verify-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={`input-field ${!email.trim() ? "" : ""}`}
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
            className="input-field text-center text-2xl font-semibold tracking-[0.6em]"
            autoFocus
            required
          />
        </div>

        <button
          type="submit"
          disabled={verifying || otp.length !== 6 || !email.trim()}
          className="btn-primary"
        >
          {verifying ? "Verifying..." : "Verify & continue"}
        </button>

        <button
          type="button"
          onClick={onResend}
          disabled={cooldown > 0}
          className="w-full text-center text-sm text-slate-400 transition hover:text-indigo-300 disabled:cursor-not-allowed disabled:hover:text-slate-400"
        >
          {cooldown > 0
            ? `Resend code in ${cooldown}s`
            : "Didn't get it? Resend code"}
        </button>
      </form>
    </AuthLayout>
  );
}
