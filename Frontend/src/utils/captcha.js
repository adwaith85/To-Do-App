/**
 * Google reCAPTCHA v3 helper.
 *
 * The site key is baked in (no env files on the frontend). When the key is
 * empty — or cleared for local dev — executeCaptcha() resolves to
 * undefined and the backend skips verification.
 */
const SITE_KEY = "6Ldto5YtAAAAAK4CDU5fOGeq8GgvXaLGl7E7arO5";

/** Is captcha active on this deployment? */
export function captchaEnabled() {
  return Boolean(SITE_KEY);
}

let scriptLoaded = false;

/** Inject Google's recaptcha script exactly once. */
function loadRecaptchaScript() {
  return new Promise((resolve, reject) => {
    if (scriptLoaded && window.grecaptcha) return resolve();

    const existing = document.querySelector("script[data-recaptcha]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("reCAPTCHA failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.dataset.recaptcha = "true";
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("reCAPTCHA failed to load"));
    document.head.appendChild(script);
  });
}

/**
 * Run the invisible captcha for `action` ("login" | "register").
 * Never blocks the form: if Google's script or the token call fails
 * (offline, ad-blocker, firewall) it resolves undefined, and the backend
 * skips verification when captcha isn't enforced.
 * @returns {Promise<string|undefined>} token, or undefined when unavailable.
 */
export async function executeCaptcha(action) {
  if (!SITE_KEY) return undefined;

  try {
    await loadRecaptchaScript();
  } catch (error) {
    console.warn("[captcha] script unavailable — skipping:", error.message);
    return undefined;
  }

  try {
    return await new Promise((resolve, reject) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(SITE_KEY, { action })
          .then(resolve)
          .catch(reject);
      });
    });
  } catch (error) {
    console.warn("[captcha] execute failed — skipping:", error.message);
    return undefined;
  }
}
