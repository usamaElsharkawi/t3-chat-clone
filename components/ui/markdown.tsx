"use client";

import React, { useState } from "react";
import { Clipboard, Check } from "lucide-react";

type Block =
  | { type: "code"; lang: string; code: string }
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "paragraph"; text: string };

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match bold (**text**), inline code (`code`), and markdown links ([text](url))
  const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
  const matches = [...text.matchAll(regex)];

  let lastIndex = 0;
  for (const match of matches) {
    const matchText = match[0];
    const matchIndex = match.index!;

    // Add normal text before match
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    if (matchText.startsWith("**") && matchText.endsWith("**")) {
      parts.push(
        <strong key={matchIndex} className="font-semibold text-foreground">
          {matchText.slice(2, -2)}
        </strong>,
      );
    } else if (matchText.startsWith("`") && matchText.endsWith("`")) {
      parts.push(
        <code
          key={matchIndex}
          className="bg-muted/60 px-1.5 py-0.5 rounded-md font-mono text-[13px] text-primary border border-border/50"
        >
          {matchText.slice(1, -1)}
        </code>,
      );
    } else if (matchText.startsWith("[") && matchText.includes("](")) {
      const closeBracket = matchText.indexOf("]");
      const linkText = matchText.slice(1, closeBracket);
      const url = matchText.slice(closeBracket + 2, -1);
      parts.push(
        <a
          key={matchIndex}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/30 hover:decoration-primary/60 font-medium transition-colors"
        >
          {linkText}
        </a>,
      );
    }

    lastIndex = matchIndex + matchText.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      let code = "";
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code += lines[i] + "\n";
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: "code", lang, code: code.trim() });
      continue;
    }

    // 2. Headings
    if (line.startsWith("# ")) {
      blocks.push({ type: "heading", level: 1, text: line.slice(2).trim() });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "heading", level: 2, text: line.slice(3).trim() });
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ type: "heading", level: 3, text: line.slice(4).trim() });
      i++;
      continue;
    }

    // 3. Tables (check if line contains pipes and next line is separator)
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1].match(/^\|?[\s:-]+\|/)) {
      // Parse header
      const headers = line
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell !== "");
      
      i++; // skip header line
      i++; // skip separator line (---|---|---)
      
      // Parse rows
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const cells = lines[i]
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell !== "");
        if (cells.length > 0) {
          rows.push(cells);
        }
        i++;
      }
      
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    // 4. Lists (unordered)
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))
      ) {
        const itemLine = lines[i].trim();
        items.push(itemLine.slice(2).trim());
        i++;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    // 5. Lists (ordered)
    const matchNumbered = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (matchNumbered) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^(\d+)\.\s+(.*)/)) {
        const itemMatch = lines[i].trim().match(/^(\d+)\.\s+(.*)/);
        if (itemMatch) {
          items.push(itemMatch[2].trim());
        }
        i++;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    // 6. Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 7. Paragraph
    let paragraphText = line;
    i++;
    // Combine consecutive non-empty non-special lines
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].startsWith("# ") &&
      !lines[i].startsWith("## ") &&
      !lines[i].startsWith("### ") &&
      !lines[i].trim().startsWith("- ") &&
      !lines[i].trim().startsWith("* ") &&
      !lines[i].trim().match(/^(\d+)\.\s+(.*)/)
    ) {
      paragraphText += "\n" + lines[i];
      i++;
    }
    blocks.push({ type: "paragraph", text: paragraphText });
  }

  return blocks;
}

// Simple syntax highlighting using regex patterns
function highlightCode(code: string, lang: string): React.ReactNode[] {
  const lines = code.split("\n");
  
  // Tokenize each line
  return lines.map((line, lineIdx) => {
    let remaining = line;
    const tokens: React.ReactNode[] = [];
    let keyIdx = 0;
    
    // Process the line with multiple patterns
    while (remaining.length > 0) {
      let matched = false;
      
      // 1. Multi-line comments /* */ (greedy, so check first)
      const multiLineCommentMatch = remaining.match(/^\/\*[\s\S]*?\*\//);
      if (multiLineCommentMatch) {
        tokens.push(
          <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-comment)' }} className="italic">
            {multiLineCommentMatch[0]}
          </span>
        );
        remaining = remaining.slice(multiLineCommentMatch[0].length);
        matched = true;
        continue;
      }
      
      // 2. Single-line comments // (must be at start or after whitespace)
      const singleLineCommentMatch = remaining.match(/^(\s*)\/\/.*/);
      if (singleLineCommentMatch) {
        tokens.push(
          <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-comment)' }} className="italic">
            {singleLineCommentMatch[0]}
          </span>
        );
        remaining = "";
        matched = true;
        continue;
      }
      
      // 3. Multi-line strings (template literals)
      const templateLiteralMatch = remaining.match(/^(`(?:[^`\\]|\\.)*`)/);
      if (templateLiteralMatch) {
        tokens.push(
          <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-string)' }}>
            {templateLiteralMatch[0]}
          </span>
        );
        remaining = remaining.slice(templateLiteralMatch[0].length);
        matched = true;
        continue;
      }
      
      // 4. Double-quoted strings
      const doubleStringMatch = remaining.match(/^("(?:[^"\\]|\\.)*")/);
      if (doubleStringMatch) {
        tokens.push(
          <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-string)' }}>
            {doubleStringMatch[0]}
          </span>
        );
        remaining = remaining.slice(doubleStringMatch[0].length);
        matched = true;
        continue;
      }
      
      // 5. Single-quoted strings
      const singleStringMatch = remaining.match(/^('(?:[^'\\]|\\.)*')/);
      if (singleStringMatch) {
        tokens.push(
          <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-string)' }}>
            {singleStringMatch[0]}
          </span>
        );
        remaining = remaining.slice(singleStringMatch[0].length);
        matched = true;
        continue;
      }
      
      // 6. TypeScript/JavaScript keywords
      const keywords = [
        'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
        'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally',
        'throw', 'new', 'class', 'extends', 'implements', 'interface', 'type',
        'async', 'await', 'import', 'export', 'from', 'default', 'static', 'public',
        'private', 'protected', 'readonly', 'abstract', 'enum', 'typeof', 'instanceof',
        'null', 'undefined', 'true', 'false', 'this', 'super', 'in', 'of', 'void',
        'delete', 'yield', 'get', 'set', 'as', 'is', 'namespace', 'module', 'declare'
      ];
      const keywordPattern = new RegExp(`^(${keywords.join('|')})\\b`);
      const keywordMatch = remaining.match(keywordPattern);
      if (keywordMatch) {
        tokens.push(
          <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-keyword)' }} className="font-medium">
            {keywordMatch[0]}
          </span>
        );
        remaining = remaining.slice(keywordMatch[0].length);
        matched = true;
        continue;
      }
      
      // 7. Numbers
      const numberMatch = remaining.match(/^(\d+\.?\d*)/);
      if (numberMatch) {
        tokens.push(
          <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-number)' }}>
            {numberMatch[0]}
          </span>
        );
        remaining = remaining.slice(numberMatch[0].length);
        matched = true;
        continue;
      }
      
      // 8. Function calls (word followed by parenthesis)
      const functionMatch = remaining.match(/^([a-zA-Z_]\w*)\s*(?=\()/);
      if (functionMatch) {
        tokens.push(
          <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-function)' }}>
            {functionMatch[1]}
          </span>
        );
        // Keep the parenthesis
        if (functionMatch[0].length > functionMatch[1].length) {
          remaining = remaining.slice(functionMatch[1].length);
        } else {
          remaining = remaining.slice(functionMatch[0].length);
        }
        matched = true;
        continue;
      }
      
      // 9. TypeScript types (PascalCase)
      const typeMatch = remaining.match(/^([A-Z][a-zA-Z0-9]*)/);
      if (typeMatch && (lang === 'typescript' || lang === 'ts' || lang === 'tsx')) {
        tokens.push(
          <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-type)' }}>
            {typeMatch[0]}
          </span>
        );
        remaining = remaining.slice(typeMatch[0].length);
        matched = true;
        continue;
      }
      
      // 10. CSS properties/values (for CSS-like languages)
      if (lang === 'css' || lang === 'scss' || lang === 'tailwind') {
        // CSS properties
        const cssPropMatch = remaining.match(/^([a-z-]+)(?=\s*:)/);
        if (cssPropMatch) {
          tokens.push(
            <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-function)' }}>
              {cssPropMatch[0]}
            </span>
          );
          remaining = remaining.slice(cssPropMatch[0].length);
          matched = true;
          continue;
        }
        
        // CSS values/colors (hex)
        const hexColorMatch = remaining.match(/^(#[0-9a-fA-F]{3,8})\b/);
        if (hexColorMatch) {
          tokens.push(
            <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-string)' }}>
              {hexColorMatch[0]}
            </span>
          );
          remaining = remaining.slice(hexColorMatch[0].length);
          matched = true;
          continue;
        }
      }
      
      // 11. HTML/JSX tags
      const htmlTagMatch = remaining.match(/^(<\/?[a-zA-Z][a-zA-Z0-9-]*)/);
      if (htmlTagMatch) {
        tokens.push(
          <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-keyword)' }}>
            {htmlTagMatch[0]}
          </span>
        );
        remaining = remaining.slice(htmlTagMatch[0].length);
        matched = true;
        continue;
      }
      
      // 12. HTML/JSX attributes
      const htmlAttrMatch = remaining.match(/^(\s+)([a-zA-Z-]+)(?=\s|=)/);
      if (htmlAttrMatch && htmlAttrMatch[2]) {
        tokens.push(
          <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-function)' }}>
            {htmlAttrMatch[1]}{htmlAttrMatch[2]}
          </span>
        );
        remaining = remaining.slice(htmlAttrMatch[0].length);
        matched = true;
        continue;
      }
      
      // No match - take one character
      if (!matched) {
        tokens.push(
          <span key={`${lineIdx}-${keyIdx++}`} style={{ color: 'var(--syntax-plain)' }}>
            {remaining[0]}
          </span>
        );
        remaining = remaining.slice(1);
      }
    }
    
    // Add line break (except for last line if empty)
    const showBreak = lineIdx < lines.length - 1 || line.trim() === "";
    
    return (
      <span key={lineIdx}>
        {tokens}
        {showBreak && "\n"}
      </span>
    );
  });
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Apply syntax highlighting
  const highlightedCode = highlightCode(code, lang);

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/50 shadow-lg group/code" style={{ backgroundColor: 'var(--code-bg)' }}>
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5 backdrop-blur-sm" style={{ backgroundColor: 'var(--code-header-bg)' }}>
        <div className="flex items-center gap-3">
          {/* Colored dots to represent language */}
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80"></span>
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80"></span>
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/80"></span>
          </div>
          <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
            {lang || "plaintext"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                     text-muted-foreground hover:text-foreground hover:bg-muted/50 
                     transition-all duration-200 cursor-pointer active:scale-95"
          aria-label={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <Clipboard className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed scrollbar-thin">
        <code className="block">{highlightedCode}</code>
      </pre>
    </div>
  );
}

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-border/50 shadow-sm">
      <table className="w-full border-collapse bg-card text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {headers.map((header, idx) => (
              <th
                key={idx}
                className="px-4 py-3 text-left font-semibold text-foreground border-r border-border/50 last:border-r-0"
              >
                {parseInline(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b border-border/30 last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className="px-4 py-3 border-r border-border/30 last:border-r-0 align-top"
                >
                  {parseInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="prose prose-sm max-w-none text-foreground/90 w-full">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "code":
            return <CodeBlock key={idx} lang={block.lang} code={block.code} />;

          case "table":
            return <TableBlock key={idx} headers={block.headers} rows={block.rows} />;

          case "heading": {
            const Tag = `h${block.level}` as keyof React.JSX.IntrinsicElements;
            const sizeClass =
              block.level === 1
                ? "text-2xl font-bold mt-8 mb-4 text-foreground border-b border-border/50 pb-2"
                : block.level === 2
                ? "text-xl font-semibold mt-6 mb-3 text-foreground"
                : "text-lg font-semibold mt-5 mb-2.5 text-foreground";
            return (
              <Tag key={idx} className={sizeClass}>
                {parseInline(block.text)}
              </Tag>
            );
          }

          case "list": {
            const ListTag = block.ordered ? "ol" : "ul";
            const listClass = block.ordered
              ? "list-decimal pl-6 space-y-2 my-4 marker:text-muted-foreground marker:font-medium"
              : "list-disc pl-6 space-y-2 my-4 marker:text-primary/60";
            return (
              <ListTag key={idx} className={listClass}>
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed pl-1 text-foreground/90">
                    {parseInline(item)}
                  </li>
                ))}
              </ListTag>
            );
          }

          case "paragraph":
          default:
            return (
              <p key={idx} className="leading-[1.7] my-3 text-foreground/90 whitespace-pre-line">
                {parseInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
