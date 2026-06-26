"use client";

interface HighlightProps {
  text: string;
  query: string;
  className?: string;
}

export function Highlight({ text, query, className }: HighlightProps) {
  if (!query.trim()) return <span className={className}>{text}</span>;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}
