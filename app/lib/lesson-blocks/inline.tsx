import type { ReactNode } from "react";

type Delimiter = "**" | "==" | "*" | "`";

function escapedAt(text: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function findClosing(text: string, delimiter: string, from: number): number {
  for (let index = from; index <= text.length - delimiter.length; index += 1) {
    if (text.startsWith(delimiter, index) && !escapedAt(text, index)) return index;
  }
  return -1;
}

export function isAllowedInlineHref(href: string): boolean {
  try {
    const parsed = new URL(href);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

function parse(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let plain = "";
  const flush = () => {
    if (plain) nodes.push(plain);
    plain = "";
  };

  for (let index = 0; index < text.length;) {
    if (text[index] === "\\" && index + 1 < text.length && "\\`[]=*".includes(text[index + 1]!)) {
      plain += text[index + 1];
      index += 2;
      continue;
    }
    if (text[index] === "\n") {
      flush();
      nodes.push(<br key={`br-${index}`} />);
      index += 1;
      continue;
    }

    if (text[index] === "[") {
      const labelEnd = findClosing(text, "]", index + 1);
      if (labelEnd !== -1 && text[labelEnd + 1] === "(") {
        const urlEnd = findClosing(text, ")", labelEnd + 2);
        if (urlEnd !== -1) {
          const href = text.slice(labelEnd + 2, urlEnd);
          if (isAllowedInlineHref(href)) {
            flush();
            const label = parse(text.slice(index + 1, labelEnd));
            const isWeb = /^https?:/i.test(href);
            nodes.push(
              <a key={`link-${index}`} href={href} {...(isWeb ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {label}
              </a>,
            );
            index = urlEnd + 1;
            continue;
          }
        }
      }
    }

    const delimiter: Delimiter | undefined = text.startsWith("**", index)
      ? "**"
      : text.startsWith("==", index)
        ? "=="
        : text[index] === "*"
          ? "*"
          : text[index] === "`"
            ? "`"
            : undefined;
    if (delimiter && !escapedAt(text, index)) {
      const close = findClosing(text, delimiter, index + delimiter.length);
      if (close > index + delimiter.length) {
        flush();
        const inside = text.slice(index + delimiter.length, close);
        const content = delimiter === "`" ? inside : parse(inside);
        const key = `inline-${index}`;
        nodes.push(
          delimiter === "*" ? <em key={key}>{content}</em>
            : delimiter === "`" ? <code key={key}>{content}</code>
              : <strong key={key}>{content}</strong>,
        );
        index = close + delimiter.length;
        continue;
      }
    }
    plain += text[index];
    index += 1;
  }

  flush();
  return nodes;
}

export function renderInline(text: string): ReactNode {
  return parse(text);
}
