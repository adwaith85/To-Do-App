/**
 * Contact routes → mounted at /api/contact.
 *
 * Public support form: rate-limited per IP, sanitized, Zod-validated.
 */
import { Router } from "express";
import { validate } from "../middleware/validate.middleware.js";
import { sanitize } from "../middleware/sanitize.middleware.js";
import { contactLimiter } from "../middleware/rateLimiter.middleware.js";
import { submitContact } from "../controllers/contact.controller.js";
import { contactMessageSchema } from "../validations/index.js";

const router = Router();

router.post("/", contactLimiter, sanitize, validate({ body: contactMessageSchema }), submitContact);

export default router;