/**
 * Badge helpers for support-message status + category rendering.
 * Constants live in utils.js so this file is component-only (fast-refresh safe).
 */
import { Badge } from "./ui";
import { STATUS_TONE_MSG, CATEGORY_TONE_MSG } from "./utils";

export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE_MSG[status] || "slate"} dot>{status || "new"}</Badge>;
}

export function CategoryBadge({ category }) {
  return <Badge tone={CATEGORY_TONE_MSG[category] || "slate"}>{category || "other"}</Badge>;
}