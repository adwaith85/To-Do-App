import { splitDescription } from "../utils/description";

/**
 * Renders a todo `description` string, preserving list structure.
 *
 * Lines that start with `• ` are treated as list items and rendered as
 * diamond-bulleted points; all other non-empty lines are rendered as paragraph
 * text, allowing a todo to mix a list and a continuing paragraph.
 */
export default function RichDescription({ description, light = false, className = "", textClass = "" }) {
  const { lists, paragraphs } = splitDescription(description);
  if (!lists.length && !paragraphs.length) return null;

  return (
    <div className={className}>
      {lists.length > 0 && (
        <ul className="space-y-1">
          {lists.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className={`mt-[6px] inline-block h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1.5px] ${
                  light ? "bg-brand-500" : "bg-brand-400/80"
                }`}
                aria-hidden
              />
              <span className={`min-w-0 flex-1 break-words ${textClass}`}>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {paragraphs.length > 0 && (
        <div className={lists.length > 0 ? "mt-2 space-y-2" : "space-y-2"}>
          {paragraphs.map((p, i) => (
            <p key={i} className={`min-w-0 break-words ${textClass}`}>
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}