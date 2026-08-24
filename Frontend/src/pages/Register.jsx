/**
 * Register page.
 *
 * Validation lives in a Zod schema resolved by react-hook-form — it
 * mirrors the backend rules exactly (name letters-only, password
 * complexity, per-country phone digit checks) plus frontend-only rules
 * (confirm password match, terms accepted).
 *
 * On success we navigate to /verify-otp carrying the email (+ devOtp when
 * SMTP is unconfigured locally so devs can complete the flow).
 */
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { parsePhoneNumberFromString, getCountries, getCountryCallingCode } from "libphonenumber-js";
import AuthLayout from "../components/AuthLayout";
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
    // Confirm-password match check.
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

export default function Register() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const countries = useCountryOptions();
  const [serverError, setServerError] = useState("");
  const [country, setCountry] = useState("IN"); // drives the dial-code hint

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", country: "IN", phone: "", password: "", confirmPassword: "", terms: false },
  });

  const selectedDial = `+${getCountryCallingCode(country)}`;

  const onSubmit = async (values) => {
    setServerError("");
    try {
      // Normalize to E.164 ("+919876543210") before sending.
      const parsedPhone = parsePhoneNumberFromString(values.phone, values.country);

      const captchaToken = await executeCaptcha("register");

      await signUp({
        name: values.name,
        email: values.email,
        phone: parsedPhone.number,
        password: values.password,
        ...(captchaToken && { captchaToken }),
      });

      navigate("/verify-otp", { state: { email: values.email } });
    } catch (err) {
      setServerError(
        err.response?.data?.message ||
          err.message ||
          "Registration failed. Please try again."
      );
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="One verified account across all your devices."
      footer={
        <>
          Already registered?{" "}
          <Link to="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
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
            className={`input-field ${errors.name ? "input-error" : ""}`}
            {...register("name")}
          />
          {errors.name && <p className="error-text">{errors.name.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="label-text">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={`input-field ${errors.email ? "input-error" : ""}`}
            {...register("email")}
          />
          {errors.email && <p className="error-text">{errors.email.message}</p>}
        </div>

        {/* Country + Phone */}
        <div>
          <label htmlFor="phone" className="label-text">Phone</label>
          <div className="flex gap-3">
            <select
              aria-label="Country code"
              value={country}
              className="input-field w-32 shrink-0"
              {...register("country")}
              onChange={(e) => setCountry(e.target.value)}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code} className="bg-slate-900">
                  {c.name} ({c.dial})
                </option>
              ))}
            </select>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder={selectedDial ? `${selectedDial} 98765 43210` : "Phone number"}
              className={`input-field ${errors.phone ? "input-error" : ""}`}
              {...register("phone")}
            />
          </div>
          {errors.phone && <p className="error-text">{errors.phone.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="label-text">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Min 8 chars, Aa1! mix"
            className={`input-field ${errors.password ? "input-error" : ""}`}
            {...register("password")}
          />
          {errors.password && <p className="error-text">{errors.password.message}</p>}
        </div>

        {/* Confirm */}
        <div>
          <label htmlFor="confirmPassword" className="label-text">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            className={`input-field ${errors.confirmPassword ? "input-error" : ""}`}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && <p className="error-text">{errors.confirmPassword.message}</p>}
        </div>

        {/* Terms */}
        <div>
          <label className="flex items-start gap-3 text-sm text-slate-400">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/10 accent-indigo-500"
              {...register("terms")}
            />
            <span>
              I agree to the Terms of Service and Privacy Policy.
            </span>
          </label>
          {errors.terms && <p className="error-text">{errors.terms.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
