/**
 * Login page.
 *
 * On success → redirect back to the page the user originally wanted
 * (state.from) or to "/". If the backend answers 403 EMAIL_NOT_VERIFIED
 * we route straight into the OTP flow instead of showing an error.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/useAuth";
import { executeCaptcha } from "../utils/captcha";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [serverError, setServerError] = useState(location.state?.info || "");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values) => {
    setServerError("");
    try {
      const captchaToken = await executeCaptcha("login");
      await login({
        ...values,
        ...(captchaToken && { captchaToken }),
      });
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      const code = err.response?.data?.code;

      // Unverified account → continue the verification journey.
      if (code === "EMAIL_NOT_VERIFIED") {
        navigate("/verify-otp", { state: { email: values.email } });
        return;
      }

      setServerError(
        err.response?.data?.message || "Login failed. Please try again."
      );
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to manage your todos."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}

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

        <div>
          <label htmlFor="password" className="label-text">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              className={`input-field pr-16 ${errors.password ? "input-error" : ""}`}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 transition hover:text-indigo-300"
            >
              {showPassword ? "HIDE" : "SHOW"}
            </button>
          </div>
          {errors.password && <p className="error-text">{errors.password.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
