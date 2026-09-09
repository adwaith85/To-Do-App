const LIST_PREFIX = "• ";

export function isListLine(line) {
  return typeof line === "string" && line.startsWith(LIST_PREFIX);
}

export function toListLine(text) {
  return `${LIST_PREFIX}${text}`;
}

export function fromListLine(line) {
  return isListLine(line) ? line.slice(LIST_PREFIX.length) : line;
}

export function splitDescription(description) {
  if (!description) return { lists: [], paragraphs: [] };
  const lists = [];
  const paragraphs = [];
  for (const raw of String(description).split("\n")) {
    if (isListLine(raw)) lists.push(fromListLine(raw));
    else if (raw.trim()) paragraphs.push(raw.trim());
  }
  return { lists, paragraphs };
}