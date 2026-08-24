/**
 * Register page.
 *
 * Validation lives in a Zod schema resolved by react-hook-form — it
 * mirrors the backend rules exactly (name letters-only, password
 * complexity, per-country phone digit checks) plus frontend-only rules
 * (confirm password match, terms accepted).
 *
 * UX details: live zxcvbn strength meter, show/hide passwords,
 * red-border errors / green-border valid fields, toast notifications.
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

/* ------------------------------------------------------------------ */
/* Zod schema                                                          */
/* ------------------------------------------------------------------ */
const registerSchema = z
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
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Needs an uppercase letter")
      .regex(/[a-z]/, "Needs a lowercase letter")
      .regex(/\d/, "Needs a number")
      .regex(/[^A-Za-z0-9]/, "Needs a special character"),
    confirmPassword: z.string(),
    terms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms to continue" }),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword !== data.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }

    // Phone must be valid FOR THE SELECTED COUNTRY (digit count rules).
    const parsed = parsePhoneNumberFromString(data.phone, data.country);
    if (!parsed || !parsed.isValid()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Invalid number of digits for the selected country",
      });
    }
  });

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
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const countries = useCountryOptions();
  const [serverError, setServerError] = useState("");
  const [country, setCountry] = useState("IN");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "", email: "", country: "IN", phone: "",
      password: "", confirmPassword: "", terms: false,
    },
  });

  // Lightweight mirrors of the fields we style reactively (avoids
  // useForm().watch(), which the React compiler cannot memoize safely).
  const [typed, setTyped] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const mirror = (key) => ({
    onChange: (e) => setTyped((t) => ({ ...t, [key]: e.target.value })),
  });

  const selectedDial = `+${getCountryCallingCode(country)}`;

  const onSubmit = async (vals) => {
    setServerError("");
    try {
      const parsedPhone = parsePhoneNumberFromString(vals.phone, vals.country);
      const captchaToken = await executeCaptcha("register");

      await signUp({
        name: vals.name,
        email: vals.email,
        phone: parsedPhone.number, // E.164
        password: vals.password,
        ...(captchaToken && { captchaToken }),
      });

      toast.success("Account created! Check your inbox for the code.");
      navigate("/verify-otp", { state: { email: vals.email } });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Registration failed. Please try again.";
      setServerError(msg);
      toast.error(msg);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="One verified account across all your devices."
      footer={
        <>
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-brand-400 transition hover:text-brand-300">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}

        {/* Name */}
        <div>
          <label htmlFor="name" className="label-text">Full name</label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Adwaith H"
            className={`input-field ${errors.name ? "input-error" : typed.name ? "input-valid" : ""}`}
            {...register("name", mirror("name"))}
          />
          {errors.name && <p className="error-text">⚠ {errors.name.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="label-text">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={`input-field ${errors.email ? "input-error" : typed.email ? "input-valid" : ""}`}
            {...register("email", mirror("email"))}
          />
          {errors.email && <p className="error-text">⚠ {errors.email.message}</p>}
        </div>

        {/* Country + Phone */}
        <div>
          <label htmlFor="phone" className="label-text">Phone</label>
          <div className="flex gap-3">
            <select
              aria-label="Country code"
              value={country}
              className="input-field w-36 shrink-0 cursor-pointer"
              {...register("country")}
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
              className={`input-field ${errors.phone ? "input-error" : typed.phone ? "input-valid" : ""}`}
              {...register("phone", mirror("phone"))}
            />
          </div>
          {(errors.phone || errors.country) && (
            <p className="error-text">⚠ {errors.phone?.message || errors.country?.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="label-text">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Min 8 chars with Aa1! mix"
              className={`input-field pr-16 ${errors.password ? "input-error" : typed.password ? "input-valid" : ""}`}
              {...register("password", mirror("password"))}
            />
            <PasswordToggle visible={showPassword} onClick={() => setShowPassword(!showPassword)} />
          </div>
          {errors.password && <p className="error-text">⚠ {errors.password.message}</p>}
          <PasswordStrength password={typed.password} />
        </div>

        {/* Confirm */}
        <div>
          <label htmlFor="confirmPassword" className="label-text">Confirm password</label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repeat your password"
              className={`input-field pr-16 ${
                errors.confirmPassword
                  ? "input-error"
                  : typed.confirm && !errors.confirmPassword
                    ? "input-valid"
                    : ""
              }`}
              {...register("confirmPassword", mirror("confirm"))}
            />
            <PasswordToggle visible={showConfirm} onClick={() => setShowConfirm(!showConfirm)} />
          </div>
          {errors.confirmPassword && <p className="error-text">⚠ {errors.confirmPassword.message}</p>}
        </div>

        {/* Terms */}
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-400">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/10 accent-brand-500"
              {...register("terms")}
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
          {errors.terms && <p className="error-text">⚠ {errors.terms.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
