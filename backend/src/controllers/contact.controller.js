/**
 * Contact controller — public help/contact form (login page).
 *
 * Stores support requests in ContactMessage for the admin panel to triage.
 * Response is always a generic success so bots can't probe state; abuse is
 * capped by `contactLimiter` (10/IP/hour) and the data itself is scrubbed
 * by `sanitize` before Zod validates it.
 */
import ContactMessage from "../models/contactMessage.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getClientIp, getDevice } from "../utils/history.util.js";

/** POST /api/contact */
export const submitContact = asyncHandler(async (req, res) => {
  const { name, email, category, subject, message } = req.body;

  await ContactMessage.create({
    name,
    email,
    category,
    subject,
    message,
    userAgent: getDevice(req),
    ip: getClientIp(req),
  });

  res.status(201).json({
    success: true,
    message: "Thanks — your message has been sent. We'll get back to you soon.",
  });
});