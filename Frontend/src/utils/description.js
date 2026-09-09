const CHECKED_PREFIX = "[x] ";
const UNCHECKED_PREFIX = "[ ] ";
const LEGACY_PREFIX = "• ";

export function isListLine(line) {
  return (
    typeof line === "string" &&
    (line.startsWith(CHECKED_PREFIX) ||
      line.startsWith(UNCHECKED_PREFIX) ||
      line.startsWith(LEGACY_PREFIX))
  );
}

export function isCheckedLine(line) {
  return typeof line === "string" && line.startsWith(CHECKED_PREFIX);
}

export function toListLine(text, checked = false) {
  return (checked ? CHECKED_PREFIX : UNCHECKED_PREFIX) + text;
}

export function fromListLine(line) {
  if (!isListLine(line)) return line;
  for (const prefix of [CHECKED_PREFIX, UNCHECKED_PREFIX, LEGACY_PREFIX]) {
    if (line.startsWith(prefix)) return line.slice(prefix.length);
  }
  return line;
}

export function toggleListLine(line) {
  if (!isListLine(line)) return line;
  return toListLine(fromListLine(line), !isCheckedLine(line));
}

export function toggleItemAt(description, itemIndex) {
  let i = 0;
  return String(description)
    .split("\n")
    .map((line) => {
      if (!isListLine(line)) return line;
      if (i === itemIndex) return toggleListLine(line);
      i += 1;
      return line;
    })
    .join("\n");
}

/**
 * Splits a description into an ordered list of segments, preserving exactly
 * the order the user typed them. Consecutive list lines merge into a single
 * list segment; every other non-blank line becomes its own paragraph segment.
 */
export function splitDescription(description) {
  const segments = [];
  if (!description) return segments;
  for (const raw of String(description).split("\n")) {
    if (isListLine(raw)) {
      const last = segments[segments.length - 1];
      if (last && last.type === "list") {
        last.items.push({ text: fromListLine(raw), checked: isCheckedLine(raw) });
      } else {
        segments.push({
          type: "list",
          items: [{ text: fromListLine(raw), checked: isCheckedLine(raw) }],
        });
      }
    } else if (raw.trim()) {
      segments.push({ type: "paragraph", text: raw.trim() });
    }
  }
  return segments;
}