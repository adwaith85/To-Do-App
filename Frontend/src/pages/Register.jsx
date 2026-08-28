/**
 * Register page — three-step signup wizard, all on ONE page.
 *
 *   STEP 1 · Account   → name + email + country/phone (+ terms)
 *   STEP 2 · Verify    → 6-digit email code (sent at submit of step 1)
 *   STEP 3 · Password  → choose the password, then head to /login
 *
 * Only the form area changes between steps — no page navigation until the
 * very end, when the user is redirected to /login with a success message.
 *
 * Field errors stay per-input (client Zod rules + server field errors are
 * mapped onto the matching input). Toasts are compact by global config.
 */
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { parsePhoneNumberFromString, getCountries, getCountryCallingCode } from "libphonenumber-js";
import toast from "react-hot-toast";
import AuthLayout from "../components/AuthLayout";
import PasswordStrength from "../components/PasswordStrength";
import { useAuth } from "../context/useAuth";
import { executeCaptcha } from "../utils/captcha";

/* ------------------------------------------------------------------ */
/* Country dropdown data (built once from libphonenumber metadata)     */
/* ------------------------------------------------------------------ */
function useCountryOptions() {
  return useMemo(() => {
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    return getCountries()
      .map((code) => ({
        code,
        name: regionNames.of(code) || code,
        dial: `+${getCountryCallingCode(code)}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);
}

/* ---- STEP 1 schema: account info ---- */
const accountSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name must be at most 50 characters")
      .regex(/^[\p{L}\s]+$/u, "Name may contain letters and spaces only"),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    country: z.string().min(2, "Select your country"),
    phone: z.string().trim().min(6, "Phone number is too short"),
    terms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms to continue" }),
    }),
  })
  .superRefine((data, ctx) => {
    const parsed = parsePhoneNumberFromString(data.phone, data.country);
    if (!parsed || !parsed.isValid()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Invalid number of digits for the selected country",
      });
    }
  });

/* ---- STEP 3 schema: password ---- */
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

const OTP_SHAPE = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

/* Small show/hide toggle used by both password inputs. */
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

export default function Register() {
  const { register: signUp, setPassword, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const countries = useCountryOptions();

  const [step, setStep] = useState(1);            // 1 account · 2 verify · 3 password
  const [email, setEmail] = useState("");
  const [devOtp, setDevOtp] = useState(null);
  const [signupToken, setSignupToken] = useState(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [serverError, setServerError] = useState("");
  const [country, setCountry] = useState("IN");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* ---- Step 1 form ---- */
  const account = useForm({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", email: "", country: "IN", phone: "", terms: false },
  });

  /* ---- Step 3 form ---- */
  const password = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const selectedDial = `+${getCountryCallingCode(country)}`;

  /* ── STEP 1: submit name/email/phone → OTP is sent ── */
  const onAccountSubmit = async (vals) => {
    setServerError("");
    setSubmitting(true);
    try {
      const parsedPhone = parsePhoneNumberFromString(vals.phone, vals.country);
      const captchaToken = await executeCaptcha("register");

      const result = await signUp({
        name: vals.name,
        email: vals.email,
        phone: parsedPhone.number, // E.164
        ...(captchaToken && { captchaToken }),
      });

      setEmail(vals.email);
      setDevOtp(result?.devOtp || null);
      if (result?.devOtp) toast(`Dev verification code: ${result.devOtp}`, { icon: "🔑" });
      toast.success(`Verification code sent to ${vals.email}`);
      setStep(2);
    } catch (err) {
      const data = err.response?.data || {};
      const msg = data.message || err.message || "Registration failed. Please try again.";
      toast.error(msg);

      const fieldErrors = Array.isArray(data.errors) ? data.errors : [];
      if (fieldErrors.length > 0) {
        let mapped = 0;
        fieldErrors.forEach(({ field, message }) => {
          const key = String(field || "").replace(/^body\./, "");
          if (["name", "email", "country", "phone"].includes(key)) {
            account.setError(key, { type: "server", message });
            mapped++;
          }
        });
        if (mapped > 0) {
          setServerError("");
          return;
        }
      }
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── STEP 2: verify email OTP → unlock password step ── */
  const onOtpSubmit = async (e) => {
    e.preventDefault();
    setOtpError("");
    setServerError("");

    const parsed = OTP_SHAPE.safeParse(otp.trim());
    if (!parsed.success) {
      setOtpError(parsed.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const res = await verifyOtp({ email, otp: parsed.data });

      if (res.data?.alreadyVerified) {
        toast.success("Email already verified — log in to continue.");
        navigate("/login");
        return;
      }
      if (!res.data?.signupToken) {
        throw new Error("Verification response was invalid — please try again.");
      }

      setSignupToken(res.data.signupToken);
      setOtp("");
      toast.success("Email verified! Now create your password.");
      setStep(3);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.message ||
        err.message ||
        "Verification failed.";
      setOtpError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── STEP 2: resend code ── */
  const onResend = async () => {
    setSubmitting(true);
    try {
      const res = await resendOtp({ email });
      if (res?.devOtp) {
        setDevOtp(res.devOtp);
        toast(`Dev verification code: ${res.devOtp}`, { icon: "🔑" });
      }
      toast.success("A new code was sent.");
    } catch (err) {
      const msg = err.response?.data?.message || "Could not resend the code.";
      setOtpError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── STEP 3: create password → done, go to login ── */
  const onPasswordSubmit = async (vals) => {
    setServerError("");
    setSubmitting(true);
    try {
      await setPassword({ signupToken, password: vals.password });
      toast.success("Registered successfully! Log in with your email and password.");
      navigate("/login");
    } catch (err) {
      const data = err.response?.data || {};
      const msg = data.message || err.message || "Could not save your password.";
      setServerError(msg);
      toast.error(msg);
      if (data.code === "SIGNUP_TOKEN_EXPIRED") {
        // The 10-minute window closed — start over from account details.
        setStep(1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ================================================================ */
  return (
    <AuthLayout
      title={step === 1 ? "Create your account" : step === 2 ? "Verify your email" : "Create your password"}
      subtitle={
        step === 1
          ? "Step 1 of 3 — we'll send a code to verify your email."
          : step === 2
            ? `Step 2 of 3 — enter the 6-digit code sent to ${email || "your email"}`
            : "Step 3 of 3 — one strong password, then you're done."
      }
      footer={
        <>
          {step > 1 && step < 3 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="mr-2 font-medium text-brand-400 transition hover:text-brand-300"
            >
              ← Back
            </button>
          )}
          {step !== 2 ? (
            <>
              Already registered?{" "}
              <Link to="/login" className="font-semibold text-brand-400 transition hover:text-brand-300">
                Log in
              </Link>
            </>
          ) : (
            <span className="text-slate-500">{devOtp && <span className="font-mono text-xs">Dev code: {devOtp}</span>}</span>
          )}
        </>
      }
    >
      {serverError && step !== 2 && <div className="alert-error mb-5">⚠ {serverError}</div>}

      {/* ═══════════ STEP 1 · ACCOUNT ═══════════ */}
      {step === 1 && (
        <form onSubmit={account.handleSubmit(onAccountSubmit)} className="space-y-5" noValidate>
          <div>
            <label htmlFor="name" className="label-text">Full name</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Adwaith H"
              className={`input-field ${account.formState.errors.name ? "input-error" : ""}`}
              {...account.register("name")}
            />
            {account.formState.errors.name && <p className="error-text">⚠ {account.formState.errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="email" className="label-text">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={`input-field ${account.formState.errors.email ? "input-error" : ""}`}
              {...account.register("email")}
            />
            {account.formState.errors.email && <p className="error-text">⚠ {account.formState.errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="label-text">Phone</label>
            <div className="flex gap-3">
              <select
                aria-label="Country code"
                value={country}
                className="input-field w-36 shrink-0 cursor-pointer"
                {...account.register("country")}
                onChange={(e) => setCountry(e.target.value)}
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code} className="bg-ink-900">
                    {c.name} ({c.dial})
                  </option>
                ))}
              </select>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                placeholder={`${selectedDial} 98765 43210`}
                className={`input-field ${account.formState.errors.phone ? "input-error" : ""}`}
                {...account.register("phone")}
              />
            </div>
            {(account.formState.errors.phone || account.formState.errors.country) && (
              <p className="error-text">
                ⚠ {account.formState.errors.phone?.message || account.formState.errors.country?.message}
              </p>
            )}
          </div>

          <div>
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-400">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/10 accent-brand-500"
                {...account.register("terms")}
              />
              <span>
                I agree to the{" "}
                <span className="text-slate-300 underline decoration-white/20 underline-offset-2">
                  Terms of Service
                </span>{" "}
                and{" "}
                <span className="text-slate-300 underline decoration-white/20 underline-offset-2">
                  Privacy Policy
                </span>
                .
              </span>
            </label>
            {account.formState.errors.terms && <p className="error-text">⚠ {account.formState.errors.terms.message}</p>}
          </div>

          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {submitting ? "Sending code…" : "Send verification code"}
          </button>
        </form>
      )}

      {/* ═══════════ STEP 2 · EMAIL VERIFY ═══════════ */}
      {step === 2 && (
        <form onSubmit={onOtpSubmit} className="space-y-5" noValidate>
          {otpError && <div className="alert-error">⚠ {otpError}</div>}
          {devOtp && !otpError && (
            <div className="alert-info">
              SMTP is off in dev — use this code: <span className="font-mono font-bold tracking-widest">{devOtp}</span>
            </div>
          )}

          <div>
            <label htmlFor="otp" className="label-text">6-digit verification code</label>
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
          </div>

          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {submitting ? "Verifying…" : "Verify & continue"}
          </button>

          <p className="text-center text-xs text-slate-400">
            Didn't get it?{" "}
            <button type="button" onClick={onResend} disabled={submitting} className="font-semibold text-brand-400 hover:text-brand-300">
              Resend code
            </button>
          </p>
        </form>
      )}

      {/* ═══════════ STEP 3 · PASSWORD ═══════════ */}
      {step === 3 && (
        <form onSubmit={password.handleSubmit(onPasswordSubmit)} className="space-y-5" noValidate>
          <div>
            <label htmlFor="password" className="label-text">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min 8 chars with Aa1! mix"
                className={`input-field pr-16 ${password.formState.errors.password ? "input-error" : ""}`}
                {...password.register("password")}
              />
              <PasswordToggle visible={showPassword} onClick={() => setShowPassword(!showPassword)} />
            </div>
            {password.formState.errors.password && <p className="error-text">⚠ {password.formState.errors.password.message}</p>}
            <PasswordStrength password={password.watch("password") || ""} />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="label-text">Confirm password</label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat your password"
                className={`input-field pr-16 ${password.formState.errors.confirmPassword ? "input-error" : ""}`}
                {...password.register("confirmPassword")}
              />
              <PasswordToggle visible={showConfirm} onClick={() => setShowConfirm(!showConfirm)} />
            </div>
            {password.formState.errors.confirmPassword && <p className="error-text">⚠ {password.formState.errors.confirmPassword.message}</p>}
          </div>

          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {submitting ? "Creating account…" : "Finish & log in"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}