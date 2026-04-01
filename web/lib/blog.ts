import fs from "fs";
import path from "path";

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
}

const CONTENT_DIR = path.join(process.cwd(), "content");

function parseFrontmatter(raw: string): {
  data: Record<string, string>;
  content: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    data[key] = value;
  }
  return { data, content: match[2] };
}

function isBlogPost(filename: string, raw: string): boolean {
  return raw.startsWith("---") && raw.includes("\ndate:");
}

export function getAllPosts(): BlogPost[] {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  const posts: BlogPost[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf-8");
    if (!isBlogPost(file, raw)) continue;

    const { data, content } = parseFrontmatter(raw);
    const slug = file.replace(/\.md$/, "");
    const plainText = content
      .replace(/```[\s\S]*?```/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`|>\-]/g, "")
      .replace(/\n+/g, " ")
      .trim();

    posts.push({
      slug,
      title: data.title || slug,
      date: data.date || "",
      excerpt: data.excerpt || plainText.slice(0, 200) + "...",
      content,
    });
  }

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  if (!isBlogPost(slug + ".md", raw)) return null;

  const { data, content } = parseFrontmatter(raw);
  const plainText = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`|>\-]/g, "")
    .replace(/\n+/g, " ")
    .trim();

  return {
    slug,
    title: data.title || slug,
    date: data.date || "",
    excerpt: data.excerpt || plainText.slice(0, 200) + "...",
    content,
  };
}
