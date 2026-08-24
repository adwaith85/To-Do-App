/**
 * Admin-only controller — demonstrates the authorize("admin") role gate.
 * Kept intentionally tiny: it exists so the RBAC middleware has a real,
 * testable consumer.
 */
import { asyncHandler } from "../utils/asyncHandler.js";

export const adminPing = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome, admin.",
    data: { role: req.user.role, userId: String(req.user._id) },
  });
});
