/**
 * Simple regex-based markdown to HTML converter.
 * No external dependencies. Handles the subset of markdown used in blog posts.
 */
export function markdownToHtml(md: string): string {
  let html = md;

  // Fenced code blocks (``` ... ```)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, lang, code) => {
      const escaped = escapeHtml(code.trimEnd());
      const langAttr = lang ? ` data-lang="${lang}"` : "";
      return `<pre class="code-block"${langAttr}><code>${escaped}</code></pre>`;
    }
  );

  // Tables
  html = html.replace(
    /(?:^|\n)(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/g,
    (_match, headerRow, _separator, bodyRows) => {
      const headers = parseTableRow(headerRow);
      const rows = bodyRows.trim().split("\n").map(parseTableRow);
      const thead = `<thead><tr>${headers.map((h: string) => `<th>${h.trim()}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows.map((row: string[]) => `<tr>${row.map((cell: string) => `<td>${cell.trim()}</td>`).join("")}</tr>`).join("")}</tbody>`;
      return `\n<table class="blog-table">${thead}${tbody}</table>\n`;
    }
  );

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="blog-hr" />');

  // Headings (process after code blocks to avoid matching inside them)
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code (after code blocks)
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="blog-link" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Blockquotes
  html = html.replace(
    /^> (.+)$/gm,
    '<blockquote class="blog-blockquote">$1</blockquote>'
  );
  // Merge adjacent blockquotes
  html = html.replace(
    /<\/blockquote>\n<blockquote class="blog-blockquote">/g,
    "\n"
  );

  // Unordered lists
  html = html.replace(
    /(?:^|\n)((?:[-*] .+\n?)+)/g,
    (_match, block) => {
      const items = block
        .trim()
        .split("\n")
        .map((line: string) => line.replace(/^[-*] /, ""))
        .map((item: string) => `<li>${item}</li>`)
        .join("");
      return `\n<ul class="blog-list">${items}</ul>\n`;
    }
  );

  // Ordered lists
  html = html.replace(
    /(?:^|\n)((?:\d+\. .+\n?)+)/g,
    (_match, block) => {
      const items = block
        .trim()
        .split("\n")
        .map((line: string) => line.replace(/^\d+\. /, ""))
        .map((item: string) => `<li>${item}</li>`)
        .join("");
      return `\n<ol class="blog-list">${items}</ol>\n`;
    }
  );

  // Paragraphs: wrap loose lines that aren't already HTML
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<table") ||
        trimmed.startsWith("<hr")
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n\n");

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseTableRow(row: string): string[] {
  return row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}
